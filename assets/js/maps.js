// ============================================================
// FoodRescue — Google Maps Integration
// ============================================================

// NOTE: Include Maps JS API in HTML before this module:
// <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&libraries=places,visualization&callback=initMapsReady" defer></script>

let mapsReady = false;
const mapCallbacks = [];

window.initMapsReady = function() {
  mapsReady = true;
  mapCallbacks.forEach(cb => cb());
};

function onMapsReady(cb) {
  if (mapsReady) cb();
  else mapCallbacks.push(cb);
}

// ── Initialize Map ──────────────────────────────────────────

export function initMap(containerId, options = {}) {
  return new Promise((resolve) => {
    onMapsReady(() => {
      const defaults = {
        center: { lat: 21.1702, lng: 72.8311 }, // Surat, Gujarat
        zoom: 13,
        styles: getDarkMapStyles(),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      };
      const map = new google.maps.Map(
        document.getElementById(containerId),
        { ...defaults, ...options }
      );
      resolve(map);
    });
  });
}

export function initLightMap(containerId, options = {}) {
  return new Promise((resolve) => {
    onMapsReady(() => {
      const defaults = {
        center: { lat: 21.1702, lng: 72.8311 },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false
      };
      const map = new google.maps.Map(
        document.getElementById(containerId),
        { ...defaults, ...options }
      );
      resolve(map);
    });
  });
}

// ── Add Marker ──────────────────────────────────────────────

export function addMarker(map, position, options = {}) {
  return new google.maps.Marker({
    map,
    position,
    title: options.title || '',
    icon: options.icon || null,
    animation: options.animation || null,
    ...options
  });
}

export function addRestaurantMarker(map, position, title) {
  return addMarker(map, position, {
    title,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: '#f5921e',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2
    },
    animation: google.maps.Animation.DROP
  });
}

export function addNGOMarker(map, position, title) {
  return addMarker(map, position, {
    title,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: '#3578d4',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2
    }
  });
}

export function addVolunteerMarker(map, position, title) {
  return addMarker(map, position, {
    title,
    icon: {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 8,
      fillColor: '#3da668',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
      rotation: 0
    },
    animation: google.maps.Animation.BOUNCE
  });
}

// ── Draw Route (Directions API) ─────────────────────────────

export function drawRoute(map, origin, destination, waypoints = []) {
  return new Promise((resolve, reject) => {
    const directionsService  = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#3da668',
        strokeWeight: 4,
        strokeOpacity: 0.85
      }
    });
    directionsService.route({
      origin,
      destination,
      waypoints: waypoints.map(w => ({ location: w, stopover: true })),
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);
        const leg = result.routes[0].legs[0];
        resolve({ renderer: directionsRenderer, duration: leg.duration.text, distance: leg.distance.text });
      } else {
        reject(new Error(`Directions failed: ${status}`));
      }
    });
  });
}

// ── NGO Proximity rings ─────────────────────────────────────

export function drawDistanceRings(map, center) {
  [1, 3, 5].forEach((radius, i) => {
    new google.maps.Circle({
      map,
      center,
      radius: radius * 1000,
      strokeColor: ['#3da668', '#f7aa4a', '#d44c4c'][i],
      strokeOpacity: 0.4,
      strokeWeight: 1.5,
      fillOpacity: 0
    });
  });
}

// ── Places Autocomplete ─────────────────────────────────────

export function initPlacesAutocomplete(inputId, onSelect) {
  onMapsReady(() => {
    const input = document.getElementById(inputId);
    if (!input) return;
    const autocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: 'in' },
      fields: ['geometry', 'formatted_address', 'name']
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        onSelect({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address || place.name
        });
      }
    });
  });
}

// ── Map Picker Modal ────────────────────────────────────────

export function initMapPicker(mapId, onPick) {
  initLightMap(mapId).then(map => {
    let marker = null;
    navigator.geolocation.getCurrentPosition(pos => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setCenter(loc);
      marker = addMarker(map, loc, { title: 'Pickup Location', draggable: true });
      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        onPick({ lat: pos.lat(), lng: pos.lng() });
      });
      onPick(loc);
    }, () => {
      // Default to Surat
    });
    map.addListener('click', (e) => {
      const loc = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      if (marker) marker.setPosition(loc);
      else marker = addMarker(map, loc, { title: 'Pickup Location', draggable: true });
      onPick(loc);
    });
  });
}

// ── Google Maps Heatmap (Admin Analytics) ──────────────────

export function initHeatmap(map, points) {
  onMapsReady(() => {
    const heatmapData = points.map(p =>
      new google.maps.LatLng(p.lat, p.lng)
    );
    new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map,
      radius: 30,
      gradient: [
        'rgba(0, 255, 255, 0)',
        'rgba(0, 255, 255, 1)',
        'rgba(0, 191, 255, 1)',
        'rgba(0, 127, 255, 1)',
        'rgba(0, 63, 255, 1)',
        'rgba(0, 0, 255, 1)',
        'rgba(0, 0, 223, 1)',
        'rgba(0, 0, 191, 1)',
        'rgba(0, 0, 159, 1)',
        'rgba(0, 0, 127, 1)',
        'rgba(63, 0, 91, 1)',
        'rgba(127, 0, 63, 1)',
        'rgba(191, 0, 31, 1)',
        'rgba(255, 0, 0, 1)'
      ]
    });
  });
}

// ── Dark map styles ─────────────────────────────────────────

function getDarkMapStyles() {
  return [
    { elementType: 'geometry', stylers: [{ color: '#1a2e20' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a2e20' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9aa08a' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f4030' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#133d26' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2218' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] }
  ];
}
