"use client";
import React, { useState, useEffect } from 'react';
import './globals.css';
import Map, { SelectedLocation } from './Map';
import InfoPanel, { OpenPanel } from './InfoPanel';
import SearchBar from './SearchBar';
import Account from './Account';
import AdminDashboard from './AdminDashboard';
import { createClient } from '@/utils/supabase/client';

interface MenuOption {
    id: string;
    label: string;
}

const UI: React.FC = () => {
    const [supabase] = useState(() => createClient());
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [adminViewOverride, setAdminViewOverride] = useState<boolean>(false);

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role;
            const isClaimsAdmin = session?.user?.app_metadata?.claims_admin === true;
            setIsAdmin(role === 'admin' || isClaimsAdmin);
        };
        checkAdmin();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role;
            const isClaimsAdmin = session?.user?.app_metadata?.claims_admin === true;
            setIsAdmin(role === 'admin' || isClaimsAdmin);
            if (!session) {
                setAdminViewOverride(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

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

    // If logged in as admin and not explicitly overriding to map view, show Admin Dashboard
    if (isAdmin && !adminViewOverride) {
        return (
            <AdminDashboard
                onSignOut={() => {
                    setIsAdmin(false);
                    setAdminViewOverride(false);
                }}
                onViewMap={() => setAdminViewOverride(true)}
            />
        );
    }

    return (
        <div className="page">
            <div className="sidebar">
                <div className="sidebar-header">
                    <h2>Chatlas</h2>
                </div>
                {isAdmin && (
                    <div style={{ padding: '0 0 12px 0' }}>
                        <button
                            className="admin-badge"
                            style={{ width: '100%', cursor: 'pointer', border: 'none', padding: '6px 8px' }}
                            onClick={() => setAdminViewOverride(false)}
                        >
                            Return to Admin Console
                        </button>
                    </div>
                )}
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