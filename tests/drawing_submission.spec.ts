import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Drawing & Guess Submission Tests
 * 
 * Tests the full submission flow for both draw and guess phases,
 * including manual submit and timer-based auto-submit.
 * Uses 2-player games (even count) for predictable draw→guess alternation.
 */

// Increase default timeout for these tests (some wait for 60s timers)
test.setTimeout(120_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a room and return the page + room code */
async function createRoom(browser: any, name: string): Promise<{ page: Page; context: BrowserContext; roomCode: string }> {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/');

    // Wait for name input to be visible and auto-populated
    const nameInput = page.getByTestId('name-input');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(name);

    // Click host button
    const hostBtn = page.getByTestId('host-btn');
    await expect(hostBtn).toBeVisible({ timeout: 5000 });
    await hostBtn.click();

    // Wait for lobby navigation
    await expect(page).toHaveURL(/\/lobby\/.*/, { timeout: 10000 });

    // Extract room code from the lobby (CSS module class: roomCode)
    const codeElement = page.locator('span[class*="roomCode"]');
    await expect(codeElement).toBeVisible({ timeout: 5000 });
    const roomCode = (await codeElement.textContent())?.trim();
    console.log(`Room created: ${roomCode} by ${name}`);
    return { page, context, roomCode: roomCode || '' };
}

/** Join a room and return the page */
async function joinRoom(browser: any, name: string, roomCode: string): Promise<{ page: Page; context: BrowserContext }> {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/');

    // Wait for page to be ready
    const nameInput = page.getByTestId('name-input');
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Fill name
    await nameInput.fill(name);

    // Fill room code
    const codeInput = page.getByTestId('room-code-input');
    await expect(codeInput).toBeVisible({ timeout: 5000 });
    await codeInput.fill(roomCode);

    // Wait a moment for state to update
    await page.waitForTimeout(500);

    // Click join button
    const joinBtn = page.getByTestId('join-btn');
    await expect(joinBtn).toBeEnabled({ timeout: 5000 });
    await joinBtn.click();

    // Wait for lobby navigation
    await expect(page).toHaveURL(/\/lobby\/.*/, { timeout: 10000 });
    console.log(`${name} joined room ${roomCode}`);
    return { page, context };
}

/** Mark non-host players as ready, then start game from host page */
async function startGame(hostPage: Page, otherPages: Page[]) {
    // Non-host players must click READY first
    for (const p of otherPages) {
        const readyBtn = p.getByTestId('ready-btn');
        // ready-btn may be hidden for host (display:none) — only click if visible
        if (await readyBtn.isVisible()) {
            await readyBtn.click();
            // Wait for the READY state to propagate
            await p.waitForTimeout(500);
        }
    }

    // Host clicks START GAME
    const startBtn = hostPage.getByTestId('start-game-btn');
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await startBtn.click();

    // Wait for all pages to reach the game screen (includes 3s countdown)
    await expect(hostPage).toHaveURL(/\/game/, { timeout: 10000 });
    for (const p of otherPages) {
        await expect(p).toHaveURL(/\/game/, { timeout: 10000 });
    }
}

/** Draw a simple line on the canvas */
async function drawOnCanvas(page: Page) {
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 10000 });
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found or has no bounding box');

    // Draw a diagonal line
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 20, box.y + box.height - 20, { steps: 10 });
    await page.mouse.up();

    // Wait for onDrawingComplete callback
    await page.waitForTimeout(300);
}

/** Wait for phase to be visible on page */
async function waitForPhase(page: Page, phaseName: string, timeout = 15000) {
    await expect(page.locator(`text=${phaseName}`)).toBeVisible({ timeout });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Drawing Submission', () => {

    test('Manual submit preserves drawing', async ({ browser }) => {
        const host = await createRoom(browser, 'Host');
        const p2 = await joinRoom(browser, 'Player2', host.roomCode);

        await expect(host.page.locator('text=Player2')).toBeVisible({ timeout: 5000 });
        await startGame(host.page, [p2.page]);

        // Turn 0 = Draw phase for 2 players
        await waitForPhase(host.page, 'SKETCH IT');
        await waitForPhase(p2.page, 'SKETCH IT');

        // Draw on both canvases
        await drawOnCanvas(host.page);
        await drawOnCanvas(p2.page);

        // Wait for min submit delay
        await host.page.waitForTimeout(5500);

        // Submit both drawings
        const submitBtn1 = host.page.locator('.submit-btn');
        await expect(submitBtn1).toBeEnabled({ timeout: 3000 });
        await submitBtn1.click();
        await expect(host.page.locator('text=Waiting for other players')).toBeVisible({ timeout: 3000 });

        const submitBtn2 = p2.page.locator('.submit-btn');
        await expect(submitBtn2).toBeEnabled({ timeout: 3000 });
        await submitBtn2.click();

        // Should advance to Guess phase
        await waitForPhase(host.page, 'GUESS IT', 15000);
        await waitForPhase(p2.page, 'GUESS IT', 15000);

        // Verify guess phase shows the previous drawing
        const readonlyCanvas = host.page.locator('.canvas-container.readonly canvas');
        await expect(readonlyCanvas).toBeVisible({ timeout: 5000 });

        await host.context.close();
        await p2.context.close();
    });

    test('Timer expiry auto-submits drawing (drawing not lost)', async ({ browser }) => {
        const host = await createRoom(browser, 'AutoHost');
        const p2 = await joinRoom(browser, 'AutoP2', host.roomCode);

        await expect(host.page.locator('text=AutoP2')).toBeVisible({ timeout: 5000 });
        await startGame(host.page, [p2.page]);

        // Draw phase
        await waitForPhase(host.page, 'SKETCH IT');

        // Draw on both but DON'T submit — let timer expire
        await drawOnCanvas(host.page);
        await drawOnCanvas(p2.page);

        // Wait for auto-advance to Guess phase (60s draw + 1s grace + buffer)
        await waitForPhase(host.page, 'GUESS IT', 75000);
        await waitForPhase(p2.page, 'GUESS IT', 5000);

        // Drawing should be visible in guess phase (auto-submitted, not blank)
        const readonlyCanvas = host.page.locator('.canvas-container.readonly canvas');
        await expect(readonlyCanvas).toBeVisible({ timeout: 5000 });

        await host.context.close();
        await p2.context.close();
    });

    test('Timer expiry with no drawing does not crash', async ({ browser }) => {
        const host = await createRoom(browser, 'EmptyHost');
        const p2 = await joinRoom(browser, 'EmptyP2', host.roomCode);

        await expect(host.page.locator('text=EmptyP2')).toBeVisible({ timeout: 5000 });
        await startGame(host.page, [p2.page]);

        await waitForPhase(host.page, 'SKETCH IT');

        // Don't draw anything — wait for timer
        await waitForPhase(host.page, 'GUESS IT', 75000);

        // Page should be functional — guess input visible
        const guessInput = host.page.locator('.guess-input');
        await expect(guessInput).toBeVisible({ timeout: 5000 });

        await host.context.close();
        await p2.context.close();
    });
});

