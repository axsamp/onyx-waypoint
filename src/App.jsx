import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Map as MapIcon, Compass, Target, ArrowUpRight, ChevronUp, Clock, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { obsidianStyle } from './utils/mapStyles';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// NOTE: Pulled from secure .env file
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function App() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isBladeExpanded, setIsBladeExpanded] = useState(false);
  const [nextStop, setNextStop] = useState({
    name: "SHIBUYA_STATION",
    distance: "1.2KM",
    eta: "14 MIN",
    step: "Head North towards Hachiko Square"
  });

  useEffect(() => {
    // Load Google Maps Script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => console.log("%cONYX SYSTEM: Waypoint Node Connected", "color: #C084FC; font-weight: bold;");
    script.onerror = () => console.error("%cONYX SYSTEM: Waypoint Authentication Failure", "color: #EF4444; font-weight: bold;");
    
    window.initMap = initMap;
    document.head.appendChild(script);

    let markers = [];

    function syncMarkers(gMap) {
      // Clear existing markers
      markers.forEach(m => m.setMap(null));
      markers = [];

      const savedLocations = JSON.parse(localStorage.getItem('onyx_itinerary_locations') || '[]');
      const geocoder = new window.google.maps.Geocoder();

      savedLocations.forEach((loc) => {
        geocoder.geocode({ address: `${loc.city}, Japan` }, (results, status) => {
          if (status === 'OK') {
            const marker = new window.google.maps.Marker({
              position: results[0].geometry.location,
              map: gMap,
              title: loc.city,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#C084FC',
                fillOpacity: 0.8,
                strokeColor: '#FFFFFF',
                strokeWeight: 2,
                scale: 8,
              }
            });

            marker.addListener('click', () => {
              setNextStop({
                name: loc.city.toUpperCase(),
                distance: "SYNCED",
                eta: loc.category.toUpperCase(),
                step: loc.description || "Destination Node Locked"
              });
              setIsBladeExpanded(true);
              gMap.panTo(marker.getPosition());
            });
            markers.push(marker);
          }
        });
      });
    }

    function initMap() {
      try {
        const gMap = new window.google.maps.Map(mapRef.current, {
          center: { lat: 35.6586, lng: 139.7454 }, // Tokyo Center
          zoom: 12,
          styles: obsidianStyle,
          disableDefaultUI: true,
          backgroundColor: '#000000',
          clickableIcons: true,
        });
        setMap(gMap);
        syncMarkers(gMap);

        // Live Sync Listener
        window.addEventListener('storage', (e) => {
          if (e.key === 'onyx_itinerary_locations') {
            syncMarkers(gMap);
          }
        });

      } catch (err) {
        console.error("ONYX SYSTEM: Map Initialization Error", err);
      }
    }
  }, []);

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col font-['Outfit'] overflow-hidden">

      {/* Top Telemetry Overlay */}
      <header className="fixed top-0 left-0 right-0 p-6 z-20 pointer-events-none flex justify-between items-start">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col pointer-events-auto">
          <span className="text-[10px] font-bold text-onyx-purple uppercase tracking-[0.5em] mb-1">Onyx Waypoint</span>
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-onyx-muted uppercase tracking-widest">SIGNAL LOCK</span>
              <div className="flex items-center gap-1">
                <Target className="w-3 h-3 text-onyx-purple" />
                <span className="text-xs font-mono font-bold">LAT 35.658 / LNG 139.745</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col pointer-events-auto">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-onyx-purple" />
            <span className="text-lg font-black tracking-tighter">N 012°</span>
          </div>
        </div>
      </header>

      {/* The Obsidian Map Viewport */}
      <div ref={mapRef} className="flex-1 w-full bg-black" />

      {/* Navigation Blade (Bottom Sheet) */}
      <motion.div 
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragEnd={(e, info) => {
          if (info.offset.y > 50) setIsBladeExpanded(false);
          if (info.offset.y < -50) setIsBladeExpanded(true);
        }}
        animate={{ 
          height: isBladeExpanded ? "65%" : "120px",
          y: 0 
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-zinc-950 border-t border-white/10 rounded-t-[32px] p-6 relative z-30 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] touch-none"
      >
        {/* Handle Bar */}
        <div 
          onClick={() => setIsBladeExpanded(!isBladeExpanded)}
          className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full cursor-pointer hover:bg-onyx-purple/40 transition-colors" 
        />

        <div className="flex items-center justify-between mt-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-onyx-purple uppercase tracking-[0.4em] mb-1">Next Destination</span>
            <h2 className="text-2xl font-black tracking-tight uppercase leading-none">{nextStop.name.replace(/_/g, ' ')}</h2>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xl font-black text-white">{nextStop.distance}</span>
            <span className="text-[10px] font-bold text-onyx-muted uppercase tracking-widest">{nextStop.eta}</span>
          </div>
        </div>

        <AnimatePresence>
          {isBladeExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 flex flex-col gap-8"
            >
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-start gap-4">
                <Navigation className="w-5 h-5 text-onyx-purple shrink-0 mt-1" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-onyx-muted uppercase tracking-widest mb-1">CURRENT STEP</span>
                  <p className="text-lg font-bold leading-tight">{nextStop.step}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-white/5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-3 h-3 text-onyx-purple" />
                    <span className="text-[8px] font-bold text-onyx-muted uppercase tracking-widest">Arrival</span>
                  </div>
                  <span className="text-xl font-black">14:42</span>
                </div>
                <div className="p-4 border border-white/5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="w-3 h-3 text-onyx-purple" />
                    <span className="text-[8px] font-bold text-onyx-muted uppercase tracking-widest">Traffic</span>
                  </div>
                  <span className="text-xl font-black uppercase">Low</span>
                </div>
              </div>

              <button className="w-full py-4 bg-onyx-purple rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-black hover:bg-white transition-colors mt-4">
                Launch Official Map <ArrowUpRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  );
}
