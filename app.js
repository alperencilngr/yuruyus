// --- 1. Şifre Doğrulama Sistemi ---
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
    errorEl.innerText = "Yanlış cevap, yol seni içeri almıyor...";
    inputEl.value = '';
    inputEl.focus();
  }
}

// Oturum kontrolü (sayfa yenilendiğinde tekrar sormasın)
if (sessionStorage.getItem('is_authenticated') === 'true') {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
}

// --- 2. Harita Kurulumu ---
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
  attribution: '© Esri Satellite'
});

L.control.layers({
  "Google Earth Uydu": googleSat,
  "Esri Canlı Uydu": esriSat
}, null, { position: 'topright' }).addTo(map);

// KML Renk Çevirici (AABBGGRR -> #RRGGBB)
function kmlColorToHex(kmlColor) {
  if (!kmlColor || kmlColor.length < 8) return null;
  const r = kmlColor.substring(6, 8);
  const g = kmlColor.substring(4, 6);
  const b = kmlColor.substring(2, 4);
  return `#${r}${g}${b}`;
}

// --- 3. KML Yükleme ve Çizgileri Boyama ---
let lineCount = 0;

const kmlLayer = omnivore.kml('rota.kml')
  .on('ready', function() {
    console.log("KML yüklendi, öğeler taranıyor...");

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

        console.log(`Çizgi #${lineCount}:`, name);

        // 1. Yol: Canlı fosforlu yeşil
        // 2. Yol veya içinde alternatif/kırmızı/2 geçen: Kırmızı
        let strokeColor = (lineCount >= 2) ? '#ff2a2a' : '#39ff14';

        if (lowerName.includes('alternatif') || lowerName.includes('kırmızı') || lowerName.includes('ikinci') || lowerName.includes('2')) {
          strokeColor = '#ff2a2a';
        }

        // KML içinde hazır stil varsa onu al
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

      // Duraklar ve Noktalar
      if (layer instanceof L.Marker) {
        const props = (layer.feature && layer.feature.properties) ? layer.feature.properties : {};
        const title = props.name || "Nokta";
        const desc = props.description || "";
        layer.bindPopup(`<strong>${title}</strong><br/>${desc}`);
      }
    });

    map.fitBounds(kmlLayer.getBounds(), { padding: [40, 40] });
    document.getElementById('status').innerText = `Rotalar yüklendi (${lineCount} çizgi).`;
  })
  .on('error', function(err) {
    console.error("KML Hatası:", err);
    document.getElementById('status').innerText = "rota.kml okunamadı.";
  })
  .addTo(map);

// --- 4. GPS Canlı Konum Takibi ---
let userMarker = null;

function locateMe() {
  document.getElementById('status').innerText = "Konum taranıyor...";
  map.locate({ setView: true, maxZoom: 17, watch: true, enableHighAccuracy: true });
}

map.on('locationfound', function(e) {
  document.getElementById('status').innerText = `Doğruluk: ±${Math.round(e.accuracy)}m`;
  if (userMarker) {
    userMarker.setLatLng(e.latlng);
  } else {
    userMarker = L.circleMarker(e.latlng, {
      radius: 9,
      fillColor: '#0077b6',
      color: '#ffffff',
      weight: 3,
      fillOpacity: 1
    }).addTo(map).bindPopup("Şu an buradasın!").openPopup();
  }
});

map.on('locationerror', function(e) {
  document.getElementById('status').innerText = "GPS hatası: " + e.message;
});
