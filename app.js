// Google Uydu Altlığı ve 3D Arazi (Terrain) Katmanı
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      'google-satellite': {
        type: 'raster',
        tiles: [
          'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
        ],
        tileSize: 256
      },
      'terrain-source': {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15
      }
    },
    layers: [
      {
        id: 'google-satellite-layer',
        type: 'raster',
        source: 'google-satellite',
        paint: {}
      }
    ],
    terrain: {
      source: 'terrain-source',
      exaggeration: 1.3
    }
  },
  center: [32.747, 40.662],
  zoom: 13.5,
  pitch: 50,
  bearing: -10,
  maxPitch: 85
});

// Kontroller
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

let userMarker = null;

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

      document.getElementById('status').innerText = 'Rota Yüklendi';
    })
    .catch(err => {
      console.error('KML yüklenirken hata:', err);
      document.getElementById('status').innerText = 'Rota yüklenemedi';
    });
});

// "Beni Patikaya Oturt" Butonu
function locateAndSnapToTrail() {
  if (!navigator.geolocation) {
    alert('Tarayıcınız konum servisini desteklemiyor.');
    return;
  }

  document.getElementById('status').innerText = 'Konum aranıyor...';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const userLng = pos.coords.longitude;
      const userLat = pos.coords.latitude;

      if (!userMarker) {
        userMarker = new maplibregl.Marker({ color: '#007aff' })
          .setLngLat([userLng, userLat])
          .addTo(map);
      } else {
        userMarker.setLngLat([userLng, userLat]);
      }

      map.flyTo({ center: [userLng, userLat], zoom: 16 });
      document.getElementById('status').innerText = 'Konumdasınız';
    },
    (err) => {
      alert('Konum alınamadı: ' + err.message);
      document.getElementById('status').innerText = 'Konum hatası';
    },
    { enableHighAccuracy: true }
  );
}
