// --- 1. Şifre Doğrulama ---
function checkAuth(event) {
  event.preventDefault();
  const inputEl = document.getElementById('auth-input');
  const errorEl = document.getElementById('auth-error');
  const val = inputEl.value.trim().toLowerCase();

  if (val === 'malcom') {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
  } else {
    errorEl.innerText = "mal mısın?";
    inputEl.value = '';
    inputEl.focus();
  }
}

// --- 2. Harita Kurulumu ---
const map = new maplibregl.Map({
  container: 'map',
  zoom: 13.8,
  center: [32.739, 40.678],
  pitch: 60,
  bearing: -20,
  maxPitch: 85,
  style: {
    version: 8,
    sources: {
      'google-satellite': {
        type: 'raster',
        tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
        tileSize: 256
      },
      'terrain-source': {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256
      }
    },
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster',
        source: 'google-satellite'
      }
    ],
    terrain: {
      source: 'terrain-source',
      exaggeration: 1.5
    }
  }
});

map.addControl(new maplibregl.NavigationControl({
  visualizePitch: true
}), 'top-right');

// Mesafe & Projeksiyon Fonksiyonları
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestPointOnSegment(p, a, b) {
  const x = p[0], y = p[1];
  const x1 = a[0], y1 = a[1];
  const x2 = b[0], y2 = b[1];
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) return a;

  let t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return [x1 + t * dx, y1 + t * dy];
}

const storedRoutes = [];

// --- 3. KML Verisi, Çizgiler ve Noktalar ---
map.on('load', () => {
  map.addSource('guide-line-source', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [] }
    }
  });

  map.addLayer({
    id: 'guide-line-layer',
    type: 'line',
    source: 'guide-line-source',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#ffea00',
      'line-width': 4,
      'line-dasharray': [2, 2]
    }
  });

  fetch('rota.kml')
    .then(res => {
      if (!res.ok) throw new Error("rota.kml bulunamadı!");
      return res.text();
    })
    .then(kmlText => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      const placemarks = xmlDoc.getElementsByTagName('Placemark');

      const bounds = new maplibregl.LngLatBounds();
      let pathCount = 0;

      for (let i = 0; i < placemarks.length; i++) {
        const pm = placemarks[i];
        const nameEl = pm.getElementsByTagName('name')[0];
        let name = nameEl ? nameEl.textContent.trim() : '';
        const lowerName = name.toLowerCase();

        // Başlangıç noktasını Çakıl yap
        if (lowerName.includes('tanışma') || lowerName.includes('tanisma') || lowerName.includes('başlangıç')) {
          name = 'Çakıl';
        }

        // Bayraklı Çeşme HARİÇ diğer çeşmeler ve Wikiloc çöpleri elenir
        if (
          lowerName.includes('ceyda') ||
          lowerName.includes('wikiloc') ||
          lowerName.includes('ara nokta') ||
          lowerName.startsWith('wpt') ||
          (lowerName.includes('çeşme') && !lowerName.includes('bayraklı')) ||
          (lowerName.includes('cesme') && !lowerName.includes('bayrakli'))
        ) {
          continue;
        }

        // A) ROTA ÇİZGİLERİ
        const lineString = pm.getElementsByTagName('LineString')[0];
        if (lineString) {
          pathCount++;
          const coordsText = lineString.getElementsByTagName('coordinates')[0].textContent.trim();
          const coordLines = coordsText.split(/\s+/);
          
          const coords = [];
          coordLines.forEach(pair => {
            const parts = pair.split(',');
            if (parts.length >= 2) {
              const lng = parseFloat(parts[0]);
              const lat = parseFloat(parts[1]);
              if (!isNaN(lat) && !isNaN(lng)) {
                coords.push([lng, lat]);
                bounds.extend([lng, lat]);
              }
            }
          });

          let lineColor = '#0070f3';
          let routeName = 'Mavi Rota (Ana Yol)';
          if (lowerName.includes('sevgi') || lowerName.includes('kırmızı') || pathCount === 2) {
            lineColor = '#ff2200';
            routeName = 'Kırmızı Rota (Sevgi Yolu)';
          }

          storedRoutes.push({
            name: routeName,
            colorName: (lineColor === '#ff2200') ? 'Kırmızı Rota' : 'Mavi Rota',
            coords: coords
          });

          const sourceId = `line-source-${i}`;
          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: coords }
            }
          });

          map.addLayer({
            id: `line-layer-${i}`,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': lineColor,
              'line-width': 5
            }
          });
        }

        // B) NOKTALAR
        const point = pm.getElementsByTagName('Point')[0];
        if (point) {
          const coordsText = point.getElementsByTagName('coordinates')[0].textContent.trim();
          const parts = coordsText.split(',');
          if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
              bounds.extend([lng, lat]);

              const el = document.createElement('div');
              el.className = 'earth-marker';
              el.innerHTML = `
                <div class="earth-pin-icon"></div>
                <div class="earth-label-text">${name}</div>
              `;

              new maplibregl.Marker({ element: el, anchor: 'bottom-left' })
                .setLngLat([lng, lat])
                .addTo(map);
            }
          }
        }
      }

      // C) 1. Eğitim Kamp Alanı
      const campLng = 32.739069;
      const campLat = 40.678775;
      bounds.extend([campLng, campLat]);

      const campEl = document.createElement('div');
      campEl.className = 'earth-marker';
      campEl.innerHTML = `
        <div class="earth-pin-icon"></div>
        <div class="earth-label-text">1.eğitim kamp alanı</div>
      `;

      new maplibregl.Marker({ element: campEl, anchor: 'bottom-left' })
        .setLngLat([campLng, campLat])
        .addTo(map);

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, pitch: 55 });
      }

      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.innerText = '';
    })
    .catch(err => {
      console.error(err);
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.innerText = 'Hata: ' + err.message;
    });
});

