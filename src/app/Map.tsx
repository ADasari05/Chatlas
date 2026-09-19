"use client";

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapStyleMenu, { MapStyleOption } from './MapStyleMenu';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;
mapboxgl.prewarm();

const MAP_STYLES: MapStyleOption[] = [
    { id: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
    { id: 'satellite-streets', label: 'Satellite Streets', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
    { id: 'navigation-dark', label: 'Navigation Dark', url: 'mapbox://styles/mapbox/navigation-night-v1' },
];

function setStreetLayersVisible(map: mapboxgl.Map, visible: boolean): void {
    for (const layer of map.getStyle()?.layers ?? []) {
        if (layer['source-layer'] === 'road' || layer['source-layer'] === 'road_label') {
            map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
        }
    }
}

function Map(): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const [activeStyleId, setActiveStyleId] = useState<string>(MAP_STYLES[0].id);
    const [showStreets, setShowStreets] = useState(false);
    const showStreetsRef = useRef(showStreets);
    showStreetsRef.current = showStreets;

    useEffect(() => {
        if (!containerRef.current) return;

        const map = new mapboxgl.Map({
            container: containerRef.current,
            style: MAP_STYLES[0].url,
            projection: 'mercator',
            center: [0, 20],
            zoom: 1.5,
        });
        mapRef.current = map;

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));

        // Remove right click feature
        map.dragRotate.disable();

        // Style switches reset layer visibility, so reapply on every load
        map.on('style.load', () => setStreetLayersVisible(map, showStreetsRef.current));

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    const handleStyleChange = (style: MapStyleOption): void => {
        mapRef.current?.setStyle(style.url);
        setActiveStyleId(style.id);
    };

    const handleStreetsToggle = (): void => {
        const next = !showStreets;
        setShowStreets(next);
        if (mapRef.current) setStreetLayersVisible(mapRef.current, next);
    };

    return (
        <div className="map">
            <link rel="preconnect" href="https://api.mapbox.com" />
            <link rel="preconnect" href="https://events.mapbox.com" />
            <div ref={containerRef} className="map-canvas" />
            <MapStyleMenu
                styles={MAP_STYLES}
                activeStyleId={activeStyleId}
                showStreets={showStreets}
                onStyleChange={handleStyleChange}
                onToggleStreets={handleStreetsToggle}
            />
        </div>
    );
}

export default Map;
