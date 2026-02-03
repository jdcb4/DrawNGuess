import { test, expect } from '@playwright/test';

test('Player Limits and Kick Functionality', async ({ browser }) => {
    // 1. HOST setup
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/');
    await hostPage.getByTestId('name-input').fill('Host');
    await hostPage.getByTestId('host-btn').click();

    // Get Code
    await expect(hostPage).toHaveURL(/\/lobby\/.*/);
    const codeElement = hostPage.locator('span[class*="code"]');
    const roomCode = await codeElement.textContent();
    console.log('Room:', roomCode);

    // 2. MIN PLAYERS check (Try to start - Min is 2)
    // The button should be disabled now, so clicking might not work or fail
    // We expect it to be disabled (based on UX audit)
    const startBtn = hostPage.getByTestId('start-game-btn');
    await expect(startBtn).toBeDisabled();

    // Hover to check tooltip (optional, plays nice with audit)
    // const title = await startBtn.getAttribute('title');
    // expect(title).toContain('Need at least 2 players');

    // 3. JOINER (2nd player)
    const joinContext = await browser.newContext();
    const joinPage = await joinContext.newPage();
    await joinPage.goto(`/join/${roomCode}`);
    await joinPage.getByTestId('name-input').fill('KickedPlayer');
    await joinPage.getByTestId('join-btn').click();
    await expect(joinPage).toHaveURL(/\/lobby\/.*/);

    // Host should see 2 players
    await expect(hostPage.locator('text=KickedPlayer')).toBeVisible();

    // 4. KICK Functionality
    // Host clicks kick on KickedPlayer
    // We don't have the exact ID here easily without iterating, but we can assume logic or use a more specific selector if possible.
    // However, in our loop we added `kick-btn-${p.id}`.
    // For this test, finding by title is okay, but `data-testid` is better if we knew the ID.
    // Since we don't know the ID of "KickedPlayer" easily here without scraping, we will stick to the slightly robust `hasText` locator which is fine for this specific test case,
    // OR we relies on the fact that `kick-btn-*` exists.
    // Actually, let's keep the locator logic but improve the button selector part if possible?
    // "KickedPlayer" row -> button.
    const kickBtn = hostPage.locator('div', { hasText: 'KickedPlayer' }).locator('button[data-testid^="kick-btn-"]');
    await kickBtn.click();

    // Verify Modal appears and Click Confirm
    await expect(hostPage.getByText('Are you sure you want to kick')).toBeVisible();
    await hostPage.getByRole('button', { name: 'KICK' }).click();

    // 5. Verify Kick
    // Joiner should be redirected to Landing
    await expect(joinPage).not.toHaveURL(/\/lobby\/.*/);
    await expect(joinPage).toHaveURL(/\/$/); // Landing page (trailing slash depend on vite)

    // Joiner should see Toast error
    await expect(joinPage.getByText('You have been kicked')).toBeVisible();

    // Check Host list
    await expect(hostPage.locator('text=KickedPlayer')).not.toBeVisible();
});
