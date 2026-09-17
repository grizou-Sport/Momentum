/* =========================================================
   MOMENTUM — HOME IMPORT v1.1
   ---------------------------------------------------------
   Lecture locale et téléversement des fichiers GPX / FIT.
   ========================================================= */

const ACTIVITY_BUCKET = "activities";

function haversineKm(pointA, pointB) {
  const radius = 6371;
  const toRad = (value) => value * Math.PI / 180;

  const dLat = toRad(pointB.lat - pointA.lat);
  const dLon = toRad(pointB.lon - pointA.lon);

  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeDistance(points) {
  return points.reduce((total, point, index) => {
    if (index === 0) return 0;

    return total + haversineKm(
      points[index - 1],
      point
    );
  }, 0);
}

function routeDurationMinutes(points) {
  const first = points.find((point) => point.time);
  const last = [...points].reverse().find((point) => point.time);

  if (!first?.time || !last?.time) return 0;

  const duration = new Date(last.time) - new Date(first.time);

  return duration > 0
    ? duration / 60000
    : 0;
}

function validActivityTimestamp(value) {
  if (!value) return null;

  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
}

function activityLocalDateTime(value) {
  const date = validActivityTimestamp(value);
  if (!date) return null;

  const pad = (part) => String(part).padStart(2, "0");

  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
}

function routeCenter(route) {
  const points = route?.points || [];

  if (!points.length) return null;

  const middle = points[Math.floor(points.length / 2)];

  return {
    latitude: middle.lat,
    longitude: middle.lon
  };
}

function simplifyRoutePoints(points, maximumPoints = 350) {
  const validPoints = (points || []).filter((point) =>
    Number.isFinite(Number(point?.lat)) &&
    Number.isFinite(Number(point?.lon))
  );

  if (validPoints.length <= maximumPoints) {
    return validPoints;
  }

  const step = (validPoints.length - 1) / (maximumPoints - 1);

  return Array.from(
    { length: maximumPoints },
    (_, index) => validPoints[Math.round(index * step)]
  );
}

function createRouteSummary(fileName, points, extra = {}) {
  if (!Array.isArray(points) || points.length < 2) return null;

  const mapPoints = simplifyRoutePoints(points).map((point) => [
    Number(Number(point.lat).toFixed(6)),
    Number(Number(point.lon).toFixed(6))
  ]);

  if (mapPoints.length < 2) return null;

  const middle = mapPoints[Math.floor(mapPoints.length / 2)];

  return {
    file_name: fileName,
    point_count: points.length,
    map_points: mapPoints,
    start: mapPoints[0],
    end: mapPoints[mapPoints.length - 1],
    center: {
      latitude: middle[0],
      longitude: middle[1]
    },
    ...extra
  };
}

async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude)
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`, { signal:AbortSignal.timeout(5000) }
  );

  if (!response.ok) {
    throw new Error(`Géocodage indisponible (${response.status})`);
  }

  const data = await response.json();
  const address = data.address || {};

  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    data.name ||
    "Lieu du moment"
  );
}

async function parseGpx(file) {
  const text = await file.text();
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("Les entités XML externes ne sont pas acceptées.");
  const xml = new DOMParser().parseFromString(
    text,
    "application/xml"
  );

  if (xml.querySelector("parsererror")) {
    throw new Error("Le fichier GPX est invalide.");
  }

  const points = [...xml.querySelectorAll("trkpt")]
    .map((point) => ({
      lat: point.hasAttribute("lat") ? Number(point.getAttribute("lat")) : NaN,
      lon: point.hasAttribute("lon") ? Number(point.getAttribute("lon")) : NaN,
      ele: point.querySelector("ele") ? Number(point.querySelector("ele").textContent) : null,
      time: point.querySelector("time")?.textContent || null
    }))
    .filter((point) =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180
    );

  if (!points.length) {
    throw new Error(
      "Aucun point de trace trouvé dans le fichier GPX."
    );
  }

  const firstTimedPoint = points.find((point) =>
    validActivityTimestamp(point.time)
  );
  const lastTimedPoint = [...points].reverse().find((point) =>
    validActivityTimestamp(point.time)
  );

  return {
    name: file.name,
    points,
    startTime:
      validActivityTimestamp(firstTimedPoint?.time)?.toISOString() || null,
    endTime:
      validActivityTimestamp(lastTimedPoint?.time)?.toISOString() || null,
    distance: routeDistance(points),
    duration: routeDurationMinutes(points)
  };
}

function secondsToMinutes(value) {
  const seconds = Number(value);

  return Number.isFinite(seconds)
    ? seconds / 60
    : 0;
}

function fitDate(value) {
  if (!value) return "";

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : iso(date);
}

function fitSportLabel(value) {
  const sportIds = {
    1: "running",
    2: "cycling",
    5: "swimming",
    11: "hiking",
    13: "fitness",
    15: "walking"
  };

  return sportIds[Number(value)] || "other";
}

function readFitValue(view, offset, baseType, littleEndian) {
  const type = baseType & 0x1f;

  switch (type) {
    case 0:
      return view.getUint8(offset);

    case 1:
      return view.getInt8(offset);

    case 2:
      return view.getUint8(offset);

    case 3:
      return view.getInt16(offset, littleEndian);

    case 4:
      return view.getUint16(offset, littleEndian);

    case 5:
      return view.getInt32(offset, littleEndian);

    case 6:
      return view.getUint32(offset, littleEndian);

    case 7:
      return null;

    case 8:
      return view.getFloat32(offset, littleEndian);

    case 9:
      return view.getFloat64(offset, littleEndian);

    case 10:
      return view.getUint8(offset);

    case 11:
      return view.getUint16(offset, littleEndian);

    case 12:
      return view.getUint32(offset, littleEndian);

    case 13:
      return view.getUint8(offset);

    case 14:
      return Number(
        view.getBigInt64(offset, littleEndian)
      );

    case 15:
    case 16:
      return Number(
        view.getBigUint64(offset, littleEndian)
      );

    default:
      return null;
  }
}

function fitEpochToDate(seconds) {
  const FIT_EPOCH_MS = Date.UTC(
    1989,
    11,
    31,
    0,
    0,
    0
  );

  return new Date(
    FIT_EPOCH_MS + Number(seconds) * 1000
  );
}

function fitSemicirclesToDegrees(value) {
  const semicircles = Number(value);

  if (
    !Number.isFinite(semicircles) ||
    semicircles === 0x7fffffff
  ) {
    return null;
  }

  return semicircles * 180 / 2147483648;
}

function fitAverage(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : null;
}

function fitHeartRateZones(heartRates, maximumHeartRate) {
  const maxHr = Number(maximumHeartRate) || Math.max(...heartRates, 0);
  if (!heartRates.length || maxHr <= 0) return null;
  const counts = [0, 0, 0, 0, 0];
  heartRates.forEach((heartRate) => {
    const ratio = heartRate / maxHr;
    const index = ratio < .6 ? 0 : ratio < .7 ? 1 : ratio < .8 ? 2 : ratio < .9 ? 3 : 4;
    counts[index] += 1;
  });
  return {
    basis:"observed_max",
    maximum_hr:maxHr,
    distribution_percent:counts.map((count) => Number((count / heartRates.length * 100).toFixed(1)))
  };
}

function fitCardiacDrift(records) {
  const usable = records.filter((record) => Number.isFinite(record.heartRate));
  if (usable.length < 10) return null;
  const midpoint = Math.floor(usable.length / 2);
  const halves = [usable.slice(0, midpoint), usable.slice(midpoint)];
  const summaries = halves.map((half) => {
    const heartRate = fitAverage(half.map((record) => record.heartRate));
    const speed = fitAverage(half.map((record) => record.speed).filter((value) => Number(value) > 0));
    return { heartRate, speed };
  });
  const useEfficiency = summaries.every((summary) => summary.heartRate && summary.speed);
  const first = useEfficiency ? summaries[0].heartRate / summaries[0].speed : summaries[0].heartRate;
  const second = useEfficiency ? summaries[1].heartRate / summaries[1].speed : summaries[1].heartRate;
  if (!first || !second) return null;
  return {
    percent:Number(((second - first) / first * 100).toFixed(1)),
    method:useEfficiency ? "heart_rate_to_speed_ratio" : "heart_rate_change"
  };
}

function summarizeFitAnalysis(records, session) {
  const heartRates = records.map((record) => record.heartRate).filter(Number.isFinite);
  const temperatures = records.map((record) => record.temperature).filter(Number.isFinite);
  const altitudes = records.map((record) => record.altitude).filter(Number.isFinite);
  return {
    version:1,
    samples:records.length,
    heart_rate:{
      average:session.avgHeartRate ?? (fitAverage(heartRates) == null ? null : Math.round(fitAverage(heartRates))),
      maximum:session.maxHeartRate ?? (heartRates.length ? Math.max(...heartRates) : null),
      zones:fitHeartRateZones(heartRates, session.maxHeartRate),
      drift:fitCardiacDrift(records)
    },
    speed_mps:{
      average:session.avgSpeed ?? fitAverage(records.map((record) => record.speed)),
      maximum:session.maxSpeed ?? (records.some((record) => Number.isFinite(record.speed)) ? Math.max(...records.map((record) => record.speed).filter(Number.isFinite)) : null)
    },
    power_watts:{
      average:session.avgPower ?? fitAverage(records.map((record) => record.power)),
      normalized:session.normalizedPower ?? null,
      maximum:session.maxPower ?? null
    },
    cadence_rpm:{
      average:session.avgCadence ?? fitAverage(records.map((record) => record.cadence)),
      maximum:session.maxCadence ?? null
    },
    temperature_celsius:{
      average:session.avgTemperature ?? fitAverage(temperatures),
      maximum:session.maxTemperature ?? (temperatures.length ? Math.max(...temperatures) : null)
    },
    altitude_meters:{
      minimum:altitudes.length ? Math.min(...altitudes) : null,
      maximum:altitudes.length ? Math.max(...altitudes) : null,
      ascent:session.totalAscent ?? null,
      descent:session.totalDescent ?? null
    },
    training:{
      training_effect:session.trainingEffect ?? null,
      training_stress_score:session.trainingStressScore ?? null,
      intensity_factor:session.intensityFactor ?? null
    }
  };
}

async function parseFit(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  if (buffer.byteLength < 12) {
    throw new Error("Le fichier FIT est invalide.");
  }

  const headerSize = view.getUint8(0);
  const dataSize = view.getUint32(4, true);
  const dataEnd = Math.min(
    headerSize + dataSize,
    buffer.byteLength
  );

  if (headerSize < 12 || dataEnd <= headerSize) {
    throw new Error("Le fichier FIT est invalide.");
  }

  const definitions = new Map();
  let processedMessages = 0;

  let offset = headerSize;
  let session = null;
  const fitPoints = [];
  const fitRecords = [];
  const fitLaps = [];
  const fitEvents = [];
  let lastFitTimestamp = null;

  while (offset < dataEnd) {
    if (++processedMessages % 1024 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    const header = view.getUint8(offset);
    offset += 1;

    const compressedTimestamp =
      (header & 0x80) !== 0;

    const definitionMessage =
      !compressedTimestamp &&
      (header & 0x40) !== 0;

    const developerData =
      !compressedTimestamp &&
      (header & 0x20) !== 0;

    const localMessageType =
      compressedTimestamp
        ? ((header >> 5) & 0x03)
        : (header & 0x0f);

    if (definitionMessage) {
      if (offset + 5 > dataEnd) {
        throw new Error("La définition FIT est incomplète.");
      }

      offset += 1;

      const architecture = view.getUint8(offset);
      offset += 1;

      const littleEndian = architecture === 0;

      const globalMessageNumber =
        view.getUint16(offset, littleEndian);

      offset += 2;

      const fieldCount = view.getUint8(offset);
      offset += 1;

      const fields = [];

      if (offset + fieldCount * 3 > dataEnd) {
        throw new Error("Les champs FIT sont incomplets.");
      }

      for (let index = 0; index < fieldCount; index += 1) {
        fields.push({
          number: view.getUint8(offset),
          size: view.getUint8(offset + 1),
          baseType: view.getUint8(offset + 2)
        });

        offset += 3;
      }

      const developerFields = [];

      if (developerData) {
        if (offset >= dataEnd) {
          throw new Error("Les champs développeur FIT sont incomplets.");
        }

        const developerFieldCount =
          view.getUint8(offset);

        offset += 1;

        if (offset + developerFieldCount * 3 > dataEnd) {
          throw new Error("Les champs développeur FIT sont incomplets.");
        }

        for (let index = 0; index < developerFieldCount; index += 1) {
          developerFields.push({
            number: view.getUint8(offset),
            size: view.getUint8(offset + 1),
            developerDataIndex: view.getUint8(offset + 2)
          });

          offset += 3;
        }
      }

      definitions.set(localMessageType, {
        globalMessageNumber,
        littleEndian,
        fields,
        developerFields
      });

      continue;
    }

    const definition =
      definitions.get(localMessageType);

    if (!definition) {
      throw new Error(
        "Structure FIT non reconnue."
      );
    }

    const values = {};

    for (const field of definition.fields) {
      if (offset + field.size > dataEnd) {
        throw new Error(
          "Le fichier FIT est incomplet."
        );
      }

      if (
        field.size === 1 ||
        field.size === 2 ||
        field.size === 4 ||
        field.size === 8
      ) {
        values[field.number] = readFitValue(
          view,
          offset,
          field.baseType,
          definition.littleEndian
        );
      }

      offset += field.size;
    }

    // Les valeurs des champs développeur suivent les champs standards
    // dans chaque message de données. Elles ne sont pas encore utilisées
    // par MOMENTUM, mais doivent être parcourues pour conserver l'alignement
    // du flux binaire et reconnaître la définition du message suivant.
    for (const field of definition.developerFields || []) {
      if (offset + field.size > dataEnd) {
        throw new Error(
          "Les données développeur FIT sont incomplètes."
        );
      }

      offset += field.size;
    }

    // Un en-tete compresse remplace le champ timestamp par un offset
    // de cinq bits relatif au dernier timestamp FIT rencontre.
    if (compressedTimestamp && lastFitTimestamp != null) {
      const timeOffset = header & 0x1f;
      const previousOffset = lastFitTimestamp & 0x1f;
      values[253] = (lastFitTimestamp & ~0x1f) + timeOffset;
      if (timeOffset < previousOffset) values[253] += 0x20;
    }
    if (values[253] != null) lastFitTimestamp = Number(values[253]);

    // Message global 18 = session
    if (definition.globalMessageNumber === 18) {
      session = {
        startTime:
          values[2] != null
            ? fitEpochToDate(values[2])
            : null,

        endTime:
          values[253] != null
            ? fitEpochToDate(values[253])
            : null,

        sport: values[5],
        subSport: values[6],

        totalElapsedSeconds:
          values[7] != null
            ? values[7] / 1000
            : 0,

        totalTimerSeconds:
          values[8] != null
            ? values[8] / 1000
            : 0,

        totalDistanceKm:
          values[9] != null
            ? values[9] / 100000
            : 0,

        avgHeartRate:
          values[16] ?? null,

        maxHeartRate:
          values[17] ?? null,

        avgSpeed:
          values[14] != null ? values[14] / 1000 : null,

        maxSpeed:
          values[15] != null ? values[15] / 1000 : null,

        avgCadence:values[18] ?? null,
        maxCadence:values[19] ?? null,
        avgPower:values[20] ?? null,
        maxPower:values[21] ?? null,

        totalAscent:
          values[22] ?? null,

        totalDescent:values[23] ?? null,
        trainingEffect:values[24] != null ? values[24] / 10 : null,
        normalizedPower:values[34] ?? null,
        trainingStressScore:values[35] != null ? values[35] / 10 : null,
        intensityFactor:values[36] != null ? values[36] / 1000 : null,
        avgTemperature:values[57] ?? null,
        maxTemperature:values[58] ?? null
      };
    }

    // Message global 19 = lap. Le timestamp du message correspond a
    // la fin du tour ; le debut est conserve dans le champ start_time.
    if (definition.globalMessageNumber === 19) {
      fitLaps.push({
        number:fitLaps.length + 1,
        startTime:values[2] != null ? fitEpochToDate(values[2]).toISOString() : null,
        endTime:values[253] != null ? fitEpochToDate(values[253]).toISOString() : null,
        totalElapsedSeconds:values[7] != null ? values[7] / 1000 : null,
        totalTimerSeconds:values[8] != null ? values[8] / 1000 : null,
        distanceMeters:values[9] != null ? values[9] / 100 : null
      });
    }

    // Message global 21 = event. Les evenements timer sont la source
    // objective des pauses et reprises ; les autres restent generiques.
    if (definition.globalMessageNumber === 21) {
      fitEvents.push({
        timestamp:values[253] != null ? fitEpochToDate(values[253]).toISOString() : null,
        event:values[0] ?? null,
        eventType:values[1] ?? null,
        data:values[3] ?? values[2] ?? null,
        eventGroup:values[4] ?? null
      });
    }

    // Message global 20 = record. Les positions sont exprimées
    // en semicircles dans les champs 0 (latitude) et 1 (longitude).
    if (definition.globalMessageNumber === 20) {
      const latitude = fitSemicirclesToDegrees(values[0]);
      const longitude = fitSemicirclesToDegrees(values[1]);
      const enhancedAltitude = values[78] != null ? values[78] / 5 - 500 : null;
      const altitude = enhancedAltitude ?? (values[2] != null ? values[2] / 5 - 500 : null);
      const enhancedSpeed = values[73] != null ? values[73] / 1000 : null;
      const speed = enhancedSpeed ?? (values[6] != null ? values[6] / 1000 : null);

      fitRecords.push({
        timestamp:values[253] != null ? fitEpochToDate(values[253]).toISOString() : null,
        positionValid:
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          latitude >= -90 && latitude <= 90 &&
          longitude >= -180 && longitude <= 180,
        heartRate:values[3] ?? null,
        cadence:values[4] ?? null,
        distance:values[5] != null ? values[5] / 100 : null,
        speed,
        power:values[7] ?? null,
        temperature:values[13] ?? null,
        altitude
      });

      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 && latitude <= 90 &&
        longitude >= -180 && longitude <= 180
      ) {
        fitPoints.push({
          lat: latitude,
          lon: longitude
        });
      }
    }
  }

  if (!session) {
    throw new Error(
      "Aucune séance n'a été trouvée dans ce fichier FIT."
    );
  }

  const fitAnalysis = summarizeFitAnalysis(fitRecords, session);
  const firstRecordTime = fitRecords.find((record) =>
    validActivityTimestamp(record.timestamp)
  )?.timestamp || null;
  const startTime = session.startTime?.toISOString?.() || firstRecordTime;
  const lastRecordTime = [...fitRecords].reverse().find((record) => record.timestamp)?.timestamp || null;
  const endTime = session.endTime?.toISOString?.() || lastRecordTime || (
    session.startTime && session.totalElapsedSeconds
      ? new Date(session.startTime.getTime() + session.totalElapsedSeconds * 1000).toISOString()
      : null
  );
  const timeline = window.MomentumTimeline?.build({
    startTime,
    endTime,
    totalElapsedSeconds:session.totalElapsedSeconds,
    records:fitRecords,
    laps:fitLaps,
    fitEvents
  }) || null;
  const routeSummary = createRouteSummary(file.name, fitPoints, { fit_analysis:fitAnalysis }) || {
    file_name:file.name,
    point_count:0,
    map_points:[],
    fit_analysis:fitAnalysis
  };

  let locationName = "";

  if (routeSummary?.center) {
    try {
      locationName = await reverseGeocode(
        routeSummary.center.latitude,
        routeSummary.center.longitude
      );
    } catch (error) {
      console.warn(
        "HOME : lieu FIT non résolu.",
        error
      );
    }
  }

  return {
    date:
      fitDate(startTime) || null,

    sport:
      fitSportLabel(session.sport),

    type:
      file.name.replace(/\.fit$/i, ""),

    distance:
      Number(
        session.totalDistanceKm.toFixed(2)
      ),

    duration:
      secondsToMinutes(session.totalTimerSeconds || session.totalElapsedSeconds),

    elevation:
      session.totalAscent || "",

    avgHr:
      session.avgHeartRate || "",

    startedAt:startTime,
    endedAt:endTime,
    totalDurationSeconds:session.totalElapsedSeconds || null,
    timerDurationSeconds:session.totalTimerSeconds || null,
    movingTimeSeconds:null, // No actual moving time is supplied by this supported FIT field.
    actualMovingSeconds:null,
    pausedTimeSeconds:Math.max(0, (session.totalElapsedSeconds || 0) - (session.totalTimerSeconds || 0)),
    distanceMeters:session.totalDistanceKm ? session.totalDistanceKm * 1000 : null,
    totalAscentMeters:session.totalAscent ?? null,
    averageHeartRateBpm:session.avgHeartRate ?? null,

    locationName,

    routeSummary,
    timeline
  };
}

async function parseActivityFile(file) {
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase();

  if (extension === "gpx") {
    const route = await parseGpx(file);
    const center = routeCenter(route);
    const timeline = window.MomentumTimeline?.build({
      source:"gpx",
      startTime:route.startTime,
      endTime:route.endTime,
      records:route.points.map((point) => ({
        timestamp:point.time,
        positionValid:true
      }))
    }) || null;

    let locationName = "";

    if (center) {
      try {
        locationName = await reverseGeocode(
          center.latitude,
          center.longitude
        );
      } catch (error) {
        console.warn(
          "HOME : lieu GPX non résolu.",
          error
        );
      }
    }

    return {
      sourceFileType: "gpx",

      date:
        route.startTime
          ? iso(new Date(route.startTime))
          : null,

      sport: null, // A GPX trace alone does not identify a discipline.

      type:
        file.name.replace(/\.gpx$/i, ""),

      distance:
        Number(route.distance.toFixed(2)),

      duration:
        route.duration || null,

      elevation: "",
      avgHr: "",
      startedAt:route.startTime,
      endedAt:route.endTime,
      totalDurationSeconds:route.duration ? route.duration * 60 : null,
      movingTimeSeconds:null,
      pausedTimeSeconds:null,
      distanceMeters:route.distance ? route.distance * 1000 : null,
      totalAscentMeters:null,
      averageHeartRateBpm:null,
      locationName,

      routeSummary: createRouteSummary(
        file.name,
        route.points,
        {
          start_time: route.startTime,
          end_time: route.endTime
        }
      ),
      timeline
    };
  }

  if (extension === "fit") {
    return {
      ...(await parseFit(file)),
      sourceFileType: "fit"
    };
  }

  throw new Error(
    "Format non pris en charge. Choisis un fichier .FIT ou .GPX."
  );
}

function activityFileExtension(file) {
  return (
    file?.name
      ?.split(".")
      .pop()
      ?.toLowerCase() || ""
  );
}

function sanitizeActivityFileName(fileName) {
  const extension =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase() || "";

  const baseName = fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${baseName || "activite"}.${extension}`;
}

