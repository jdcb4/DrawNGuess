export interface Team {
    id: string;
    name: string;
}

export interface Player {
    id: string; // Persistent User ID (localStorage)
    socketId: string; // Transient Socket ID (changes on reconnect)
    name: string;
    isReady: boolean;
    isConnected: boolean; // False if socket disconnects (Grace period active)
    isHost: boolean;
    teamId?: string;
}

/**
 * Represents a single page in a Telestrations book
 */
export interface Page {
    type: 'word' | 'draw' | 'guess' | 'skip';
    playerId: string;
    playerName: string;
    content: string; // Base64 image data for drawings, text for words/guesses
    timestamp: number;
    disconnected?: boolean; // True if auto-filled due to player disconnect
}

/**
 * A Telestrations "sketchbook" that gets passed between players
 */
export interface Book {
    id: string; // Matches original owner's player ID
    ownerName: string;
    secretWord: string;
    pages: Page[];
    currentHolderId: string; // Which player currently has this book
}

/**
 * Core Game State for Telestrations
 */
export interface GameState {
    status: 'LOBBY' | 'PLAYING' | 'REVEAL';
    turnNumber: number; // Current turn (0 to playerCount-1)
    books: Book[];
    submittedPlayerIds: string[]; // Players who clicked "Ready" this turn
    settings: {
        difficulties: ('easy' | 'medium' | 'hard')[];
        drawTimeLimit: number; // milliseconds
        guessTimeLimit: number; // milliseconds
    };
    turnStartTime: number | null; // Timestamp when current turn started
}

/**
 * The complete state of a Game Room.
 * Synced partially or fully to clients via sockets.
 */
export interface Room {
    id: string;
    players: Player[];
    teams: Team[];
    settings: Record<string, any>;
    gameState: GameState;
}

/**
 * Word bank item with difficulty level
 */
export interface WordItem {
    word: string;
    difficulty: 'easy' | 'medium' | 'hard';
}
