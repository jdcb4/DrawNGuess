// Track disconnection timers server-side only (not part of game state to avoid serialization issues)
export const disconnectionTimers = new Map<string, NodeJS.Timeout>();
