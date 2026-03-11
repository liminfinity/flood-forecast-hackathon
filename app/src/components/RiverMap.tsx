import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type BridgeState, getRiskLabel } from '@/data/mockData';
import { computeCfrm, getRiskClassLabel } from '@/data/cfrmService';
import { Legend } from './Legend';
import { InfoPanel } from './InfoPanel';
import { EventLog } from './EventLog';
import { useTheme } from '@/hooks/useTheme';
import type { EventLogEntry } from '@/data/mockData';

interface Props {
  bridges: BridgeState[];
  selectedDate: Date;
  onBridgeClick: (bridgeId: number) => void;
  events: EventLogEntry[];
}

const riskColors: Record<string, string> = {
  safe: '#4ade80',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function RiverMap({ bridges, selectedDate, onBridgeClick, events }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const bridgesRef = useRef(bridges);
  bridgesRef.current = bridges;
  const dateRef = useRef(selectedDate);
  dateRef.current = selectedDate;
  const onClickRef = useRef(onBridgeClick);
  onClickRef.current = onBridgeClick;
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const updateData = useCallback((map: maplibregl.Map, data: BridgeState[]) => {
    const bs = map.getSource('bridges') as maplibregl.GeoJSONSource;
    if (!bs) return;

    bs.setData({
      type: 'FeatureCollection',
      features: data.map(b => {
        const cfrm = computeCfrm(b, dateRef.current, 'day');
        let color = riskColors[b.risk] || riskColors.safe;
        if (cfrm.riskClass === 'CRITICAL') color = '#ef4444';
        else if (cfrm.riskClass === 'HIGH' && b.risk !== 'danger') color = '#f97316';

        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [b.longitude, b.latitude] },
          properties: {
            bridgeId: b.id,
            name: b.name,
            waterLevel: b.waterLevel,
            risk: b.risk,
            riskLabel: getRiskLabel(b.risk),
            color,
            trendLabel: b.trendLabel,
            floodRiskIndex: b.floodRiskIndex,
            cfrmScore: cfrm.score.toFixed(2),
            cfrmClass: getRiskClassLabel(cfrm.riskClass),
          },
        };
      }),
    });
  }, []);

  const getTileUrl = useCallback((isDark: boolean) => {
    return isDark
      ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
      : 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png';
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: 'raster',
            tiles: [getTileUrl(theme === 'dark')],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
      },
      center: [92.860, 56.035],
      zoom: 12.3,
      maxZoom: 17,
      minZoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });

    map.on('load', async () => {
      // Load real river geometry from GeoJSON
      let riverData: GeoJSON.FeatureCollection | GeoJSON.Feature;
      try {
        const resp = await fetch('/data/kacha-river.geojson');
        riverData = await resp.json();
      } catch {
        riverData = { type: 'FeatureCollection', features: [] };
      }

      map.addSource('river', {
        type: 'geojson',
        data: riverData,
      });
      map.addLayer({
        id: 'river-glow-outer',
        type: 'line',
        source: 'river',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 24, 'line-opacity': 0.08, 'line-blur': 12 },
      });
      map.addLayer({
        id: 'river-glow',
        type: 'line',
        source: 'river',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#60a5fa', 'line-width': 14, 'line-opacity': 0.2, 'line-blur': 6 },
      });
      map.addLayer({
        id: 'river-line',
        type: 'line',
        source: 'river',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.75 },
      });

      map.addSource('bridges', { type: 'geojson', data: emptyFC });
      map.addLayer({
        id: 'bridge-glow',
        type: 'circle',
        source: 'bridges',
        paint: {
          'circle-radius': 16,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
        },
      });
      map.addLayer({
        id: 'bridge-circles',
        type: 'circle',
        source: 'bridges',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.on('mouseenter', 'bridge-circles', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties!;
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const isDark = themeRef.current === 'dark';
        const bgColor = isDark ? '#1e2330' : '#ffffff';
        const textColor = isDark ? '#d1d5db' : '#374151';
        const mutedColor = isDark ? '#9ca3af' : '#6b7280';
        const borderColor = isDark ? '#374151' : '#e5e7eb';
        popup
          .setLngLat(coords)
          .setHTML(
            `<div style="padding:6px 10px;font-family:inherit;min-width:190px;background:${bgColor};border-radius:8px;">
              <p style="font-weight:600;font-size:13px;margin:0;color:${textColor};">${p.name}</p>
              <p style="font-size:10px;color:${mutedColor};margin:3px 0 0;">Сенсор #${p.bridgeId}</p>
              <div style="margin:6px 0;padding:5px 0;border-top:1px solid ${borderColor};border-bottom:1px solid ${borderColor};">
                <p style="font-size:12px;color:${textColor};margin:0;">Уровень: <strong>${p.waterLevel} см</strong></p>
                <p style="font-size:10px;color:${mutedColor};margin:3px 0 0;">${p.trendLabel}</p>
                <p style="font-size:10px;color:${mutedColor};margin:2px 0 0;">Индекс риска: ${p.floodRiskIndex}/100</p>
                <p style="font-size:10px;color:${mutedColor};margin:2px 0 0;">CFRM: <strong>${p.cfrmScore}</strong> — ${p.cfrmClass}</p>
              </div>
              <p style="font-size:11px;color:${p.color};font-weight:600;margin:0;">● ${p.riskLabel}</p>
              <p style="font-size:9px;color:${mutedColor};margin:3px 0 0;">Нажмите для подробностей</p>
            </div>`
          )
          .addTo(map);
      });

      map.on('mouseleave', 'bridge-circles', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      map.on('click', 'bridge-circles', (e) => {
        const f = e.features?.[0];
        if (f) onClickRef.current(f.properties!.bridgeId as number);
      });

      loadedRef.current = true;
      updateData(map, bridgesRef.current);
    });

    mapRef.current = map;
    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [updateData, getTileUrl]);

  // Switch map tiles on theme change
  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return;
    const source = mapRef.current.getSource('carto') as maplibregl.RasterTileSource;
    if (source) {
      // Recreate style to switch tiles
      const map = mapRef.current;
      const center = map.getCenter();
      const zoom = map.getZoom();
      
      // Update tiles by setting new source
      (source as any).tiles = [getTileUrl(theme === 'dark')];
      (source as any).tileSize = 256;
      map.style.sourceCaches['carto'].clearTiles();
      map.style.sourceCaches['carto'].update(map.transform);
      map.triggerRepaint();
    }
  }, [theme, getTileUrl]);

  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return;
    updateData(mapRef.current, bridges);
  }, [bridges, updateData]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <InfoPanel />
      <div className="hidden md:block">
        <Legend />
      </div>
      <div className="hidden sm:block">
        <EventLog events={events} onBridgeClick={onClickRef.current} />
      </div>
    </div>
  );
}
