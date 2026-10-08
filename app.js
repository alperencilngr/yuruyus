const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [32.747, 40.662],
  zoom: 13,
  pitch: 45
});

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

      // Mavi Yol
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
      console.error('KML yükleme hatası:', err);
      document.getElementById('status').innerText = 'Hata oluştu';
    });
});

// Orijinal "Beni Patikaya Oturt" Butonu
function locateAndSnapToTrail() {
  if (!navigator.geolocation) {
    alert('Tarayıcınız konum servisini desteklemiyor.');
    return;
  }

  document.getElementById('status').innerText = 'Konum alınıyor...';

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
      document.getElementById('status').innerText = 'Konum Bulundu';
    },
    (err) => {
      alert('Konum alınamadı: ' + err.message);
      document.getElementById('status').innerText = 'Konum Hatası';
    },
    { enableHighAccuracy: true }
  );
}
