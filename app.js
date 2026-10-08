// --- 1. Şifre Kontrolü ---
function checkAuth(event) {
  event.preventDefault();
  const inputEl = document.getElementById('auth-input');
  const errorEl = document.getElementById('auth-error');
  const inputVal = inputEl.value.trim().toLocaleLowerCase('tr-TR');

  if (inputVal === 'ali') {
    sessionStorage.setItem('is_authenticated', 'true');
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
  } else {
    errorEl.innerText = "erişim reddedildi.";
    inputEl.value = '';
    inputEl.focus();
  }
}

if (sessionStorage.getItem('is_authenticated') === 'true') {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
}

// --- 2. MapLibre 3D Harita Kurulumu ---
const map = new maplibregl.Map({
  container: 'map',
  zoom: 13.8,
  center: [32.785, 40.675],
  pitch: 60,       // Google Earth gibi kamerayı 60 derece yatırır (3D tepe görünümü)
  bearing: -20,    // Açılı bakış
  maxPitch: 85,
  style: {
    version: 8,
    sources: {
      // Gerçek Google Earth Uydu Katmanı
      'google-satellite': {
        type: 'raster',
        tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
        tileSize: 256
      },
      // Küresel 3D Yükseklik Verisi (Dağ kabartması için)
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
      exaggeration: 1.5 // Dağların ve tepelerin vadilerini belirginleştiren yükselti çarpanı
    }
  }
});

// Sağ üst köşeye 3D Döndürme, Pusula ve Zoom butonları
map.addControl(new maplibregl.NavigationControl({
  visualizePitch: true
}), 'top-right');

// --- 3. KML Verisini Oku, İstenmeyen Çeşmeyi Filtrele ve 3D Çiz ---
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

        // 1. İSTENMEYEN NOKTALARI SİL / ELE:
        // - Wikiloc artıkları
        // - "Bayraklı Çeşme"den ÖNCEKİ isimsiz veya ara çeşmeler (Bayraklı Çeşme HARİÇ diğer tüm çeşme türevleri elenir)
        if (
          lowerName.includes('ceyda') ||
          lowerName.includes('wikiloc') ||
          lowerName.includes('ara nokta') ||
          lowerName.startsWith('wpt') ||
          (lowerName.includes('çeşme') && !lowerName.includes('bayraklı')) ||
          (lowerName.includes('cesme') && !lowerName.includes('bayrakli'))
        ) {
          continue; // Bu noktayı haritaya basmadan atla
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

          // "sevgi" ise kırmızı, diğeri mavi
          let lineColor = '#0070f3';
          if (lowerName.includes('sevgi') || lowerName.includes('kırmızı') || pathCount === 2) {
            lineColor = '#ff2200';
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

        // B) NOKTALAR VE SABİT YAZILAR
        const point = pm.getElementsByTagName('Point')[0];
        if (point) {
          const coordsText = point.getElementsByTagName('coordinates')[0].textContent.trim();
          const parts = coordsText.split(',');
          if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
              bounds.extend([lng, lat]);

              // Google Earth tarzı sarı raptiye + kalıcı metin
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

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, pitch: 55 });
        document.getElementById('status').innerText = '3D Rota hazır.';
      }
    })
    .catch(err => {
      console.error(err);
      document.getElementById('status').innerText = 'Hata: ' + err.message;
    });
});

// --- 4. GPS Canlı Takip ---
let userMarker = null;

function locateMe() {
  document.getElementById('status').innerText = 'Konum taranıyor...';
  if (!navigator.geolocation) {
    document.getElementById('status').innerText = 'GPS desteklenmiyor.';
    return;
  }

  navigator.geolocation.watchPosition(
    pos => {
      const { longitude, latitude, accuracy } = pos.coords;
      document.getElementById('status').innerText = `Hassasiyet: ±${Math.round(accuracy)}m`;

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
      document.getElementById('status').innerText = 'GPS hatası: ' + err.message;
    },
    { enableHighAccuracy: true }
  );
}
