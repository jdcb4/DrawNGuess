import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { RulesModal } from '../components/ui/RulesModal';
import { SOCKET_EVENTS } from '@shared/events';
import { socket } from '../socket';
import { generateName } from '../utils/nameGenerator';
import styles from './Landing.module.css';

export const Landing: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { inviteCode } = useParams<{ inviteCode: string }>();
    const [name, setName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [rejoinRoomId, setRejoinRoomId] = useState<string | null>(null);

    useEffect(() => {
        // Check for error messages from redirects (e.g. kicked)
        if (location.state?.error) {
            setToastMessage(location.state.error);
            setShowToast(true);
            // Clear state so it doesn't persist on refresh? 
            // React Router state is cleared on new navigation but persists on refresh dependent on browser.
            // Better to clear it manually or just let it be.
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    useEffect(() => {
        // Load or generate name
        const storedName = localStorage.getItem('playerName');
        if (storedName) {
            setName(storedName);
        } else {
            setName(generateName());
        }

        // Handle invite code
        if (inviteCode) {
            setJoinCode(inviteCode.toUpperCase());
        }
    }, [inviteCode]);

    const connectAndEmit = (
        event: string,
        data: any,
        onSuccess: (res: any) => void
    ) => {
        setIsConnecting(true);
        setToastMessage('');
        setShowToast(false);

        const timeoutId = setTimeout(() => {
            setIsConnecting(false);
            setToastMessage('CONNECTION TIMEOUT. SERVER UNREACHABLE.');
            setShowToast(true);
        }, 5000); // 5s timeout

        const proceed = () => {
            socket.emit(event, data, (response: any) => {
                clearTimeout(timeoutId);
                // We keep isConnecting true until navigation for smoother UI, 
                // UNLESS there is an error in the response
                if (response.error) {
                    setIsConnecting(false);
                    setToastMessage(response.error);
                    setShowToast(true);
                    if (event === SOCKET_EVENTS.JOIN_ROOM) socket.disconnect();
                } else {
                    onSuccess(response);
                }
            });
        };

        if (socket.connected) {
            proceed();
        } else {
            socket.connect();
            const onConnect = () => {
                proceed();
                cleanup();
            };
            const onConnectError = (_err: Error) => {
                clearTimeout(timeoutId);
                setIsConnecting(false);
                setToastMessage(' CONNECTION FAILED');
                setShowToast(true);
                cleanup();
            };

            const cleanup = () => {
                socket.off('connect', onConnect);
                socket.off('connect_error', onConnectError);
            };

            socket.once('connect', onConnect);
            socket.once('connect_error', onConnectError);
        }
    };

    const handleRejoin = () => {
        if (!rejoinRoomId) return;
        setIsConnecting(true);
        // Use stored name if available, or current input
        const joinName = localStorage.getItem('playerName') || name || 'Player';

        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId: rejoinRoomId, name: joinName }, (response: any) => {
            setIsConnecting(false);
            if (response.error) {
                // If error (e.g. room gone), clear session
                localStorage.removeItem('lastRoomId');
                setRejoinRoomId(null);
                setToastMessage(response.error);
                setShowToast(true);
            } else {
                navigate(`/lobby/${rejoinRoomId}`);
            }
        });
    };

    const handleHost = () => {
        if (!name) {
            setToastMessage("ENTER NAME");
            setShowToast(true);
            return;
        }
        localStorage.setItem('playerName', name);

        connectAndEmit(SOCKET_EVENTS.CREATE_ROOM, { name }, (response) => {
            if (response.roomId) {
                navigate(`/lobby/${response.roomId}`);
            } else {
                setIsConnecting(false); // Should have been caught by response.error check but just in case
            }
        });
    };

    const handleJoin = () => {
        if (!name || !joinCode) {
            setToastMessage("ENTER NAME AND CODE");
            setShowToast(true);
            return;
        }
        localStorage.setItem('playerName', name);

        connectAndEmit(SOCKET_EVENTS.JOIN_ROOM, { roomId: joinCode, name }, (_response) => {
            navigate(`/lobby/${joinCode}`);
        });
    };

    return (
        <div className="container full-screen">
            <Toast
                message={toastMessage}
                show={showToast}
                onClose={() => setShowToast(false)}
            />
            <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
            <header className={styles.header}>
                <h1 className="text-6xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary filter drop-shadow-lg">
                    DrawNGuess
                </h1>
                <p className={styles.tagline}>Draw it, guess it, laugh at it!</p>
                <button
                    onClick={() => setShowRules(true)}
                    className={styles.infoBtn}
                    aria-label="How to play"
                >
                    <span style={{ fontSize: '1.2rem' }}>ⓘ</span> How to Play
                </button>
            </header>

            <main className={styles.main}>
                <div className={`${styles.section} ${styles.nameSection}`}>
                    <h3>NAME</h3>
                    <Input
                        placeholder="YOUR NAME"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        data-testid="name-input"
                        aria-label="Your Name"
                        maxLength={24}
                    />
                </div>

                <div className={styles.actionsGrid}>
                    {rejoinRoomId && (
                        <div className={styles.actionCol} style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
                            <Button
                                className={styles.fullBtn}
                                onClick={handleRejoin}
                                variant="secondary"
                                disabled={isConnecting}
                            >
                                {isConnecting ? 'REJOINING...' : `REJOIN ROOM ${rejoinRoomId}`}
                            </Button>
                        </div>
                    )}

                    <div className={styles.actionCol}>
                        <h3>HOST</h3>
                        <Button
                            size="lg"
                            onClick={handleHost}
                            className={styles.fullBtn}
                            disabled={isConnecting}
                            data-testid="host-btn"
                        >
                            {isConnecting ? <><span className={styles.spinner}></span> CREATING...</> : 'CREATE'}
                        </Button>
                    </div>

                    <div className={styles.actionCol}>
                        <h3>JOIN</h3>
                        <div className={styles.joinRow}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Input
                                    placeholder="CODE"
                                    value={joinCode}
                                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                    maxLength={4}
                                    data-testid="room-code-input"
                                    aria-label="Room Code"
                                />
                                {joinCode.length > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: '0.8rem',
                                        color: joinCode.length === 4 ? '#4ade80' : '#9ca3af'
                                    }}>
                                        {joinCode.length === 4 ? '✅' : `${joinCode.length}/4`}
                                    </span>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleJoin}
                                disabled={isConnecting || (joinCode.length > 0 && joinCode.length < 4)}
                                data-testid="join-btn"
                            >
                                {isConnecting ? '...' : 'GO'}
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
