/* =========================================================
   MOMENTUM — ACTIVITY TIMELINE v1.0
   ---------------------------------------------------------
   Chronologie factuelle d'une activite. Ce module ne produit
   ni segmentation de terrain, ni interpretation physiologique.
   ========================================================= */

(function activityTimelineModule(global) {
  const VERSION = 1;
  const TIMER_EVENT = 0;
  const TIMER_START_TYPES = new Set([0]);
  const TIMER_STOP_TYPES = new Set([1, 4, 8, 9]);

  const FIT_EVENT_NAMES = {
    0:"timer",
    3:"workout",
    8:"power_down",
    9:"power_up",
    10:"off_course",
    11:"session",
    12:"lap",
    13:"course_point",
    21:"activity",
    26:"user_marker",
    27:"sport_point",
    42:"front_gear_change",
    43:"rear_gear_change",
    44:"rider_position_change"
  };

  const FIT_EVENT_TYPE_NAMES = {
    0:"start",
    1:"stop",
    2:"consecutive",
    3:"marker",
    4:"stop_all",
    5:"begin",
    6:"end",
    7:"end_all",
    8:"stop_disable",
    9:"stop_disable_all"
  };

  const EVENT_ORDER = {
    start:0,
    resume:10,
    gps_recovered:20,
    lap:30,
    fit_event:40,
    gps_lost:50,
    pause:60,
    finish:100
  };

  function timestamp(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function elapsedSeconds(value, startTime) {
    const eventTime = timestamp(value);
    const start = timestamp(startTime);
    if (!eventTime || !start) return 0;
    return Math.max(0, Math.round((new Date(eventTime) - new Date(start)) / 1000));
  }

  function eventAt(eventType, value, metadata = {}) {
    const eventTimestamp = timestamp(value);
    if (!eventTimestamp) return null;
    return {
      timestamp:eventTimestamp,
      event_type:eventType,
      metadata:{ ...metadata }
    };
  }

  function timestampCandidates(input) {
    return [
      ...(input.records || []).map((record) => record.timestamp),
      ...(input.laps || []).flatMap((lap) => [lap.startTime, lap.endTime, lap.timestamp]),
      ...(input.fitEvents || []).map((event) => event.timestamp)
    ].map(timestamp).filter(Boolean).sort();
  }

  function buildTimerEvents(fitEvents) {
    let timerPaused = false;
    const events = [];

    [...(fitEvents || [])]
      .filter((item) => Number(item.event) === TIMER_EVENT && timestamp(item.timestamp))
      .sort((a, b) => timestamp(a.timestamp).localeCompare(timestamp(b.timestamp)))
      .forEach((item) => {
        const fitEventType = Number(item.eventType);
        const metadata = {
          source:"fit_event",
          fit_event:"timer",
          fit_event_type:FIT_EVENT_TYPE_NAMES[fitEventType] || fitEventType
        };

        if (TIMER_STOP_TYPES.has(fitEventType) && !timerPaused) {
          events.push(eventAt("pause", item.timestamp, metadata));
          timerPaused = true;
        } else if (TIMER_START_TYPES.has(fitEventType) && timerPaused) {
          events.push(eventAt("resume", item.timestamp, metadata));
          timerPaused = false;
        } else if (!TIMER_START_TYPES.has(fitEventType)) {
          events.push(eventAt("fit_event", item.timestamp, {
            ...metadata,
            data:item.data ?? null,
            event_group:item.eventGroup ?? null
          }));
        }
      });

    return events.filter(Boolean);
  }

  function buildFitEvents(fitEvents) {
    return (fitEvents || [])
      .filter((item) => Number(item.event) !== TIMER_EVENT)
      .map((item) => eventAt("fit_event", item.timestamp, {
        source:"fit_event",
        fit_event:FIT_EVENT_NAMES[Number(item.event)] || Number(item.event),
        fit_event_type:FIT_EVENT_TYPE_NAMES[Number(item.eventType)] || Number(item.eventType),
        data:item.data ?? null,
        event_group:item.eventGroup ?? null
      }))
      .filter(Boolean);
  }

  function buildLapEvents(laps) {
    return (laps || []).map((lap, index) => {
      const lapNumber = Number.isFinite(Number(lap.number)) ? Number(lap.number) : index + 1;
      return eventAt("lap", lap.endTime || lap.timestamp || lap.startTime, {
        source:"fit_lap",
        lap:lapNumber,
        start_timestamp:timestamp(lap.startTime),
        total_elapsed_seconds:Number.isFinite(Number(lap.totalElapsedSeconds))
          ? Number(lap.totalElapsedSeconds)
          : null,
        total_timer_seconds:Number.isFinite(Number(lap.totalTimerSeconds))
          ? Number(lap.totalTimerSeconds)
          : null,
        distance_m:Number.isFinite(Number(lap.distanceMeters))
          ? Number(lap.distanceMeters)
          : null
      });
    }).filter(Boolean);
  }

  function buildGpsEvents(records) {
    const ordered = (records || [])
      .filter((record) => timestamp(record.timestamp))
      .sort((a, b) => timestamp(a.timestamp).localeCompare(timestamp(b.timestamp)));
    const events = [];
    let hasSeenPosition = false;
    let gpsLost = false;

    ordered.forEach((record) => {
      const hasPosition = record.positionValid === true;
      if (hasPosition) {
        if (gpsLost) {
          events.push(eventAt("gps_recovered", record.timestamp, { source:"fit_record" }));
          gpsLost = false;
        }
        hasSeenPosition = true;
      } else if (hasSeenPosition && !gpsLost) {
        events.push(eventAt("gps_lost", record.timestamp, { source:"fit_record" }));
        gpsLost = true;
      }
    });

    return events.filter(Boolean);
  }

  function build(input = {}) {
    const source = String(input.source || "fit");
    const candidates = timestampCandidates(input);
    const startTime = timestamp(input.startTime) || candidates[0] || null;
    let endTime = timestamp(input.endTime) || candidates[candidates.length - 1] || null;

    if (!endTime && startTime && Number.isFinite(Number(input.totalElapsedSeconds))) {
      endTime = new Date(new Date(startTime).getTime() + Number(input.totalElapsedSeconds) * 1000).toISOString();
    }

    if (!startTime || !endTime) {
      return { version:VERSION, source, events:[] };
    }

    const events = [
      eventAt("start", startTime, { source:`${source}_session` }),
      ...buildTimerEvents(input.fitEvents),
      ...buildLapEvents(input.laps),
      ...buildGpsEvents(input.records),
      ...buildFitEvents(input.fitEvents),
      eventAt("finish", endTime, { source:`${source}_session` })
    ].filter(Boolean);

    events.sort((a, b) => {
      const byTime = a.timestamp.localeCompare(b.timestamp);
      if (byTime) return byTime;
      return (EVENT_ORDER[a.event_type] ?? 50) - (EVENT_ORDER[b.event_type] ?? 50);
    });

    return {
      version:VERSION,
      source,
      events:events.map((event, position) => ({
        ...event,
        position,
        elapsed_seconds:elapsedSeconds(event.timestamp, startTime)
      }))
    };
  }

  function rows(activityId, userId, timeline) {
    return (timeline?.events || []).map((event, position) => ({
      activity_id:activityId,
      user_id:userId,
      position,
      timestamp:event.timestamp,
      elapsed_seconds:event.elapsed_seconds,
      event_type:event.event_type,
      metadata:event.metadata || {}
    }));
  }

  async function save(activityId, userId, timeline, client = global.momentumDB) {
    const payload = rows(activityId, userId, timeline);
    if (!client || !payload.length) return;

    const { error } = await client
      .from("activity_timeline")
      .upsert(payload, { onConflict:"activity_id,position" });
    if (error) throw error;

    const { error:cleanupError } = await client
      .from("activity_timeline")
      .delete()
      .eq("activity_id", activityId)
      .gte("position", payload.length);
    if (cleanupError) throw cleanupError;
  }

  async function get(activityId, client = global.momentumDB) {
    const { data, error } = await client
      .from("activity_timeline")
      .select("timestamp,elapsed_seconds,event_type,metadata,position")
      .eq("activity_id", activityId)
      .order("timestamp", { ascending:true })
      .order("position", { ascending:true });
    if (error) throw error;
    return { activity_id:activityId, events:data || [] };
  }

  global.MomentumTimeline = Object.freeze({ VERSION, build, rows, save, get });
})(typeof window !== "undefined" ? window : globalThis);