// --- 4. "Beni Patikaya Oturt" Kılavuzu ---
let userMarker = null;
let snapMarker = null;

function locateAndSnapToTrail() {
  const statusEl = document.getElementById('status');
  const guideInfoEl = document.getElementById('guide-info');
  statusEl.innerText = 'GPS taranıyor...';

  if (!navigator.geolocation) {
    statusEl.innerText = 'GPS desteklenmiyor.';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const uLng = pos.coords.longitude;
      const uLat = pos.coords.latitude;
      const accuracy = Math.round(pos.coords.accuracy);

      statusEl.innerText = `GPS Hassasiyeti: ±${accuracy}m`;

      if (!userMarker) {
        const uEl = document.createElement('div');
        uEl.style.width = '16px';
        uEl.style.height = '16px';
        uEl.style.backgroundColor = '#00f0ff';
        uEl.style.border = '3px solid #ffffff';
        uEl.style.borderRadius = '50%';
        uEl.style.boxShadow = '0 0 10px #00f0ff';

        userMarker = new maplibregl.Marker({ element: uEl })
          .setLngLat([uLng, uLat])
          .addTo(map);
      } else {
        userMarker.setLngLat([uLng, uLat]);
      }

      if (storedRoutes.length === 0) return;

      let minDistance = Infinity;
      let closestPoint = null;
      let closestRoute = null;

      storedRoutes.forEach(route => {
        for (let i = 0; i < route.coords.length - 1; i++) {
          const ptA = route.coords[i];
          const ptB = route.coords[i + 1];
          const candidatePoint = findNearestPointOnSegment([uLng, uLat], ptA, ptB);
          const dist = getDistanceMeters(uLat, uLng, candidatePoint[1], candidatePoint[0]);

          if (dist < minDistance) {
            minDistance = dist;
            closestPoint = candidatePoint;
            closestRoute = route;
          }
        }
      });

      const distInt = Math.round(minDistance);

      if (!snapMarker) {
        const sEl = document.createElement('div');
        sEl.style.width = '14px';
        sEl.style.height = '14px';
        sEl.style.backgroundColor = '#ffea00';
        sEl.style.border = '2px solid #000000';
        sEl.style.borderRadius = '50%';
        sEl.style.boxShadow = '0 0 8px #ffea00';

        snapMarker = new maplibregl.Marker({ element: sEl })
          .setLngLat(closestPoint)
          .addTo(map);
      } else {
        snapMarker.setLngLat(closestPoint);
      }

      const guideSource = map.getSource('guide-line-source');
      if (guideSource) {
        guideSource.setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[uLng, uLat], closestPoint]
          }
        });
      }

      if (distInt <= 15) {
        guideInfoEl.innerHTML = `🎯 Tam <span style="color:#39ff14;">${closestRoute.colorName}</span> üzerindesin!`;
      } else {
        guideInfoEl.innerHTML = `⚠️ <span style="color:#ffea00;">${closestRoute.colorName}</span>'a <strong>${distInt}m</strong> uzaktasın.<br/>Sarı kesikli çizgiyi takip et!`;
      }

      const snapBounds = new maplibregl.LngLatBounds();
      snapBounds.extend([uLng, uLat]);
      snapBounds.extend(closestPoint);
      map.fitBounds(snapBounds, { padding: 90, maxZoom: 17, pitch: 60 });
    },
    err => {
      statusEl.innerText = 'GPS hatası: ' + err.message;
    },
    { enableHighAccuracy: true }
  );
}
