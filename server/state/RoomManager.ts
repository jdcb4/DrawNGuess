import { Room } from '../../shared/types';

class RoomManager {
    private rooms: Map<string, Room>;

    constructor() {
        this.rooms = new Map<string, Room>();
    }

    /**
     * Adds a new room to the manager.
     */
    createRoom(room: Room): void {
        this.rooms.set(room.id, room);
    }

    /**
     * Retrieves a room by its ID.
     */
    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    /**
     * Removes a room from the manager.
     */
    deleteRoom(roomId: string): boolean {
        return this.rooms.delete(roomId);
    }

    /**
     * Checks if a room exists.
     */
    hasRoom(roomId: string): boolean {
        return this.rooms.has(roomId);
    }

    // Debugging / Admin
    getAllRooms(): Room[] {
        return Array.from(this.rooms.values());
    }
}

export const roomManager = new RoomManager();
