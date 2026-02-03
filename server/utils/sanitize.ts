import { Room, Player, Book, Page, Team } from '../../shared/types';

/**
 * Creates a clean, JSON-serializable copy of the Room object associated data.
 * This prevents circular reference errors and ensures only intended data is sent to clients.
 */
export const sanitizeRoom = (room: Room): Room => {
    return {
        id: room.id,
        players: room.players.map(sanitizePlayer),
        teams: room.teams.map(sanitizeTeam),
        settings: JSON.parse(JSON.stringify(room.settings)), // Deep copy settings
        gameState: {
            status: room.gameState.status,
            turnNumber: room.gameState.turnNumber,
            books: room.gameState.books.map(sanitizeBook),
            submittedPlayerIds: [...room.gameState.submittedPlayerIds],
            settings: { ...room.gameState.settings },
            turnStartTime: room.gameState.turnStartTime
        }
    };
};

const sanitizePlayer = (player: Player): Player => {
    return {
        id: player.id,
        socketId: player.socketId,
        name: player.name,
        isReady: player.isReady,
        isConnected: player.isConnected,
        isHost: player.isHost,
        teamId: player.teamId
    };
};

const sanitizeTeam = (team: Team): Team => {
    return {
        id: team.id,
        name: team.name
    };
};

const sanitizeBook = (book: Book): Book => {
    return {
        id: book.id,
        ownerName: book.ownerName,
        secretWord: book.secretWord,
        currentHolderId: book.currentHolderId,
        pages: book.pages.map(sanitizePage)
    };
};

const sanitizePage = (page: Page): Page => {
    return {
        type: page.type,
        playerId: page.playerId,
        playerName: page.playerName,
        content: page.content,
        timestamp: page.timestamp,
        disconnected: page.disconnected
    };
};

/**
 * Sanitizes room data specifically for a target player.
 * During 'PLAYING' phase, this ensures they only receive the book they are currently holding.
 */
export const sanitizeRoomForPlayer = (room: Room, playerId: string): Room => {
    const sanitized = sanitizeRoom(room);

    if (sanitized.gameState.status === 'PLAYING') {
        const heldBook = sanitized.gameState.books.find(b => b.currentHolderId === playerId);
        // Only reveal the book currently held by the player
        sanitized.gameState.books = heldBook ? [heldBook] : [];
    }

    return sanitized;
};
