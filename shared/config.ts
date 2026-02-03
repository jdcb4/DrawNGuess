export const APP_CONFIG = {
    appName: "DrawNGuess",
    theme: {
        background: "#050505",
        surface: "#111111",
        textMain: "#f0f0f0",
        textMuted: "#aaaaaa",
        primary: "#FF6B9D", // Playful pink
        secondary: "#4ECDC4", // Teal
        accent: "#FFE66D", // Yellow
        border: "#333333",
        radius: {
            sm: "4px",
            md: "12px",
            lg: "24px"
        }
    },
    gameLimits: {
        minPlayers: 2,
        maxPlayers: 12
    },
    teams: {
        enabled: false, // Teams not used in Telestrations
        minTeams: 2,
        maxTeams: 6,
        minPlayersPerTeam: 2,
        maxPlayersPerTeam: 6,
        defaultTeams: 4
    },
    settings: [
        {
            id: 'difficulties',
            label: 'WORD DIFFICULTY',
            type: 'multi-select',
            options: [
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' }
            ],
            default: ['easy', 'medium', 'hard'],
            visibleTeam: false,
            visibleSolo: true
        }
    ],
    /** Time limits for game phases (in milliseconds) */
    timeLimits: {
        draw: 60000, // 60 seconds for drawing
        guess: 30000, // 30 seconds for guessing
        minSubmitDelay: 5000 // Minimum 5s before can submit (prevent accidents)
    }
};

/**
 * Server configuration constants
 * Used for timing, rate limits, and other server-specific settings
 */
export const SERVER_CONFIG = {
    /** Grace period before disconnecting inactive players (30 seconds) */
    disconnectionGracePeriod: 30000,
    /** Duration of countdown phase before game starts (3 seconds) */
    countdownDuration: 3000,
    /** Length of room codes */
    roomCodeLength: 4,
    /** Rate limiting */
    rateLimits: {
        /** HTTP requests per IP per 15 minutes */
        httpRequestsPerWindow: 100,
        /** Socket events per connection before disconnect */
        socketEventsPerConnection: 50
    }
};
