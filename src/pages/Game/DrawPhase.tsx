import React, { useState, useEffect, useRef } from 'react';
import type { Room, Book } from '@shared/types';
import { Canvas } from '../../components/Canvas';
import type { CanvasHandle } from '../../components/Canvas';
import { useSocket } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '@shared/events';
import { APP_CONFIG } from '@shared/config';
import './GamePhases.css';

interface DrawPhaseProps {
    room: Room;
    currentBook: Book;
}

export const DrawPhase: React.FC<DrawPhaseProps> = ({ room, currentBook }) => {
    const { socket } = useSocket();
    const [drawingData, setDrawingData] = useState<string>('');
    const [canSubmit, setCanSubmit] = useState(false);
    const [timeLeft, setTimeLeft] = useState(60);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    // Ref for always-current drawing data (avoids stale closure in timer)
    const drawingDataRef = useRef<string>('');
    // Ref to the Canvas imperative handle for direct snapshots
    const canvasHandleRef = useRef<CanvasHandle>(null);

    const player = room.players.find(p => p.socketId === socket.id);
    const isSubmitted = player && room.gameState.submittedPlayerIds.includes(player.id);

    // Get previous page content to reference
    const previousPage = currentBook.pages[currentBook.pages.length - 1];
    const referenceContent = previousPage?.type === 'word'
        ? previousPage.content
        : previousPage?.type === 'guess'
            ? previousPage.content
            : null;

    // Update both state and ref when Canvas reports a completed stroke
    const handleDrawingComplete = (dataUrl: string) => {
        setDrawingData(dataUrl);
        drawingDataRef.current = dataUrl;
    };

    // Timer
    useEffect(() => {
        if (!room.gameState.turnStartTime) return;

        const interval = setInterval(() => {
            const elapsed = Date.now() - room.gameState.turnStartTime!;
            const remaining = Math.max(0, Math.floor((APP_CONFIG.timeLimits.draw - elapsed) / 1000));
            setTimeLeft(remaining);

            // Auto-submit when timer reaches 0
            if (remaining === 0 && !hasSubmitted && !isSubmitted) {
                // Snapshot the canvas directly to capture mid-stroke data
                const snapshot = canvasHandleRef.current?.getSnapshot();
                const data = snapshot || drawingDataRef.current;

                if (data && data.startsWith('data:image/')) {
                    socket.emit(SOCKET_EVENTS.SUBMIT_DRAWING, {
                        roomId: room.id,
                        drawingData: data
                    });
                    setHasSubmitted(true);
                }
                // If no valid data (player drew nothing), let server auto-fill handle it
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [room.gameState.turnStartTime, hasSubmitted, isSubmitted, room.id]);

    // Enable submit after minimum delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setCanSubmit(true);
        }, APP_CONFIG.timeLimits.minSubmitDelay);

        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = () => {
        if (!canSubmit || !drawingData || isSubmitted || hasSubmitted) return;

        socket.emit(SOCKET_EVENTS.SUBMIT_DRAWING, {
            roomId: room.id,
            drawingData
        });
        setHasSubmitted(true);
    };

    return (
        <div className="game-phase">
            <div className="phase-header">
                <h1 className="phase-title">✏️ SKETCH IT</h1>
                <div className="timer">{timeLeft}s</div>
            </div>

            {referenceContent && (
                <div className="reference-box">
                    <p className="reference-label">Draw this:</p>
                    <p className="reference-content">{referenceContent}</p>
                </div>
            )}

            <Canvas
                ref={canvasHandleRef}
                onDrawingComplete={handleDrawingComplete}
                readonly={isSubmitted || hasSubmitted}
            />

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
                            ✏️ Edit Drawing
                        </button>
                    </div>
                ) : (
                    <button
                        className="submit-btn"
                        onClick={handleSubmit}
                        disabled={!canSubmit || !drawingData}
                    >
                        {!canSubmit ? `Ready in ${Math.ceil(APP_CONFIG.timeLimits.minSubmitDelay / 1000)}s...` : 'Submit Drawing ✓'}
                    </button>
                )}
            </div>
        </div>
    );
};
