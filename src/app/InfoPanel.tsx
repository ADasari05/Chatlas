"use client";

import React, { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { SelectedLocation } from './Map';

export function OpenPanel(): void {
    window.dispatchEvent(new Event('openInfoPanel'));
}

interface InfoPanelProps {
    selectedLocation?: SelectedLocation | null;
}

function InfoPanel({ selectedLocation }: InfoPanelProps): React.JSX.Element | null {
    const [isOpen, setIsOpen] = useState<boolean>(true);
    const [height, setHeight] = useState<number>(60);
    const [dragging, setDragging] = useState<boolean>(false);

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

    const locationLabel = selectedLocation ? selectedLocation.name : 'Please Select a Location';

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

            <Tabs defaultIndex={1} onSelect={(index: number) => console.log(index)}>
                <TabList>
                    <Tab>Background</Tab>
                    <Tab>History/Culture</Tab>
                    <Tab>News</Tab>
                    <Tab>Media</Tab>
                </TabList>
                <TabPanel className="info-content">Background: {locationLabel}</TabPanel>
                <TabPanel className="info-content">History/Culture: {locationLabel}</TabPanel>
                <TabPanel className="info-content">News: {locationLabel}</TabPanel>
                <TabPanel className="info-content">Media: {locationLabel}</TabPanel>
            </Tabs>
        </div>
    );
}

export default InfoPanel;