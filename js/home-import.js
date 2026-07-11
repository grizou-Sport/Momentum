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
    "Lieu du moment"
  );
}

async function parseGpx(file) {
  const text = await file.text();
  const xml = new DOMParser().parseFromString(
    text,
    "application/xml"
  );

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
    throw new Error(
      "Aucun point de trace trouvé dans le fichier GPX."
    );
  }

  return {
    name: file.name,
    points,
    startTime:
      points.find((point) => point.time)?.time || null,
    endTime:
      [...points].reverse().find((point) => point.time)?.time || null,
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

  let offset = headerSize;
  let session = null;
  const fitPoints = [];

  while (offset < dataEnd) {
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

    // Message global 18 = session
    if (definition.globalMessageNumber === 18) {
      session = {
        startTime:
          values[2] != null
            ? fitEpochToDate(values[2])
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

        totalAscent:
          values[22] ?? null
      };
    }

    // Message global 20 = record. Les positions sont exprimées
    // en semicircles dans les champs 0 (latitude) et 1 (longitude).
    if (definition.globalMessageNumber === 20) {
      const latitude = fitSemicirclesToDegrees(values[0]);
      const longitude = fitSemicirclesToDegrees(values[1]);

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

  const routeSummary = createRouteSummary(
    file.name,
    fitPoints
  );

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
      fitDate(session.startTime) ||
      iso(new Date()),

    sport:
      fitSportLabel(session.sport),

    type:
      file.name.replace(/\.fit$/i, ""),

    distance:
      Number(
        session.totalDistanceKm.toFixed(2)
      ),

    duration:
      Math.round(
        secondsToMinutes(
          session.totalTimerSeconds ||
          session.totalElapsedSeconds
        )
      ),

    elevation:
      session.totalAscent || "",

    avgHr:
      session.avgHeartRate || "",

    locationName,

    routeSummary
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
      date:
        route.startTime
          ? iso(new Date(route.startTime))
          : iso(new Date()),

      sport: "running",

      type:
        file.name.replace(/\.gpx$/i, ""),

      distance:
        Number(route.distance.toFixed(2)),

      duration:
        Math.round(route.duration),

      elevation: "",
      avgHr: "",
      locationName,

      routeSummary: createRouteSummary(
        file.name,
        route.points,
        {
          start_time: route.startTime,
          end_time: route.endTime
        }
      )
    };
  }

  if (extension === "fit") {
    return parseFit(file);
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

  const path = createActivityStoragePath(
    userId,
    activityDate,
    file
  );

  const { error } = await window.momentumDB
    .storage
    .from(ACTIVITY_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType:
        file.type ||
        "application/octet-stream"
    });

  if (error) {
    console.error(
      "HOME : téléversement impossible.",
      error
    );

    throw new Error(
      error.message ||
      "Impossible d'envoyer le fichier dans Supabase."
    );
  }

  return {
    path,
    type: extension
  };
}

async function removeUploadedActivityFile(path) {
  if (!path) return;

  const { error } = await window.momentumDB
    .storage
    .from(ACTIVITY_BUCKET)
    .remove([path]);

  if (error) {
    console.warn(
      "HOME : fichier non supprimé après échec.",
      error
    );
  }
}

async function handleActivityFile(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  setActivityMessage("Lecture du fichier…");

  try {
    const parsed =
      await parseActivityFile(file);

    fillActivityForm(parsed);

    setActivityMessage(
      "Fichier lu. Vérifie les données avant d’enregistrer."
    );
  } catch (error) {
    console.error(
      "HOME : import impossible.",
      error
    );

    event.target.value = "";

    setActivityMessage(
      error.message ||
      "Impossible de lire ce fichier.",
      true
    );
  }
}
