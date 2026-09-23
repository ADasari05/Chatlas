"use client";

import React, { useState } from 'react';
import { loginStatus } from './Account';

export interface MapStyleOption {
    id: string;
    label: string;
    url: string;
}

interface MapStyleMenuProps {
    styles: MapStyleOption[];
    activeStyleId: string;
    showStreets: boolean;
    onStyleChange: (style: MapStyleOption) => void;
    onToggleStreets: () => void;
    showWaypoints: boolean;
    onToggleWaypoints: () => void;
}

function MapStyleMenu({ styles, activeStyleId, showStreets, onStyleChange, onToggleStreets, showWaypoints, onToggleWaypoints }: MapStyleMenuProps): React.JSX.Element {
    const [menuOpen, setMenuOpen] = useState(false);

    const handleStyleClick = (style: MapStyleOption): void => {
        onStyleChange(style);
        setMenuOpen(false);
    };

    return (
        <div className="style-menu">
            <button className="style-menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
                🗺️
            </button>
            {menuOpen && (
                <div className="style-menu-list">
                    {styles.map((style) => (
                        <button
                            key={style.id}
                            className={style.id === activeStyleId ? 'active' : ''}
                            onClick={() => handleStyleClick(style)}
                        >
                            {style.label}
                        </button>
                    ))}
                    <label className="style-menu-toggle-row">
                        <input type="checkbox" checked={showStreets} onChange={onToggleStreets} />
                        Show streets
                    </label>
                    <label className="style-menu-toggle-row">
                        <input type="checkbox" checked={showWaypoints} onChange={onToggleWaypoints} disabled={!loginStatus}/>
                        Show waypoints
                    </label>
                </div>
            )}
        </div>
    );
}

export default MapStyleMenu;
