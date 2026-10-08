// Harita Başlatma
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [32.747, 40.662],
  zoom: 13,
  pitch: 45
});

let userMarker = null;
let headingConeEl = null;
let currentCoords = null;
let orientationActive = false;

// KML Yükleme
map.on('load', () => {
  fetch('rota.kml')
    .then(res => res.text())
    .then(kmlText => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      const placemarks = xmlDoc.getElementsByTagName('Placemark');

      const geojson = {
        type: 'FeatureCollection',
        features: []
      };

      for (let pm of placemarks) {
        const name = pm.getElementsByTagName('name')[0]?.textContent || '';
        const line = pm.getElementsByTagName('LineString')[0];
        const point = pm.getElementsByTagName('Point')[0];

        if (line) {
          const coordText = line.getElementsByTagName('coordinates')[0]?.textContent.trim() || '';
          const rawPairs = coordText.split(/\s+/);
          const coords = rawPairs.map(p => {
            const [lng, lat] = p.split(',').map(Number);
            return [lng, lat];
          }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

          geojson.features.push({
            type: 'Feature',
            properties: { name: name },
            geometry: { type: 'LineString', coordinates: coords }
          });
        } else if (point) {
          const coordText = point.getElementsByTagName('coordinates')[0]?.textContent.trim() || '';
          const [lng, lat] = coordText.split(',').map(Number);
          if (!isNaN(lng) && !isNaN(lat)) {
            new maplibregl.Marker({ color: '#ffcc00' })
              .setLngLat([lng, lat])
              .setPopup(new maplibregl.Popup().setText(name))
              .addTo(map);
          }
        }
      }

      map.addSource('trails', { type: 'geojson', data: geojson });

      // Mavi Ana Hat
      map.addLayer({
        id: 'trail-blue',
        type: 'line',
        source: 'trails',
        filter: ['!=', 'name', 'sevgi'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#007aff', 'line-width': 4 }
      });

      // Kırmızı Sevgi Yolu
      map.addLayer({
        id: 'trail-red',
        type: 'line',
        source: 'trails',
        filter: ['==', 'name', 'sevgi'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ff3b30', 'line-width': 4 }
      });
    })
    .catch(err => console.error('KML Yüklenemedi:', err));

  // Canlı GPS Başlat
  startLiveTracking();
});

// Kullanıcı İşaretçisi Oluşturma
function createUserMarker(lngLat) {
  const container = document.createElement('div');
  container.className = 'user-location-marker';

  const cone = document.createElement('div');
  cone.className = 'user-heading-cone';
  headingConeEl = cone;

  const dot = document.createElement('div');
  dot.className = 'user-dot';

  container.appendChild(cone);
  container.appendChild(dot);

  userMarker = new maplibregl.Marker({ element: container })
    .setLngLat(lngLat)
    .addTo(map);
}

// 1. Canlı Konum Takibi
function startLiveTracking() {
  if (!navigator.geolocation) {
    document.getElementById('status').innerText = 'GPS desteklenmiyor';
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      const lngLat = [pos.coords.longitude, pos.coords.latitude];
      currentCoords = lngLat;
      document.getElementById('status').innerText = 'GPS Aktif';

      if (!userMarker) {
        createUserMarker(lngLat);
      } else {
        userMarker.setLngLat(lngLat);
      }
    },
    (err) => {
      document.getElementById('status').innerText = 'GPS Alınamadı';
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
}

// 2. Telefon Pusula Dinleyicisi
function enableOrientation() {
  if (orientationActive) return;

  // iOS 13+ İzin Protokolü
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
          orientationActive = true;
        }
      })
      .catch(console.error);
  } else {
    // Android ve Standart Tarayıcılar
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
    orientationActive = true;
  }
}

function handleOrientation(e) {
  let compass = null;

  if (e.webkitCompassHeading) {
    compass = e.webkitCompassHeading;
  } else if (e.alpha !== null) {
    compass = 360 - e.alpha;
  }

  if (compass !== null && headingConeEl) {
    headingConeEl.style.transform = `rotate(${compass}deg)`;
  }
}

// "Beni Patikaya Oturt" Butonu
function locateAndSnapToTrail() {
  enableOrientation();

  if (currentCoords) {
    map.flyTo({ center: currentCoords, zoom: 16 });
  } else {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lngLat = [pos.coords.longitude, pos.coords.latitude];
        currentCoords = lngLat;
        if (!userMarker) createUserMarker(lngLat);
        map.flyTo({ center: lngLat, zoom: 16 });
      },
      () => alert('Konum alınamadı, GPS iznini kontrol edin.')
    );
  }
}
