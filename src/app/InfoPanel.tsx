"use client";

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { SelectedLocation, locationLabel } from './Map';

export function OpenPanel(): void {
    window.dispatchEvent(new Event('openInfoPanel'));
}

const tabs = ['Background', 'History/Culture', 'News', 'Media'];
const BACKGROUND_TAB = 0;
const HISTORY_TAB = 1;
const NEWS_TAB = 2;
const MEDIA_TAB = 3;

const MediaTab = lazy(() => import('./MediaTab'));

async function loadTab(tabIndex: number, location: SelectedLocation | null): Promise<string> {
    if (!location) {
        return `${tabs[tabIndex]}: Please Select a Location`;
    }
    // TODO: Pull tab data from APIs
    return `Loading ${tabs[tabIndex]} for ${locationLabel(location)}...`;
}

interface InfoPanelProps {
    selectedLocation?: SelectedLocation | null;
}

function InfoPanel({ selectedLocation = null }: InfoPanelProps): React.JSX.Element | null {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [height, setHeight] = useState<number>(60);
    const [dragging, setDragging] = useState<boolean>(false);

    const [tabIndex, setTabIndex] = useState<number>(1);
    const [tabText, setTabText] = useState<Record<number, string>>({});

    useEffect(() => {
        const openPanel = (): void => {
            setIsOpen(true);
            setHeight(60);
        };

        window.addEventListener('openInfoPanel', openPanel);

        return () => {
            window.removeEventListener('openInfoPanel', openPanel);
        };
    }, []);

    // Clear cached tab text when a new location is selected
    useEffect(() => {
        setTabText({});
    }, [selectedLocation]);

    useEffect(() => {
        if  (tabIndex === MEDIA_TAB) {
            return;
        }
        if (tabText[tabIndex] !== undefined) {
            return;
        }

        let cancelled = false;
        loadTab(tabIndex, selectedLocation).then((text) => {
            if (!cancelled) {
                setTabText((old) => ({ ...old, [tabIndex]: text }));
            }
        });

        return () => {
            cancelled = true;
        };
    }, [selectedLocation, tabIndex, tabText]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
        setDragging(true);
    };

    useEffect(() => {
        if (!dragging) return;

        const handleMouseMove = (e: MouseEvent): void => {
            const newHeight = ((window.innerHeight - e.clientY) / window.innerHeight) * 100;
            const limitHeight = Math.max(10, Math.min(60, newHeight));
            setHeight(limitHeight);
        };

        const handleMouseUp = (): void => setDragging(false);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="info-panel" style={{ height: `${height}%` }}>
            <div>
                <button className="close-button" onClick={() => setIsOpen(false)}>
                    Close
                </button>
            </div>
            <div className="drag-handle" onMouseDown={handleMouseDown}>
                <div className="drag-bar"></div>
            </div>

            <Tabs selectedIndex={tabIndex} onSelect={(index: number) => setTabIndex(index)}>
                <TabList>
                    <Tab>Background</Tab>
                    <Tab>History/Culture</Tab>
                    <Tab>News</Tab>
                    <Tab>Media</Tab>
                </TabList>
                {tabs.map((label, index) => (
                    <TabPanel key={label} className="info-content">
                        {index === MEDIA_TAB ? (
                            selectedLocation ? (
                                <Suspense fallback={<p>Loading...</p>}>
                                    <MediaTab location={selectedLocation} />
                                </Suspense>
                            ) : (
                                <p>{`${label}: Please Select a Location`}</p>
                            )
                        ) : (
                            tabText[index] ?? 'Loading...'
                        )}
                    </TabPanel>
                ))}
            </Tabs>
        </div>
    );
}

export default InfoPanel;