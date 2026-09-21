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

const COUNTRY_DATA = 'country-data';
const COUNTRY_DATA_LAYER = 'country_boundaries';
const COUNTRY_TINT = 'country-tint';
const COUNTRY_OUTLINE = 'country-outline';
const CITY_DATA = 'city-data';
const CITY_DOT = 'city-dot';
const HIGHLIGHT_COLOR = '#f29406';
const NO_CITY = { type: 'FeatureCollection', features: [] };

function setStreetLayersVisible(map: mapboxgl.Map, visible: boolean): void {
    for (const layer of map.getStyle()?.layers ?? []) {
        if (layer['source-layer'] === 'road' || layer['source-layer'] === 'road_label') {
            map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
        }
    }
}

function addHoverEffect(map: mapboxgl.Map): void {
    // Define layers and determine where to place hover effects
    const layers = map.getStyle()?.layers ?? [];
    const textLayerId = layers.find((l) => l.type === 'symbol')?.id;
    const cityLayerId = layers.find((l) => l['source-layer'] === 'place_label')?.id;

    // Set up country boundaries
    if (!map.getSource(COUNTRY_DATA)) {
        map.addSource(COUNTRY_DATA, {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1',
        promoteId: { [COUNTRY_DATA_LAYER]: 'iso_3166_1' },
    });
    }

    // Tint country on hover
    map.addLayer(
        {
            id: COUNTRY_TINT,
            type: 'fill',
            source: COUNTRY_DATA,
            'source-layer': COUNTRY_DATA_LAYER,
            filter: ['any', ['==', 'all', ['get', 'worldview']], ['in', 'US', ['get', 'worldview']]],
            paint: {
                'fill-color': HIGHLIGHT_COLOR,
                'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.2, 0],
            },
        },
        textLayerId
    );


    // Outline country on hover
    map.addLayer(
        {
            id: COUNTRY_OUTLINE,
            type: 'line',
            source: COUNTRY_DATA,
            'source-layer': COUNTRY_DATA_LAYER,
            filter: ['any', ['==', 'all', ['get', 'worldview']], ['in', 'US', ['get', 'worldview']]],
            paint: {
                'line-color': HIGHLIGHT_COLOR,
                'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 3, 0],
            },
        },
        textLayerId
    );

    // Define city data and layer
    map.addSource(CITY_DATA, { type: 'geojson', data: NO_CITY });
    map.addLayer(
        {
            id: CITY_DOT,
            type: 'circle',
            source: CITY_DATA,
            paint: {
                'circle-radius': 9,
                'circle-color': HIGHLIGHT_COLOR,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
            },
        },
        cityLayerId
    );
}

function findCityNearMouse(map: mapboxgl.Map, mouse: mapboxgl.Point) {
    const cityTextLayers = (map.getStyle()?.layers ?? [])
        .filter((l) => l.type === 'symbol' && l['source-layer'] === 'place_label')
        .map((l) => l.id);
    if (cityTextLayers.length === 0) return undefined;

    const cities = map.queryRenderedFeatures(mouse, {
        layers: cityTextLayers,
        filter: ['==', ['get', 'class'], 'settlement'],
    }) as unknown as GeoJSON.Feature[];

    return cities[0];
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

        // Show name popup of city/country on mouse hover
        const nameBox = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });
        const showName = (place: mapboxgl.LngLat, name: string): void => {
            nameBox.setLngLat(place).setText(name);
            if (!nameBox.isOpen()) {
                nameBox.addTo(map);
                const element = nameBox.getElement();
                if (element) {
                    element.style.pointerEvents = 'none';
                }
            }
        };

        let hoveredCountry: string | null = null;
 
        const unhighlightCountry = (): void => {
            if (hoveredCountry === null) return;
            map.setFeatureState(
                { source: COUNTRY_DATA, sourceLayer: COUNTRY_DATA_LAYER, id: hoveredCountry },
                { hover: false }
            );
            hoveredCountry = null;
        };
 
        const unhighlightCity = (): void => {
            (map.getSource(CITY_DATA) as mapboxgl.GeoJSONSource | undefined)?.setData(NO_CITY);
        };

        // Track mouse movement for highlighting and showing names
        map.on('mousemove', (e) => {
            if (!map.getLayer(COUNTRY_TINT)) {
                return;
            }
 
            // Handle city case
            const city = findCityNearMouse(map, e.point);
            const cityName = city?.properties?.name;
            if (city && cityName) {
                unhighlightCountry();
                (map.getSource(CITY_DATA) as mapboxgl.GeoJSONSource).setData({
                    type: 'Feature',
                    properties: {},
                    geometry: city.geometry,
                });
                showName(e.lngLat, cityName);
                return;
            }
            unhighlightCity();
 
            // Handle country case
            const country = (
                map.queryRenderedFeatures(e.point, { layers: [COUNTRY_TINT] }) as unknown as GeoJSON.Feature[]
            )[0];
            const countryCode: string | undefined = country?.properties?.iso_3166_1;
            if (!country || !countryCode) {
                unhighlightCountry();
                nameBox.remove();
                return;
            }
 
            if (countryCode !== hoveredCountry) {
                unhighlightCountry();
                map.setFeatureState(
                    { source: COUNTRY_DATA, sourceLayer: COUNTRY_DATA_LAYER, id: countryCode },
                    { hover: true }
                );
                hoveredCountry = countryCode;
            }
            showName(e.lngLat, country.properties?.name_en ?? countryCode);
        });

        // Style switches reset layer visibility, so reapply on every load
        map.on('style.load', () => {
            setStreetLayersVisible(map, showStreetsRef.current);
            addHoverEffect(map);
            hoveredCountry = null;
            nameBox.remove();
        });

        return () => {
            nameBox.remove();
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
