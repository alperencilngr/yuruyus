// --- 1. Şifre Kontrolü (Her Sayfa Açılışında Sorar) ---
function checkAuth(event) {
  event.preventDefault();
  const inputEl = document.getElementById('auth-input');
  const errorEl = document.getElementById('auth-error');
  const inputVal = inputEl.value.trim().toLocaleLowerCase('tr-TR');

  if (inputVal === 'ali') {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
  } else {
    errorEl.innerText = "erişim reddedildi.";
    inputEl.value = '';
    inputEl.focus();
  }
}

// --- 2. MapLibre 3D Harita Kurulumu ---
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

// --- 3. KML Verisi, Çeşme Filtresi ve Özel Kamp Alanı ---
map.on('load', () => {
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
        const name = nameEl ? nameEl.textContent.trim() : '';
        const lowerName = name.toLowerCase();

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

          let lineColor = '#0070f3'; // Path mavi
          if (lowerName.includes('sevgi') || lowerName.includes('kırmızı') || pathCount === 2) {
            lineColor = '#ff2200'; // sevgi kırmızı
          }

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

        // B) NOKTALAR VE METİNLER
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

      // --- C) ÖZEL İŞARET: 1. Eğitim Kamp Alanı (Kök Merdivenler / Ayıbar Tarzı) ---
      // Koordinat: 40°40'43.59"K 32°44'20.65"D -> [32.739069, 40.678775]
      const campLng = 32.739069;
      const campLat = 40.678775;
      bounds.extend([campLng, campLat]);

      const campEl = document.createElement('div');
      campEl.className = 'earth-marker';
      campEl.innerHTML = `
        <div style="
          width: 32px;
          height: 32px;
          background: #3e2723;
          border: 2px solid #d7ccc8;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.8);
        ">⛺</div>
        <div class="earth-label-text" style="color: #ffcc80;">1.eğitim kamp alanı</div>
      `;

      new maplibregl.Marker({ element: campEl, anchor: 'bottom-left' })
        .setLngLat([campLng, campLat])
        .addTo(map);

      // Haritayı sınırlara odakla
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, pitch: 55 });
      }

      // "3D Rota hazır" yazısı silindi
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.innerText = '';
    })
    .catch(err => {
      console.error(err);
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.innerText = 'Hata: ' + err.message;
    });
});

// --- 4. GPS Canlı Takip ---
let userMarker = null;

function locateMe() {
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.innerText = 'Konum taranıyor...';

  if (!navigator.geolocation) {
    if (statusEl) statusEl.innerText = 'GPS desteklenmiyor.';
    return;
  }

  navigator.geolocation.watchPosition(
    pos => {
      const { longitude, latitude, accuracy } = pos.coords;
      if (statusEl) statusEl.innerText = `Hassasiyet: ±${Math.round(accuracy)}m`;

      if (!userMarker) {
        const el = document.createElement('div');
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.backgroundColor = '#00f0ff';
        el.style.border = '3px solid #ffffff';
        el.style.borderRadius = '50%';
        el.style.boxShadow = '0 0 10px #00f0ff';

        userMarker = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(map);

        map.flyTo({ center: [longitude, latitude], zoom: 16 });
      } else {
        userMarker.setLngLat([longitude, latitude]);
      }
    },
    err => {
      if (statusEl) statusEl.innerText = 'GPS hatası: ' + err.message;
    },
    { enableHighAccuracy: true }
  );
}
