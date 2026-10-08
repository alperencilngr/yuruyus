// 1. Haritayı başlat
const map = L.map('map', {
  zoomControl: false,
  maxZoom: 19
}).setView([40.67, 32.75], 13);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// 2. Google Earth Uydu Katmanı (Varsayılan Katman)
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

// 3. KML Dosyasını Yükle ve Google Earth Stillerini Birebir Koru
// NOT: Dosya adın ne ise buraya onu yaz (örn: rota.kml)
const kmlLayer = omnivore.kml('rota.kml')
  .on('ready', function() {
    this.eachLayer(function(layer) {
      // Çizgilerin (Rotaların) Renkleri
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        let lineColor = '#e63946'; // Varsayılan renk
        
        // Google Earth'te atadığın renk verisini oku
        if (layer.feature && layer.feature.properties) {
          const props = layer.feature.properties;
          const kmlCol = props.stroke || props.color || props.LineStyleColor;
          if (kmlCol) {
            lineColor = kmlColorToHex(kmlCol) || kmlCol;
          }
        }

        layer.setStyle({
          color: lineColor,
          weight: 5,
          opacity: 0.95
        });
      }

      // Noktalar ve Durak İsimleri
      if (layer.feature && layer.feature.properties) {
        const name = layer.feature.properties.name || "Nokta";
        const desc = layer.feature.properties.description || "";
        layer.bindPopup(`<strong>${name}</strong><br/>${desc}`);
      }
    });

    // Haritayı rotaların ve noktaların olduğu yere otomatik odakla
    map.fitBounds(kmlLayer.getBounds(), { padding: [40, 40] });
    document.getElementById('status').innerText = "Rotalar başarıyla yüklendi.";
  })
  .on('error', function(err) {
    console.error("KML Hatası:", err);
    document.getElementById('status').innerText = "Dosya okunamadı. Adını kontrol edin.";
  })
  .addTo(map);

// 4. GPS Canlı Takip
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
      color: '#fff',
      weight: 3,
      fillOpacity: 1
    }).addTo(map).bindPopup("Şu an buradasın!").openPopup();
  }
});