test.describe('Guess Submission', () => {

    test('Manual guess submit preserves text', async ({ browser }) => {
        const host = await createRoom(browser, 'GuessHost');
        const p2 = await joinRoom(browser, 'GuessP2', host.roomCode);

        await expect(host.page.locator('text=GuessP2')).toBeVisible({ timeout: 5000 });
        await startGame(host.page, [p2.page]);

        // Draw and submit quickly
        await waitForPhase(host.page, 'SKETCH IT');
        await drawOnCanvas(host.page);
        await drawOnCanvas(p2.page);
        await host.page.waitForTimeout(5500);
        await host.page.locator('.submit-btn').click();
        await p2.page.waitForTimeout(5500);
        await p2.page.locator('.submit-btn').click();

        // Guess phase
        await waitForPhase(host.page, 'GUESS IT', 15000);

        // Type and submit guess on both players
        const guessInput1 = host.page.locator('.guess-input');
        await guessInput1.fill('Test Guess');
        await host.page.waitForTimeout(5500);
        const submitBtn1 = host.page.locator('.submit-btn');
        await expect(submitBtn1).toBeEnabled();
        await submitBtn1.click();
        await expect(host.page.locator('text=Waiting for other players')).toBeVisible({ timeout: 3000 });

        const guessInput2 = p2.page.locator('.guess-input');
        await guessInput2.fill('P2 Guess');
        await p2.page.waitForTimeout(5500);
        await p2.page.locator('.submit-btn').click();

        // 2-player game ends after 2 turns → REVEAL / VIEWING BOOKS
        await expect(host.page.locator('text=VIEWING BOOKS')).toBeVisible({ timeout: 15000 });

        await host.context.close();
        await p2.context.close();
    });

    test('Guess timer expiry auto-submits', async ({ browser }) => {
        const host = await createRoom(browser, 'GuessTimerH');
        const p2 = await joinRoom(browser, 'GuessTimerP2', host.roomCode);

        await expect(host.page.locator('text=GuessTimerP2')).toBeVisible({ timeout: 5000 });
        await startGame(host.page, [p2.page]);

        // Complete draw phase quickly
        await waitForPhase(host.page, 'SKETCH IT');
        await drawOnCanvas(host.page);
        await drawOnCanvas(p2.page);
        await host.page.waitForTimeout(5500);
        await host.page.locator('.submit-btn').click();
        await p2.page.waitForTimeout(5500);
        await p2.page.locator('.submit-btn').click();

        // Guess phase — type guesses but DON'T submit
        await waitForPhase(host.page, 'GUESS IT', 15000);
        const guessInput1 = host.page.locator('.guess-input');
        await guessInput1.fill('Auto-submitted guess');
        const guessInput2 = p2.page.locator('.guess-input');
        await guessInput2.fill('P2 auto guess');

        // Wait for guess timer (30s + 1s grace + buffer)
        // 2-player: after T1 guess → REVEAL
        await expect(host.page.locator('text=VIEWING BOOKS')).toBeVisible({ timeout: 45000 });

        await host.context.close();
        await p2.context.close();
    });
});

test.describe('Edit/Unsubmit', () => {

    test('Unsubmit allows re-editing drawing', async ({ browser }) => {
        const host = await createRoom(browser, 'EditHost');
        const p2 = await joinRoom(browser, 'EditP2', host.roomCode);

        await expect(host.page.locator('text=EditP2')).toBeVisible({ timeout: 5000 });
        await startGame(host.page, [p2.page]);

        // Draw phase
        await waitForPhase(host.page, 'SKETCH IT');
        await drawOnCanvas(host.page);
        await host.page.waitForTimeout(5500);

        // Submit
        await host.page.locator('.submit-btn').click();
        await expect(host.page.locator('text=Waiting for other players')).toBeVisible({ timeout: 3000 });

        // Unsubmit
        await host.page.locator('.unsubmit-btn').click();

        // Should be back to editable state with submit button visible
        const submitBtn = host.page.locator('.submit-btn');
        await expect(submitBtn).toBeVisible({ timeout: 3000 });

        // Canvas should be interactive (not readonly)
        const editableCanvas = host.page.locator('.canvas-container:not(.readonly) canvas');
        await expect(editableCanvas).toBeVisible();

        await host.context.close();
        await p2.context.close();
    });
});
