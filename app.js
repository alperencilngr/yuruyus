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

const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: '© Esri'
});

L.control.layers({
  "Google Earth Uydu": googleSat,
  "Esri Canlı Uydu": esriSat
}, null, { position: 'topright' }).addTo(map);

// --- 3. KML Doğrudan XML Olarak Okuma (Kayıpsız Yöntem) ---
fetch('rota.kml')
  .then(res => {
    if (!res.ok) throw new Error("rota.kml dosyası bulunamadı!");
    return res.text();
  })
  .then(kmlText => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    
    const allBounds = [];
    let pathCount = 0;

    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i];
      const nameEl = pm.getElementsByTagName('name')[0];
      const name = nameEl ? nameEl.textContent.trim() : `Öğe ${i+1}`;
      
      const descEl = pm.getElementsByTagName('description')[0];
      const desc = descEl ? descEl.textContent.trim() : '';

      // A) ÇİZGİLER (LineString)
      const lineString = pm.getElementsByTagName('LineString')[0];
      if (lineString) {
        pathCount++;
        const coordsText = lineString.getElementsByTagName('coordinates')[0].textContent.trim();
        const coordLines = coordsText.split(/\s+/);
        
        const latLngs = [];
        coordLines.forEach(pair => {
          const parts = pair.split(',');
          if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
              latLngs.push([lat, lng]);
              allBounds.push([lat, lng]);
            }
          }
        });

        // İsim kontrolü: "sevgi" ise KIRMIZI, diğeri MAVİ
        let strokeColor = '#0070f3'; // Standart Mavi yol (Path)
        const lowerName = name.toLowerCase();

        if (lowerName.includes('sevgi') || lowerName.includes('kırmızı') || pathCount === 2) {
          strokeColor = '#ff2200'; // Kırmızı yol (sevgi)
        }

        const polyline = L.polyline(latLngs, {
          color: strokeColor,
          weight: 5,
          opacity: 0.95
        }).addTo(map);

        polyline.bindPopup(`<strong>📍 Rota: ${name}</strong><br/>${desc}`);
      }

      // B) NOKTALAR (Point / Placemark)
      const point = pm.getElementsByTagName('Point')[0];
      if (point) {
        const coordsText = point.getElementsByTagName('coordinates')[0].textContent.trim();
        const parts = coordsText.split(',');
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            allBounds.push([lat, lng]);

            // Google Earth'teki sarı raptiye stili
            const pinIcon = L.divIcon({
              className: 'custom-pin',
              html: `<div style="
                background-color: #ffd166;
                width: 22px;
                height: 22px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 2px solid #000;
                box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
              "><div style="width: 6px; height: 6px; background: #000; border-radius: 50%; transform: rotate(45deg);"></div></div>`,
              iconSize: [24, 24],
              iconAnchor: [6, 22]
            });

            const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
            marker.bindPopup(`<strong>${name}</strong><br/>${desc}`);
          }
        }
      }
    }

    if (allBounds.length > 0) {
      map.fitBounds(allBounds, { padding: [50, 50] });
      document.getElementById('status').innerText = `Rotalar yüklendi: ${pathCount} hat aktif.`;
    }
  })
  .catch(err => {
    console.error("Yükleme hatası:", err);
    document.getElementById('status').innerText = "Hata: " + err.message;
  });

// --- 4. GPS Canlı Konum ---
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
      fillColor: '#00e5ff',
      color: '#ffffff',
      weight: 3,
      fillOpacity: 1
    }).addTo(map).bindPopup("Mevcut Konum").openPopup();
  }
});

map.on('locationerror', function(e) {
  document.getElementById('status').innerText = "GPS hatası: " + e.message;
});
