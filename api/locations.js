const GEOAPIFY_AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

function normalizeGeoapifyResult(result = {}) {
  const properties = result.properties || result;
  const latitude = finiteCoordinate(properties.lat, -90, 90);
  const longitude = finiteCoordinate(properties.lon, -180, 180);
  const streetAddress = cleanText(properties.address_line1) || [
    cleanText(properties.housenumber),
    cleanText(properties.street)
  ].filter(Boolean).join(" ");
  const city = cleanText(
    properties.city ||
    properties.town ||
    properties.village ||
    properties.municipality ||
    properties.county
  );
  const name = cleanText(properties.name) || streetAddress || city || cleanText(properties.formatted);

  if (!name) return null;

  return {
    name,
    address: streetAddress || null,
    postal_code: cleanText(properties.postcode) || null,
    city: city || null,
    country: cleanText(properties.country) || null,
    country_code: cleanText(properties.country_code).toUpperCase() || null,
    latitude,
    longitude,
    source: "geoapify",
    provider_place_id: cleanText(properties.place_id) || null
  };
}

function requestQuery(request) {
  if (request.query) return request.query;
  const url = new URL(request.url, "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

async function locationsHandler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Méthode non autorisée." });
  }

  const query = requestQuery(request);
  const text = cleanText(query.text);

  if (text.length < 3) {
    return response.status(400).json({ error: "Saisis au moins 3 caractères." });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return response.status(503).json({ error: "La recherche externe n’est pas configurée." });
  }

  const parameters = new URLSearchParams({
    text,
    lang: "fr",
    limit: "5",
    format: "geojson",
    apiKey
  });

  const latitude = finiteCoordinate(query.latitude, -90, 90);
  const longitude = finiteCoordinate(query.longitude, -180, 180);
  if (latitude !== null && longitude !== null) {
    parameters.set("bias", `proximity:${longitude},${latitude}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const upstream = await fetch(`${GEOAPIFY_AUTOCOMPLETE_URL}?${parameters}`, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: controller.signal
    });

    if (!upstream.ok) {
      console.warn("[locations] Geoapify response rejected", {
        status: upstream.status,
        queryLength: text.length,
        hasProximity: parameters.has("bias")
      });
      return response.status(502).json({ error: "La recherche de lieux est momentanément indisponible." });
    }

    const payload = await upstream.json();
    const results = (payload.features || payload.results || [])
      .map(normalizeGeoapifyResult)
      .filter(Boolean)
      .slice(0, 5);

    response.setHeader("Cache-Control", "private, max-age=60");
    return response.status(200).json({ results });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error("[locations] Geoapify request failed", {
      errorName: error?.name || "Error",
      queryLength: text.length,
      hasProximity: parameters.has("bias"),
      timedOut
    });
    return response.status(timedOut ? 504 : 502).json({
      error: timedOut
        ? "La recherche de lieux a pris trop de temps."
        : "La recherche de lieux est momentanément indisponible."
    });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = locationsHandler;
module.exports.normalizeGeoapifyResult = normalizeGeoapifyResult;
module.exports.finiteCoordinate = finiteCoordinate;
