// 1. Haritayı Başlat (Işık Dağı koordinatları)
const map = L.map('map', {
  zoomControl: false,
  maxZoom: 19
}).setView([40.67, 32.75], 13);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// 2. Google Earth ve Esri Uydu Katmanları
const googleSat = L.tileLayer('https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  attribution: '© Google Earth'
}).addTo(map);

const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: '© Esri Satellite'
});

L.control.layers({
  "Google Earth Uydu": googleSat,
  "Esri Canlı Uydu": esriSat
}, null, { position: 'topright' }).addTo(map);

// Google Earth KML renk kodunu (AABBGGRR) Web HEX (#RRGGBB) formatına çevirici
function kmlColorToHex(kmlColor) {
  if (!kmlColor || kmlColor.length < 8) return null;
  const r = kmlColor.substring(6, 8);
  const g = kmlColor.substring(4, 6);
  const b = kmlColor.substring(2, 4);
  return `#${r}${g}${b}`;
}

// 3. KML Dosyasını Yükle ve Renklendir
let lineCount = 0;

const kmlLayer = omnivore.kml('rota.kml')
  .on('ready', function() {
    this.eachLayer(function(layer) {
      
      // Çizgileri (Rotaları) Yakala
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        lineCount++;
        const props = (layer.feature && layer.feature.properties) ? layer.feature.properties : {};
        const name = (props.name || '').toLowerCase();
        
        console.log(`Çizgi #${lineCount} Adı:`, props.name);

        // Varsayılan ilk rota: Canlı fosforlu yeşil
        let finalColor = '#39ff14';

        // İkinci çizgi veya adı alternatif/kırmızı/ikinci olan çizgi: Canlı Kırmızı
        if (
          lineCount === 2 ||
          name.includes('alternatif') || 
          name.includes('kırmızı') || 
          name.includes('ikinci') || 
          name.includes('dönüş') ||
          name.includes('2')
        ) {
          finalColor = '#ff2a2a';
        }

        // KML içerisinde gömülü renk tanımlanmışsa öncelikli onu uygula
        if (props.stroke || props.color) {
          finalColor = kmlColorToHex(props.stroke || props.color) || finalColor;
        }

        layer.setStyle({
          color: finalColor,
          weight: 5,
          opacity: 0.95
        });

        if (props.name) {
          layer.bindPopup(`<strong>📍 Rota: ${props.name}</strong>`);
        }
      }

      // Noktalar ve Duraklar
      if (layer instanceof L.Marker) {
        const props = (layer.feature && layer.feature.properties) ? layer.feature.properties : {};
        const title = props.name || "Durak";
        const desc = props.description || "";
        layer.bindPopup(`<strong>${title}</strong><br/>${desc}`);
      }
    });

    // Haritayı rotaya odakla
    map.fitBounds(kmlLayer.getBounds(), { padding: [40, 40] });
    document.getElementById('status').innerText = "Rotalar yüklendi.";
  })
  .on('error', function(err) {
    console.error("KML Yükleme Hatası:", err);
    document.getElementById('status').innerText = "Dosya okunamadı. rota.kml adını kontrol edin.";
  })
  .addTo(map);

// 4. GPS Canlı Konum Takibi
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
