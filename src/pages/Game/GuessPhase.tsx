import React, { useState, useEffect } from 'react';
import type { Room, Book } from '@shared/types';
import { Canvas } from '../../components/Canvas';
import { useSocket } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '@shared/events';
import { APP_CONFIG } from '@shared/config';
import './GamePhases.css';

interface GuessPhaseProps {
    room: Room;
    currentBook: Book;
}

export const GuessPhase: React.FC<GuessPhaseProps> = ({ room, currentBook }) => {
    const { socket } = useSocket();
    const [guessText, setGuessText] = useState('');
    const [canSubmit, setCanSubmit] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    const player = room.players.find(p => p.socketId === socket.id);
    const isSubmitted = player && room.gameState.submittedPlayerIds.includes(player.id);

    // Get previous drawing to guess
    const previousDrawing = currentBook.pages[currentBook.pages.length - 1];

    // Timer
    useEffect(() => {
        if (!room.gameState.turnStartTime) return;

        const interval = setInterval(() => {
            const elapsed = Date.now() - room.gameState.turnStartTime!;
            const remaining = Math.max(0, Math.floor((APP_CONFIG.timeLimits.guess - elapsed) / 1000));
            setTimeLeft(remaining);

            // Auto-submit logic
            if (remaining === 0 && !hasSubmitted && !isSubmitted) {
                socket.emit(SOCKET_EVENTS.SUBMIT_GUESS, {
                    roomId: room.id,
                    guessText: guessText.trim() || 'No Guess ¯\\_(ツ)_/¯' // Fun fallback
                });
                setHasSubmitted(true);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [room.gameState.turnStartTime, hasSubmitted, isSubmitted, guessText, room.id]);

    // Enable submit after minimum delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setCanSubmit(true);
        }, APP_CONFIG.timeLimits.minSubmitDelay);

        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = () => {
        if (!canSubmit || !guessText.trim() || isSubmitted || hasSubmitted) return;

        socket.emit(SOCKET_EVENTS.SUBMIT_GUESS, {
            roomId: room.id,
            guessText: guessText.trim()
        });
        setHasSubmitted(true);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && canSubmit && guessText.trim()) {
            handleSubmit();
        }
    };

    return (
        <div className="game-phase">
            <div className="phase-header">
                <h1 className="phase-title">🤔 GUESS IT</h1>
                <div className="timer">{timeLeft}s</div>
            </div>

            {previousDrawing && previousDrawing.type === 'draw' && (
                <div className="drawing-reference">
                    <p className="reference-label">What is this drawing?</p>
                    <Canvas
                        initialDrawing={previousDrawing.content}
                        onDrawingComplete={() => { }}
                        readonly={true}
                    />
                    {previousDrawing.disconnected && (
                        <p className="disconnected-note">⚠️ Player disconnected</p>
                    )}
                </div>
            )}

            <div className="guess-input-section">
                <input
                    type="text"
                    className="guess-input"
                    placeholder="Type your guess here..."
                    value={guessText}
                    onChange={(e) => setGuessText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isSubmitted || hasSubmitted}
                    autoFocus
                    maxLength={50}
                />
            </div>

            <div className="phase-actions">
                {isSubmitted || hasSubmitted ? (
                    <div className="waiting-container">
                        <div className="waiting-message">
                            ✅ Waiting for other players... ({room.gameState.submittedPlayerIds.length}/{room.players.length})
                        </div>
                        <button
                            className="unsubmit-btn"
                            onClick={() => {
                                socket.emit(SOCKET_EVENTS.UNSUBMIT, { roomId: room.id });
                                setHasSubmitted(false);
                            }}
                        >
                            ✏️ Edit Guess
                        </button>
                    </div>
                ) : (
                    <button
                        className="submit-btn"
                        onClick={handleSubmit}
                        disabled={!canSubmit || !guessText.trim()}
                    >
                        {!canSubmit ? `Ready in ${Math.ceil(APP_CONFIG.timeLimits.minSubmitDelay / 1000)}s...` : 'Submit Guess ✓'}
                    </button>
                )}
            </div>
        </div>
    );
};
