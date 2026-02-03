import { test, expect } from '@playwright/test';

test('Standard Game Flow', async ({ browser }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/');
    await hostPage.getByTestId('name-input').fill('Host');
    await hostPage.getByTestId('host-btn').click();
    await expect(hostPage).toHaveURL(/\/lobby\/.*/);

    // Get Code
    const codeElement = hostPage.locator('span[class*="code"]');
    const roomCode = await codeElement.textContent();

    // 2. Player 2 Joins
    const p2Context = await browser.newContext();
    const p2Page = await p2Context.newPage();
    await p2Page.goto('/');
    await p2Page.getByTestId('name-input').fill('Joiner');
    await p2Page.getByTestId('room-code-input').fill(roomCode || '');
    await p2Page.getByTestId('join-btn').click();
    await expect(p2Page).toHaveURL(/\/lobby\/.*/);

    // 3. Host Starts Game
    // Wait for p2 to be visible to ensure they are connected
    await expect(hostPage.locator('text=Joiner')).toBeVisible();

    // Enable Team mode if needed, or just start. Defaults should allow start with 2 players.
    await hostPage.getByTestId('start-game-btn').click();

    // 4. Verify Game Screen
    await expect(hostPage).toHaveURL(/\/game/);
    await expect(p2Page).toHaveURL(/\/game/);

    await expect(hostPage.locator('text=GAME PHASE')).toBeVisible();
    await expect(hostPage.locator('text=ROUND 1')).toBeVisible();

    // 5. Host Ends Game
    await hostPage.getByRole('button', { name: 'END GAME' }).click();

    // 6. Verify End Screen
    await expect(hostPage).toHaveURL(/\/end/);
    await expect(p2Page).toHaveURL(/\/end/);
});
