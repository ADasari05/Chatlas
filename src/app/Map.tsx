"use client";

import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

function Map(): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const map = new mapboxgl.Map({
            container: containerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            projection: 'mercator',
            center: [0, 20],
            zoom: 1.5,
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));

        // Remove right click feature
        map.dragRotate.disable();

        // Remove street view
        map.on('style.load', () => {
            for (const layer of map.getStyle()?.layers ?? []) {
                if (layer['source-layer'] === 'road' || layer['source-layer'] === 'road_label') {
                    map.setLayoutProperty(layer.id, 'visibility', 'none');
                }
            }
        });

        return () => {
            map.remove();
        };
    }, []);

    return <div className="map" ref={containerRef} />;
}

export default Map;
