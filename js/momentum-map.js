/* =========================================================
   MOMENTUM — MAP
   ---------------------------------------------------------
   Carte Leaflet partagée pour les lieux et traces GPS.
   ========================================================= */

(function initialiseMomentumMap() {
  const maps = new WeakMap();

  function resolveElement(target) {
    return typeof target === "string"
      ? document.querySelector(target)
      : target;
  }

  function normalisePoint(point) {
    const latitude = Array.isArray(point)
      ? Number(point[0])
      : Number(point?.latitude ?? point?.lat);

    const longitude = Array.isArray(point)
      ? Number(point[1])
      : Number(point?.longitude ?? point?.lon ?? point?.lng);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      return null;
    }

    return [latitude, longitude];
  }

  function clear(target) {
    const element = resolveElement(target);
    const map = element ? maps.get(element) : null;

    if (map) {
      map.remove();
      maps.delete(element);
    }

    if (element) element.replaceChildren();
  }

  function createMap(target, options = {}) {
    const element = resolveElement(target);

    if (!element || !window.L) return null;

    clear(element);

    const map = window.L.map(element, {
      zoomControl: options.zoomControl !== false,
      scrollWheelZoom: false,
      attributionControl: true
    });

    window.L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }
    ).addTo(map);

    maps.set(element, map);

    window.setTimeout(() => map.invalidateSize(), 0);

    return map;
  }

  function renderLocation(target, point, options = {}) {
    const coordinates = normalisePoint(point);
    const map = coordinates ? createMap(target, options) : null;

    if (!map) return false;

    map.setView(coordinates, options.zoom || 11);

    window.L.circleMarker(coordinates, {
      radius: 7,
      weight: 3,
      color: "#ffffff",
      fillColor: "#173d31",
      fillOpacity: 1
    }).addTo(map);

    return true;
  }

  function renderRoute(target, points, options = {}) {
    const coordinates = (points || [])
      .map(normalisePoint)
      .filter(Boolean);

    const map = coordinates.length >= 2
      ? createMap(target, options)
      : null;

    if (!map) return false;

    const route = window.L.polyline(coordinates, {
      color: options.color || "#c56f2d",
      weight: options.weight || 4,
      opacity: .92,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    const markerStyle = {
      radius: 5,
      weight: 2,
      color: "#ffffff",
      fillColor: "#173d31",
      fillOpacity: 1
    };

    window.L.circleMarker(coordinates[0], markerStyle).addTo(map);
    window.L.circleMarker(
      coordinates[coordinates.length - 1],
      { ...markerStyle, fillColor: "#c56f2d" }
    ).addTo(map);

    map.fitBounds(route.getBounds(), {
      padding: [24, 24],
      maxZoom: options.maxZoom || 15
    });

    return true;
  }

  window.MomentumMap = Object.freeze({
    clear,
    renderLocation,
    renderRoute
  });
})();
