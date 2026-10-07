"use client";

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { MapMouseEvent } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapStyleMenu, { MapStyleOption } from './MapStyleMenu';
import { loginStatus } from './Account';
import { createClient } from '@/utils/supabase/client';
import { openWaypointChat } from './WaypointChat';

const supabase = createClient();

const MAP_STYLES: MapStyleOption[] = [
    { id: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
    { id: 'satellite-streets', label: 'Satellite Streets', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
    { id: 'navigation-dark', label: 'Navigation Dark', url: 'mapbox://styles/mapbox/navigation-night-v1' },
];

// id is the country code for countries (e.g. "US"), and region code + name
// for cities (e.g. "US-IL:Springfield") so same-named cities stay distinct
export interface SelectedLocation {
    id: string;
    country: string;
    region?: string;
    city?: string;
    center: [number, number];
}

export function locationName(location: SelectedLocation): string {
    return location.city ?? location.region ?? location.country;
}

export function locationLabel(location: SelectedLocation): string {
    const name = locationName(location);
    return name === location.country ? name : `${name}, ${location.country}`;
}

interface MapProps {
    selectedLocation?: SelectedLocation | null;
    onLocationSelected?: (location: SelectedLocation) => void;
}

const COUNTRY_DATA = 'country-data';
const COUNTRY_DATA_LAYER = 'country_boundaries';
const COUNTRY_TINT = 'country-tint';
const COUNTRY_OUTLINE = 'country-outline';
const CITY_DATA = 'city-data';
const CITY_DOT = 'city-dot';
const HIGHLIGHT_COLOR = '#f29406';
const NO_CITY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const CLICKED_CITY_DATA = 'clicked-city-data';
const CLICKED_CITY_DOT = 'clicked-city-dot';
const CLICK_COLOR = '#b21c1c';

interface WaypointEntry {
    id: number;
    marker: mapboxgl.Marker;
}

interface OtherWaypointEntry extends WaypointEntry {
    ownerUserId: string;
}

const ownWaypoints: WaypointEntry[] = [];
const otherWaypoints: OtherWaypointEntry[] = [];

function createWaypointMarker(
    lng: number,
    lat: number,
    color: string
): mapboxgl.Marker {
    return new mapboxgl.Marker({ color })
        .setLngLat([lng, lat]);
}

const OWN_WAYPOINT_COLOR = '#2b75f4';
const OTHER_WAYPOINT_COLOR = '#e87d2c';

let nextTempWaypointId = -1;

let currentMap: mapboxgl.Map | null = null;
let waypointsVisible = true;
let onOwnWaypointClick: ((id: number) => void) | null = null;
let onOtherWaypointClick: ((waypointId: number, ownerUserId: string) => void) | null = null;

function setStreetLayersVisible(map: mapboxgl.Map, visible: boolean): void {
    for (const layer of map.getStyle()?.layers ?? []) {
        if (layer['source-layer'] === 'road' || layer['source-layer'] === 'road_label') {
            map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
        }
    }
}

async function loadWaypoints(map: mapboxgl.Map, visible: boolean): Promise<void> {
    for (const wp of [...ownWaypoints, ...otherWaypoints]) {
        wp.marker.remove();
    }
    ownWaypoints.length = 0;
    otherWaypoints.length = 0;
 
    const [{ data: mine, error: mineError }, { data: others, error: othersError }] = await Promise.all([
        supabase.rpc('get_my_waypoints'),
        supabase.rpc('get_other_waypoints'),
    ]);
 
    if (mineError || othersError) {
        console.error('Could not load waypoints', mineError, othersError);
        return;
    }
 
    for (const wp of mine ?? []) {
        const marker = createWaypointMarker(wp.longitude, wp.latitude, OWN_WAYPOINT_COLOR);
        if (visible) {
            marker.addTo(map);
        }
        marker.getElement().addEventListener('click', (ev) => {
            ev.stopPropagation();
            onOwnWaypointClick?.(wp.id);
        });
        ownWaypoints.push({ id: wp.id, marker });
    }
 
    for (const wp of others ?? []) {
        const marker = createWaypointMarker(wp.longitude, wp.latitude, OTHER_WAYPOINT_COLOR);
        if (visible) {
            marker.addTo(map);
        }
        marker.getElement().addEventListener('click', (ev) => {
            ev.stopPropagation();
            onOtherWaypointClick?.(wp.id, wp.owner_user_id);
        });
        otherWaypoints.push({ id: wp.id, marker, ownerUserId: wp.owner_user_id });
    }
}
 
function setWaypointsVisible(map: mapboxgl.Map, visible: boolean): void {
    for (const wp of [...ownWaypoints, ...otherWaypoints]) {
        if (visible) {
            wp.marker.addTo(map);
        } else {
            wp.marker.remove();
        }
    }
}
 
function removeAllWaypoints(): void {
    for (const wp of [...ownWaypoints, ...otherWaypoints]) {
        wp.marker.remove();
    }
    ownWaypoints.length = 0;
    otherWaypoints.length = 0;
}

export async function handleMapLogin(): Promise<void> {
    if (currentMap) {
        await loadWaypoints(currentMap, waypointsVisible);
        setWaypointsVisible(currentMap, waypointsVisible);
        console.log('Map login handled, waypoints loaded');
    }
}
 
export function handleMapLogout(): void {
    removeAllWaypoints();
}

export async function deleteAllOwnWaypoints(): Promise<void> {
    for (const entry of ownWaypoints) {
        const { error } = await supabase.rpc('delete_waypoint', {
            waypoint_id: entry.id
        });

        if (error) {
            console.error('Could not delete waypoint,', error);
            return;
        }
    }

    for (const entry of ownWaypoints) {
        entry.marker.remove();
    }

    ownWaypoints.length = 0;
};

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
                'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], CLICK_COLOR, HIGHLIGHT_COLOR],
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], 0.3,
                    ['boolean', ['feature-state', 'hover'], false], 0.2,
                    0,
                ],
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
                'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], CLICK_COLOR, HIGHLIGHT_COLOR],
                'line-width': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], 3,
                    ['boolean', ['feature-state', 'hover'], false], 3,
                    0,
                ],
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

    // Define city data and layer for clicked case
    map.addSource(CLICKED_CITY_DATA, { type: 'geojson', data: NO_CITY });
    map.addLayer(
        {
            id: CLICKED_CITY_DOT,
            type: 'circle',
            source: CLICKED_CITY_DATA,
            paint: {
                'circle-radius': 9,
                'circle-color': CLICK_COLOR,
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

function Map({ selectedLocation, onLocationSelected }: MapProps): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const onLocationSelectedRef = useRef(onLocationSelected);
    onLocationSelectedRef.current = onLocationSelected;
    const mapSelectionRef = useRef<SelectedLocation | null>(null);
    const [activeStyleId, setActiveStyleId] = useState<string>(MAP_STYLES[0].id);
    const [showStreets, setShowStreets] = useState(false);
    const showStreetsRef = useRef(showStreets);
    showStreetsRef.current = showStreets;
    const [showWaypoints, setShowWaypoints] = useState(true);
    const showWaypointsRef = useRef(showWaypoints);
    showWaypointsRef.current = showWaypoints;

    const [isWaypointConfirmationPopupOpen, setIsWaypointConfirmationPopupOpen] = useState(false);
    const [isDeleteWaypointPopupOpen, setIsDeleteWaypointPopupOpen] = useState(false);
    const [selectedOwnWaypointId, setSelectedOwnWaypointId] = useState<number | null>(null);
    const [isChatWaypointPopupOpen, setIsChatWaypointPopupOpen] = useState(false);
    const [selectedOtherWaypointOwnerId, setSelectedOtherWaypointOwnerId] = useState<string | null>(null);
    const [selectedOtherWaypointId, setSelectedOtherWaypointId] = useState<number | null> (null);

    useEffect(() => {
        if (!containerRef.current) return;

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;
        mapboxgl.prewarm();

        const map = new mapboxgl.Map({
            container: containerRef.current,
            style: MAP_STYLES[0].url,
            projection: 'mercator',
            center: [0, 20],
            zoom: 1.5,
        });
        mapRef.current = map;
        currentMap = map;

        onOwnWaypointClick = (id) => {
            setSelectedOwnWaypointId(id);
            setIsDeleteWaypointPopupOpen(true);
        };
        onOtherWaypointClick = (waypointId, ownerUserId) => {
            setSelectedOtherWaypointId(waypointId);
            setSelectedOtherWaypointOwnerId(ownerUserId);
            setIsChatWaypointPopupOpen(true);
        };

        if (loginStatus) {
            loadWaypoints(map, showWaypointsRef.current);
        }

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));

        // Remove right click feature
        map.dragRotate.disable();
        map.doubleClickZoom.disable();

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
        let selectedCountry: string | null = null;
        let selectedCity: string | null = null;

        const selectFromMap = (location: SelectedLocation): void => {
            mapSelectionRef.current = location;
            onLocationSelectedRef.current?.(location);
        };
 
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

        // Remove highlighting for clicking
        const deselect = (): void => {
            if (selectedCountry !== null) {
                map.setFeatureState(
                    { source: COUNTRY_DATA, sourceLayer: COUNTRY_DATA_LAYER, id: selectedCountry },
                    { selected: false }
                );
                selectedCountry = null;
            }
            selectedCity = null;
            (map.getSource(CLICKED_CITY_DATA) as mapboxgl.GeoJSONSource | undefined)?.setData(NO_CITY);
        };

        const moveMapOnClick = (location: mapboxgl.LngLatLike): void => {
            map.easeTo({
                center: location,
                padding: { top: 0, left: 0, right: 0, bottom: window.innerHeight * 0.6 },
                duration: 1200,
            });
        }

        let clickTimer: ReturnType<typeof setTimeout> | null = null;

        // Show click highlight
        map.on('click', (e) => {
            if (e.originalEvent.detail > 1) {
                if (clickTimer) {
                    clearTimeout(clickTimer);
                }
                return;
            }
            clickTimer = setTimeout(() => {
                clickTimer = null;
                if (!map.getLayer(COUNTRY_TINT)) {
                    return;
                }

                // City case
                const city = findCityNearMouse(map, e.point);
                if (city) {
                    const cityCenter = (city.geometry as GeoJSON.Point).coordinates as [number, number];
                    const cityPoint = map.project(cityCenter);
                    const cityCountry = (
                        map.queryRenderedFeatures(cityPoint, { layers: [COUNTRY_TINT] }) as unknown as GeoJSON.Feature[]
                    )[0];
                    const cityName: string = city.properties?.name ?? '';
                    const regionCode: string = city.properties?.iso_3166_2 ?? cityCountry?.properties?.iso_3166_1 ?? '';
                    const cityId = `${regionCode}:${cityName}`;

                    const wasSelected = selectedCity === cityId;
                    deselect();
                    if (wasSelected) {
                        return;
                    }
                    (map.getSource(CLICKED_CITY_DATA) as mapboxgl.GeoJSONSource).setData({
                        type: 'Feature',
                        properties: city.properties || {},
                        geometry: city.geometry,
                    });
                    selectedCity = cityId;
                    selectFromMap({
                        id: cityId,
                        country: cityCountry?.properties?.name_en ?? '',
                        city: cityName,
                        center: cityCenter,
                    });
                    moveMapOnClick(cityCenter);
                    return;
                }

                // Country case
                const country = (
                    map.queryRenderedFeatures(e.point, { layers: [COUNTRY_TINT] }) as unknown as GeoJSON.Feature[]
                )[0];
                const countryCode: string | undefined = country?.properties?.iso_3166_1;

                if (!countryCode) {
                    return;
                }

                if(selectedCountry == countryCode) {
                    map.setFeatureState(
                        { source: COUNTRY_DATA, sourceLayer: COUNTRY_DATA_LAYER, id: countryCode },
                        { selected: false }
                    );
                    selectedCountry = null;
                    return;
                }

                deselect();
                map.setFeatureState(
                    { source: COUNTRY_DATA, sourceLayer: COUNTRY_DATA_LAYER, id: countryCode },
                    { selected: true }
                );
                
                selectedCountry = countryCode;
                selectFromMap({
                    id: countryCode,
                    country: country.properties?.name_en ?? countryCode,
                    center: [e.lngLat.lng, e.lngLat.lat],
                });
                moveMapOnClick(e.lngLat);
            }, 250);
        });

        map.on('dblclick', (e) => {
            if(loginStatus == false) {
                console.log("User not logged in, cannot add waypoint");
                return;
            }
            if (ownWaypoints.length >= 5 || !showWaypointsRef.current) {
                console.log("Waypoint limit reached or waypoints not visible.");
                return;
            }
            setIsWaypointConfirmationPopupOpen(true);
 
            const marker = createWaypointMarker(e.lngLat.lng, e.lngLat.lat, OWN_WAYPOINT_COLOR);
            if (showWaypointsRef.current) {
                marker.addTo(map);
            }
 
            const id = nextTempWaypointId--;

            const entry: WaypointEntry = {
                id,
                marker
            };

            marker.getElement().addEventListener('click', (ev) => {
                ev.stopPropagation();
                onOwnWaypointClick?.(entry.id);
            });

            ownWaypoints.push(entry);
        });

        // Style switches reset layer visibility, so reapply on every load
        map.on('style.load', () => {
            setStreetLayersVisible(map, showStreetsRef.current);
            if (loginStatus) {
                loadWaypoints(map, showWaypointsRef.current);
            }
            setWaypointsVisible(map, showWaypointsRef.current);
            addHoverEffect(map);
            hoveredCountry = null;
            selectedCountry = null;
            selectedCity = null;
            nameBox.remove();
        });

        return () => {
            nameBox.remove();
            map.remove();
            mapRef.current = null;
        };
    }, []);

    const simulateClickAtLngLat = (map: mapboxgl.Map): void => {
        if (!selectedLocation) {
            return;
        }
        const [lng, lat] = selectedLocation.center;
        
        const targetZoom = selectedLocation.city ? 10 : 4; 

        map.jumpTo({ 
            center: [lng, lat], 
            zoom: targetZoom 
        });

        map.once('idle', () => {
            const targetLngLat = new mapboxgl.LngLat(lng, lat);
            const targetPoint = map.project(targetLngLat);

            map.fire('click', {
                lngLat: targetLngLat,
                point: targetPoint,
                originalEvent: new MouseEvent('click', { detail: 1 }),
            } as unknown as MapMouseEvent);
        });
    };

    useEffect(() => {
        if (!selectedLocation || !mapRef.current) return;
        // Map clicks already move the map themselves
        if (selectedLocation === mapSelectionRef.current) return;
        mapRef.current.flyTo({
            center: selectedLocation.center,
            zoom: 4,
            padding: { top: 0, left: 0, right: 0, bottom: window.innerHeight * 0.6 },
        });
        simulateClickAtLngLat(mapRef.current);
    }, [selectedLocation]);

    const handleStyleChange = (style: MapStyleOption): void => {
        mapRef.current?.setStyle(style.url);
        setActiveStyleId(style.id);
    };

    const handleStreetsToggle = (): void => {
        const next = !showStreets;
        setShowStreets(next);
        if (mapRef.current) setStreetLayersVisible(mapRef.current, next);
    };

    const handleWaypointsToggle = (): void => {
        if (!loginStatus) {
            return;
        }
        const next = !showWaypoints;
        setShowWaypoints(next);
        waypointsVisible = next;
        if (mapRef.current) {
            setWaypointsVisible(mapRef.current, next);
        }
    };
 
    const removeLastOwnWaypoint = (): void => {
        const removed = ownWaypoints.pop();
        removed?.marker.remove();
    };

    const deleteSelectedWaypoint = async (): Promise<void> => {
        if (selectedOwnWaypointId === null) {
            return;
        }
        const index = ownWaypoints.findIndex((wp) => wp.id === selectedOwnWaypointId);
        if (index === -1) {
            return;
        }
        const entry = ownWaypoints[index];
 
        if (entry.id >= 0) {
            const { error } = await supabase.rpc('delete_waypoint', { waypoint_id: entry.id });
            if (error) {
                console.error('Could not delete waypoint,', error);
                return;
            }
        }
 
        entry.marker.remove();
        ownWaypoints.splice(index, 1);
        setSelectedOwnWaypointId(null);
    };
 
    const openChatWithWaypointOwner = (): void => {
        if (selectedOtherWaypointId === null) {
            return;
        }
        openWaypointChat(selectedOtherWaypointId);
    };

    const confirmWaypoint = async (): Promise<void> => {
        const entry = ownWaypoints[ownWaypoints.length - 1];
        if (!entry) {
            return;
        }
        const { lng, lat } = entry.marker.getLngLat();
        const { data, error } = await supabase.rpc('create_waypoint', {
            waypoint_longitude: lng,
            waypoint_latitude: lat,
        });
 
        if (error || data === null) {
            console.error('Could not save waypoint,', error);
            entry.marker.remove();
            ownWaypoints.pop();
            return;
        }
 
        entry.id = data;
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
                showWaypoints={showWaypoints}
                onStyleChange={handleStyleChange}
                onToggleStreets={handleStreetsToggle}
                onToggleWaypoints={handleWaypointsToggle}
            />
            {isWaypointConfirmationPopupOpen && (
                <div className="waypoint-overlay">
                <div className="waypoint-popup">
                    <p>Do you wish to place a waypoint here?</p>
                    <div className="waypoint-popup-buttons">
                    <button
                        className="waypoint-confirm-button"
                        onClick={() => {
                            setIsWaypointConfirmationPopupOpen(false);
                            confirmWaypoint();
                        }}
                    >
                        Confirm
                    </button>
                    <button
                        className="waypoint-cancel-button"
                        onClick={() => {
                            setIsWaypointConfirmationPopupOpen(false);
                            removeLastOwnWaypoint();
                        }}
                    >
                        Cancel
                    </button>
                    </div>
                </div>
                </div>
                
            )}
            {isDeleteWaypointPopupOpen && (
                <div className="waypoint-overlay">
                <div className="waypoint-popup">
                    <p>What would you like to do with this waypoint?</p>
                    <div className="waypoint-popup-buttons">
                    <button
                        className="waypoint-confirm-button"
                        onClick={() => {
                            setIsDeleteWaypointPopupOpen(false);
                            if (selectedOwnWaypointId !== null && selectedOwnWaypointId > 0) {
                                openWaypointChat(selectedOwnWaypointId);
                            }
                        }}
                    >
                        Chat
                    </button>
                    <button
                        className="waypoint-confirm-button"
                        onClick={() => {
                            setIsDeleteWaypointPopupOpen(false);
                            deleteSelectedWaypoint();
                        }}
                    >
                        Delete
                    </button>
                    <button
                        className="waypoint-cancel-button"
                        onClick={() => {
                            setIsDeleteWaypointPopupOpen(false);
                            setSelectedOwnWaypointId(null);
                        }}
                    >
                        Cancel
                    </button>
                    </div>
                </div>
                </div>
                
            )}
            {isChatWaypointPopupOpen && (
                <div className="waypoint-overlay">
                <div className="waypoint-popup">
                    <p>{"Chat with this waypoint's host?"}</p>
                    <div className="waypoint-popup-buttons">
                    <button
                        className="waypoint-confirm-button"
                        onClick={() => {
                            setIsChatWaypointPopupOpen(false);
                            openChatWithWaypointOwner();
                        }}
                    >
                        Chat
                    </button>
                    <button
                        className="waypoint-cancel-button"
                        onClick={() => {
                            setIsChatWaypointPopupOpen(false);
                            setSelectedOtherWaypointOwnerId(null);
                            setSelectedOtherWaypointId(null);
                        }}
                    >
                        Cancel
                    </button>
                    </div>
                </div>
                </div>
                
            )}
        </div>
    );
}

export default Map;