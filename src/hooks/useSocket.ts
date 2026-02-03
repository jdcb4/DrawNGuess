import { useEffect, useState } from 'react';
import { socket } from '../socket';
import { SOCKET_EVENTS } from '@shared/events';

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [connectError, setConnectError] = useState<string | null>(null);

    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
            setConnectError(null);
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        function onConnectError(err: Error) {
            console.error('Socket connection error:', err);
            setIsConnected(false);
            setConnectError('Connection lost. Retrying...');
        }

        socket.on(SOCKET_EVENTS.CONNECT, onConnect);
        socket.on(SOCKET_EVENTS.DISCONNECT, onDisconnect);
        socket.on(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);

        return () => {
            socket.off(SOCKET_EVENTS.CONNECT, onConnect);
            socket.off(SOCKET_EVENTS.DISCONNECT, onDisconnect);
            socket.off(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);
        };
    }, []);

    return { socket, isConnected, connectError };
};
