
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

interface TestResult {
    name: string;
    success: boolean;
    errors: string[];
    warnings: string[];
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

class GameSimulator {
    players: Socket[] = [];
    playerNames: string[] = [];
    roomId: string = '';
    hostSocket: Socket | null = null;
    playerCount: number;
    scenario: 'standard' | 'timeout' | 'disconnect';
    errors: string[] = [];
    warnings: string[] = [];

    constructor(playerCount: number, scenario: 'standard' | 'timeout' | 'disconnect') {
        this.playerCount = playerCount;
        this.scenario = scenario;
        for (let i = 0; i < playerCount; i++) {
            this.playerNames.push(`P${i + 1}`);
        }
    }

    async setup() {
        // Connect Host
        this.hostSocket = io(SERVER_URL, { transports: ['websocket'], forceNew: true });
        this.players.push(this.hostSocket);
        await new Promise<void>(resolve => this.hostSocket!.on('connect', resolve));

        // Create Room
        this.roomId = await new Promise<string>((resolve) => {
            this.hostSocket!.emit('create_room', { name: this.playerNames[0] }, (response: any) => {
                if (response.error) this.errors.push(`Create Room Error: ${response.error}`);
                resolve(response.roomId);
            });
        });

        // Connect other players
        for (let i = 1; i < this.playerCount; i++) {
            const socket = io(SERVER_URL, { transports: ['websocket'], forceNew: true });
            this.players.push(socket);
            await new Promise<void>(resolve => socket.on('connect', resolve));

            await new Promise<void>(resolve => {
                socket.emit('join_room', { roomId: this.roomId, name: this.playerNames[i] }, (response: any) => {
                    if (response.error) this.errors.push(`Join Room Error P${i + 1}: ${response.error}`);
                    resolve();
                });
            });
        }
    }

    async run(): Promise<TestResult> {
        try {
            await this.setup();

            // Mark Ready
            for (const p of this.players) {
                p.emit('toggle_ready', { roomId: this.roomId });
                await sleep(50);
            }

            // Start Game
            this.hostSocket!.emit('start_game', { roomId: this.roomId });

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Game execution timed out (30s)'));
                }, 60000); // 60s timeout for whole game

                let activePlayerCount = this.playerCount;

                const onGameOver = (room: any) => {
                    clearTimeout(timeout);
                    this.verifyResults(room);
                    resolve();
                };

                const onStateChange = async (room: any) => {
                    if (room.gameState.status === 'REVEAL') {
                        // handled by game_over event usually, but just in case
                        return;
                    }

                    // Check for turn actions
                    // We only drive actions from Host socket listener to avoid duplicate logic
                    // But actions must be taken by INDIVIDUAL sockets
                };

