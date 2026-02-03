import { io, Socket } from 'socket.io-client';

const runStressTest = async () => {
    console.log('Starting stress test (4 players)...');

    const players: Socket[] = [];
    const playerNames = ['P1', 'P2', 'P3', 'P4'];
    let roomId = '';

    // 1. Connect P1
    const hostSocket = io('http://localhost:3000', { transports: ['websocket'] });
    players.push(hostSocket);

    await new Promise<void>(resolve => hostSocket.on('connect', resolve));
    console.log('Host connected');

    // 2. Create Room
    roomId = await new Promise<string>((resolve) => {
        hostSocket.emit('create_room', { name: 'P1' }, (response: any) => {
            resolve(response.roomId);
        });
    });
    console.log('Room created:', roomId);

    // 3. Connect other 3 players
    for (let i = 1; i < 4; i++) {
        const socket = io('http://localhost:3000', { transports: ['websocket'] });
        players.push(socket);
        await new Promise<void>(resolve => socket.on('connect', resolve));
        socket.emit('join_room', { roomId, name: playerNames[i] }, (response: any) => {
            // callback
        });
        console.log(`Player ${playerNames[i]} joined`);
    }

    // 4. Mark all ready
    console.log('Marking all ready...');
    for (const p of players) {
        // Wait briefly
        await new Promise(r => setTimeout(r, 100));
        p.emit('toggle_ready', { roomId });
    }

    // 5. Host Start Game
    console.log('Starting game...');
    hostSocket.emit('start_game', { roomId });

    // 6. Listen for Game Events and Auto-Play
    // We'll use one socket to monitor progress, but all sockets need to submit

    const gamePromise = new Promise<void>((resolve, reject) => {
        let turnCount = 0;

        hostSocket.on('game_started', (room) => {
            console.log('GAME STARTED! Turn:', room.gameState.turnNumber);
            performTurnActions(room);
        });

        hostSocket.on('turn_advance', (room) => {
            console.log('TURN ADVANCE! Turn:', room.gameState.turnNumber);
            turnCount = room.gameState.turnNumber;
            performTurnActions(room);
        });

        hostSocket.on('game_over', (room) => {
            console.log('GAME OVER!');
            resolve();
        });

        hostSocket.on('disconnect', () => {
            console.log('HOST DISCONNECTED!');
            reject(new Error('Server disconnected'));
        });

        async function performTurnActions(room: any) {
            const turnNumber = room.gameState.turnNumber;
            const playerCount = room.players.length;

            // Determine action (client side logic simulation)
            // Even players (4):
            // T0: Even (Draw)
            // T1: Odd (Guess)
            // T2: Even (Draw)
            // T3: Odd (Guess)

            const isDrawTurn = playerCount % 2 === 0
                ? turnNumber % 2 === 0
                : turnNumber % 2 === 1;

            const action = isDrawTurn ? 'draw' : 'guess';
            console.log(`Performing action for Turn ${turnNumber}: ${action}`);

            // Simulate delay then submit
            await new Promise(r => setTimeout(r, 500));

            for (let i = 0; i < players.length; i++) {
                const player = players[i];
                // Check if this player needs to submit?
                // Server logic: check if player already submitted.
                // We just spam submit for everyone to be sure

                if (action === 'draw') {
                    player.emit('submit_drawing', { roomId, drawingData: 'base64data' });
                } else {
                    player.emit('submit_guess', { roomId, guessText: 'Guess' });
                }
            }
        }
    });

    await gamePromise;
    console.log('STRESS TEST COMPLETED SUCCESSFULLY');
    process.exit(0);
};

runStressTest().catch(console.error);
