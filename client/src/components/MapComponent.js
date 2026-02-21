import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, useMap, ZoomControl, LayersControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMarkerColor } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

// Fix Leaflet default marker icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Nashik district bounding box (expanded to cover all locations)
const NASHIK_BOUNDS = [
  [19.35, 73.20], // SW corner
  [20.90, 74.90], // NE corner
];

// Clean pin marker for single-location dashboard view
function createPinIcon(color) {
  return L.divIcon({
    className: 'custom-pin-marker',
    html: `
      <div style="position:relative;width:36px;height:48px;cursor:pointer;">
        <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3));">
          <path d="M18 0C8.06 0 0 8.06 0 18c0 12.8 16.5 27.1 17.22 27.74a1.2 1.2 0 001.56 0C19.5 45.1 36 30.8 36 18 36 8.06 27.94 0 18 0z" fill="${color}"/>
          <circle cx="18" cy="18" r="9" fill="white" opacity="0.92"/>
          <circle cx="18" cy="18" r="5.5" fill="${color}"/>
        </svg>
      </div>
    `,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -44],
  });
}

// GPS location marker
function createGPSIcon() {
  return L.divIcon({
    className: 'gps-marker',
    html: `
      <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;
          width:40px;height:40px;
          border-radius:50%;
          background:rgba(59,130,246,0.2);
          animation:gps-pulse 1.5s ease-out infinite;
        "></div>
        <div style="
          width:16px;height:16px;
          border-radius:50%;
          background:#3b82f6;
          border:3px solid white;
          box-shadow:0 2px 8px rgba(59,130,246,0.6);
          position:relative;z-index:2;
        "></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
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

// GPS Marker component
function GPSMarker({ position }) {
  const icon = createGPSIcon();
  if (!position) return null;
  return (
    <Marker position={[position.lat, position.lng]} icon={icon}>
      <Tooltip direction="top" offset={[0, -24]} className="nashik-bubble-tooltip">
        <div className="jal-tooltip-inner">
          <div className="jal-tt-header">
            <span className="jal-tt-dot" style={{ background: '#3b82f6' }} />
            <span className="jal-tt-name">📍 Your Location</span>
          </div>
          <div className="jal-tt-grid">
            <div className="jal-tt-metric">
              <span className="jal-tt-label">Lat</span>
              <span className="jal-tt-value">{position.lat.toFixed(5)}</span>
            </div>
            <div className="jal-tt-metric">
              <span className="jal-tt-label">Lng</span>
              <span className="jal-tt-value">{position.lng.toFixed(5)}</span>
            </div>
          </div>
          <div className="jal-tt-hint">Accuracy: ±{position.accuracy?.toFixed(0)}m</div>
        </div>
      </Tooltip>
    </Marker>
  );
}

// Tile layer URLs — Google satellite works in Android WebView
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
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps Satellite',
    name: 'Satellite',
    maxZoom: 20,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com">CARTO</a>',
    name: 'Dark',
  },
  terrain: {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
    name: 'Terrain',
  },
};

export default function MapComponent({ center, markers = [], zoom = 12, singleMarker, height = '100%', showAllOverview = false, onMarkerClick, isDashboard = false }) {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [gpsPosition, setGpsPosition] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  const defaultCenter = center || { lat: 19.9975, lng: 73.7898 };
  const defaultTile = darkMode ? 'dark' : 'street';

  // Build all markers — filter to Nashik district
  const allMarkers = [];
  const isInNashik = (lat, lng) =>
    lat >= NASHIK_BOUNDS[0][0] && lat <= NASHIK_BOUNDS[1][0] &&
    lng >= NASHIK_BOUNDS[0][1] && lng <= NASHIK_BOUNDS[1][1];

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
    if (lat && lng && isInNashik(lat, lng)) {
      allMarkers.push({
        ...m,
        position: [lat, lng],
        isSingle: false,
      });
    }
  });

  // GPS Locate Me handler
  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not supported');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGpsPosition(newPos);
        setGpsLoading(false);
        if (mapRef.current) {
          mapRef.current.flyTo([newPos.lat, newPos.lng], 15, { duration: 1.5 });
        }
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(err.code === 1 ? 'Permission denied' : 'GPS unavailable');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl border border-white/10 dark:border-gray-700/30" style={{ height, minHeight: '300px' }}>
      {/* Gradient overlay at top */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none bg-gradient-to-b from-black/30 to-transparent h-16" />
      <div className="absolute top-3 left-4 z-[1001] text-white text-sm font-bold drop-shadow-lg pointer-events-none flex items-center gap-2">
        {singleMarker?.location || 'Nashik District — Groundwater Monitoring'}
      </div>

      {/* GPS Locate Me button */}
      <div className="absolute top-3 right-14 z-[1001]">
        <button
          onClick={handleLocate}
          disabled={gpsLoading}
          title="Find my location"
          className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md border border-white/60 dark:border-slate-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-all duration-200 disabled:opacity-60"
        >
          {gpsLoading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Locating...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              </svg>
              My Location
            </>
          )}
        </button>
        {gpsError && (
          <p className="text-[10px] text-red-400 bg-white/90 dark:bg-slate-800/90 px-2 py-1 rounded-lg mt-1 shadow text-center">
            {gpsError}
          </p>
        )}
        {gpsPosition && !gpsError && (
          <p className="text-[10px] text-green-600 bg-white/90 dark:bg-slate-800/90 px-2 py-1 rounded-lg mt-1 shadow text-center font-medium">
            ✅ GPS found! ±{gpsPosition.accuracy?.toFixed(0)}m
          </p>
        )}
      </div>

      {/* Compact Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] pointer-events-auto" style={{ maxWidth: '150px' }}>
        <div className="rounded-xl p-2.5 text-[10px] leading-tight" style={{ background: darkMode ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', border: darkMode ? '1px solid rgba(51,65,85,0.5)' : '1px solid rgba(226,232,240,0.7)', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
          <p className="font-bold text-[9px] uppercase tracking-wider mb-1.5" style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>Legend</p>
          <div className="flex items-center gap-1.5 mb-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', border: '1.5px solid white', flexShrink: 0 }} />
            <span style={{ color: darkMode ? '#cbd5e1' : '#334155' }}>Safe</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', display: 'inline-block', border: '1.5px solid white', flexShrink: 0 }} />
            <span style={{ color: darkMode ? '#cbd5e1' : '#334155' }}>Warning</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', border: '1.5px solid white', flexShrink: 0 }} />
            <span style={{ color: darkMode ? '#cbd5e1' : '#334155' }}>Critical</span>
          </div>
          <div style={{ height: 1, background: darkMode ? '#1e293b' : '#e2e8f0', margin: '3px 0' }} />
          <div className="flex items-center gap-1.5 mb-1" style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>
            <svg width="14" height="10" viewBox="0 0 14 10" style={{ flexShrink: 0 }}>
              <circle cx="3" cy="7" r="2.5" fill={darkMode ? '#475569' : '#94a3b8'} opacity="0.7" />
              <circle cx="8" cy="5" r="3.5" fill={darkMode ? '#475569' : '#94a3b8'} opacity="0.7" />
            </svg>
            <span>Size = Score</span>
          </div>
          {gpsPosition && (
            <>
              <div style={{ height: 1, background: darkMode ? '#1e293b' : '#e2e8f0', margin: '3px 0' }} />
              <div className="flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', border: '1.5px solid white', flexShrink: 0 }} />
                <span style={{ color: '#3b82f6' }}>You</span>
              </div>
            </>
          )}
          <p style={{ color: darkMode ? '#475569' : '#94a3b8', marginTop: 2 }}>Hover for details</p>
        </div>
      </div>

      <MapContainer
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={zoom}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
        ref={mapRef}
        whenReady={() => { }}
        maxBounds={NASHIK_BOUNDS}
        maxBoundsViscosity={0.8}
        minZoom={9}
      >
        <ZoomControl position="topright" />

        {/* Layer switcher */}
        <LayersControl position="topright" collapsed={true}>
          <LayersControl.BaseLayer checked={defaultTile === 'street'} name="Street">
            <TileLayer url={TILE_LAYERS.street.url} attribution={TILE_LAYERS.street.attribution} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={defaultTile === 'dark'} name="Dark">
            <TileLayer url={TILE_LAYERS.dark.url} attribution={TILE_LAYERS.dark.attribution} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer url={TILE_LAYERS.satellite.url} attribution={TILE_LAYERS.satellite.attribution} maxZoom={20} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer url={TILE_LAYERS.terrain.url} attribution={TILE_LAYERS.terrain.attribution} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Topographic">
            <TileLayer url={TILE_LAYERS.topo.url} attribution={TILE_LAYERS.topo.attribution} maxZoom={17} />
          </LayersControl.BaseLayer>
        </LayersControl>

        <FlyToCenter center={[defaultCenter.lat, defaultCenter.lng]} zoom={zoom} />

        {/* GPS user location marker */}
        <GPSMarker position={gpsPosition} />

        {/* Render location bubbles — Nashik regions only */}
        {allMarkers.map((m, i) => {
          const color = getMarkerColor(m.status);

          // Bubble radius based on waterScore
          const baseRadius = m.isSingle ? 18 : Math.max(6, Math.min(13, (m.waterScore || 50) / 6));

          // Depletion severity color
          const deplColor = (m.depletionRate || 0) >= 5 ? '#ef4444' : (m.depletionRate || 0) >= 3 ? '#f59e0b' : '#22c55e';

          return (
            <React.Fragment key={`${m.location || i}-${m.position[0]}`}>
              {/* Outer glow ring */}
              <CircleMarker
                center={m.position}
                radius={baseRadius + 6}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.10,
                  weight: 0,
                  opacity: 0,
                }}
              />

              {/* Main colored bubble */}
              <CircleMarker
                center={m.position}
                radius={baseRadius}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: color,
                  fillOpacity: 0.55,
                  weight: 2,
                  opacity: 0.9,
                }}
                eventHandlers={{
                  click: () => {
                    if (m.location) {
                      if (isDashboard) {
                        navigate(`/analytics/${encodeURIComponent(m.location)}`);
                      } else {
                        navigate(`/dashboard/${encodeURIComponent(m.location)}`);
                      }
                    } else if (onMarkerClick) {
                      onMarkerClick(m);
                    }
                  },
                  mouseover: (e) => {
                    const layer = e.target;
                    layer.setStyle({ fillOpacity: 0.8, weight: 3 });
                    layer.bringToFront();
                  },
                  mouseout: (e) => {
                    const layer = e.target;
                    layer.setStyle({ fillOpacity: 0.55, weight: 2 });
                  },
                }}
              >
                {/* Compact analytics tooltip on hover */}
                <Tooltip
                  direction="top"
                  offset={[0, -baseRadius - 4]}
                  opacity={0.98}
                  className="nashik-bubble-tooltip"
                  sticky={false}
                >
                  <div className="jal-tooltip-inner">
                    {/* Header */}
                    <div className="jal-tt-header">
                      <span className="jal-tt-dot" style={{ background: color }} />
                      <span className="jal-tt-name">{m.location}</span>
                      <span className="jal-tt-badge" style={{ background: color }}>{m.status}</span>
                    </div>

                    {/* Compact metrics grid */}
                    <div className="jal-tt-grid">
                      <div className="jal-tt-metric">
                        <span className="jal-tt-label">💧 Level</span>
                        <span className="jal-tt-value">{m.groundwaterLevel ?? '—'}m</span>
                      </div>
                      <div className="jal-tt-metric">
                        <span className="jal-tt-label">🌧️ Rain</span>
                        <span className="jal-tt-value">{m.rainfall ?? '—'}mm</span>
                      </div>
                      <div className="jal-tt-metric">
                        <span className="jal-tt-label">📉 Depl.</span>
                        <span className="jal-tt-value" style={{ color: deplColor }}>{m.depletionRate ?? '—'}%</span>
                      </div>
                      <div className="jal-tt-metric">
                        <span className="jal-tt-label">🧪 pH</span>
                        <span className="jal-tt-value">{m.ph ?? '—'}</span>
                      </div>
                    </div>

                    {/* Depletion mini-bar */}
                    <div className="jal-tt-bar-wrap">
                      <div className="jal-tt-bar-track">
                        <div className="jal-tt-bar-fill" style={{ width: `${Math.min(100, ((m.depletionRate || 0) / 8) * 100)}%`, background: deplColor }} />
                      </div>
                    </div>

                    {/* Coordinates */}
                    <div className="jal-tt-coords">
                      📍 {Number(m.position[0]).toFixed(4)}°N, {Number(m.position[1]).toFixed(4)}°E
                    </div>

                    {/* Score + Scarcity */}
                    <div className="jal-tt-footer">
                      {m.waterScore !== undefined && (
                        <span className="jal-tt-score">Score: <strong style={{ color }}>{m.waterScore}</strong></span>
                      )}
                      {m.scarcityLevel && (
                        <span className="jal-tt-scarcity">{m.scarcityLevel}</span>
                      )}
                    </div>

                    <div className="jal-tt-hint">{isDashboard ? 'Click → Analytics' : 'Click → Dashboard'}</div>
                  </div>
                </Tooltip>
              </CircleMarker>

              {/* Pin icon overlay for single-location dashboard view */}
              {m.isSingle && (
                <Marker
                  position={m.position}
                  icon={createPinIcon(color)}
                  interactive={false}
                  bubblingMouseEvents={false}
                />
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Styles — bubble tooltips & controls */}
      <style>{`
        .custom-marker { background: transparent !important; border: none !important; }
        .custom-pin-marker { background: transparent !important; border: none !important; pointer-events: none !important; }
        .gps-marker { background: transparent !important; border: none !important; }

        @keyframes gps-pulse {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        /* ===== Bubble Tooltip ===== */
        .nashik-bubble-tooltip {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12) !important;
          padding: 0 !important;
          font-family: system-ui, -apple-system, sans-serif;
          min-width: 200px;
          max-width: 230px;
        }
        .nashik-bubble-tooltip::before {
          border-top-color: #ffffff !important;
        }
        html.dark .nashik-bubble-tooltip {
          background: #0f172a !important;
          border-color: #1e293b !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.45) !important;
        }
        html.dark .nashik-bubble-tooltip::before {
          border-top-color: #0f172a !important;
        }

        .jal-tooltip-inner { padding: 8px 10px 6px; }
        .jal-tt-header {
          display: flex; align-items: center; gap: 5px;
          margin-bottom: 6px; padding-bottom: 5px;
          border-bottom: 1px solid #f1f5f9;
        }
        html.dark .jal-tt-header { border-color: #1e293b; }
        .jal-tt-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .jal-tt-name { font-weight: 700; font-size: 11.5px; color: #0f172a; flex: 1; }
        html.dark .jal-tt-name { color: #f1f5f9; }
        .jal-tt-badge {
          font-size: 8px; font-weight: 700; color: #fff;
          padding: 1px 6px; border-radius: 8px; text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .jal-tt-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 4px; margin-bottom: 6px;
        }
        .jal-tt-metric {
          display: flex; flex-direction: column;
          background: #f8fafc; border-radius: 6px; padding: 3px 6px;
        }
        html.dark .jal-tt-metric { background: #1e293b; }
        .jal-tt-label {
          font-size: 8.5px; color: #94a3b8; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.2px;
        }
        html.dark .jal-tt-label { color: #64748b; }
        .jal-tt-value { font-size: 11.5px; font-weight: 700; color: #1e293b; }
        html.dark .jal-tt-value { color: #e2e8f0; }
        .jal-tt-bar-wrap { margin-bottom: 5px; }
        .jal-tt-bar-track { height: 3px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
        html.dark .jal-tt-bar-track { background: #1e293b; }
        .jal-tt-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
        .jal-tt-coords {
          font-size: 9px; color: #64748b; text-align: center;
          margin-bottom: 4px; font-family: 'Courier New', monospace;
        }
        html.dark .jal-tt-coords { color: #94a3b8; }
        .jal-tt-footer {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 10px; color: #64748b; margin-bottom: 3px;
        }
        .jal-tt-score strong { font-weight: 700; }
        html.dark .jal-tt-footer { color: #94a3b8; }
        .jal-tt-hint {
          font-size: 8px; color: #94a3b8; text-align: center;
          padding-top: 4px; border-top: 1px solid #f1f5f9; font-weight: 500;
        }
        html.dark .jal-tt-hint { color: #475569; border-color: #1e293b; }
        .leaflet-interactive { cursor: pointer !important; }
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
