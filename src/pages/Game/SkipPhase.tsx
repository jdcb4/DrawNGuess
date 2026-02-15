import React, { useState, useEffect } from 'react';
import type { Room, Book } from '@shared/types';
import { useSocket } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '@shared/events';
import { APP_CONFIG } from '@shared/config';
import './GamePhases.css';

interface SkipPhaseProps {
    room: Room;
    currentBook: Book;
}

/**
 * SkipPhase Component
 * 
 * Displayed during the odd-player skip round (Turn 0).
 * The book owner sees the secret word but doesn't draw or guess.
 * Shows a 15-second countdown with a "Ready" button to proceed early.
 */
export const SkipPhase: React.FC<SkipPhaseProps> = ({ room, currentBook }) => {
    const { socket } = useSocket();
    const [timeLeft, setTimeLeft] = useState(15);
    const [hasClickedReady, setHasClickedReady] = useState(false);

    const player = room.players.find(p => p.socketId === socket.id);
    const isSubmitted = player && room.gameState.submittedPlayerIds.includes(player.id);

    // The secret word from the book
    const secretWord = currentBook.secretWord;

    // Timer
    useEffect(() => {
        if (!room.gameState.turnStartTime) return;

        const interval = setInterval(() => {
            const elapsed = Date.now() - room.gameState.turnStartTime!;
            const remaining = Math.max(0, Math.floor((APP_CONFIG.timeLimits.skip - elapsed) / 1000));
            setTimeLeft(remaining);

            // Auto-ready when timer expires
            if (remaining === 0 && !hasClickedReady && !isSubmitted) {
                socket.emit(SOCKET_EVENTS.SUBMIT_SKIP_READY, { roomId: room.id });
                setHasClickedReady(true);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [room.gameState.turnStartTime, hasClickedReady, isSubmitted, room.id]);

    const handleReady = () => {
        if (isSubmitted || hasClickedReady) return;

        socket.emit(SOCKET_EVENTS.SUBMIT_SKIP_READY, { roomId: room.id });
        setHasClickedReady(true);
    };

    return (
        <div className="game-phase">
            <div className="phase-header">
                <h1 className="phase-title">⏭️ SKIP ROUND</h1>
                <div className="timer">{timeLeft}s</div>
            </div>

            <div className="reference-box">
                <p className="reference-label">YOUR SECRET WORD</p>
                <p className="reference-content">{secretWord}</p>
            </div>

            <div className="skip-message">
                <p>Because there is an odd number of players, you don't draw this turn.</p>
                <p className="skip-hint">The next player will draw this word for you!</p>
            </div>

            <div className="phase-actions">
                {isSubmitted || hasClickedReady ? (
                    <div className="waiting-container">
                        <div className="waiting-message">
                            ✅ Waiting for other players... ({room.gameState.submittedPlayerIds.length}/{room.players.length})
                        </div>
                    </div>
                ) : (
                    <button
                        className="submit-btn"
                        onClick={handleReady}
                    >
                        Ready ✓
                    </button>
                )}
            </div>
        </div>
    );
};
