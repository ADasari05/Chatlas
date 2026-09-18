"use client";

import React, { useState } from 'react';
import './globals.css';
import Map from './Map';
import InfoPanel, { OpenPanel } from './InfoPanel';
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

    const [text, setText] = useState<string>('');

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        setText(event.target.value);
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
                <div className="search-bar">
                    <input
                        type="text"
                        value={text}
                        onChange={handleChange}
                        placeholder="Enter a Country or City"
                    />
                </div>
                <Map />
                <InfoPanel />
            </div>
        </div>
    );
};

export default UI;