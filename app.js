// --- 1. Giriş Doğrulama ---
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

// --- 2. Harita Başlatma ---
const map = L.map('map', {
  zoomControl: false,
  maxZoom: 19
}).setView([40.67, 32.75], 13);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Google Earth Uydu Katmanı
const googleSat = L.tileLayer('https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  attribution: '© Google Earth'
}).addTo(map);

// Esri Uydu Katmanı
const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: '© Esri'
});

L.control.layers({
  "Google Earth Uydu": googleSat,
  "Esri Canlı Uydu": esriSat
}, null, { position: 'topright' }).addTo(map);

function kmlColorToHex(kmlColor) {
  if (!kmlColor || kmlColor.length < 8) return null;
  const r = kmlColor.substring(6, 8);
  const g = kmlColor.substring(4, 6);
  const b = kmlColor.substring(2, 4);
  return `#${r}${g}${b}`;
}

// --- 3. KML Verisini Yükleme ---
let lineCount = 0;

const kmlLayer = omnivore.kml('rota.kml')
  .on('ready', function() {
    this.eachLayer(function(layer) {
      // Çizgileri yakala
      const isLine = (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) ||
                     (layer.feature && layer.feature.geometry && 
                      (layer.feature.geometry.type === 'LineString' || layer.feature.geometry.type === 'MultiLineString'));

      if (isLine) {
        lineCount++;
        const props = (layer.feature && layer.feature.properties) ? layer.feature.properties : {};
        const name = (props.name || '').trim();
        const lowerName = name.toLowerCase();

        // 1. Hat yeşil, 2. Hat kırmızı
        let strokeColor = (lineCount >= 2) ? '#ff2a2a' : '#39ff14';

        if (lowerName.includes('alternatif') || lowerName.includes('kırmızı') || lowerName.includes('ikinci') || lowerName.includes('2')) {
          strokeColor = '#ff2a2a';
        }

        if (props.stroke || props.color) {
          strokeColor = kmlColorToHex(props.stroke || props.color) || strokeColor;
        }

        layer.setStyle({
          color: strokeColor,
          weight: 6,
          opacity: 0.95
        });

        if (layer.bringToFront) {
          layer.bringToFront();
        }

        if (name) {
          layer.bindPopup(`<strong>📍 Rota: ${name}</strong>`);
        }
      }

      // Noktalar
      if (layer instanceof L.Marker) {
        const props = (layer.feature && layer.feature.properties) ? layer.feature.properties : {};
        const title = props.name || "Nokta";
        const desc = props.description || "";
        layer.bindPopup(`<strong>${title}</strong><br/>${desc}`);
      }
    });

    map.fitBounds(kmlLayer.getBounds(), { padding: [40, 40] });
    document.getElementById('status').innerText = `Rotalar yüklendi (${lineCount} hat).`;
  })
  .on('error', function(err) {
    console.error("KML Hatası:", err);
    document.getElementById('status').innerText = "Dosya okunamadı.";
  })
  .addTo(map);

// --- 4. Canlı Konum Takibi ---
let userMarker = null;

function locateMe() {
  document.getElementById('status').innerText = "Konum taranıyor...";
  map.locate({ setView: true, maxZoom: 17, watch: true, enableHighAccuracy: true });
}

map.on('locationfound', function(e) {
  document.getElementById('status').innerText = `Hassasiyet: ±${Math.round(e.accuracy)}m`;
  if (userMarker) {
    userMarker.setLatLng(e.latlng);
  } else {
    userMarker = L.circleMarker(e.latlng, {
      radius: 8,
      fillColor: '#0077b6',
      color: '#ffffff',
      weight: 3,
      fillOpacity: 1
    }).addTo(map).bindPopup("Mevcut Konum").openPopup();
  }
});

map.on('locationerror', function(e) {
  document.getElementById('status').innerText = "GPS hatası: " + e.message;
});
