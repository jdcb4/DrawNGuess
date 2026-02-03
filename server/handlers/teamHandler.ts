import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../shared/events';
import { roomManager } from '../state/RoomManager';
import { APP_CONFIG } from '../../shared/config';
import { generateTeamName } from '../../shared/teamNames';

export const registerTeamHandlers = (io: Server, socket: Socket) => {

    /**
     * Handles player switching teams.
     * Checks capacity constraints before allowing switch.
     */
    socket.on(SOCKET_EVENTS.SWITCH_TEAM, (data, callback) => {
        const { roomId, teamId } = data;
        const room = roomManager.getRoom(roomId);
        if (room && APP_CONFIG.teams.enabled) {
            const player = room.players.find(p => p.socketId === socket.id);
            const targetTeam = room.teams.find(t => t.id === teamId);
            if (player && targetTeam) {
                // Check capacity
                const teamCount = room.players.filter(p => p.teamId === teamId).length;
                if (teamCount < APP_CONFIG.teams.maxPlayersPerTeam) {
                    player.teamId = teamId;
                    io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
                }
            }
        }
    });

    /**
     * Dynamic Team Resizing (Host Only).
     * Adds or removes teams and rebalances orphan players.
     */
    socket.on(SOCKET_EVENTS.UPDATE_TEAM_COUNT, (data) => {
        const { roomId, count } = data;
        const room = roomManager.getRoom(roomId);
        if (room && room.players.find(p => p.socketId === socket.id)?.isHost) {
            const currentCount = room.teams.length;
            if (count > currentCount) {
                // Add teams
                for (let i = currentCount; i < count; i++) {
                    room.teams.push({ id: `team-${i}`, name: generateTeamName() });
                }
            } else if (count < currentCount) {
                // Remove teams & rebalance
                const removedTeams = room.teams.slice(count).map(t => t.id);
                room.teams = room.teams.slice(0, count);

                // Reassign orphans
                const orphans = room.players.filter(p => p.teamId && removedTeams.includes(p.teamId));
                orphans.forEach(p => {
                    // Find smallest team
                    const counts = room.teams.map(t => ({
                        id: t.id,
                        count: room.players.filter(pl => pl.teamId === t.id && pl.id !== p.id).length
                    }));
                    counts.sort((a, b) => a.count - b.count);
                    p.teamId = counts[0].id;
                });
            }
            room.settings.teamCount = count;
            io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
        }
    });

    socket.on(SOCKET_EVENTS.UPDATE_TEAM_NAME, (data) => {
        const { roomId, teamId, name } = data;
        const room = roomManager.getRoom(roomId);
        if (room) {
            // Check if captain (first player in team)
            const teamPlayers = room.players.filter(p => p.teamId === teamId);
            // Sort by join order? Indices are stable in array usually.
            if (teamPlayers.length > 0 && teamPlayers[0].socketId === socket.id) {
                const team = room.teams.find(t => t.id === teamId);
                if (team) {
                    team.name = name;
                    io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
                }
            }
        }
    });
};
