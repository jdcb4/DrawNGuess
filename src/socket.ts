import { io, Socket } from 'socket.io-client';

// const URL = 'http://localhost:3000'; // Hardcoded for debugging
const URL = import.meta.env.VITE_API_URL || 'https://draw.jboxtv.com';
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
