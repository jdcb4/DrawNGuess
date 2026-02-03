/**
 * Manages turn timers to prevent race conditions and ensures clean turn transitions.
 * Stores a single NodeJS.Timeout per room.
 */
export class TurnTimerManager {
    private timers: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Starts a new timer for a room, clearing any existing one.
     */
    startTimer(roomId: string, durationMs: number, callback: () => void) {
        this.clearTimer(roomId);

        const timer = setTimeout(() => {
            this.timers.delete(roomId);
            callback();
        }, durationMs);

        this.timers.set(roomId, timer);
    }

    /**
     * Clears the active timer for a room (e.g., when all players submit early).
     */
    clearTimer(roomId: string) {
        if (this.timers.has(roomId)) {
            clearTimeout(this.timers.get(roomId)!);
            this.timers.delete(roomId);
        }
    }
}

export const turnTimerManager = new TurnTimerManager();
