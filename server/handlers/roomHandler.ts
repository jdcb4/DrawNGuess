import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../shared/events';
import { CreateRoomSchema, JoinRoomSchema } from '../../shared/schemas';
import { roomManager } from '../state/RoomManager';
import { APP_CONFIG, SERVER_CONFIG } from '../../shared/config';
import { disconnectionTimers } from '../state/disconnectionTimers';
import { generateTeamName } from '../../shared/teamNames';
import { Player, Team, Room } from '../../shared/types';
import { formatZodError } from '../utils/error';
import { sanitizeRoom } from '../utils/sanitize';

// Helper to generate room ID
const generateRoomId = () => Math.random().toString(36).substring(2, 6).toUpperCase();

export const registerRoomHandlers = (io: Server, socket: Socket) => {

    socket.on(SOCKET_EVENTS.CREATE_ROOM, (data, callback) => {
        const result = CreateRoomSchema.safeParse(data);
        if (!result.success) {
            const errorMessage = formatZodError(result.error);
            if (typeof callback === 'function') callback({ error: errorMessage });
            return;
        }
        const { name } = result.data;

        const roomId = generateRoomId();

        // Generate Teams
        const teams: Team[] = [];
        if (APP_CONFIG.teams.enabled) {
            for (let i = 0; i < APP_CONFIG.teams.defaultTeams; i++) {
                teams.push({ id: `team-${i}`, name: generateTeamName() });
            }
        }

        const userId = socket.handshake.auth.userId || socket.id;

        const player: Player = {
            id: userId,
            socketId: socket.id,
            name,
            isReady: true, // Host is auto-ready
            isConnected: true,
            isHost: true,
            teamId: teams.length > 0 ? teams[0].id : undefined
        };

        const room: Room = {
            id: roomId,
            players: [player],
            teams,
            settings: {
                difficulties: ['easy', 'medium', 'hard'] // Default difficulty setting
            },
            gameState: {
                status: 'LOBBY',
                turnNumber: 0,
                books: [],
                submittedPlayerIds: [],
                settings: {
                    difficulties: ['easy', 'medium', 'hard'],
                    drawTimeLimit: APP_CONFIG.timeLimits.draw,
                    guessTimeLimit: APP_CONFIG.timeLimits.guess
                },
                turnStartTime: null
            }
        };

        roomManager.createRoom(room);

        socket.join(roomId);
        if (typeof callback === 'function') callback({ roomId });
        console.log(`Room ${roomId} created by ${name}`);
    });

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data, callback) => {
        const result = JoinRoomSchema.safeParse(data);
        if (!result.success) {
            const errorMessage = formatZodError(result.error);
            if (typeof callback === 'function') callback({ error: errorMessage });
            return;
        }
        const { roomId, name } = result.data;

        const room = roomManager.getRoom(roomId);
        if (!room) {
            if (typeof callback === 'function') callback({ error: 'Room not found' });
            return;
        }
        if (room.gameState.status !== 'LOBBY') {
            if (typeof callback === 'function') callback({ error: 'Game already in progress' });
            return;
        }

        if (room.players.length >= APP_CONFIG.gameLimits.maxPlayers) {
            if (typeof callback === 'function') callback({ error: `Room is full (Max ${APP_CONFIG.gameLimits.maxPlayers})` });
            return;
        }

        // Teams Assignment (Round Robin)
        let teamId = undefined;
        if (APP_CONFIG.teams.enabled && room.teams.length > 0) {
            const counts = room.teams.map(t => ({
                id: t.id,
                count: room.players.filter(p => p.teamId === t.id).length
            }));
            counts.sort((a, b) => a.count - b.count);
            teamId = counts[0].id;
        }

        const userId = socket.handshake.auth.userId || socket.id;
        const existingPlayer = room.players.find(p => p.id === userId);

        // Check for existing player (Reconnection)
        if (existingPlayer) {
            // Update ephemeral socket ID but keep persistent User ID
            existingPlayer.socketId = socket.id;
            existingPlayer.isConnected = true;
            existingPlayer.name = name; // Update name if changed

            // Clear potential disconnection timer to prevent removal
            if (disconnectionTimers.has(existingPlayer.id)) {
                clearTimeout(disconnectionTimers.get(existingPlayer.id));
                disconnectionTimers.delete(existingPlayer.id);
            }

            socket.join(roomId);

            const sanitizedRoom = sanitizeRoom(room);
            io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, sanitizedRoom);
            if (typeof callback === 'function') callback({ room: sanitizedRoom });
            return;
        }

        const player: Player = {
            id: userId,
            socketId: socket.id,
            name,
            isReady: false,
            isConnected: true,
            isHost: false,
            teamId
        };

        room.players.push(player);
        socket.join(roomId);

        // Notify others of new player
        io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, sanitizeRoom(room));

        if (typeof callback === 'function') {
            callback({ room: sanitizeRoom(room) });
        }
        console.log(`${name} joined room ${roomId}`);
    });

    socket.on(SOCKET_EVENTS.GET_ROOM, ({ roomId }: { roomId: string }, callback) => {
        const room = roomManager.getRoom(roomId);
        if (room) {
            if (typeof callback === 'function') callback(room);
        } else {
            if (typeof callback === 'function') callback(null);
        }
    });

    socket.on(SOCKET_EVENTS.DISCONNECTING, () => {
        for (const roomId of socket.rooms) {
            const room = roomManager.getRoom(roomId);
            if (room) {
                const playerLeaving = room.players.find(p => p.socketId === socket.id);

                if (playerLeaving) {
                    // Mark as disconnected immediately for UI
                    playerLeaving.isConnected = false;
                    io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, sanitizeRoom(room));

                    // Set Grace Period (30s) before actual removal to allow refresh/reconnect
                    const timer = setTimeout(() => {
                        const currentRoom = roomManager.getRoom(roomId);
                        if (currentRoom) {
                            const p = currentRoom.players.find(pl => pl.id === playerLeaving.id);

                            // If still disconnected after grace period, remove them
                            if (p && !p.isConnected) {
                                currentRoom.players = currentRoom.players.filter(pl => pl.id !== p.id);
                                io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, sanitizeRoom(currentRoom));

                                // Clean up empty rooms
                                if (currentRoom.players.length === 0) {
                                    roomManager.deleteRoom(roomId);
                                } else if (p.isHost) {
                                    // Host Migration: Promote next player if host leaves
                                    const newHost = currentRoom.players[0];
                                    newHost.isHost = true;
                                    io.to(roomId).emit(SOCKET_EVENTS.TOAST, { message: `${newHost.name} is now Host` });
                                    io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, sanitizeRoom(currentRoom));
                                }
                            }
                        }
                    }, SERVER_CONFIG.disconnectionGracePeriod);

                    // Store timeout reference on player object (cast to any for runtime property)
                    (playerLeaving as any).disconnectTimeout = timer;
                }
            }
        }
    });

    socket.on(SOCKET_EVENTS.KICK_PLAYER, ({ roomId, playerId }: { roomId: string, playerId: string }) => {
        const room = roomManager.getRoom(roomId);
        if (room) {
            const requester = room.players.find(p => p.socketId === socket.id);
            if (requester && requester.isHost) {
                const target = room.players.find(p => p.id === playerId);
                if (target && target.id !== requester.id) {
                    room.players = room.players.filter(p => p.id !== playerId);
                    io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, sanitizeRoom(room));
                    io.to(target.socketId).emit(SOCKET_EVENTS.KICKED, { reason: 'You have been kicked.' });
                }
            }
        }
    });
};
