"use client";

import React, { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

export function OpenPanel(): void {
    window.dispatchEvent(new Event('openInfoPanel'));
}

const tabs = ['Background', 'History/Culture', 'News', 'Media'];

interface Location {
    country: string;
    city?: string;
}

export function setLocation(location: Location): void {
    window.dispatchEvent(new CustomEvent<Location>('setInfoLocation', { detail: location }));
    OpenPanel();
}

async function loadTab(tabIndex: number, location: Location | null): Promise<string> {
    if (!location) {
        return `${tabs[tabIndex]}: Please Select a Location`;
    }
    const name = location.city ? `${location.city}, ${location.country}` : location.country;
    // TODO: Pull tab data from APIs
    return `Loading ${tabs[tabIndex]} for ${name}...`;
}

function InfoPanel(): React.JSX.Element | null {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [height, setHeight] = useState<number>(60);
    const [dragging, setDragging] = useState<boolean>(false);

    const [location, setLocation] = useState<Location | null>(null);
    const [tabIndex, setTabIndex] = useState<number>(1);
    const [tabText, setTabText] = useState<Record<number, string>>({});

    useEffect(() => {
        const openPanel = (): void => {
            setIsOpen(true);
            setHeight(60);
        };

        const changeLocation = (e: Event): void => {
            setLocation((e as CustomEvent<Location>).detail);
            setTabText({});
        };

        window.addEventListener('openInfoPanel', openPanel);
        window.addEventListener('setInfoLocation', changeLocation);

        return () => {
            window.removeEventListener('openInfoPanel', openPanel);
            window.removeEventListener('setInfoLocation', changeLocation);
        };
    }, []);

    useEffect(() => {
        if (tabText[tabIndex] !== undefined) {
            return;
        }
 
        let cancelled = false;
        loadTab(tabIndex, location).then((text) => {
            if (!cancelled) {
                setTabText((old) => ({ ...old, [tabIndex]: text }));
            }
        });
 
        return () => {
            cancelled = true;
        };
    }, [location, tabIndex, tabText]);

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
                        {tabText[index] ?? 'Loading...'}
                    </TabPanel>
                ))}
            </Tabs>
        </div>
    );
}

export default InfoPanel;