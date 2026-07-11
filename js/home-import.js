/* =========================================================
   MOMENTUM — HOME IMPORT v1.0
   ---------------------------------------------------------
   Lecture locale des fichiers GPX et FIT avant validation.
   ========================================================= */

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
    return total + haversineKm(points[index - 1], point);
  }, 0);
}

function routeDurationMinutes(points) {
  const first = points.find((point) => point.time);
  const last = [...points].reverse().find((point) => point.time);

  if (!first?.time || !last?.time) return 0;

  const duration = new Date(last.time) - new Date(first.time);
  return duration > 0 ? duration / 60000 : 0;
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

async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude)
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`
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
    "Lieu de l'activité"
  );
}

async function parseGpx(file) {
  const text = await file.text();
  const xml = new DOMParser().parseFromString(text, "application/xml");

  if (xml.querySelector("parsererror")) {
    throw new Error("Le fichier GPX est invalide.");
  }

  const points = [...xml.querySelectorAll("trkpt")]
    .map((point) => ({
      lat: Number(point.getAttribute("lat")),
      lon: Number(point.getAttribute("lon")),
      ele: Number(point.querySelector("ele")?.textContent || 0),
      time: point.querySelector("time")?.textContent || null
    }))
    .filter((point) =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon)
    );

  if (!points.length) {
    throw new Error("Aucun point de trace trouvé dans le fichier GPX.");
  }

  return {
    name: file.name,
    points,
    startTime: points.find((point) => point.time)?.time || null,
    endTime: [...points].reverse().find((point) => point.time)?.time || null,
    distance: routeDistance(points),
    duration: routeDurationMinutes(points)
  };
}

function secondsToMinutes(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds / 60 : 0;
}

function fitDate(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : iso(date);
}

function fitSportLabel(value) {
  const labels = {
    1: "Course à pied",
    2: "Vélo",
    5: "Natation",
    11: "Randonnée",
    13: "Musculation",
    15: "Marche"
  };

  return labels[Number(value)] || "Autre";
}

function readFitValue(view, offset, baseType, littleEndian) {
  const type = baseType & 0x1f;

  switch (type) {
    case 0: return view.getUint8(offset);
    case 1: return view.getInt8(offset);
    case 2: return view.getUint8(offset);
    case 3: return view.getInt16(offset, littleEndian);
    case 4: return view.getUint16(offset, littleEndian);
    case 5: return view.getInt32(offset, littleEndian);
    case 6: return view.getUint32(offset, littleEndian);
    case 7: return null;
    case 8: return view.getFloat32(offset, littleEndian);
    case 9: return view.getFloat64(offset, littleEndian);
    case 10: return view.getUint8(offset);
    case 11: return view.getUint16(offset, littleEndian);
    case 12: return view.getUint32(offset, littleEndian);
    case 13: return view.getUint8(offset);
    case 14: return Number(view.getBigInt64(offset, littleEndian));
    case 15: return Number(view.getBigUint64(offset, littleEndian));
    case 16: return Number(view.getBigUint64(offset, littleEndian));
    default: return null;
  }
}

function fitEpochToDate(seconds) {
  const FIT_EPOCH_MS = Date.UTC(1989, 11, 31, 0, 0, 0);
  return new Date(FIT_EPOCH_MS + Number(seconds) * 1000);
}

async function parseFit(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  const headerSize = view.getUint8(0);
  const dataSize = view.getUint32(4, true);
  const dataEnd = Math.min(headerSize + dataSize, buffer.byteLength);

  if (headerSize < 12 || dataEnd <= headerSize) {
    throw new Error("Le fichier FIT est invalide.");
  }

  const definitions = new Map();
  let offset = headerSize;
  let session = null;

  while (offset < dataEnd) {
    const header = view.getUint8(offset);
    offset += 1;

    const compressedTimestamp = (header & 0x80) !== 0;
    const definitionMessage = !compressedTimestamp && (header & 0x40) !== 0;
    const developerData = !compressedTimestamp && (header & 0x20) !== 0;
    const localMessageType = compressedTimestamp ? ((header >> 5) & 0x03) : (header & 0x0f);

    if (definitionMessage) {
      offset += 1; // reserved
      const architecture = view.getUint8(offset);
      offset += 1;

      const littleEndian = architecture === 0;
      const globalMessageNumber = view.getUint16(offset, littleEndian);
      offset += 2;

      const fieldCount = view.getUint8(offset);
      offset += 1;

      const fields = [];

      for (let i = 0; i < fieldCount; i += 1) {
        fields.push({
          number: view.getUint8(offset),
          size: view.getUint8(offset + 1),
          baseType: view.getUint8(offset + 2)
        });
        offset += 3;
      }

      if (developerData) {
        const developerFieldCount = view.getUint8(offset);
        offset += 1 + developerFieldCount * 3;
      }

      definitions.set(localMessageType, {
        globalMessageNumber,
        littleEndian,
        fields
      });

      continue;
    }

    const definition = definitions.get(localMessageType);

    if (!definition) {
      throw new Error("Structure FIT non reconnue.");
    }

    const values = {};

    for (const field of definition.fields) {
      if (offset + field.size > dataEnd) {
        throw new Error("Le fichier FIT est incomplet.");
      }

      if (field.size === 1 || field.size === 2 || field.size === 4 || field.size === 8) {
        values[field.number] = readFitValue(
          view,
          offset,
          field.baseType,
          definition.littleEndian
        );
      }

      offset += field.size;
    }

    // Message global 18 = session
    if (definition.globalMessageNumber === 18) {
      session = {
        startTime: values[2] != null ? fitEpochToDate(values[2]) : null,
        sport: values[5],
        subSport: values[6],
        totalElapsedSeconds: values[7] != null ? values[7] / 1000 : 0,
        totalTimerSeconds: values[8] != null ? values[8] / 1000 : 0,
        totalDistanceKm: values[9] != null ? values[9] / 100000 : 0,
        avgHeartRate: values[16] ?? null,
        totalAscent: values[22] ?? null
      };
    }
  }

  if (!session) {
    throw new Error("Aucune séance n'a été trouvée dans ce fichier FIT.");
  }

  return {
    date: fitDate(session.startTime) || iso(new Date()),
    sport: fitSportLabel(session.sport),
    type: file.name.replace(/\.fit$/i, ""),
    distance: Number(session.totalDistanceKm.toFixed(2)),
    duration: Math.round(secondsToMinutes(
      session.totalTimerSeconds || session.totalElapsedSeconds
    )),
    elevation: session.totalAscent || "",
    avgHr: session.avgHeartRate || "",
    locationName: ""
  };
}

async function parseActivityFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "gpx") {
    const route = await parseGpx(file);
    const center = routeCenter(route);
    let locationName = "";

    if (center) {
      try {
        locationName = await reverseGeocode(
          center.latitude,
          center.longitude
        );
      } catch (error) {
        console.warn("HOME : lieu GPX non résolu.", error);
      }
    }

    return {
      date: route.startTime ? iso(new Date(route.startTime)) : iso(new Date()),
      sport: "Course à pied",
      type: file.name.replace(/\.gpx$/i, ""),
      distance: Number(route.distance.toFixed(2)),
      duration: Math.round(route.duration),
      elevation: "",
      avgHr: "",
      locationName,
      routeSummary: {
        file_name: file.name,
        point_count: route.points.length,
        start_time: route.startTime,
        end_time: route.endTime,
        center
      }
    };
  }

  if (extension === "fit") {
    return parseFit(file);
  }

  throw new Error("Format non pris en charge. Choisis un fichier .FIT ou .GPX.");
}

async function handleActivityFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setActivityMessage("Lecture du fichier…");

  try {
    const parsed = await parseActivityFile(file);
    fillActivityForm(parsed);
    setActivityMessage("Fichier lu. Vérifie les données avant d'enregistrer.");
  } catch (error) {
    console.error("HOME : import impossible.", error);
    setActivityMessage(
      error.message || "Impossible de lire ce fichier.",
      true
    );
  }
}
