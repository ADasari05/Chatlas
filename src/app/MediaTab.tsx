"use client";

import React, { useEffect, useState } from 'react';
import { SelectedLocation, locationLabel } from './Map';

interface MusicBrainzArtist {
    id: string;
    name: string;
    score: number;
    type?: string;
    country?: string;
    area?: { name: string };
    'begin-area'?: { name: string };
    'life-span'?: {
        begin?: string;
        end?: string;
        ended?: boolean;
    };
    tags?: {
        name: string;
        count: number;
    }[];
}

interface MediaTabProps {
    location: SelectedLocation;
}

function formatLocation(location: SelectedLocation): string {
    const city = location.city;
    const country = location.country;
    if (city && country) {
        return 'beginarea:' + city + ' AND area:"' + country + '"';
    }
    const place = location.city ?? location.country;
    return 'area:"' + place + '"';
}

function formatLifespan(artist: MusicBrainzArtist): string | null {
    const lifespan = artist['life-span'];

    if (!lifespan?.begin) {
        return null;
    }

    if (lifespan.ended && lifespan.end) {
        return lifespan.begin + ' - ' + lifespan.end;
    }

    if (lifespan.ended) {
        return lifespan.begin;
    }

    return lifespan.begin + ' - ' + 'Present';
}

function getTopTags(artist: MusicBrainzArtist, max: number): string[] {
    if (!artist.tags || artist.tags.length === 0) {
        return [];
    }
    const items: string[] = [];  
    for (const tag of artist.tags) {
        if (items.length >= max) {
            break;
        }
        if (!(!tag.name || tag.name.toLowerCase() === 'unknown')) {
            items.push(tag.name);
        }
    }
    return items;
}

function MediaTab({ location }: MediaTabProps): React.JSX.Element {
    const [artists, setArtists] = useState<MusicBrainzArtist[]>([]);
    const [status, setStatus] = useState<'loading' | 'done' | 'empty' | 'error'>('loading');

    useEffect(() => {
        let cancelled = false;

        setStatus('loading');
        setArtists([]);

        const queryLocation = formatLocation(location);
        const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(queryLocation)}&fmt=json&limit=100`;

        const loadArtists = async (): Promise<void> => {
            try {
                const response = await fetch(url);

                if (!response.ok) {
                    setStatus('error');
                    return;
                }

                const data: { artists?: MusicBrainzArtist[] } = await response.json();

                if (cancelled) {
                    return;
                }

                const results: MusicBrainzArtist[] = [];

                for (const artist of data.artists ?? []) {
                    if (artist.score >= 80 && artist.id) {
                        results.push(artist);
                    }
                }

                results.sort((a, b) => b.score - a.score);

                setArtists(results.slice(0, 10));
                setStatus(results.length > 0 ? 'done' : 'empty');
            } catch (err) {
                if (cancelled) {
                    return;
                }

                console.error('Failed to load artists', err);
                setStatus('error');
            }
        };

        loadArtists();

        return () => {
            cancelled = true;
        };
    }, [location]);

    if (status === 'loading') {
        return <p className="media-tab-message">Loading artists...</p>;
    }

    if (status === 'error') {
        return <p className="media-tab-message">Could not load artists for {locationLabel(location)}. Please try again.</p>;
    }

    if (status === 'empty') {
        return <p className="media-tab-message">No artists native to {locationLabel(location)} found.</p>;
    }

    return (
        <div className="media-tab">
            <h3 
                className="media-tab-heading">Artists native to {locationLabel(location)}
            </h3>
            <div className="media-artist-scroll">
                {artists.map((artist) => {
                    const tags = getTopTags(artist, 5);
                    return (
                        <div key={artist.id} className="media-artist-card">
                            <a
                                className="media-artist-name"
                                href={`https://musicbrainz.org/artist/${artist.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {artist.name}
                            </a>

                            <div className="media-artist-facts">
                                {artist.type && (
                                    <span className="media-artist-fact">
                                        <span className="media-artist-fact-label">
                                            {"Type:"}
                                        </span>
                                        {artist.type}
                                    </span>
                                )}
                                {formatLifespan(artist) && (
                                    <span className="media-artist-fact">
                                        <span className="media-artist-fact-label">
                                            {"Active:"}
                                        </span>
                                        {formatLifespan(artist)}
                                    </span>
                                )}
                                {artist.area?.name && (
                                    <span className="media-artist-fact">
                                        <span className="media-artist-fact-label">
                                            {"Area:"}
                                        </span>
                                        {artist.area.name}
                                    </span>
                                )}
                                {artist['begin-area']?.name && (
                                    <span className="media-artist-fact">
                                        <span className="media-artist-fact-label">
                                            {"Origin:"}
                                        </span>
                                        {artist['begin-area'].name}
                                    </span>
                                )}
                            </div>

                            {tags.length > 0 && (
                                <div className="media-artist-tags">
                                    {tags.map((tag) => (
                                        <span key={tag} className="media-artist-tag">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default MediaTab;