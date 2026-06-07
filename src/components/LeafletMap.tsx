'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Spot } from '../lib/db';

interface LeafletMapProps {
  spots: Spot[];
  activeSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  userLocation: { lat: number; lng: number };
  setUserLocation: (loc: { lat: number; lng: number }) => void;
  ugcCounts: { [spotId: string]: number };
}

export default function LeafletMap({
  spots,
  activeSpot,
  onSelectSpot,
  userLocation,
  setUserLocation,
  ugcCounts,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<{ [spotId: string]: L.Marker }>({});

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([userLocation.lat, userLocation.lng], 13);

    // CartoDB Voyager Tile Layer (Bright, color-rich, highly readable map tiles)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. User Location Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const userHtml = `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 rounded-full border border-[#00bfff] animate-ping opacity-60"></div>
        <div class="absolute w-4 h-4 rounded-full bg-[#00bfff] border-2 border-white shadow-lg shadow-[#00bfff]/50"></div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userHtml,
      className: 'custom-user-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [userLocation]);

  // 3. Manage Spot Markers (Sauna-ikitai style tag bubble pins)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    spots.forEach((spot) => {
      const isActive = activeSpot?.id === spot.id;
      const ugcCount = ugcCounts[spot.id] || 0;
      const iconEmoji = spot.category === '神社' ? '⛩️' : '🙏';

      // Sauna-ikitai style tag layout
      // A white rounded bubble containing the emoji, short name, and the count badge on the right
      const spotHtml = `
        <div class="relative flex flex-col items-center justify-center">
          <div class="flex items-center gap-1.5 bg-white border-2 ${
            isActive 
              ? 'border-[#d4af37] scale-110 shadow-lg shadow-[#d4af37]/30' 
              : 'border-[#1e2024]/10 shadow-md hover:border-[#e60012] hover:scale-105'
          } rounded-full px-2.5 py-1 transition-all duration-200">
            <span class="text-xs leading-none">${iconEmoji}</span>
            <span class="text-[10px] font-black text-[#1e2024] leading-none whitespace-nowrap">
              ${spot.name.split(' ')[0]}
            </span>
            <span class="text-[9px] font-black ${
              isActive ? 'bg-[#d4af37] text-white' : 'bg-[#e60012]/10 text-[#e60012]'
            } rounded-full px-1.5 py-0.2 leading-none">
              ${ugcCount}
            </span>
          </div>
          
          {/* Subtle triangle arrow at the bottom of bubble */}
          <div class="w-2 h-2 bg-white rotate-45 -mt-1 border-r border-b ${
            isActive ? 'border-[#d4af37]' : 'border-[#1e2024]/10'
          }"></div>

          ${
            isActive
              ? `<div class="absolute -inset-1 border border-dashed border-[#d4af37] rounded-full animate-spin-slow opacity-60"></div>`
              : ''
          }
        </div>
      `;

      const spotIcon = L.divIcon({
        html: spotHtml,
        className: 'custom-spot-icon',
        iconSize: [110, 32],
        iconAnchor: [55, 32], // Anchor in the center bottom of the bubble
      });

      const marker = L.marker([spot.latitude, spot.longitude], {
        icon: spotIcon,
      })
        .addTo(map)
        .on('click', () => {
          onSelectSpot(spot);
        });

      markersRef.current[spot.id] = marker;
    });
  }, [spots, activeSpot, onSelectSpot, ugcCounts]);

  // 4. Pan to Active Spot
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (activeSpot) {
      map.setView([activeSpot.latitude, activeSpot.longitude], 15);
    }
  }, [activeSpot]);

  // 5. Warp support
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    if (!activeSpot) {
      map.panTo([userLocation.lat, userLocation.lng]);
    }
  }, [userLocation, activeSpot]);

  return <div ref={mapContainerRef} className="w-full h-full rounded-2xl overflow-hidden" />;
}
