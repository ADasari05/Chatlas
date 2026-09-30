"use client";

import React, { useState } from 'react';
import './globals.css';
import Map, { SelectedLocation } from './Map';
import InfoPanel, { OpenPanel } from './InfoPanel';
import SearchBar from './SearchBar';
import Account from './Account';

interface MenuOption {
    id: string;
    label: string;
}

const UI: React.FC = () => {

    const menuOptions: MenuOption[] = [
        { id: 'map', label: 'Map' },
        { id: 'chat', label: 'Chat' },
        { id: 'friends', label: 'Friends' },
        { id: 'profile', label: 'Profile' },
    ];

    const handleButtonClick = (label: string, id: string): void => {
        console.log(`Clicked: ${label} button`);
    };

    const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);

    const handleLocationSelected = (location: SelectedLocation): void => {
        setSelectedLocation(location);
        OpenPanel();
    };

    return (
        <div className="page">
            <div className="sidebar">
                <div className="sidebar-header">
                    <h2>Chatlas</h2>
                </div>
                <ul className="sidebar-buttons">
                    {menuOptions.map((option) => (
                        <li key={option.id}>
                            <button onClick={() => handleButtonClick(option.label, option.id)}>
                                {option.label}
                            </button>
                        </li>
                    ))}
                </ul>
                <button className="info-button" onClick={OpenPanel}>
                    {'Open \n Information'}
                </button>
                <Account />
            </div>
            <div className="main-content">
                <SearchBar onLocationSelected={handleLocationSelected} />
                <Map selectedLocation={selectedLocation} onLocationSelected={handleLocationSelected} />
                <InfoPanel selectedLocation={selectedLocation} />
            </div>
        </div>
    );
};

export default UI;