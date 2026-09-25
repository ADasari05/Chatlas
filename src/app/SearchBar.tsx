"use client";

import React, { useEffect, useRef, useState } from 'react';
import { SearchBoxCore, SessionToken, SearchBoxSuggestion } from '@mapbox/search-js-core';
import { SelectedLocation } from './Map';

const searchBox = new SearchBoxCore({ accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string });
const SEARCH_TYPES = 'country,region,place';
const DEBOUNCE_MS = 200;

const FEATURE_TYPE_LABELS: Record<string, string> = {
    country: 'Country',
    region: 'State / Region',
    place: 'City',
};

function suggestionContext(suggestion: SearchBoxSuggestion): string {
    return suggestion.place_formatted || FEATURE_TYPE_LABELS[suggestion.feature_type] || suggestion.feature_type;
}

interface SearchBarProps {
    onLocationSelected: (location: SelectedLocation) => void;
}

function SearchBar({ onLocationSelected }: SearchBarProps): React.JSX.Element {
    const [text, setText] = useState<string>('');
    const [suggestions, setSuggestions] = useState<SearchBoxSuggestion[]>([]);
    const [error, setError] = useState<string | null>(null);
    const sessionTokenRef = useRef(new SessionToken());

    useEffect(() => {
        if (!text.trim()) return;

        const timer = setTimeout(async () => {
            try {
                const response = await searchBox.suggest(text, {
                    sessionToken: sessionTokenRef.current,
                    types: SEARCH_TYPES,
                    limit: 6,
                });
                setSuggestions(response.suggestions);
                setError(response.suggestions.length === 0 ? 'No matching location found.' : null);
            } catch (err) {
                console.error('Search suggest failed:', err);
                setSuggestions([]);
                setError('Search failed. Try again.');
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [text]);

    const selectSuggestion = async (suggestion: SearchBoxSuggestion): Promise<void> => {
        try {
            const response = await searchBox.retrieve(suggestion, { sessionToken: sessionTokenRef.current });
            const feature = response.features[0];
            if (!feature) {
                setError('No matching location found.');
                return;
            }

            onLocationSelected({
                name: suggestion.name,
                center: feature.geometry.coordinates as [number, number],
            });
            setText(suggestion.name);
            setSuggestions([]);
            setError(null);
            sessionTokenRef.current = new SessionToken();
        } catch (err) {
            console.error('Search retrieve failed:', err);
            setError('Search failed. Try again.');
        }
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const value = event.target.value;
        setText(value);
        if (!value.trim()) {
            setSuggestions([]);
            setError(null);
        }
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        const suggestion = suggestions[0];
        if (!suggestion) {
            setError('No matching location found.');
            return;
        }
        void selectSuggestion(suggestion);
    };

    return (
        <div className="search-bar">
            <form onSubmit={handleSubmit} autoComplete="off">
                <input
                    type="text"
                    value={text}
                    onChange={handleChange}
                    placeholder="Enter a Country, State, or City"
                />
            </form>
            {suggestions.length > 0 && (
                <ul className="search-suggestions">
                    {suggestions.map((suggestion) => (
                        <li
                            key={suggestion.mapbox_id}
                            onMouseDown={() => void selectSuggestion(suggestion)}
                        >
                            <span className="suggestion-name">{suggestion.name}</span>
                            <span className="suggestion-context">{suggestionContext(suggestion)}</span>
                        </li>
                    ))}
                </ul>
            )}
            {error && <div className="search-error">{error}</div>}
        </div>
    );
}

export default SearchBar;
