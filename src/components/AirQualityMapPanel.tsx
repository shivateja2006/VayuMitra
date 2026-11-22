import { useCallback, useEffect, useState } from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { Layers, MapPin } from 'lucide-react';
import { classifyIndianAqi } from '../utils/airQualityLogic.ts';
import type { AreaProbeReading } from '../types/airQuality.ts';

interface AdvancedMarkerWithRefProps {
  area: AreaProbeReading;
  isSelected: boolean;
  onMarkerClick: (area: AreaProbeReading, marker: google.maps.marker.AdvancedMarkerElement) => void;
}

function AreaMarkerItem({ area, isSelected, onMarkerClick }: AdvancedMarkerWithRefProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const cls = classifyIndianAqi(area.aqi);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: area.lat, lng: area.lng }}
      zIndex={area.isPrimary || isSelected ? 1000 : 100}
      title={`${area.areaName}: NAQI ${area.aqi} (${cls.band})`}
      onClick={() => {
        if (marker) {
          onMarkerClick(area, marker);
        }
      }}
    >
      <div
        className={`flex flex-col items-center cursor-pointer transition-transform ${
          isSelected || area.isPrimary ? 'scale-110' : 'hover:scale-105'
        }`}
      >
        <div
          style={{ backgroundColor: cls.markerHex }}
          className={`px-2.5 py-1 rounded-md text-white shadow-md border-2 ${
            area.isPrimary || isSelected ? 'border-amber-200' : 'border-[#160D0B]'
          } flex items-center gap-1.5`}
        >
          <span className="font-mono text-xs font-semibold tabular-nums">{area.aqi}</span>
          <span className="text-[11px] font-medium max-w-[110px] truncate">{area.areaName}</span>
        </div>
        <div
          style={{ borderTopColor: cls.markerHex }}
          className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px]"
        />
      </div>
    </AdvancedMarker>
  );
}

function MapCameraAndHeatmapController({
  center,
  showHeatmap,
  apiKey,
  areas,
  dataSource,
}: {
  center: { lat: number; lng: number };
  showHeatmap: boolean;
  apiKey: string;
  areas: AreaProbeReading[];
  dataSource?: 'google-live' | 'live-cams' | 'fallback-baseline';
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(center);
  }, [map, center.lat, center.lng]);

  useEffect(() => {
    if (!map) return;

    for (let i = map.overlayMapTypes.getLength() - 1; i >= 0; i--) {
      const layer = map.overlayMapTypes.getAt(i);
      if (layer && layer.name === 'India CPCB Air Quality Heatmap') {
        map.overlayMapTypes.removeAt(i);
      }
    }

    if (!showHeatmap) return;

    const circles: google.maps.Circle[] = areas.map((area) => {
      const cls = classifyIndianAqi(area.aqi);
      return new google.maps.Circle({
        map,
        center: { lat: area.lat, lng: area.lng },
        radius: area.isPrimary ? 3400 : 2600,
        strokeColor: cls.accentHex,
        strokeOpacity: 0.7,
        strokeWeight: 1.5,
        fillColor: cls.accentHex,
        fillOpacity: 0.18,
        clickable: false,
      });
    });

    if (dataSource === 'google-live' && apiKey) {
      const airQualityMapType = new google.maps.ImageMapType({
        getTileUrl: (coord, zoom) => {
          if (zoom < 0 || zoom > 16) return null;
          const numTiles = 1 << zoom;
          if (coord.y < 0 || coord.y >= numTiles) return null;
          const x = ((coord.x % numTiles) + numTiles) % numTiles;
          return `https://airquality.googleapis.com/v1/mapTypes/IND_CPCB/heatmapTiles/${zoom}/${x}/${coord.y}?key=${apiKey}`;
        },
        tileSize: new google.maps.Size(256, 256),
        maxZoom: 16,
        minZoom: 0,
        name: 'India CPCB Air Quality Heatmap',
        opacity: 0.5,
      });
      map.overlayMapTypes.insertAt(0, airQualityMapType);
    }

    return () => {
      for (const c of circles) {
        c.setMap(null);
      }
      for (let i = map.overlayMapTypes.getLength() - 1; i >= 0; i--) {
        const layer = map.overlayMapTypes.getAt(i);
        if (layer && layer.name === 'India CPCB Air Quality Heatmap') {
          map.overlayMapTypes.removeAt(i);
        }
      }
    };
  }, [map, showHeatmap, apiKey, areas, dataSource]);

  return null;
}

interface AirQualityMapPanelProps {
  apiKey: string;
  center: { lat: number; lng: number };
  city: string;
  areas: AreaProbeReading[];
  selectedAreaId: string;
  dataSource?: 'google-live' | 'live-cams' | 'fallback-baseline';
  onInspectArea: (area: AreaProbeReading) => void;
  onMapCoordinateClick: (lat: number, lng: number) => void;
}

