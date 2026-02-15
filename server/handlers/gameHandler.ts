import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../shared/events';
import { roomManager } from '../state/RoomManager';
import { getRandomWords } from '../wordBank';
import { APP_CONFIG, SERVER_CONFIG } from '../../shared/config';
import { Book, Page, Room } from '../../shared/types';
import { disconnectionTimers } from '../state/disconnectionTimers';
import { sanitizeRoom, sanitizeRoomForPlayer } from '../utils/sanitize';
import { turnTimerManager } from '../state/TurnTimerManager';
import { SubmitDrawingSchema, SubmitGuessSchema, UpdateSettingsSchema } from '../../shared/schemas';
import { formatZodError } from '../utils/error';

/**
 * Broadcasts regular room updates to each player with personalized data
 */
const broadcastRoomUpdate = (io: Server, room: Room) => {
    room.players.forEach(player => {
        if (player.isConnected && player.socketId) {
            io.to(player.socketId).emit(SOCKET_EVENTS.ROOM_UPDATE, sanitizeRoomForPlayer(room, player.id));
        }
    });
};

/**
 * Determines the action type for the current turn
 * @param turnNumber Current turn number (0-indexed)
 * @param playerCount Total number of players
 * @returns 'draw' | 'guess' | 'skip'
 */
const getCurrentAction = (turnNumber: number, playerCount: number): 'draw' | 'guess' | 'skip' => {
    const isOdd = playerCount % 2 !== 0;

    // For odd player counts, turn 0 is a skip round (no draw/guess)
    if (isOdd && turnNumber === 0) return 'skip';

    // Adjust turn number for odd counts (skip round shifts everything by 1)
    const effectiveTurn = isOdd ? turnNumber - 1 : turnNumber;

    // Even effective turns: Draw, Odd effective turns: Guess
    return effectiveTurn % 2 === 0 ? 'draw' : 'guess';
};

/**
 * Pass books to the next player (circular rotation)
 */
const rotateBooks = (roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const playerIds = room.players.map(p => p.id);

    room.gameState.books.forEach(book => {
        const currentIndex = playerIds.indexOf(book.currentHolderId);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        book.currentHolderId = playerIds[nextIndex];
    });
};

/**
 * Start a new turn with timer
 */
const startNewTurn = (io: Server, roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    // Clear previous turn's submissions
    room.gameState.submittedPlayerIds = [];
    room.gameState.turnStartTime = Date.now();

    // Don't rotate books on turn 0 — books start with their owners
    if (room.gameState.turnNumber > 0) {
        rotateBooks(roomId);
    }

    // Determine time limit based on action type
    const action = getCurrentAction(room.gameState.turnNumber, room.players.length);
    const timeLimit = action === 'skip' ? APP_CONFIG.timeLimits.skip
        : action === 'draw' ? APP_CONFIG.timeLimits.draw
            : APP_CONFIG.timeLimits.guess;

    // Broadcast turn start (personalized)
    room.players.forEach(player => {
        if (player.isConnected && player.socketId) {
            io.to(player.socketId).emit(SOCKET_EVENTS.TURN_ADVANCE, sanitizeRoomForPlayer(room, player.id));
        }
    });

    // Start robust timer
    turnTimerManager.startTimer(roomId, timeLimit, () => {
        // Grace period: wait for late client auto-submissions before auto-filling
        setTimeout(() => {
            const currentRoom = roomManager.getRoom(roomId);
            // Verify (Idempotency check handled in advanceTurn via timer clearing, but extra safe)
            if (currentRoom && currentRoom.gameState.turnNumber === room.gameState.turnNumber) {
                advanceTurn(io, roomId);
            }
        }, SERVER_CONFIG.serverGracePeriod);
    });
};

/**
 * Advance to next turn or end game
 */