function createActivityStoragePath(
  userId,
  activityDate,
  file
) {
  const date =
    activityDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(activityDate)
      ? new Date(`${activityDate}T12:00:00`)
      : new Date();

  const year = String(date.getFullYear());
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const uniqueId =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

  const safeName =
    sanitizeActivityFileName(file.name);

  return `${userId}/${year}/${month}/${uniqueId}-${safeName}`;
}

async function uploadActivityFile(
  file,
  userId,
  activityDate
) {
  if (!file) return null;

  const extension =
    activityFileExtension(file);

  if (!["fit", "gpx"].includes(extension)) {
    throw new Error(
      "Seuls les fichiers FIT et GPX peuvent être téléversés."
    );
  }

  const {path} = await window.MomentumUploads.upload(file,{bucket:ACTIVITY_BUCKET});

  return {
    path,
    type: extension
  };
}

async function removeUploadedActivityFile(path) {
  if (!path) return;
  const { error } = await window.momentumDB.rpc("discard_uploaded_file", {p_bucket:ACTIVITY_BUCKET,p_path:path});
  if (error) throw new Error("Le nettoyage du fichier n’est pas encore confirmé. Les fichiers sans activité sont vérifiés automatiquement après 24 heures.");
}

async function handleActivityFile(event) {
  const input = event.target, file = input.files?.[0], form = $("#activityForm");
  if (!file || !form) return;
  if (form._pendingCommand) { input.value=""; setActivityMessage("Termine d’abord la reprise de la sauvegarde en attente.",true); return; }
  const formVersion=form.dataset.formVersion, importVersion=crypto.randomUUID();
  form.dataset.importVersion=importVersion;
  const current = () => form.dataset.formVersion === formVersion && form.dataset.importVersion === importVersion;
  const importButton=$("#saveActivityButton");
  if (importButton) importButton.disabled=true;
  try {
    if (form.dataset.dirty === "true" || form.dataset.sourceHash || form.dataset.editActivityId) {
      const replace = await window.MomentumUI.confirm({title:"Remplacer les mesures du formulaire ?",message:"La date, la nature, les mesures et la trace reconnues dans le fichier pourront remplacer les valeurs affichées. Ton effort, ton ressenti, tes photos et ton souvenir ne sont pas remplacés.",confirmLabel:"Lire et comparer",cancelLabel:"Garder ma saisie"});
      if (!replace || !current()) { input.value=""; return; }
    }
    setActivityMessage("Lecture et vérification du fichier…");
    if (file.size > window.MomentumImportRules.MAX_BYTES) throw new Error("Le fichier dépasse la limite de 20 Mo.");
    const buffer=await file.arrayBuffer(), bytes=new Uint8Array(buffer);
    window.MomentumImportRules.validateHeader(file.name,bytes);
    const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",buffer))].map(value=>value.toString(16).padStart(2,"0")).join("");
    const user=await getCurrentUser();
    if (!user) throw new Error("Reconnecte-toi avant d’enregistrer cet import.");
    const existing=await window.momentumDB.from("activities").select("id,activity_date,activity_type").eq("user_id",user.id).eq("source_hash",hash).maybeSingle();
    if (existing.error) throw new Error("Impossible de vérifier les doublons pour le moment. Réessaie sans enregistrer le fichier.");
    if (!current()) return;
    if (existing.data && existing.data.id !== form.dataset.editActivityId) {
      input.value="";
      const open=await window.MomentumUI.confirm({title:"Ce fichier est déjà enregistré",message:`Moment du ${existing.data.activity_date || "jour non précisé"}. Aucune nouvelle activité ne sera créée.`,confirmLabel:"Ouvrir l’activité existante",cancelLabel:"Revenir au formulaire"});
      if (open && current()) { form.dataset.dirty="false"; await closeActivityDialog(true); await openEditActivityById(existing.data.id); }
      return;
    }
    setActivityMessage("Analyse des données…");
    const parsed=await parseActivityFile(file);
    if (!current()) return;
    const proposedTime=activityLocalDateTime(parsed.startedAt);
    const history=await window.MomentumData.history(user.id);
    if (!current()) return;
    const candidates=window.MomentumImportRules.candidates({id:form.dataset.editActivityId,sport:parsed.sport,activity_date:parsed.date || form.elements.activity_date.value,activity_time:proposedTime?.time,duration_min:parsed.duration,distance_km:parsed.distance},history.data);
    if (candidates.length && !existing.data) {
      const candidate=candidates[0].activity;
      const separate=await window.MomentumUI.confirm({title:"Une activité ressemble à cet import",message:`Import : ${parsed.date || "date absente"}, ${parsed.duration == null ? "durée absente" : Math.round(parsed.duration)+" min"}, ${parsed.distance == null ? "distance absente" : parsed.distance+" km"}.\nDéjà enregistré : ${candidate.activity_date}, ${candidate.activity_time || "heure absente"}, ${candidate.duration_min ?? "—"} min, ${candidate.distance_km ?? "—"} km. Rien n’est fusionné automatiquement.`,confirmLabel:"C’est un autre Moment",cancelLabel:"Ouvrir l’existant"});
      if (!current()) return;
      if (!separate) { input.value=""; form.dataset.dirty="false"; await closeActivityDialog(true); await openEditActivityById(candidate.id); return; }
    }
    fillActivityForm(parsed);
    form.dataset.sourceHash=hash; form.dataset.dirty="true"; delete form.dataset.timelineSaved;
    const missing=[!parsed.startedAt ? "date/heure source absente" : null,!parsed.duration ? "durée non renseignée" : null,!parsed.sport ? "nature à choisir" : null].filter(Boolean);
    setActivityMessage(`Fichier analysé. Vérifie les valeurs reconnues avant d’enregistrer.${missing.length ? " Informations à compléter : "+missing.join(" ; ")+"." : ""}`);
    window.MomentumMomentForm?.syncNature(form);
  } catch (error) {
    if (!current()) return;
    input.value="";
    setActivityMessage(error?.message || "Impossible d’analyser ce fichier. Réessaie avec un fichier FIT ou GPX valide.",true);
  } finally {
    if (current() && importButton) importButton.disabled=false;
  }
}