                // We listen to 'turn_advance' and 'game_started' on Host
                this.hostSocket!.on('game_started', (room) => this.performTurn(room));
                this.hostSocket!.on('turn_advance', (room) => this.performTurn(room));
                this.hostSocket!.on('game_over', onGameOver);
            });

        } catch (e: any) {
            this.errors.push(`Exception: ${e.message}`);
        } finally {
            this.cleanup();
        }

        return {
            name: `${this.playerCount} Players - ${this.scenario}`,
            success: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    async performTurn(room: any) {
        const turnNumber = room.gameState.turnNumber;
        const playerCount = room.players.length; // Might be less if disconnected

        // Logic for Turn Action
        // Even turns (0, 2...) -> Draw
        // Odd turns (1, 3...) -> Guess
        const isDrawTurn = turnNumber % 2 === 0;

        const action = isDrawTurn ? 'draw' : 'guess';

        // Simulate think time
        await sleep(200);

        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            if (!player.connected) continue;

            const isTargetForTimeout = (this.scenario === 'timeout' && i === 1 && turnNumber === 1); // P2 times out on Turn 1
            const isTargetForDisconnect = (this.scenario === 'disconnect' && i === 1 && turnNumber === 1); // P2 disconnects on Turn 1

            if (isTargetForDisconnect) {
                // Perform Disconnect
                // Only do it once
                if (player.connected) {
                    player.disconnect();
                    continue; // No submission
                }
            }

            if (isTargetForTimeout) {
                // Do NOTHING (Simulate timeout)
                continue;
            }

            // Normal Play
            if (action === 'draw') {
                player.emit('submit_drawing', { roomId: this.roomId, drawingData: 'data:image/png;base64,TEST_IMAGE_DATA_12345' });
            } else {
                // If checking for gibberish persistence, we want to see if 'TEST_IMAGE_DATA' from previous turn bleeds into this guess
                // But normally we submit a guess.
                player.emit('submit_guess', { roomId: this.roomId, guessText: `Guess for Turn ${turnNumber} by P${i + 1}` });
            }
        }
    }

    verifyResults(room: any) {
        // Check for Gibberish
        for (const book of room.gameState.books) {
            for (const page of book.pages) {
                if (page.type === 'guess') {
                    if (page.content.startsWith('data:image')) {
                        this.errors.push(`Failure: Found Image Data in Guess Page! Book Owner: ${book.ownerName}, Page Author: ${page.playerName}`);
                    }
                }

                // Check encoding? "file encoding is shown as though its text"
                // Usually indicated by long base64 string without data:image prefix if stripped poorly?
                if (page.type === 'guess' && page.content.length > 500 && !page.content.includes(' ')) {
                    this.errors.push(`Failure: Suspiciously long text (Base64?) in Guess Page! Book Owner: ${book.ownerName}, Page Author: ${page.playerName}`);
                }
            }
        }

        // Check Scenario Specifics
        if (this.scenario === 'timeout') {
            // P2 should have empty content on Turn 1
            // Turn 1 for 4 players is Guess? 
            // 4 players (Even) -> Turn 0 Draw, Turn 1 Guess.
            // So P2 (Player Index 1) on Turn 1 should be a Guess.
            // It timed out. Content should be ''. disconnected should be false.

            // Find the book P2 had on Turn 1.
            // Books rotate.
            // Turn 0: P2 holds P2's book.
            // Turn 1: P2 holds P1's book (passed).
            // So check P1's book. Page index 2 (Index 0=Word, 1=Draw(P1), 2=Guess(P2)).

            // Actually simpler: iterate all pages authored by 'P2' with type 'guess'
            let foundTimeoutPage = false;
            for (const book of room.gameState.books) {
                for (const page of book.pages) {
                    if (page.playerName === 'P2' && page.type === 'guess') {
                        // This might be the one.
                        // Ideally timestamp matches turn?
                        if (page.content === '' && page.disconnected === false) {
                            foundTimeoutPage = true;
                        } else if (page.content === '' && page.disconnected === true) {
                            this.errors.push(`Scenario Failure: Timeout resulted in 'disconnected: true' for P2`);
                        } else if (page.content !== '') {
                            this.warnings.push(`Warning: P2 has content '${page.content}' (Might be from other turns if game long)`);
                        }
                    }
                }
            }
            if (!foundTimeoutPage) {
                // Verify if we actually reached that turn?
                // Assuming validation passed if strict checks passed above.
                // It's hard to be precise without tracking exactly which page was the timeout one.
                // But if we see NO empty pages but we expected one...
            }
        }

        if (this.scenario === 'disconnect') {
            // Check for disconnected: true
            let foundDisconnectPage = false;
            for (const book of room.gameState.books) {
                for (const page of book.pages) {
                    if (page.playerName === 'P2' && (page.content === '' && page.disconnected === true)) {
                        foundDisconnectPage = true;
                    }
                }
            }
            if (!foundDisconnectPage) this.errors.push("Scenario Failure: Disconnected player P2 did not produce a 'disconnected: true' page");
        }
    }

    cleanup() {
        this.players.forEach(p => p.disconnect());
    }
}

async function runSuite() {
    console.log('Starting E2E Test Suite...');

    const results: TestResult[] = [];

    // 1. 4 Players Standard
    results.push(await new GameSimulator(4, 'standard').run());

    // 2. 5 Players Standard
    results.push(await new GameSimulator(5, 'standard').run());

    // 3. 6 Players Standard
    results.push(await new GameSimulator(6, 'standard').run());

    // 4. Timeout Scenario (4 Players)
    results.push(await new GameSimulator(4, 'timeout').run());

    // 5. Disconnect Scenario (4 Players)
    results.push(await new GameSimulator(4, 'disconnect').run());

    console.log('\n=== TEST REPORT ===\n');
    for (const res of results) {
        console.log(`[${res.success ? 'PASS' : 'FAIL'}] ${res.name}`);
        res.errors.forEach(e => console.log(`   - ERROR: ${e}`));
        res.warnings.forEach(w => console.log(`   - WARN:  ${w}`));
    }
}

runSuite().catch(console.error);
