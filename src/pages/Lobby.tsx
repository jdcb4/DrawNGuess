import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { LobbyQR } from '../components/ui/LobbyQR';
import { APP_CONFIG } from '@shared/config';
import { SOCKET_EVENTS } from '@shared/events';
import { Modal } from '../components/ui/Modal';
import styles from './Lobby.module.css';
import type { Room } from '@shared/types';

export const Lobby: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [room, setRoom] = useState<Room | null>(null);
    const [showWarning, setShowWarning] = useState(false);
    const [toastMessage, setToastMessage] = useState('WAITING FOR PLAYERS!');
    const [userId, setUserId] = useState<string | null>(null);

    // Kick Modal State
    const [kickTarget, setKickTarget] = useState<{ id: string, name: string } | null>(null);

    // Team Rename Modal State
    const [renameTarget, setRenameTarget] = useState<{ id: string, oldName: string } | null>(null);
    const [newTeamName, setNewTeamName] = useState('');

    // Mobile UX State
    const [showQR, setShowQR] = useState(false);
    const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

    useEffect(() => {
        setUserId(localStorage.getItem('userId'));
    }, []);

    useEffect(() => {
        if (renameTarget) {
            setNewTeamName(renameTarget.oldName);
        }
    }, [renameTarget]);

    useEffect(() => {
        if (!code) return;

        function joinRoom() {
            if (code) {
                const storedName = localStorage.getItem('playerName') || 'Unknown';
                socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId: code, name: storedName }, (response: any) => {
                    if (response.error) {
                        localStorage.removeItem('lastRoomId'); // Clear invalid room
                        navigate('/', { state: { error: response.error } });
                    } else {
                        setRoom(response.room);
                        localStorage.setItem('lastRoomId', response.room.id);
                    }
                });
            }
        }

        // If socket disconnected (refresh), redirect to home for now to re-login
        // In a real app we'd use local storage to re-join
        if (!socket.connected) {
            socket.connect();
            socket.once('connect', joinRoom);
        } else {
            joinRoom();
        }

        // Socket Listeners
        socket.on(SOCKET_EVENTS.ROOM_UPDATE, (updatedRoom: Room) => {
            console.log('Room update:', updatedRoom);
            setRoom(updatedRoom);
            // UX: Automatically expand the user's team on first load/update if not already interacting
            if (!expandedTeamId && userId) {
                const myTeamId = updatedRoom.players.find(p => p.id === userId)?.teamId;
                if (myTeamId) setExpandedTeamId(myTeamId);
            }
        });

        socket.on(SOCKET_EVENTS.GAME_STARTED, (startedRoom: Room) => {
            if (startedRoom) {
                sessionStorage.setItem('currentRoomId', startedRoom.id);
            }
            navigate('/game');
        });

        socket.on(SOCKET_EVENTS.KICKED, ({ reason }: { reason: string }) => {
            navigate('/', { state: { error: reason || 'You have been kicked from the lobby.' } });
        });

        return () => {
            socket.off('connect', joinRoom);
            socket.off(SOCKET_EVENTS.ROOM_UPDATE);
            socket.off(SOCKET_EVENTS.GAME_STARTED);
            socket.off(SOCKET_EVENTS.KICKED);
        };
    }, [code, socket, navigate]);

    // Safety check
    if (!room) return <div className="container center">LOADING LOBBY {code}...</div>;

    // Derived state for render
    const currentUserId = userId || localStorage.getItem('userId');
    const myPlayer = room.players.find(p => p.id === currentUserId);
    const amIHost = myPlayer?.isHost || false;

    const handleReady = () => {
        socket.emit(SOCKET_EVENTS.TOGGLE_READY, { roomId: room.id });
    };

    const handleKickClick = (playerId: string, playerName: string) => {
        setKickTarget({ id: playerId, name: playerName });
    };

    const confirmKick = () => {
        if (kickTarget) {
            socket.emit(SOCKET_EVENTS.KICK_PLAYER, { roomId: room.id, playerId: kickTarget.id });
            setKickTarget(null);
        }
    };

    const handleRenameClick = (teamId: string, currentName: string) => {
        setRenameTarget({ id: teamId, oldName: currentName });
    };

    const confirmRename = () => {
        if (renameTarget && newTeamName.trim()) {
            socket.emit(SOCKET_EVENTS.UPDATE_TEAM_NAME, {
                roomId: room.id,
                teamId: renameTarget.id,
                name: newTeamName.trim()
            });
            setRenameTarget(null);
        }
    };

    const handleStart = () => {
        if (room.players.length < APP_CONFIG.gameLimits.minPlayers) {
            setToastMessage(`Need at least ${APP_CONFIG.gameLimits.minPlayers} players to start!`);
            setShowWarning(true);
            return;
        }

        const unready = room.players.some(p => !p.isReady);
        if (unready) {
            setToastMessage('WAITING FOR PLAYERS!');
            setShowWarning(true);
            return;
        }



        if (APP_CONFIG.teams.enabled) {
            // Validate Team Constraints
            // 1. Min Teams populated (Must have at least X teams with players)
            const activeTeams = room.teams.filter(t => room.players.some(p => p.teamId === t.id));
            if (activeTeams.length < APP_CONFIG.teams.minTeams) {
                setToastMessage(`Need at least ${APP_CONFIG.teams.minTeams} teams with players!`);
                setShowWarning(true);
                return;
            }
            // 2. Min Players per Team (Each active team must have Y players)
            const invalidTeams = activeTeams.filter(t => {
                const count = room.players.filter(p => p.teamId === t.id).length;
                return count < APP_CONFIG.teams.minPlayersPerTeam;
            });
            if (invalidTeams.length > 0) {
                setToastMessage(`Each team needs at least ${APP_CONFIG.teams.minPlayersPerTeam} player(s)!`);
                setShowWarning(true);
                return;
            }
        }

        // Emit start event if all checks pass
        socket.emit(SOCKET_EVENTS.START_GAME, { roomId: room.id });
    };

    const hostName = room.players.find(p => p.isHost)?.name || 'Unknown';

    return (
        <div className="container full-screen">
            <Toast
                message={toastMessage}
                show={showWarning}
                onClose={() => setShowWarning(false)}
            />

            <Modal
                isOpen={!!kickTarget}
                title="KICK PLAYER"
                onClose={() => setKickTarget(null)}
                onConfirm={confirmKick}
                confirmText="KICK"
                variant="danger"
            >
                Are you sure you want to kick <strong>{kickTarget?.name}</strong>?
            </Modal>

            <Modal
                isOpen={!!renameTarget}
                title="RENAME TEAM"
                onClose={() => setRenameTarget(null)}
                onConfirm={confirmRename}
                confirmText="SAVE"
            >
                <div style={{ padding: '1rem 0' }}>
                    <Input
                        label="TEAM NAME"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="Enter new team name..."
                        maxLength={20}
                        autoFocus
                    />
                </div>
            </Modal>

            <Modal
                isOpen={showQR}
                title="JOIN CODE"
                onClose={() => setShowQR(false)}
                onConfirm={() => setShowQR(false)}
                confirmText="CLOSE"
                cancelText=""
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem' }}>
                    <LobbyQR code={room.id} />
                    <p style={{ marginTop: '1rem', fontSize: '2rem', fontWeight: 'bold', letterSpacing: '0.1em' }}>{room.id}</p>
                </div>
            </Modal>

            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            socket.disconnect();
                            navigate('/');
                        }}
                        className={styles.backBtn}
                        title="Leave Lobby"
                    >
                        ←
                    </Button>
                    <h3 className={styles.appTitle}>{APP_CONFIG.appName}</h3>
                    <div style={{ width: 40 }}></div> {/* Spacer for centering */}
                </div>

                <div className={styles.roomInfo}>
                    <h1 className={styles.hostTitle}>{hostName}'s LOBBY</h1>
                    <div className={styles.codeRow} onClick={() => setShowQR(true)}>
                        <span className={styles.qrIcon} style={{ fontSize: '2rem', marginRight: '0.5rem' }}>📱</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span className={styles.codeLabel}>JOIN CODE:</span>
                            <span className={styles.roomCode}>{room.id}</span>
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            style={{ marginLeft: 'auto', padding: '0.2rem 0.8rem', fontSize: '0.8rem' }}
                        >
                            SHARE
                        </Button>
                    </div>
                </div>

                {room.gameState.status !== 'LOBBY' && <p className="danger">GAME IN PROGRESS</p>}
            </header>

            <main className={styles.main}>
                {/* Removed Inline QR */}

                {!APP_CONFIG.teams.enabled ? (
                    <div className={styles.playerList}>
                        {room.players.map(p => (
                            <div
                                key={p.id}
                                className={`${styles.player} ${p.isReady ? styles.ready : ''}`}
                                style={{ opacity: p.isConnected ? 1 : 0.5 }}
                            >
                                <span className={styles.name}>{p.name} {p.isHost && '👑'} {!p.isConnected && '(Disconnected)'}</span>
                                <span className={styles.status}>
                                    {p.isReady ? 'READY' : 'WAITING'}
                                    {amIHost && p.id !== myPlayer?.id && (
                                        <button
                                            className={styles.kickBtn}
                                            onClick={() => handleKickClick(p.id, p.name)}
                                            title="Kick Player"
                                            data-testid={`kick-btn-${p.id}`}
                                        >✕</button>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.teamGrid}>
                        {/* Team logic remains unchanged... omitted for brevity if no changes needed */}
                        {room.teams.map(team => {
                            const teamPlayers = room.players.filter(p => p.teamId === team.id);
                            const isMyTeam = myPlayer?.teamId === team.id;
                            const isFull = teamPlayers.length >= APP_CONFIG.teams.maxPlayersPerTeam;
                            // Captain is first person in team
                            const captain = teamPlayers[0];
                            const isCaptain = captain?.id === myPlayer?.id;
                            const isExpanded = expandedTeamId === team.id;

                            return (
                                <div key={team.id} className={`${styles.teamColumn} ${isExpanded ? styles.expanded : ''}`}>
                                    <div
                                        className={styles.teamHeader}
                                        onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                            <span className={styles.chevron}>{isExpanded ? '▼' : '▶'}</span>
                                            <span className={styles.teamName}>{team.name}</span>
                                            <span className={styles.teamCount}>({teamPlayers.length}/{APP_CONFIG.teams.maxPlayersPerTeam})</span>
                                        </div>
                                    </div>

                                    <div className={styles.teamActionBar}>
                                        {isCaptain && (
                                            <button
                                                className={styles.editBtn}
                                                onClick={(e) => { e.stopPropagation(); handleRenameClick(team.id, team.name); }}
                                                title="Rename Team"
                                            >
                                                ✎ RENAME
                                            </button>
                                        )}
                                        {!isMyTeam && !isFull && (
                                            <Button
                                                className={styles.joinTeamBtn}
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); socket.emit(SOCKET_EVENTS.SWITCH_TEAM, { roomId: room.id, teamId: team.id }); }}
                                            >
                                                JOIN
                                            </Button>
                                        )}
                                    </div>

                                    {isExpanded && (
                                        <div className={styles.playerList}>
                                            {teamPlayers.map((p, idx) => (
                                                <div
                                                    key={p.id}
                                                    className={`${styles.player} ${p.isReady ? styles.ready : ''}`}
                                                    style={{ opacity: p.isConnected ? 1 : 1 }}
                                                >
                                                    <span className={styles.name}>
                                                        {p.name}
                                                        {p.isHost && ' 👑'}
                                                        {idx === 0 && ' (C)'}
                                                        {!p.isConnected && ' (Disc.)'}
                                                    </span>
                                                    <span className={styles.status}>
                                                        {amIHost && p.id !== myPlayer?.id && (
                                                            <button
                                                                className={styles.kickBtn}
                                                                onClick={() => handleKickClick(p.id, p.name)}
                                                                title="Kick Player"
                                                            >✕</button>
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className={styles.settings}>
                    <h3>GAME SETTINGS</h3>

                    <div className={styles.settingRow}>
                        <label>WORD DIFFICULTY</label>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {['easy', 'medium', 'hard'].map(difficulty => {
                                const isSelected = room.settings.difficulties?.includes(difficulty);
                                return (
                                    <label
                                        key={difficulty}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            cursor: amIHost ? 'pointer' : 'default',
                                            opacity: amIHost ? 1 : 0.7
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={!amIHost}
                                            onChange={(e) => {
                                                if (!amIHost) return;
                                                const currentDifficulties = room.settings.difficulties || ['easy', 'medium', 'hard'];
                                                let newDifficulties;

                                                if (e.target.checked) {
                                                    newDifficulties = [...currentDifficulties, difficulty];
                                                } else {
                                                    newDifficulties = currentDifficulties.filter((d: string) => d !== difficulty);
                                                }

                                                if (newDifficulties.length === 0) {
                                                    return;
                                                }

                                                socket.emit(SOCKET_EVENTS.UPDATE_SETTINGS, {
                                                    roomId: room.id,
                                                    settings: { ...room.settings, difficulties: newDifficulties }
                                                });
                                            }}
                                            style={{ transform: 'scale(1.3)', accentColor: APP_CONFIG.theme.primary }}
                                        />
                                        <span style={{ textTransform: 'capitalize', fontSize: '0.9rem' }}>{difficulty}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className={styles.settingRow} style={{ marginTop: '1rem' }}>
                        <label>PLAYERS</label>
                        <span>{room.players.length} / {APP_CONFIG.gameLimits.maxPlayers}</span>
                    </div>
                </div>
            </main>

            <footer className={styles.footer}>
                <Button
                    className={styles.readyBtn}
                    variant={myPlayer?.isReady ? 'primary' : 'outline'}
                    onClick={handleReady}
                    data-testid="ready-btn"
                    disabled={amIHost} // Host doesn't need to readies up manually
                    style={{ display: amIHost ? 'none' : 'block' }}
                >
                    {myPlayer?.isReady ? 'READY!' : 'MARK READY'}
                </Button>

                {amIHost && (
                    room.players.length >= APP_CONFIG.gameLimits.minPlayers ? (
                        <Button
                            onClick={handleStart}
                            className={styles.startBtn}
                            data-testid="start-game-btn"
                        >
                            START GAME
                        </Button>
                    ) : (
                        <div className={styles.waitingText}>
                            Waiting for {APP_CONFIG.gameLimits.minPlayers - room.players.length} more player(s) to start...
                        </div>
                    )
                )}
            </footer>
        </div>
    );
};
