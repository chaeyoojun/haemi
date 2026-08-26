const MAP_SHARE_URL =
  /https?:\/\/(?:(?:www\.)?(?:tmap\.life|tmap\.co\.kr)|(?:m\.)?map\.kakao\.com|kko\.to|kko\.kakao\.com|naver\.me|map\.naver\.com|nmap\.naver\.com|maps\.app\.goo\.gl|maps\.google\.com|goo\.gl\/maps)[^\s]*/gi;

export function stripMapShareUrls(text: string) {
  return text
    .replace(MAP_SHARE_URL, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type MapCoords = {
  lat: number;
  lng: number;
};

export type PlaceHit = {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
};

export function coordsFromPlace(place: { lat?: number; lng?: number } | null | undefined): MapCoords | null {
  const lat = Number(place?.lat);
  const lng = Number(place?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

export function sameCoords(a: MapCoords | null | undefined, b: MapCoords | null | undefined) {
  if (!a || !b) {
    return false;
  }
  return Math.abs(a.lat - b.lat) < 0.00008 && Math.abs(a.lng - b.lng) < 0.00008;
}

export function parsePinMessage(raw: string): MapCoords | null {
  try {
    const data = JSON.parse(raw) as { type?: string; lat?: number; lng?: number };
    if (data?.type !== 'pin') {
      return null;
    }
    return coordsFromPlace(data);
  } catch {
    return null;
  }
}

export function moveMarkerScript(coords: MapCoords) {
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  return `if (window.marker && window.map) { window.marker.setLatLng([${lat}, ${lng}]); window.map.setView([${lat}, ${lng}]); } true;`;
}

export async function geocodeNominatim(place: string): Promise<MapCoords | null> {
  const query = place.trim();
  if (query.length < 2) {
    return null;
  }
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ko',
        'User-Agent': 'Haemi/1.0 (https://if.io.kr)',
      },
    }
  );
  if (!response.ok) {
    return null;
  }
  const rows = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const first = Array.isArray(rows) ? rows[0] : undefined;
  return coordsFromPlace({ lat: Number(first?.lat), lng: Number(first?.lon) });
}

export async function reverseNominatim(coords: MapCoords): Promise<string> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=18&accept-language=ko`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ko',
        'User-Agent': 'Haemi/1.0 (https://if.io.kr)',
      },
    }
  );
  if (!response.ok) {
    return '';
  }
  const json = (await response.json()) as {
    display_name?: string;
    address?: {
      road?: string;
      pedestrian?: string;
      house_number?: string;
      suburb?: string;
      borough?: string;
      city_district?: string;
      city?: string;
      province?: string;
    };
  };
  const addr = json.address;
  if (addr) {
    const road = addr.road || addr.pedestrian;
    const area = [addr.city || addr.province, addr.borough || addr.city_district || addr.suburb, road, addr.house_number]
      .filter(Boolean)
      .join(' ');
    if (area) {
      return area;
    }
  }
  return json.display_name || '';
}

export function mapWindowHtml(coords: MapCoords, options?: { movable?: boolean }) {
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  const movable = options?.movable ? 'true' : 'false';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height:100%; width:100%; margin:0; padding:0; background:#eee; -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
    .leaflet-control-attribution { font-size:9px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 17);
    window.map = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var marker = L.marker([${lat}, ${lng}]).addTo(map);
    window.marker = marker;
    setTimeout(function() { map.invalidateSize(); }, 250);
    if (${movable}) {
      var lastDrop = 0;
      function dropPin(latlng) {
        var now = Date.now();
        if (now - lastDrop < 400) return;
        lastDrop = now;
        marker.setLatLng(latlng);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', lat: latlng.lat, lng: latlng.lng }));
        }
      }
      map.on('contextmenu', function(e) {
        L.DomEvent.preventDefault(e);
        dropPin(e.latlng);
      });
      var holdTimer = null;
      var startPoint = null;
      function cancelHold() {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        startPoint = null;
      }
      map.on('dragstart zoomstart', cancelHold);
      var el = map.getContainer();
      el.addEventListener('touchstart', function(ev) {
        if (ev.touches.length !== 1) { cancelHold(); return; }
        var t = ev.touches[0];
        var rect = el.getBoundingClientRect();
        startPoint = L.point(t.clientX - rect.left, t.clientY - rect.top);
        var latlng = map.containerPointToLatLng(startPoint);
        holdTimer = setTimeout(function() {
          holdTimer = null;
          dropPin(latlng);
        }, 480);
      }, { passive: true });
      el.addEventListener('touchmove', function(ev) {
        if (!startPoint || !ev.touches[0]) { cancelHold(); return; }
        var t = ev.touches[0];
        var rect = el.getBoundingClientRect();
        var now = L.point(t.clientX - rect.left, t.clientY - rect.top);
        if (startPoint.distanceTo(now) > 14) cancelHold();
      }, { passive: true });
      el.addEventListener('touchend', cancelHold);
      el.addEventListener('touchcancel', cancelHold);
    }
  </script>
</body>
</html>`;
}
