import { test, expect } from '@playwright/test';
import { generateName } from '../src/utils/nameGenerator';

test.describe('UX Polish Verification', () => {
    test('Landing Page has Tagline and Rejoin Flow', async ({ page }) => {
        // 1. Visit Landing
        await page.goto('http://localhost:5173');

        // Check Tagline
        await expect(page.locator('.Landing_tagline__1O-s0')).toBeVisible().catch(() => {
            // Fallback for CSS module class name matching if hash differs
            // We can just look for text "Draw it, guess it"
            return expect(page.getByText('Draw it, guess it, laugh at it!')).toBeVisible();
        });

        // 2. Create Room
        const hostName = "UX_Host";
        await page.getByTestId('name-input').fill(hostName);
        await page.getByTestId('host-btn').click();

        // Wait for Lobby
        await expect(page).toHaveURL(/\/lobby\/.+/);
        const url = page.url();
        const roomId = url.split('/').pop();
        console.log(`Created room: ${roomId}`);

        // Check meaningful content to ensure Join completed and localStorage is set
        await expect(page.getByText("JOIN CODE")).toBeVisible();
        // Wait a tiny bit more for localStorage to be flushed? (Playwright is fast)
        await page.waitForTimeout(500);

        // 3. Reload Page (Simulate Refresh/Disconnect)
        await page.reload();
        await page.goto('http://localhost:5173'); // Go back to landing to see Rejoin button

        // 4. Check Rejoin Button
        // We need to wait for useEffect to read localStorage and show button
        const rejoinBtn = page.getByRole('button', { name: /REJOIN ROOM/i });
        await expect(rejoinBtn).toBeVisible();

        // 5. Click Rejoin
        await rejoinBtn.click();
        await expect(page).toHaveURL(/\/lobby\/.+/);
        await expect(page.getByText(`${hostName}'s LOBBY`)).toBeVisible();
    });

    test('Lobby Min Player Warning', async ({ page }) => {
        // 1. Visit Landing & Create Room
        await page.goto('http://localhost:5173');
        await page.getByTestId('name-input').fill("Host_Player");
        await page.getByTestId('host-btn').click();
        await expect(page).toHaveURL(/\/lobby\/.+/);

        // 2. Try to Start Game (Should fail/warn)
        // Use a locator for the start button even if disabled/styled diff
        const startBtn = page.getByTestId('start-game-btn');

        // The button might be disabled (if logic sets it disabled) OR it shows toast on click
        // My logic in Lobby.tsx:
        // If < minPlayers: Button is REPLACED by Waiting Text OR styled invalid?
        // Code:
        // {amIHost && (room.players.length >= minPlayers ? Button : WaitingText)}

        // So button should NOT be visible. Waiting text should be visible.
        await expect(startBtn).not.toBeVisible();
        await expect(page.getByText(/Waiting for \d+ more player/)).toBeVisible();
    });
});
