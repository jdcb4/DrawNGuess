import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { SOCKET_EVENTS } from '@shared/events';
import type { Room } from '@shared/types';
import { DrawPhase } from './Game/DrawPhase';
import { GuessPhase } from './Game/GuessPhase';
import { SkipPhase } from './Game/SkipPhase';
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

    // Playing phase - determine if drawing, guessing, or skipping
    if (status === 'PLAYING') {
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return <div className="container center">Player not found...</div>;

        // Find the book this player currently holds
        const currentBook = room.gameState.books.find(b => b.currentHolderId === player.id);
        if (!currentBook) return <div className="container center">No book assigned...</div>;

        // Determine action based on turn number and player count
        const getCurrentAction = (turnNumber: number, playerCount: number): 'draw' | 'guess' | 'skip' => {
            const isOdd = playerCount % 2 !== 0;
            if (isOdd && turnNumber === 0) return 'skip';
            const effectiveTurn = isOdd ? turnNumber - 1 : turnNumber;
            return effectiveTurn % 2 === 0 ? 'draw' : 'guess';
        };

        const action = getCurrentAction(room.gameState.turnNumber, room.players.length);

        if (action === 'skip') {
            return <SkipPhase room={room} currentBook={currentBook} />;
        } else if (action === 'draw') {
            return <DrawPhase room={room} currentBook={currentBook} />;
        } else {
            return <GuessPhase room={room} currentBook={currentBook} />;
        }
    }

    return <div className="container center">Loading...</div>;
};
