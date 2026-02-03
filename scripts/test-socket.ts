import { io } from 'socket.io-client';

const runTest = async () => {
    console.log('Starting test...');
    const socket1 = io('http://localhost:3000', {
        transports: ['websocket']
    });

    await new Promise<void>((resolve) => {
        socket1.on('connect', () => {
            console.log('Socket 1 connected');
            resolve();
        });
    });

    // Create Room
    const roomId = await new Promise<string>((resolve) => {
        socket1.emit('create_room', { name: 'TestHost' }, (response: any) => {
            console.log('Create Room Response:', response);
            if (!response.roomId) {
                console.error("Failed to create room", response);
                process.exit(1);
            }
            resolve(response.roomId);
        });
    });

    console.log('Room ID:', roomId);

    // Join Room
    const socket2 = io('http://localhost:3000', {
        transports: ['websocket']
    });
    await new Promise<void>((resolve) => {
        socket2.on('connect', () => {
            console.log('Socket 2 connected');
            resolve();
        });
    });

    // Expect ROOM_UPDATE on socket1 when socket2 joins
    const updatePromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for ROOM_UPDATE')), 5000);
        socket1.on('room_update', (room: any) => {
            console.log('Received ROOM_UPDATE');
            // Check if serialized correctly (no circular error would prevent this)
            if (room.players && room.players.length === 2) {
                console.log('Room has 2 players, Success!');
                clearTimeout(timeout);
                resolve();
            }
        });
    });

    socket2.emit('join_room', { roomId, name: 'TestJoiner' }, (response: any) => {
        console.log('Join Room Response:', response);
        if (response.error) {
            console.error('Join Error:', response.error);
        }
    });

    await updatePromise;
    console.log('Test Passed!');

    socket1.close();
    socket2.close();
    process.exit(0);
};

runTest().catch((err) => {
    console.error('Test Failed:', err);
    process.exit(1);
});
