import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Navigation, Map as MapIcon, Compass, Target, ArrowUpRight, 
  ChevronUp, Clock, Info, Search, Heart, Shield, Activity, 
  X, Home, Plus, CheckCircle2, Zap
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { obsidianStyle } from './utils/mapStyles';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const EMERGENCY_NODES = [
  { city: "US Embassy Tokyo", lat: 35.6672, lng: 139.7424, category: "Emergency", description: "Diplomatic Protection" },
  { city: "St. Luke's Hospital", lat: 35.6669, lng: 139.7752, category: "Emergency", description: "Major Medical Center" },
  { city: "Tokyo Metropolitan Police", lat: 35.6771, lng: 139.7523, category: "Emergency", description: "Central HQ" }
];

const CATEGORIES = ["All", "Emergency", "Retail", "Hotel", "Transit", "Nature", "Entertainment"];

export default function App() {
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isBladeExpanded, setIsBladeExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [homeBase, setHomeBase] = useState(() => {
    const saved = localStorage.getItem('onyx_waypoint_home');
    return saved ? JSON.parse(saved) : { lat: 35.3389, lng: 139.4894, name: "FUJISAWA_STATION" };
  });
  
  const [nextStop, setNextStop] = useState({
    name: "SHIBUYA_STATION",
    distance: "1.2KM",
    eta: "14 MIN",
    step: "Head North towards Hachiko Square"
  });

  const [itinerary, setItinerary] = useState(() => {
    return JSON.parse(localStorage.getItem('onyx_itinerary_locations') || '[]');
  });

  useEffect(() => {
    localStorage.setItem('onyx_waypoint_home', JSON.stringify(homeBase));
  }, [homeBase]);

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`;
      script.async = true;
      script.defer = true;
      window.initMap = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    let markers = [];
    let emergencyMarkers = [];
    let currentRoute = null;
    let selectedNodes = [];

    function syncMarkers(gMap) {
      markers.forEach(m => m.setMap(null));
      emergencyMarkers.forEach(m => m.setMap(null));
      markers = [];
      emergencyMarkers = [];

      const rawData = localStorage.getItem('onyx_itinerary_locations');
      const savedLocations = JSON.parse(rawData || '[]');
      setItinerary(savedLocations);
      
      const geocoder = new window.google.maps.Geocoder();
      const directionsService = new window.google.maps.DirectionsService();

      EMERGENCY_NODES.forEach(node => {
        if (activeFilter === "All" || activeFilter === "Emergency") {
          const marker = new window.google.maps.Marker({
            position: { lat: node.lat, lng: node.lng },
            map: gMap,
            title: node.city,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#EF4444',
              fillOpacity: 0.8,
              strokeColor: '#FFFFFF',
              strokeWeight: 1,
              scale: 3,
            }
          });
          marker.addListener('click', () => handleNodeSelection(gMap, directionsService, { lat: node.lat, lng: node.lng }, node, marker));
          emergencyMarkers.push(marker);
        }
      });

      savedLocations.forEach((loc) => {
        if (activeFilter === "All" || activeFilter === loc.category) {
          if (loc.lat && loc.lng) {
             const pos = { lat: loc.lat, lng: loc.lng };
             createMarker(gMap, pos, loc, directionsService);
          } else {
            geocoder.geocode({ address: `${loc.city}, Japan` }, (results, status) => {
              if (status === 'OK') {
                const pos = results[0].geometry.location;
                createMarker(gMap, pos, loc, directionsService);
              }
            });
          }
        }
      });
    }

    function createMarker(gMap, pos, loc, service) {
      const marker = new window.google.maps.Marker({
        position: pos,
        map: gMap,
        title: loc.city,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#C084FC',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 1.5,
          scale: 5,
        }
      });

      marker.addListener('click', () => handleNodeSelection(gMap, service, pos, loc, marker));
      markers.push(marker);
    }

    function handleNodeSelection(gMap, service, pos, loc, marker) {
      setSelectedLocation({ ...loc, pos });
      
      if (selectedNodes.length >= 2) {
        selectedNodes.forEach(n => n.marker && n.marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#C084FC',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 1.5,
          scale: 5,
        }));
        selectedNodes = [];
        if (currentRoute) currentRoute.setMap(null);
      }

      if (marker) {
        selectedNodes.push({ pos, loc, marker });
        marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeColor: '#C084FC',
          strokeWeight: 2,
          scale: 7,
        });
      }

      const origin = homeBase;
      calculateRoute(gMap, service, origin, pos, loc);
    }

    function calculateRoute(gMap, service, origin, destination, locData) {
      if (currentRoute) currentRoute.setMap(null);

      service.route({
        origin: origin,
        destination: destination,
        travelMode: window.google.maps.TravelMode.TRANSIT,
        transitOptions: { departureTime: new Date() }
      }, (result, status) => {
        if (status === 'OK') {
          renderOnyxRoute(gMap, result, locData, destination, origin);
        } else {
          service.route({
            origin: origin,
            destination: destination,
            travelMode: window.google.maps.TravelMode.WALKING
          }, (walkResult, walkStatus) => {
            if (walkStatus === 'OK') {
              renderOnyxRoute(gMap, walkResult, locData, destination, origin);
            }
          });
        }
      });
    }

    function renderOnyxRoute(gMap, result, locData, destination, origin) {
      const route = result.routes[0].legs[0];
      
      currentRoute = new window.google.maps.Polyline({
        path: result.routes[0].overview_path,
        geodesic: true,
        strokeColor: '#C084FC',
        strokeOpacity: 0.15,
        strokeWeight: 2,
        map: gMap
      });

      const pulseLine = new window.google.maps.Polyline({
        path: result.routes[0].overview_path,
        geodesic: true,
        strokeColor: '#C084FC',
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            strokeWeight: 2,
            scale: 2,
            strokeColor: '#FFFFFF'
          },
          offset: '0%',
          repeat: '80px'
        }],
        map: gMap
      });

      let count = 0;
      const animate = setInterval(() => {
        count = (count + 1) % 200;
        const icons = pulseLine.get('icons');
        if (icons && icons[0]) {
          icons[0].offset = (count / 2) + 'px';
          pulseLine.set('icons', icons);
        }
      }, 25);

      const oldSetMap = currentRoute.setMap;
      currentRoute.setMap = function(map) {
        oldSetMap.call(this, map);
        pulseLine.setMap(map);
        if (!map) clearInterval(animate);
      };

      setNextStop({
        name: (locData.city || locData.name || "TARGET").toUpperCase(),
        distance: route.distance.text,
        eta: route.duration.text,
        step: route.steps[0].instructions.replace(/<[^>]*>?/gm, '')
      });
      setIsBladeExpanded(true);
      
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destination);
      gMap.fitBounds(bounds, { top: 150, bottom: 250, left: 50, right: 50 });
    }

    function initMap() {
      try {
        const gMap = new window.google.maps.Map(mapRef.current, {
          center: homeBase,
          zoom: 12,
          styles: obsidianStyle,
          disableDefaultUI: true,
          backgroundColor: '#000000',
          clickableIcons: true,
        });
        setMap(gMap);
        syncMarkers(gMap);

        let lastData = localStorage.getItem('onyx_itinerary_locations');
        const pollInterval = setInterval(() => {
          const currentData = localStorage.getItem('onyx_itinerary_locations');
          if (currentData !== lastData) {
            lastData = currentData;
            syncMarkers(gMap);
          }
        }, 3000);

        const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
          componentRestrictions: { country: "jp" },
          fields: ["geometry", "name", "formatted_address"]
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;
          setIsSearchExpanded(false);
          handleNodeSelection(gMap, new window.google.maps.DirectionsService(), place.geometry.location, { city: place.name, description: place.formatted_address, category: "Urban" }, null);
        });

        gMap.addListener('click', (e) => {
          if (e.placeId) {
            e.stop();
            const service = new window.google.maps.places.PlacesService(gMap);
            service.getDetails({ placeId: e.placeId }, (place, status) => {
              if (status === 'OK') {
                handleNodeSelection(gMap, new window.google.maps.DirectionsService(), place.geometry.location, { city: place.name, description: place.formatted_address, category: "Urban" }, null);
              }
            });
          }
        });

        window.addEventListener('storage', (e) => {
          if (e.key === 'onyx_itinerary_locations') syncMarkers(gMap);
        });
      } catch (err) {
        console.error("ONYX SYSTEM: Map Initialization Error", err);
      }
    }
  }, [activeFilter]);

  const addToLattice = () => {
    if (!selectedLocation) return;
    const current = JSON.parse(localStorage.getItem('onyx_itinerary_locations') || '[]');
    if (current.find(l => l.city === selectedLocation.city)) return;
    const updated = [...current, { city: selectedLocation.city, kanji: "", category: selectedLocation.category || "Urban", budget: 0, priority: 5, description: selectedLocation.description }];
    localStorage.setItem('onyx_itinerary_locations', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    setItinerary(updated);
  };

  const updateHomeBase = () => {
    if (!selectedLocation) return;
    setHomeBase({ lat: selectedLocation.pos.lat(), lng: selectedLocation.pos.lng(), name: selectedLocation.city.toUpperCase() });
  };

  const isLocationInLattice = selectedLocation && itinerary.find(l => l.city === selectedLocation.city);

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col font-['Outfit'] overflow-hidden">

      {/* Top HUD Overlays */}
      <div className="fixed top-0 left-0 right-0 z-20 pointer-events-none p-4 pt-[env(safe-area-inset-top)] flex flex-col gap-3">
        
        <div className="flex justify-between items-start gap-3">
          <motion.div layout className="bg-black/80 backdrop-blur-xl border border-white/10 p-2.5 rounded-xl flex flex-col pointer-events-auto shadow-2xl shrink-0">
            <span className="text-[7px] font-black text-onyx-purple uppercase tracking-[0.4em] mb-0.5 opacity-60">Waypoint</span>
            <div className="flex items-center gap-1.5">
              <Home className="w-2 h-2 text-onyx-purple" />
              <span className="text-[9px] font-mono font-bold tracking-tighter opacity-90 uppercase">{homeBase.name}</span>
            </div>
          </motion.div>

          <motion.div 
            layout
            initial={false}
            animate={{ 
              width: isSearchExpanded ? "calc(100vw - 32px)" : "40px",
              flex: isSearchExpanded ? "1 1 0%" : "0 0 auto"
            }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex items-center overflow-hidden pointer-events-auto shadow-2xl"
          >
            <button onClick={() => setIsSearchExpanded(!isSearchExpanded)} className="w-10 h-10 flex items-center justify-center shrink-0 text-onyx-purple hover:bg-white/5 active:scale-90 transition-transform">
              <Search className="w-3.5 h-3.5" />
            </button>
            <AnimatePresence>
              {isSearchExpanded && (
                <motion.input 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  ref={searchInputRef} 
                  type="text" 
                  placeholder="SEARCH GRID..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[10px] font-bold tracking-widest p-0 pr-4 placeholder:text-zinc-800" 
                />
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div layout className="bg-black/80 backdrop-blur-xl border border-white/10 px-3 rounded-xl flex items-center gap-2 pointer-events-auto shadow-2xl h-[40px] shrink-0">
            <span className="text-xs font-black tabular-nums tracking-tighter opacity-80">
              {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
            </span>
          </motion.div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveFilter(cat)} className={cn("px-2.5 py-1 rounded-md text-[7px] font-black uppercase tracking-widest border transition-all whitespace-nowrap", activeFilter === cat ? "bg-onyx-purple border-onyx-purple text-black" : "bg-black/60 border-white/5 text-onyx-muted")}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div ref={mapRef} className="flex-1 w-full bg-black" />

      {/* Stealth Navigation HUD (Bottom Sheet) */}
      <motion.div 
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragEnd={(e, info) => {
          if (info.offset.y > 50) setIsBladeExpanded(false);
          if (info.offset.y < -50) setIsBladeExpanded(true);
        }}
        animate={{ height: isBladeExpanded ? "50%" : "84px", y: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="bg-black/95 backdrop-blur-2xl border-t border-white/10 rounded-t-[24px] p-5 pt-7 relative z-30 shadow-[0_-20px_60px_rgba(0,0,0,1)] touch-none"
      >
        <div onClick={() => setIsBladeExpanded(!isBladeExpanded)} className="absolute top-2.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/10 rounded-full cursor-pointer hover:bg-onyx-purple/40" />

        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-onyx-purple uppercase tracking-[0.4em] mb-0.5">Target Node</span>
            <h2 className="text-lg font-black tracking-tight uppercase leading-tight">{nextStop.name.replace(/_/g, ' ')}</h2>
            <div className="flex items-center gap-3 mt-1 opacity-60">
              <span className="text-sm font-black tabular-nums">{nextStop.distance}</span>
              <div className="w-1 h-1 bg-zinc-700 rounded-full" />
              <span className="text-[9px] font-bold uppercase tracking-widest">{nextStop.eta}</span>
            </div>
          </div>
          <button className="w-10 h-10 rounded-xl bg-onyx-purple/10 border border-onyx-purple/20 flex items-center justify-center text-onyx-purple hover:bg-onyx-purple hover:text-black transition-all pointer-events-auto">
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {isBladeExpanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 space-y-6">
              <div className="flex items-start gap-3 opacity-90">
                <Zap className="w-3.5 h-3.5 text-onyx-purple shrink-0 mt-0.5" />
                <p className="text-sm font-bold leading-snug tracking-tight">{nextStop.step}</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={updateHomeBase} className="flex-1 py-3 border border-white/5 rounded-lg flex items-center justify-center gap-2 hover:bg-white/5 active:scale-95 transition-all">
                  <Home className="w-3 h-3 text-onyx-purple" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]">Set Home</span>
                </button>
                <button onClick={addToLattice} disabled={isLocationInLattice} className={cn("flex-1 py-3 border rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-all", isLocationInLattice ? "border-onyx-purple/40 bg-onyx-purple/5 opacity-80" : "border-white/5 hover:bg-white/5")}>
                  {isLocationInLattice ? (
                    <><CheckCircle2 className="w-3 h-3 text-onyx-purple" /><span className="text-[8px] font-black uppercase tracking-[0.2em]">In Lattice</span></>
                  ) : (
                    <><Plus className="w-3 h-3 text-white" /><span className="text-[8px] font-black uppercase tracking-[0.2em]">Add Lattice</span></>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  );
}