export function AirQualityMapPanel({
  apiKey,
  center,
  city,
  areas,
  selectedAreaId,
  dataSource,
  onInspectArea,
  onMapCoordinateClick,
}: AirQualityMapPanelProps) {
  const isLoaded = useApiIsLoaded();
  const status = useApiLoadingStatus();
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [activeInfoArea, setActiveInfoArea] = useState<AreaProbeReading | null>(null);
  const [anchorMarker, setAnchorMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);

  const handleMarkerClick = useCallback(
    (area: AreaProbeReading, marker: google.maps.marker.AdvancedMarkerElement) => {
      setActiveInfoArea(area);
      setAnchorMarker(marker);
    },
    []
  );

  const handleCloseInfo = useCallback(() => {
    setActiveInfoArea(null);
    setAnchorMarker(null);
  }, []);

  const mapFailed =
    !apiKey || status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE;

  return (
    <div
      id="air-map"
      className="bg-[var(--vm-surface)] border border-[var(--vm-border)] rounded-xl overflow-hidden flex flex-col transition-colors duration-300"
    >
      <div className="px-5 py-3.5 border-b border-[var(--vm-border)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--vm-ink)]">
            Area-Wise Air Quality Map · {city}
          </h2>
          <p className="text-xs text-[var(--vm-ink-muted)] mt-0.5">
            Click any neighborhood marker or tap anywhere on the map to inspect live air quality.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowHeatmap((prev) => !prev)}
          aria-pressed={showHeatmap}
          style={
            showHeatmap
              ? {
                  backgroundImage:
                    'linear-gradient(to right, var(--vm-accent-from), var(--vm-accent-to))',
                }
              : undefined
          }
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            showHeatmap
              ? 'text-white border-[var(--vm-accent-border)]'
              : 'bg-[var(--vm-muted)] text-[var(--vm-ink-secondary)] border-[var(--vm-border-strong)] hover:bg-[var(--vm-muted-hover)] hover:text-[var(--vm-ink)]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{showHeatmap ? 'Hide CPCB Heatmap' : 'Show CPCB Heatmap'}</span>
        </button>
      </div>

      <div className="relative w-full h-[380px] lg:h-[440px] bg-[var(--vm-muted)]">
        {mapFailed ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[var(--vm-muted)]">
            <MapPin className="w-7 h-7 text-[var(--vm-accent-text)] mb-2" />
            <p className="text-sm font-medium text-[var(--vm-ink)]">
              Interactive Google Map unavailable
            </p>
            <p className="text-xs text-[var(--vm-ink-muted)] mt-1 max-w-md">
              Area-wise air quality readings remain active in the breakdown table below. Check your
              Google Maps API key or quota status to re-enable map tiles.
            </p>
          </div>
        ) : !isLoaded ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-[var(--vm-ink-muted)]">
            Loading Google Maps for {city}...
          </div>
        ) : (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={center}
            defaultZoom={11}
            gestureHandling="greedy"
            disableDefaultUI={false}
            streetViewControl={false}
            mapTypeControl={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            onClick={(ev) => {
              const latLng = ev.detail?.latLng;
              if (latLng) {
                onMapCoordinateClick(latLng.lat, latLng.lng);
              }
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <MapCameraAndHeatmapController
              center={center}
              showHeatmap={showHeatmap}
              apiKey={apiKey}
              areas={areas}
              dataSource={dataSource}
            />

            {areas.map((area) => (
              <AreaMarkerItem
                key={area.id}
                area={area}
                isSelected={area.id === selectedAreaId}
                onMarkerClick={handleMarkerClick}
              />
            ))}

            {activeInfoArea && anchorMarker && (
              <InfoWindow
                anchor={anchorMarker}
                pixelOffset={[0, -6]}
                onCloseClick={handleCloseInfo}
              >
                <div className="p-1 min-w-[210px] text-stone-900">
                  <p className="text-xs text-stone-500 font-medium">{activeInfoArea.zoneType}</p>
                  <h3 className="text-sm font-bold text-stone-900 mt-0.5">
                    {activeInfoArea.areaName}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-lg font-bold tabular-nums text-red-700">
                      NAQI {activeInfoArea.aqi}
                    </span>
                    <span className="text-xs font-semibold text-stone-700">
                      {activeInfoArea.band}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    {activeInfoArea.healthNote}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onInspectArea(activeInfoArea);
                      handleCloseInfo();
                    }}
                    className="mt-2.5 w-full px-3 py-1.5 text-xs font-semibold rounded bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-500 hover:to-orange-500 transition-colors"
                  >
                    Inspect Live Area AQI
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </div>

      {/* Clean CPCB NAQI legend bar */}
      <div className="px-5 py-2.5 bg-[var(--vm-muted)] border-t border-[var(--vm-border)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--vm-ink-secondary)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-medium text-[var(--vm-ink)]">India NAQI (CPCB):</span>
          <span>0–50 Good</span>
          <span>51–100 Satisfactory</span>
          <span>101–200 Moderate</span>
          <span>201–300 Poor</span>
          <span>301–400 Very Poor</span>
          <span>401+ Severe</span>
        </div>
      </div>
    </div>
  );
}