const advanceTurn = (io: Server, roomId: string) => {
    turnTimerManager.clearTimer(roomId); // Prevent double-trigger

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    // Auto-fill for players who didn't submit
    const submittedIds = new Set(room.gameState.submittedPlayerIds);
    room.players.forEach(player => {
        if (!submittedIds.has(player.id)) {
            autoFillForPlayer(roomId, player.id, !player.isConnected);
        }
    });

    room.gameState.turnNumber++;

    // Check if game is complete (all books back to owners)
    if (room.gameState.turnNumber >= room.players.length) {
        endGame(io, roomId);
    } else {
        startNewTurn(io, roomId);
    }
};

/**
 * Auto-fill a page for a player who didn't submit (timeout or disconnect)
 */
const autoFillForPlayer = (roomId: string, playerId: string, disconnected: boolean) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    // Find the book this player currently holds
    const book = room.gameState.books.find(b => b.currentHolderId === playerId);
    if (!book) return;

    const action = getCurrentAction(room.gameState.turnNumber, room.players.length);

    // Copy previous page content if available
    const previousPage = book.pages[book.pages.length - 1];
    const content = previousPage ? previousPage.content : '';

    // Skip rounds don't produce content pages — just mark as submitted
    if (action === 'skip') {
        if (!room.gameState.submittedPlayerIds.includes(playerId)) {
            room.gameState.submittedPlayerIds.push(playerId);
        }
        return;
    }

    const autoFilledPage: Page = {
        type: action === 'draw' ? 'draw' : 'guess',
        playerId: player.id,
        playerName: player.name,
        content: '', // Leave blank as requested
        timestamp: Date.now(),
        disconnected: disconnected
    };

    book.pages.push(autoFilledPage);

    // Mark as submitted
    if (!room.gameState.submittedPlayerIds.includes(playerId)) {
        room.gameState.submittedPlayerIds.push(playerId);
    }
};

/**
 * End the game and transition to reveal phase
 */
const endGame = (io: Server, roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    room.gameState.status = 'REVEAL';
    // During Reveal, everyone sees everything, so we can use standard emit
    io.to(roomId).emit(SOCKET_EVENTS.GAME_OVER, sanitizeRoom(room));
};

