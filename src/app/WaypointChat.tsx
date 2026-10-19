"use client";

import React, { useState, useEffect , useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

interface Message {
    id: number;
    timestamp: string;
    message_contents: string;
    sender_name: string | null;
    tour_guide_status: number | null;
}

export function openWaypointChat(waypointId: number): void {
    window.dispatchEvent(new CustomEvent('openWaypointChat', { detail: waypointId }));
}

async function getMessages(chatId: number): Promise<Message[]> {
    const { data, error } = await supabase.rpc('get_messages_with_sender_status', { chat_connection_id: chatId });

    if (error) {
        console.error('Could not load messages,', error);
        return [];
    }
    return data;
}

function WaypointChat(): React.JSX.Element | null {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [chatId, setChatId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState<string>('');
    const messagesRef = useRef<HTMLDivElement>(null);
    const currWaypointIdRef = useRef<number | null>(null);

    const [waypointLocation, setWaypointLocation] = useState<{
        city: string | null;
        country: string | null;
    }>({ city: null, country: null });

    // Open the chat for whichever waypoint was clicked
    useEffect(() => {
        const openChat = async (e: Event): Promise<void> => {
            const waypointId = (e as CustomEvent<number>).detail;
            currWaypointIdRef.current = waypointId;
            setIsOpen(true);
            setMessages([]);

            const { data } = await supabase
                .from('Waypoints')
                .select('associated_chat_connection')
                .eq('id', waypointId)
                .single();

            setChatId(data?.associated_chat_connection ?? null);
        };

        window.addEventListener('openWaypointChat', openChat);

        return () => {
            window.removeEventListener('openWaypointChat', openChat);
        };
    }, []);

    // Load messages, then check for new ones every 3 seconds
    useEffect(() => {
        if (chatId === null) return;

        const refresh = async (): Promise<void> => {
            setMessages(await getMessages(chatId));
        };

        refresh();
        const interval = setInterval(refresh, 3000);

        return () => clearInterval(interval);
    }, [chatId]);

    useEffect(() => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }, [messages.length]);

    // Get the location of the waypoint for display in the chat header
    useEffect(() => {
        async function fetchWaypointLocation() {
            const { data, error } = await supabase.rpc('get_waypoint_location', {
                waypoint_id: currWaypointIdRef.current
            });

            if (error || !data || data.length === 0) {
                setWaypointLocation({ city: null, country: null });
                return;
            }

            setWaypointLocation({
                city: data[0].city || null,
                country: data[0].country || null
            });
        }

        fetchWaypointLocation();
    }, [currWaypointIdRef.current]);


    const sendMessage = async (): Promise<void> => {
        if (chatId === null || newMessage.trim() === '') return;

        const { error } = await supabase.rpc('send_message', {
            text_contents: newMessage,
            chat_connection_id: chatId,
        });

        if (error) {
            console.error('Could not send message,', error);
            return;
        }

        setNewMessage('');
        setMessages(await getMessages(chatId));
    };

    const closeChat = (): void => {
        setIsOpen(false);
        setChatId(null);
    };

    const [isTourGuide, setIsTourGuide] = useState(false);

    useEffect(() => {
        checkTourGuide();
    }, [currWaypointIdRef.current]);

    async function checkTourGuide() {
        if(!currWaypointIdRef.current) {
            return;
        }

        const { data, error } = await supabase.rpc('is_tourguide_waypoint', {
            waypoint_id: currWaypointIdRef.current
        });

        if (error) {
            console.error('Could not check tour guide,', error);
            setIsTourGuide(false);
            return;
        }

        console.log('Tour guide check result:', data);

        setIsTourGuide(data === true);
    }

    if (!isOpen) return null;

    return (
        <div className="waypoint-chat">
            <div className="waypoint-chat-header">
                <span>
                    {`Chat${isTourGuide ? ' (Tour Guide)' : ''}${(
                        waypointLocation.city && waypointLocation.country
                            ? `: ${waypointLocation.city}, ${waypointLocation.country}`
                            : waypointLocation.country
                                ? `: ${waypointLocation.country}`
                                : 'Chat'
                    )}`}
                </span>
                <button onClick={closeChat}>✕</button>
            </div>
            <div className="waypoint-chat-messages" ref={messagesRef}>
                {messages.map((message) => (
                    <div key={message.id} className="waypoint-chat-message">
                        <div className="waypoint-chat-sender">
                            {message.tour_guide_status === 3 ? (
                                <strong>{message.sender_name ?? 'Unknown'} (TG)</strong>
                            ) : message.tour_guide_status === 2 ? (
                                <strong>{message.sender_name ?? 'Unknown'}</strong>
                            ) : (
                                message.sender_name ?? 'Unknown'
                            )}
                        </div>
                        {message.message_contents}
                    </div>
                ))}
            </div>
            <form
                className="waypoint-chat-input"
                onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                }}
            >
                <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
}

export default WaypointChat;
