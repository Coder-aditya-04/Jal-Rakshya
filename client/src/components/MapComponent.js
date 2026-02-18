import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, ZoomControl, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMarkerColor } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

// Fix Leaflet default marker icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom colored marker using divIcon
function createColoredIcon(color, pulseColor, size = 14) {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;width:${size * 2.5}px;height:${size * 2.5}px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;
          width:${size * 2.5}px;
          height:${size * 2.5}px;
          border-radius:50%;
          background:${pulseColor};
          opacity:0.25;
          animation:marker-pulse 2s ease-out infinite;
        "></div>
        <div style="
          position:relative;
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          background:${color};
          border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          z-index:2;
        "></div>
      </div>
    `,
    iconSize: [size * 2.5, size * 2.5],
    iconAnchor: [size * 1.25, size * 1.25],
    popupAnchor: [0, -size],
  });
}

// Large pin marker for single-location dashboard view
function createPinIcon(color) {
  return L.divIcon({
    className: 'custom-pin-marker',
    html: `
      <div style="position:relative;width:40px;height:52px;">
        <div style="
          position:absolute;
          bottom:0;left:50%;
          transform:translateX(-50%);
          width:50px;height:50px;
          border-radius:50%;
          background:${color}22;
          animation:marker-pulse 2s ease-out infinite;
        "></div>
        <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 0C8.95 0 0 8.95 0 20c0 14.25 18.35 30.13 19.14 30.82a1.33 1.33 0 001.72 0C21.65 50.13 40 34.25 40 20 40 8.95 31.05 0 20 0z" fill="${color}"/>
          <circle cx="20" cy="20" r="10" fill="white" opacity="0.9"/>
          <circle cx="20" cy="20" r="6" fill="${color}"/>
        </svg>
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 52],
    popupAnchor: [0, -48],
  });
}

// Component to fly/pan to a new center when it changes
function FlyToCenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

// Tile layer URLs
const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    name: 'Street',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    name: 'Topographic',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com">Esri</a> World Imagery',
    name: 'Satellite',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com">CARTO</a>',
    name: 'Dark',
  },
  watercolor: {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
    name: 'Terrain',
  },
};

