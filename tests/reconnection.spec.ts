import { test, expect } from '@playwright/test';

test('Reconnection Logic', async ({ browser }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/');
    await hostPage.getByTestId('name-input').fill('Host');
    await hostPage.getByTestId('host-btn').click();

    const codeElement = hostPage.locator('span[class*="code"]');
    const roomCode = await codeElement.textContent();

    // 2. Player 2 Joins
    const p2Context = await browser.newContext();
    const p2Page = await p2Context.newPage();
    await p2Page.goto('/');
    await p2Page.getByTestId('name-input').fill('Reconnecter');
    await p2Page.getByTestId('room-code-input').fill(roomCode || '');
    await p2Page.getByTestId('join-btn').click();
    await expect(p2Page).toHaveURL(/\/lobby\/.*/);

    // Verify P2 is in lobby
    await expect(hostPage.locator('text=Reconnecter')).toBeVisible();

    // 3. Reload P2 Page (Simulate Reconnect)
    await p2Page.reload();

    // 4. Verify P2 is still in lobby
    await expect(p2Page).toHaveURL(/\/lobby\/.*/);

    // Host should still see P2 (maybe momentary disconnect depending on implementation, but should stabilize)
    await expect(hostPage.locator('text=Reconnecter')).toBeVisible();

    // Verify NOT duplicated
    const count = await hostPage.locator('text=Reconnecter').count();
    expect(count).toBe(1);
});
