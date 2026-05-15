import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Navigation, Compass, Search, X, Home, Plus, CheckCircle2, Zap, ArrowUpRight,
  Maximize, Minimize, Map as MapIcon, Star, Camera, Activity, Target
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { obsidianStyle } from './utils/mapStyles';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// FUJISAWA STATION - THE ABSOLUTE HOME BASE
const ONYX_HOME_BASE = { lat: 35.3372, lng: 139.4872, name: "FUJISAWA STATION" };

const EMERGENCY_NODES = [
  { city: "US Embassy Tokyo", lat: 35.6672, lng: 139.7424, category: "Emergency", description: "Diplomatic Protection" },
  { city: "St. Luke's Hospital", lat: 35.6669, lng: 139.7752, category: "Emergency", description: "Major Medical Center" },
  { city: "Tokyo Metropolitan Police", lat: 35.6771, lng: 139.7523, category: "Emergency", description: "Central HQ" }
];

const CATEGORIES = ["All", "Emergency", "Retail", "Hotel", "Transit", "Nature", "Entertainment"];

export default function App() {
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const mapInstance = useRef(null);
  const trafficLayerRef = useRef(null);
  const markersRef = useRef([]);
  const emergencyMarkersRef = useRef([]);
  const currentRouteRef = useRef(null);
  const pulseLineRef = useRef(null);
  const selectedNodesRef = useRef([]);
  const animationIntervalRef = useRef(null);
  const homeMarkerRef = useRef(null);

  const [isBladeExpanded, setIsBladeExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  
  const [homeBase, setHomeBase] = useState(() => {
    const saved = localStorage.getItem('onyx_waypoint_home');
    const parsed = saved ? JSON.parse(saved) : null;
    return (parsed && parsed.name === ONYX_HOME_BASE.name) ? parsed : ONYX_HOME_BASE;
  });
  
  const [nextStop, setNextStop] = useState({
    name: "DESTINATION",
    distance: "0KM",
    eta: "0 MIN",
    step: "Lattice Sync Active",
    rating: null,
    photo: null,
    transitLines: []
  });

  const [itinerary, setItinerary] = useState(() => {
    return JSON.parse(localStorage.getItem('onyx_itinerary_locations') || '[]');
  });

  useEffect(() => {
    localStorage.setItem('onyx_waypoint_home', JSON.stringify(homeBase));
  }, [homeBase]);

  useEffect(() => {
    if (mapInstance.current) {
      syncMarkers(mapInstance.current);
    }
  }, [activeFilter, itinerary]);

  useEffect(() => {
    if (mapInstance.current) {
      if (showTraffic) {
        if (!trafficLayerRef.current) trafficLayerRef.current = new window.google.maps.TrafficLayer();
        trafficLayerRef.current.setMap(mapInstance.current);
      } else if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    }
  }, [showTraffic]);

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&callback=initMap`;
      script.async = true;
      script.defer = true;
      window.initMap = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    const pollInterval = setInterval(() => {
      const currentData = JSON.parse(localStorage.getItem('onyx_itinerary_locations') || '[]');
      if (JSON.stringify(currentData) !== JSON.stringify(itinerary)) {
        setItinerary(currentData);
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
    };
  }, []);

  function initMap() {
    if (mapInstance.current) return;
    try {
      const gMap = new window.google.maps.Map(mapRef.current, {
        center: homeBase,
        zoom: 15,
        styles: obsidianStyle,
        disableDefaultUI: true,
        backgroundColor: '#000000',
        clickableIcons: true,
        gestureHandling: "greedy"
      });
      mapInstance.current = gMap;
      
      homeMarkerRef.current = new window.google.maps.Marker({
        position: ONYX_HOME_BASE,
        map: gMap,
        title: "HOME BASE",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeColor: '#C084FC',
          strokeWeight: 2,
          scale: 8,
        },
        zIndex: 999
      });
      homeMarkerRef.current.addListener('click', () => {
        const latLng = new window.google.maps.LatLng(ONYX_HOME_BASE.lat, ONYX_HOME_BASE.lng);
        handleNodeSelection(gMap, latLng, { city: "FUJISAWA STATION", description: "Home Base", category: "Transit" }, homeMarkerRef.current);
      });

      syncMarkers(gMap);

      const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
        componentRestrictions: { country: "jp" },
        fields: ["geometry", "name", "formatted_address", "place_id"]
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) return;
        setIsSearchExpanded(false);
        fetchRichData(gMap, place.place_id, place.geometry.location, { city: place.name, description: place.formatted_address, category: "Urban" });
      });

      gMap.addListener('click', (e) => {
        if (e.placeId) {
          e.stop();
          fetchRichData(gMap, e.placeId, e.latLng, null);
        } else {
          const service = new window.google.maps.places.PlacesService(gMap);
          service.nearbySearch({ location: e.latLng, radius: 50, type: ['point_of_interest'] }, (results, status) => {
            if (status === 'OK' && results[0]) {
              fetchRichData(gMap, results[0].place_id, results[0].geometry.location, null);
            } else {
              const geocoder = new window.google.maps.Geocoder();
              geocoder.geocode({ location: e.latLng }, (results, status) => {
                if (status === 'OK' && results[0]) {
                  const res = results[0];
                  handleNodeSelection(gMap, e.latLng, { city: res.formatted_address.split(',')[0], description: res.formatted_address, category: "Point" }, null);
                }
              });
            }
          });
        }
      });
    } catch (err) {
      console.error("ONYX SYSTEM: Map Initialization Error", err);
    }
  }

  function fetchRichData(gMap, placeId, pos, basicData) {
    const service = new window.google.maps.places.PlacesService(gMap);
    service.getDetails({ 
      placeId: placeId,
      fields: ["name", "rating", "photos", "formatted_address", "types", "geometry"]
    }, (place, status) => {
      if (status === 'OK') {
        const loc = { 
          city: place.name, 
          description: place.formatted_address, 
          category: place.types?.[0]?.charAt(0).toUpperCase() + place.types?.[0]?.slice(1) || "Point",
          rating: place.rating, 
          photo: place.photos ? place.photos[0].getUrl({ maxWidth: 800 }) : null 
        };
        handleNodeSelection(gMap, place.geometry.location, loc, null);
      } else if (basicData) {
        handleNodeSelection(gMap, pos, basicData, null);
      }
    });
  }

  function syncMarkers(gMap) {
    markersRef.current.forEach(m => m.setMap(null));
    emergencyMarkersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    emergencyMarkersRef.current = [];

    const geocoder = new window.google.maps.Geocoder();

    EMERGENCY_NODES.forEach(node => {
      if (activeFilter === "All" || activeFilter === "Emergency") {
        const marker = new window.google.maps.Marker({
          position: { lat: node.lat, lng: node.lng },
          map: gMap,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#EF4444',
            fillOpacity: 0.8,
            strokeColor: '#FFFFFF',
            strokeWeight: 1,
            scale: 3,
          }
        });
        marker.addListener('click', () => {
          const latLng = new window.google.maps.LatLng(node.lat, node.lng);
          handleNodeSelection(gMap, latLng, node, marker);
        });
        emergencyMarkersRef.current.push(marker);
      }
    });

    itinerary.forEach((loc) => {
      if (activeFilter === "All" || activeFilter === loc.category) {
        if (loc.lat && loc.lng) {
          createMarker(gMap, new window.google.maps.LatLng(loc.lat, loc.lng), loc);
        } else {
          geocoder.geocode({ address: `${loc.city}, Japan` }, (results, status) => {
            if (status === 'OK') {
              createMarker(gMap, results[0].geometry.location, loc);
            }
          });
        }
      }
    });
  }

  function createMarker(gMap, pos, loc) {
    const marker = new window.google.maps.Marker({
      position: pos,
      map: gMap,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#C084FC',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 1.5,
        scale: 5,
      }
    });
    marker.addListener('click', () => handleNodeSelection(gMap, pos, loc, marker));
    markersRef.current.push(marker);
  }

  function handleNodeSelection(gMap, pos, loc, marker) {
    if (!pos) return;
    setSelectedLocation({ ...loc, pos });
    
    selectedNodesRef.current.forEach(n => n.marker && n.marker.setIcon({
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: '#C084FC',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 1.5,
      scale: 5,
    }));
    selectedNodesRef.current = [];
    if (currentRouteRef.current) currentRouteRef.current.setMap(null);
    if (pulseLineRef.current) pulseLineRef.current.setMap(null);

    if (marker && marker !== homeMarkerRef.current) {
      selectedNodesRef.current.push({ pos, loc, marker });
      marker.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        strokeColor: '#C084FC',
        strokeWeight: 2,
        scale: 7,
      });
    }

    calculateRoute(gMap, homeBase, pos, loc);
  }

  function calculateRoute(gMap, origin, destination, locData) {
    if (!window.google?.maps?.geometry) return;

    const originLatLng = new window.google.maps.LatLng(origin.lat, origin.lng);
    const destLatLng = (destination instanceof window.google.maps.LatLng) ? destination : new window.google.maps.LatLng(destination.lat, destination.lng);

    const dist = window.google.maps.geometry.spherical.computeDistanceBetween(originLatLng, destLatLng);

    if (dist < 15) {
      setNextStop({
        name: (locData.city || locData.name || "HOME").toUpperCase(),
        distance: "0M",
        eta: "ARRIVED",
        step: "You are currently at the Main Home Base.",
        rating: locData.rating || null,
        photo: locData.photo || null,
        transitLines: []
      });
      setIsBladeExpanded(true);
      gMap.panTo(destLatLng);
      return;
    }

    const service = new window.google.maps.DirectionsService();
    service.route({
      origin: originLatLng,
      destination: destLatLng,
      travelMode: window.google.maps.TravelMode.TRANSIT,
      transitOptions: { departureTime: new Date() }
    }, (result, status) => {
      if (status === 'OK') {
        renderOnyxRoute(gMap, result, locData, destLatLng, originLatLng);
      } else {
        service.route({
          origin: originLatLng,
          destination: destLatLng,
          travelMode: window.google.maps.TravelMode.WALKING
        }, (walkResult, walkStatus) => {
          if (walkStatus === 'OK') {
            renderOnyxRoute(gMap, walkResult, locData, destLatLng, originLatLng);
          }
        });
      }
    });
  }

  function renderOnyxRoute(gMap, result, locData, destination, origin) {
    if (currentRouteRef.current) currentRouteRef.current.setMap(null);
    if (pulseLineRef.current) pulseLineRef.current.setMap(null);
    if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);

    const route = result.routes[0].legs[0];
    const transitLines = route.steps
      .filter(step => step.transit)
      .map(step => ({
        name: step.transit.line.short_name || step.transit.line.name,
        color: step.transit.line.color || '#C084FC'
      }));

    currentRouteRef.current = new window.google.maps.Polyline({
      path: result.routes[0].overview_path,
      geodesic: true,
      strokeColor: '#C084FC',
      strokeOpacity: 0.15,
      strokeWeight: 2,
      map: gMap
    });

    pulseLineRef.current = new window.google.maps.Polyline({
      path: result.routes[0].overview_path,
      geodesic: true,
      strokeColor: '#C084FC',
      strokeOpacity: 0.8,
      strokeWeight: 1.5,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 2, scale: 2, strokeColor: '#FFFFFF' },
        offset: '0%',
        repeat: '80px'
      }],
      map: gMap
    });

    let count = 0;
    animationIntervalRef.current = setInterval(() => {
      count = (count + 1) % 200;
      const icons = pulseLineRef.current?.get('icons');
      if (icons && icons[0]) {
        icons[0].offset = (count / 2) + 'px';
        pulseLineRef.current.set('icons', icons);
      }
    }, 25);

    setNextStop({
      name: (locData.city || locData.name || "TARGET").toUpperCase(),
      distance: route.distance.text,
      eta: route.duration.text,
      step: route.steps[0].instructions.replace(/<[^>]*>?/gm, ''),
      rating: locData.rating || null,
      photo: locData.photo || null,
      transitLines: transitLines
    });
    setIsBladeExpanded(true);
    
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(origin);
    bounds.extend(destination);
    gMap.fitBounds(bounds, { top: 150, bottom: 250, left: 50, right: 50 });
  }

  const locateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapInstance.current?.panTo(coords);
        mapInstance.current?.setZoom(15);
      });
    }
  };

  const zoomIn = () => mapInstance.current?.setZoom(mapInstance.current.getZoom() + 1);
  const zoomOut = () => mapInstance.current?.setZoom(mapInstance.current.getZoom() - 1);

  const openInExternalMaps = () => {
    if (!selectedLocation) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${homeBase.lat},${homeBase.lng}&destination=${selectedLocation.pos.lat?.() || selectedLocation.pos.lat},${selectedLocation.pos.lng?.() || selectedLocation.pos.lng}&travelmode=transit`;
    window.open(url, '_blank');
  };

  const addToLattice = () => {
    if (!selectedLocation) return;
    const current = JSON.parse(localStorage.getItem('onyx_itinerary_locations') || '[]');
    if (current.find(l => l.city === selectedLocation.city)) return;
    const updated = [...current, { city: selectedLocation.city, kanji: "", category: selectedLocation.category || "Urban", budget: 0, priority: 5, description: selectedLocation.description }];
    localStorage.setItem('onyx_itinerary_locations', JSON.stringify(updated));
    setItinerary(updated);
  };

  const resetHomeBase = () => {
    setHomeBase(ONYX_HOME_BASE);
    const latLng = new window.google.maps.LatLng(ONYX_HOME_BASE.lat, ONYX_HOME_BASE.lng);
    handleNodeSelection(mapInstance.current, latLng, { city: "FUJISAWA STATION", description: "Home Base", category: "Transit" }, homeMarkerRef.current);
    mapInstance.current?.panTo(latLng);
    mapInstance.current?.setZoom(15);
  };

  const isLocationInLattice = selectedLocation && itinerary.find(l => l.city === selectedLocation.city);

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col font-['Outfit'] overflow-hidden">
      <div className="fixed top-0 left-0 right-0 z-20 pointer-events-none p-4 pt-[env(safe-area-inset-top)] flex flex-col gap-3">
        <div className="flex justify-between items-start gap-3">
          <motion.div layout onClick={resetHomeBase} className="bg-black/80 backdrop-blur-xl border border-white/10 p-2.5 rounded-xl flex flex-col pointer-events-auto shadow-2xl shrink-0 cursor-pointer hover:border-onyx-purple/50 transition-colors">
            <span className="text-[7px] font-black text-onyx-purple uppercase tracking-[0.4em] mb-0.5 opacity-60">Waypoint</span>
            <div className="flex items-center gap-1.5">
              <Home className="w-2 h-2 text-onyx-purple" />
              <span className="text-[9px] font-mono font-bold tracking-tighter opacity-90 uppercase">{homeBase.name?.replace(/_/g, ' ')}</span>
            </div>
          </motion.div>

          <motion.div layout initial={false} animate={{ width: isSearchExpanded ? "calc(100vw - 32px)" : "40px", flex: isSearchExpanded ? "1 1 0%" : "0 0 auto" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex items-center overflow-hidden pointer-events-auto shadow-2xl">
            <button onClick={() => setIsSearchExpanded(!isSearchExpanded)} className="w-10 h-10 flex items-center justify-center shrink-0 text-onyx-purple hover:bg-white/5 active:scale-90 transition-transform">
              <Search className="w-3.5 h-3.5" />
            </button>
            <motion.input animate={{ opacity: isSearchExpanded ? 1 : 0, x: isSearchExpanded ? 0 : -10 }} style={{ pointerEvents: isSearchExpanded ? "auto" : "none", width: isSearchExpanded ? "100%" : "0px", overflow: "hidden" }} ref={searchInputRef} type="text" placeholder="SEARCH GRID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent border-none focus:ring-0 text-[10px] font-bold tracking-widest p-0 pr-4 placeholder:text-zinc-800" />
          </motion.div>

          <motion.div layout className="bg-black/80 backdrop-blur-xl border border-white/10 px-3 rounded-xl flex items-center gap-2 pointer-events-auto shadow-2xl h-[40px] shrink-0">
            <span className="text-xs font-black tabular-nums tracking-tighter opacity-80">
              {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
            </span>
          </motion.div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveFilter(cat)} className={cn("px-2.5 py-1 rounded-md text-[7px] font-black uppercase tracking-widest border transition-all whitespace-nowrap", activeFilter === cat ? "bg-onyx-purple border-onyx-purple text-black" : "bg-black/60 border-white/5 text-onyx-muted")}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3 pointer-events-none">
        <button onClick={locateUser} className="w-10 h-10 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center text-white pointer-events-auto hover:bg-onyx-purple hover:text-black transition-all shadow-2xl"><Target className="w-4 h-4" /></button>
        <button onClick={() => setShowTraffic(!showTraffic)} className={cn("w-10 h-10 bg-black/80 backdrop-blur-xl border rounded-xl flex items-center justify-center pointer-events-auto transition-all shadow-2xl", showTraffic ? "border-onyx-purple text-onyx-purple" : "border-white/10 text-white hover:border-white/30")}><Activity className="w-4 h-4" /></button>
        <div className="flex flex-col bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl pointer-events-auto overflow-hidden shadow-2xl">
          <button onClick={zoomIn} className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 border-bottom border-white/5"><Maximize className="w-3.5 h-3.5" /></button>
          <button onClick={zoomOut} className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10"><Minimize className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div ref={mapRef} className="flex-1 w-full bg-black" />

      <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1} onDragEnd={(e, info) => { if (info.offset.y > 50) setIsBladeExpanded(false); if (info.offset.y < -50) setIsBladeExpanded(true); }} animate={{ height: isBladeExpanded ? "65%" : "84px", y: 0 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="bg-black/95 backdrop-blur-2xl border-t border-white/10 rounded-t-[24px] p-5 pt-7 relative z-30 shadow-[0_-20px_60_rgba(0,0,0,1)] touch-none">
        <div onClick={() => setIsBladeExpanded(!isBladeExpanded)} className="absolute top-2.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/10 rounded-full cursor-pointer hover:bg-onyx-purple/40" />
        <div className="flex items-start justify-between">
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[8px] font-black text-onyx-purple uppercase tracking-[0.4em]">Target Node</span>
              {nextStop.rating && <div className="flex items-center gap-1 bg-onyx-purple/10 px-1.5 py-0.5 rounded-full"><Star className="w-2 h-2 text-onyx-purple fill-onyx-purple" /><span className="text-[8px] font-bold text-onyx-purple">{nextStop.rating}</span></div>}
            </div>
            <h2 className="text-lg font-black tracking-tight uppercase leading-tight">{nextStop.name?.replace(/_/g, ' ')}</h2>
            <div className="flex items-center gap-3 mt-1 opacity-60"><span className="text-sm font-black tabular-nums">{nextStop.distance}</span><div className="w-1 h-1 bg-zinc-700 rounded-full" /><span className="text-[9px] font-bold uppercase tracking-widest">{nextStop.eta}</span></div>
          </div>
          <button onClick={openInExternalMaps} className="w-10 h-10 rounded-xl bg-onyx-purple/10 border border-onyx-purple/20 flex items-center justify-center text-onyx-purple hover:bg-onyx-purple hover:text-black transition-all pointer-events-auto shrink-0"><ArrowUpRight className="w-5 h-5" /></button>
        </div>
        <AnimatePresence>
          {isBladeExpanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 space-y-6 overflow-y-auto no-scrollbar pb-10">
              {nextStop.photo && <div className="w-full h-48 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center"><img src={nextStop.photo} alt="POI" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" /></div>}
              {nextStop.transitLines.length > 0 && <div className="flex gap-2">{nextStop.transitLines.map((line, idx) => (<div key={idx} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: line.color }} /><span className="text-[10px] font-black uppercase tracking-widest">{line.name}</span></div>))}</div>}
              <div className="flex items-start gap-3 opacity-90"><Zap className="w-3.5 h-3.5 text-onyx-purple shrink-0 mt-0.5" /><p className="text-sm font-bold leading-snug tracking-tight">{nextStop.step}</p></div>
              <div className="flex items-center gap-2 pt-2">
                <button onClick={resetHomeBase} className="flex-1 py-3 border border-onyx-purple/30 bg-onyx-purple/5 rounded-lg flex items-center justify-center gap-2 hover:bg-onyx-purple/10 active:scale-95 transition-all"><Target className="w-3 h-3 text-onyx-purple" /><span className="text-[8px] font-black uppercase tracking-[0.2em]">Reset Home</span></button>
                <button onClick={addToLattice} disabled={isLocationInLattice} className={cn("flex-1 py-3 border rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-all", isLocationInLattice ? "border-onyx-purple/40 bg-onyx-purple/5 opacity-80" : "border-white/5 hover:bg-white/5")}>{isLocationInLattice ? (<><CheckCircle2 className="w-3 h-3 text-onyx-purple" /><span className="text-[8px] font-black uppercase tracking-[0.2em]">In Lattice</span></>) : (<><Plus className="w-3 h-3 text-white" /><span className="text-[8px] font-black uppercase tracking-[0.2em]">Add Lattice</span></>)}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