export default function MapComponent({ center, markers = [], zoom = 12, singleMarker, height = '100%', showAllOverview = false, onMarkerClick }) {
  const { darkMode } = useTheme();
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const defaultCenter = center || { lat: 19.9975, lng: 73.7898 };
  const defaultTile = darkMode ? 'dark' : 'street';

  // Build all markers to render
  const allMarkers = [];
  if (singleMarker) {
    allMarkers.push({
      ...singleMarker,
      position: [defaultCenter.lat, defaultCenter.lng],
      isSingle: true,
    });
  }
  markers.forEach((m) => {
    const lat = m.position ? m.position.lat : m.coordinates?.latitude;
    const lng = m.position ? m.position.lng : m.coordinates?.longitude;
    if (lat && lng) {
      allMarkers.push({
        ...m,
        position: [lat, lng],
        isSingle: false,
      });
    }
  });

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl border border-white/10 dark:border-gray-700/30" style={{ height, minHeight: '300px' }}>
      {/* Gradient overlay at top for title */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none bg-gradient-to-b from-black/30 to-transparent h-16" />
      <div className="absolute top-3 left-4 z-[1001] text-white text-sm font-bold drop-shadow-lg pointer-events-none flex items-center gap-2">
        {singleMarker?.location || 'Nashik District — Groundwater Monitoring'}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] glass-card-sm p-3 text-xs space-y-1.5" style={{ backdropFilter: 'blur(12px)' }}>
        <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Water Status</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block border border-white shadow-sm" /> Safe
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block border border-white shadow-sm" /> Warning
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block border border-white shadow-sm" /> Critical
        </div>
      </div>

      <MapContainer
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={zoom}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
        ref={mapRef}
        whenReady={() => setMapReady(true)}
      >
        <ZoomControl position="bottomright" />

        {/* Layer switcher - collapsed by default on mobile */}
        <LayersControl position="topright" collapsed={true}>
          <LayersControl.BaseLayer checked={defaultTile === 'street'} name="Street">
            <TileLayer url={TILE_LAYERS.street.url} attribution={TILE_LAYERS.street.attribution} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={defaultTile === 'dark'} name="Dark">
            <TileLayer url={TILE_LAYERS.dark.url} attribution={TILE_LAYERS.dark.attribution} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer url={TILE_LAYERS.satellite.url} attribution={TILE_LAYERS.satellite.attribution} maxZoom={19} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer url={TILE_LAYERS.watercolor.url} attribution={TILE_LAYERS.watercolor.attribution} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Topographic">
            <TileLayer url={TILE_LAYERS.topo.url} attribution={TILE_LAYERS.topo.attribution} maxZoom={17} />
          </LayersControl.BaseLayer>
        </LayersControl>

        <FlyToCenter center={[defaultCenter.lat, defaultCenter.lng]} zoom={zoom} />

        {/* Render markers */}
        {allMarkers.map((m, i) => {
          const color = getMarkerColor(m.status);
          const icon = m.isSingle ? createPinIcon(color) : createColoredIcon(color, color);

          return (
            <React.Fragment key={`${m.location || i}-${m.position[0]}`}>
              {/* Pulsing circle behind marker for emphasis */}
              <CircleMarker
                center={m.position}
                radius={m.isSingle ? 35 : 18}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.08,
                  weight: 1,
                  opacity: 0.3,
                }}
              />

              <Marker
                position={m.position}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    if (onMarkerClick) onMarkerClick(m);
                  },
                }}
              >
                <Popup maxWidth={320} className="custom-popup">
                  <div className="p-1 min-w-[240px]">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                      />
                      <h3 className="font-bold text-gray-900 text-base leading-tight">
                        {m.location}
                      </h3>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-blue-600 font-medium uppercase">Water Level</p>
                        <p className="text-lg font-bold text-blue-700">{m.groundwaterLevel}<span className="text-xs font-normal">m</span></p>
                      </div>
                      <div className="bg-cyan-50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-cyan-600 font-medium uppercase">Rainfall</p>
                        <p className="text-lg font-bold text-cyan-700">{m.rainfall}<span className="text-xs font-normal">mm</span></p>
                      </div>
                    </div>

                    {/* Status & Score row */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-500">Status:</span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: color }}
                        >
                          {m.status}
                        </span>
                      </div>
                      {m.waterScore !== undefined && (
                        <div className="text-right">
                          <span className="text-xs text-gray-500">Score: </span>
                          <span className="text-sm font-bold" style={{ color }}>
                            {m.waterScore}/100
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Scarcity if available */}
                    {m.scarcityLevel && (
                      <div className="mt-2 text-center">
                        <span className="text-[10px] text-gray-400 uppercase">Scarcity: </span>
                        <span className="text-xs font-semibold text-gray-700">{m.scarcityLevel}</span>
                      </div>
                    )}

                    {/* Coordinates */}
                    <div className="mt-2 text-center text-[10px] text-gray-400">
                      {Number(m.position[0]).toFixed(5)}, {Number(m.position[1]).toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes marker-pulse {
          0% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.8); opacity: 0.08; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .custom-marker { background: transparent !important; border: none !important; }
        .custom-pin-marker { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper {
          border-radius: 16px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18) !important;
          padding: 4px !important;
          background: #fff !important;
        }
        html.dark .leaflet-popup-content-wrapper {
          background: #111832 !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
        }
        html.dark .leaflet-popup-content-wrapper * {
          color: #e0e7ff;
        }
        html.dark .leaflet-popup-content-wrapper .bg-blue-50 {
          background: rgba(59,130,246,0.15) !important;
        }
        html.dark .leaflet-popup-content-wrapper .bg-cyan-50 {
          background: rgba(6,182,212,0.15) !important;
        }
        html.dark .leaflet-popup-content-wrapper .bg-gray-50 {
          background: rgba(255,255,255,0.05) !important;
        }
        .leaflet-popup-tip { display: none; }
        .leaflet-control-layers {
          border-radius: 12px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
          border: none !important;
        }
        .leaflet-control-zoom a {
          border-radius: 8px !important;
          margin: 2px !important;
        }
      `}</style>
    </div>
  );
}
