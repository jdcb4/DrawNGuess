
export const SOCKET_EVENTS = {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    DISCONNECTING: 'disconnecting',
    CONNECT_ERROR: 'connect_error',

    // Room
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
    GET_ROOM: 'get_room',
    ROOM_UPDATE: 'room_update',

    // Game Flow
    TOGGLE_READY: 'toggle_ready',
    START_GAME: 'start_game',
    GAME_STARTED: 'game_started',
    END_GAME: 'end_game',
    GAME_OVER: 'game_over',

    // Player Management
    KICK_PLAYER: 'kick_player',
    KICKED: 'kicked',
    TOAST: 'toast', // Generic toast message from server

    // Teams (kept for potential future use)
    SWITCH_TEAM: 'switch_team',
    UPDATE_TEAM_COUNT: 'update_team_count',
    UPDATE_TEAM_NAME: 'update_team_name',

    // Settings
    UPDATE_SETTINGS: 'update_settings',

    // Telestrations Game Events
    SUBMIT_DRAWING: 'submit_drawing', // Player submits canvas data
    SUBMIT_GUESS: 'submit_guess', // Player submits text guess
    PLAYER_READY: 'player_ready', // Player clicked ready button
    TURN_ADVANCE: 'turn_advance', // Server broadcasts turn progression
    TURN_TIMEOUT: 'turn_timeout', // Timer expired, force advance
    UNSUBMIT: 'unsubmit', // Player undoes submission
    SUBMIT_SKIP_READY: 'submit_skip_ready', // Player ready during odd-player skip round
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
