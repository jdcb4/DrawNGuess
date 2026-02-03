import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { SOCKET_EVENTS } from '@shared/events';
import type { Room } from '@shared/types';
import { DrawPhase } from './Game/DrawPhase';
import { GuessPhase } from './Game/GuessPhase';
import { BookViewer } from './Game/BookViewer';

export const Game: React.FC = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [room, setRoom] = useState<Room | null>(null);

    useEffect(() => {
        const roomId = sessionStorage.getItem('currentRoomId');
        if (roomId) {
            socket.emit(SOCKET_EVENTS.GET_ROOM, { roomId }, (r: Room) => {
                if (r) setRoom(r);
                else {
                    navigate('/');
                }
            });
        } else {
            navigate('/');
        }

        socket.on(SOCKET_EVENTS.ROOM_UPDATE, (updatedRoom: Room) => {
            setRoom(updatedRoom);
        });

        socket.on(SOCKET_EVENTS.TURN_ADVANCE, (updatedRoom: Room) => {
            setRoom(updatedRoom);
        });

        socket.on(SOCKET_EVENTS.GAME_OVER, (endedRoom: Room) => {
            setRoom(endedRoom);
        });

        return () => {
            socket.off(SOCKET_EVENTS.ROOM_UPDATE);
            socket.off(SOCKET_EVENTS.TURN_ADVANCE);
            socket.off(SOCKET_EVENTS.GAME_OVER);
        };
    }, [socket, navigate]);

    if (!room) return <div className="container center">LOADING GAME...</div>;

    const status = room.gameState.status;

    // Reveal phase - show book viewer
    if (status === 'REVEAL') {
        return <BookViewer room={room} />;
    }

    // Playing phase - determine if drawing or guessing
    if (status === 'PLAYING') {
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return <div className="container center">Player not found...</div>;

        // Find the book this player currently holds
        const currentBook = room.gameState.books.find(b => b.currentHolderId === player.id);
        if (!currentBook) return <div className="container center">No book assigned...</div>;

        // Determine action based on turn number and player count
        const getCurrentAction = (turnNumber: number): 'draw' | 'guess' | 'word' => {
            // Start with Draw (Turn 0), then alternate
            return turnNumber % 2 === 0 ? 'draw' : 'guess';
        };

        const action = getCurrentAction(room.gameState.turnNumber);

        if (action === 'draw') {
            return <DrawPhase room={room} currentBook={currentBook} />;
        } else {
            return <GuessPhase room={room} currentBook={currentBook} />;
        }
    }

    return <div className="container center">Loading...</div>;
};