export const registerGameHandlers = (io: Server, socket: Socket) => {

    /**
     * Updates room settings (difficulty, etc)
     * Only Host can trigger this.
     */
    socket.on(SOCKET_EVENTS.UPDATE_SETTINGS, (data) => {
        const result = UpdateSettingsSchema.safeParse(data);
        if (!result.success) {
            console.error("Invalid Settings Update:", formatZodError(result.error));
            return;
        }
        const { roomId, settings } = result.data;
        const room = roomManager.getRoom(roomId);
        if (room) {
            // Merge settings carefully
            room.settings = { ...room.settings, ...settings };
            broadcastRoomUpdate(io, room);
        }
    });

    socket.on(SOCKET_EVENTS.TOGGLE_READY, ({ roomId }: { roomId: string }) => {
        const room = roomManager.getRoom(roomId);
        if (room) {
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                player.isReady = !player.isReady;
                broadcastRoomUpdate(io, room);
            }
        }
    });

    /**
     * Starts the Telestrations game
     */
    socket.on(SOCKET_EVENTS.START_GAME, ({ roomId }: { roomId: string }) => {
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) return;

        // Validate player count
        if (room.players.length < APP_CONFIG.gameLimits.minPlayers) {
            console.log(`Not enough players. Need ${APP_CONFIG.gameLimits.minPlayers}, have ${room.players.length}`);
            return;
        }

        // Get selected difficulties from settings
        const difficulties = room.settings.difficulties || ['easy', 'medium', 'hard'];

        // Get random words for each player
        const secretWords = getRandomWords(room.players.length, difficulties);

        // Initialize game state
        room.gameState.status = 'PLAYING';
        room.gameState.turnNumber = 0;
        room.gameState.submittedPlayerIds = [];
        room.gameState.settings = {
            difficulties: difficulties,
            drawTimeLimit: APP_CONFIG.timeLimits.draw,
            guessTimeLimit: APP_CONFIG.timeLimits.guess
        };

        // Create a book for each player
        room.gameState.books = room.players.map((p, index) => {
            const book: Book = {
                id: p.id,
                ownerName: p.name,
                secretWord: secretWords[index],
                pages: [],
                currentHolderId: p.id // Start with owner
            };

            // For even player count, add the secret word as first page (turn 0 = draw)
            // For odd player count, just the word (turn 0 = pass, turn 1 = draw)
            const initialPage: Page = {
                type: 'word',
                playerId: p.id,
                playerName: 'SECRET',
                content: secretWords[index],
                timestamp: Date.now()
            };
            book.pages.push(initialPage);

            return book;
        });

        // Emit game started (Private updates to hide secret words of others)
        // Using broadcastRoomUpdate triggers ROOM_UPDATE, but GAME_STARTED is distinct event in client?
        // Let's check client: usually listens for ROOM_UPDATE for state, GAME_STARTED might be toast
        // Actually, the example code sent GAME_STARTED with room data. 
        // We should send targeted GAME_STARTED.
        room.players.forEach(p => {
            if (p.isConnected && p.socketId) {
                io.to(p.socketId).emit(SOCKET_EVENTS.GAME_STARTED, sanitizeRoomForPlayer(room, p.id));
            }
        });

        // Start first turn
        startNewTurn(io, roomId);
    });

    /**
     * Player submits a drawing
     */
    socket.on(SOCKET_EVENTS.SUBMIT_DRAWING, (data) => {
        const result = SubmitDrawingSchema.safeParse(data);
        if (!result.success) {
            console.error("Invalid Drawing Submission:", formatZodError(result.error));
            return;
        }
        const { roomId, drawingData } = result.data;

        const room = roomManager.getRoom(roomId);
        if (!room || room.gameState.status !== 'PLAYING') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        // Check if player already submitted
        if (room.gameState.submittedPlayerIds.includes(player.id)) return;

        // Find the book this player currently holds
        const book = room.gameState.books.find(b => b.currentHolderId === player.id);
        if (!book) return;

        // Create draw page
        const drawPage: Page = {
            type: 'draw',
            playerId: player.id,
            playerName: player.name,
            content: drawingData, // Base64 image data
            timestamp: Date.now()
        };

        book.pages.push(drawPage);
        room.gameState.submittedPlayerIds.push(player.id);

        // Update room
        broadcastRoomUpdate(io, room);

        // Check if all players submitted
        if (room.gameState.submittedPlayerIds.length === room.players.length) {
            advanceTurn(io, roomId);
        }
    });

    /**
     * Player submits a guess
     */
    socket.on(SOCKET_EVENTS.SUBMIT_GUESS, (data) => {
        const result = SubmitGuessSchema.safeParse(data);
        if (!result.success) {
            console.error("Invalid Guess Submission:", formatZodError(result.error));
            return;
        }
        const { roomId, guessText } = result.data;

        const room = roomManager.getRoom(roomId);
        if (!room || room.gameState.status !== 'PLAYING') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        // Check if player already submitted
        if (room.gameState.submittedPlayerIds.includes(player.id)) return;

        // Find the book this player currently holds
        const book = room.gameState.books.find(b => b.currentHolderId === player.id);
        if (!book) return;

        // Create guess page
        const guessPage: Page = {
            type: 'guess',
            playerId: player.id,
            playerName: player.name,
            content: guessText.trim(),
            timestamp: Date.now()
        };

        book.pages.push(guessPage);
        room.gameState.submittedPlayerIds.push(player.id);

        // Update room
        broadcastRoomUpdate(io, room);

        // Check if all players submitted
        if (room.gameState.submittedPlayerIds.length === room.players.length) {
            advanceTurn(io, roomId);
        }
    });

    /**
     * Player un-submits their current submission (undo)
     */
    socket.on(SOCKET_EVENTS.UNSUBMIT, ({ roomId }: { roomId: string }) => {
        const room = roomManager.getRoom(roomId);
        if (!room || room.gameState.status !== 'PLAYING') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        // Remove from submitted list
        const index = room.gameState.submittedPlayerIds.indexOf(player.id);
        if (index > -1) {
            room.gameState.submittedPlayerIds.splice(index, 1);

            // Remove the last page from the player's current book
            const book = room.gameState.books.find(b => b.currentHolderId === player.id);
            if (book && book.pages.length > 0) {
                const lastPage = book.pages[book.pages.length - 1];
                // Only remove if it was created by this player this turn
                if (lastPage.playerId === player.id) {
                    book.pages.pop();
                }
            }

            broadcastRoomUpdate(io, room);
        }
    });

    /**
     * Player clicked ready (early submission)
     */
    socket.on(SOCKET_EVENTS.PLAYER_READY, ({ roomId }: { roomId: string }) => {
        // This is handled by SUBMIT_DRAWING and SUBMIT_GUESS
        // Just a placeholder for explicit ready events if needed
    });

    /**
     * Player marks ready during odd-player skip round
     */
    socket.on(SOCKET_EVENTS.SUBMIT_SKIP_READY, ({ roomId }: { roomId: string }) => {
        const room = roomManager.getRoom(roomId);
        if (!room || room.gameState.status !== 'PLAYING') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        // Verify this is actually a skip round
        const action = getCurrentAction(room.gameState.turnNumber, room.players.length);
        if (action !== 'skip') return;

        // Check if player already submitted
        if (room.gameState.submittedPlayerIds.includes(player.id)) return;

        // Mark as submitted (no page added — skip rounds produce no content)
        room.gameState.submittedPlayerIds.push(player.id);

        // Update room
        broadcastRoomUpdate(io, room);

        // Check if all players submitted
        if (room.gameState.submittedPlayerIds.length === room.players.length) {
            advanceTurn(io, roomId);
        }
    });

    /**
     * Handle player disconnection during game
     */
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
        // Find room this player is in
        const allRooms = roomManager.getAllRooms();
        const room = allRooms.find(r => r.players.some(p => p.socketId === socket.id));

        if (room) {
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                player.isConnected = false;

                // If game is in progress, handle grace period
                if (room.gameState.status === 'PLAYING') {
                    // Start 30-second grace period
                    const timer = setTimeout(() => {
                        const currentRoom = roomManager.getRoom(room.id);
                        // Check if player is still disconnected and room exists
                        if (currentRoom) {
                            const currentPlayer = currentRoom.players.find(p => p.id === player.id);
                            if (currentPlayer && !currentPlayer.isConnected) {
                                // Auto-fill for this player if they haven't submitted
                                if (!currentRoom.gameState.submittedPlayerIds.includes(player.id)) {
                                    autoFillForPlayer(room.id, player.id, true);
                                    broadcastRoomUpdate(io, currentRoom);

                                    // Check if all players submitted after auto-fill
                                    if (currentRoom.gameState.submittedPlayerIds.length === currentRoom.players.length) {
                                        advanceTurn(io, room.id);
                                    }
                                }
                            }
                        }
                        // Clean up timer
                        disconnectionTimers.delete(player.id);
                    }, 30000); // 30 second grace period

                    disconnectionTimers.set(player.id, timer);
                }

                // Notify room of disconnection status update
                // This used to be simple emit, but now we should use broadcast if status is playing
                if (room.gameState.status === 'PLAYING') {
                    broadcastRoomUpdate(io, room);
                } else {
                    io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, sanitizeRoom(room));
                }
            }
        }
    });

    /**
     * End game early (return to lobby)
     */
    socket.on(SOCKET_EVENTS.END_GAME, ({ roomId }: { roomId: string }) => {
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (player && player.isHost) {
            // Reset to lobby
            room.gameState.status = 'LOBBY';
            room.gameState.turnNumber = 0;
            room.gameState.books = [];
            room.gameState.submittedPlayerIds = [];

            // Lobby has no secret info, safe to broadcast normally
            io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, sanitizeRoom(room));
        }
    });
};
