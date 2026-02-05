import { io, Socket } from 'socket.io-client';

// If VITE_API_URL is provided, use it. Otherwise, default to undefined to use same-origin (window.location)
const URL = import.meta.env.VITE_API_URL || undefined;
console.log('🔌 Socket connecting to:', URL);

const getUserId = () => {
    let id = localStorage.getItem('userId');
    if (!id) {
        id = Math.random().toString(36).substring(2, 10); // Simple ID generation
        localStorage.setItem('userId', id);
    }
    return id;
};

export const socket: Socket = io(URL, {
    autoConnect: false,
    auth: {
        userId: getUserId()
    }
});
