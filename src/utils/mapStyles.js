// Onyx Waypoint: Stealth Obsidian Map Theme
// Designed for high-contrast visibility on iPhone 16 Pro

export const obsidianStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#71717A" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#000000" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#3f3f46" }] },
  { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
  // Subtle POI Labels (Stealth Mode)
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#3F3F46" }] },
  { "featureType": "poi", "elementType": "labels.text.stroke", "stylers": [{ "color": "#000000" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "on" }] },
  { "featureType": "poi.business", "stylers": [{ "visibility": "on" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#09090b" }] },
  
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1c1c1f" }] }, 
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#27272a" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#27272a" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#3f3f46" }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#27272a" }] },
  { "featureType": "transit.station", "stylers": [{ "visibility": "on" }] },
  { "featureType": "transit.station", "elementType": "labels.icon", "stylers": [{ "visibility": "on" }, { "hue": "#C084FC" }, { "saturation": 50 }, { "lightness": -20 }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#09090b" }] }
];
