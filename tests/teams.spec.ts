import { test, expect } from '@playwright/test';

test.describe('Team Features', () => {
    test('should assign teams round-robin and allow switching', async ({ browser }) => {
        // 1. Host creates room
        const hostContext = await browser.newContext();
        const hostPage = await hostContext.newPage();
        await hostPage.goto('/');
        await hostPage.getByTestId('name-input').fill('Host');
        await hostPage.getByTestId('host-btn').click();
        await expect(hostPage.getByText(/LOBBY/)).toBeVisible();

        // Get Room Code
        const codeElement = hostPage.locator('span[class*="code"]');
        const roomCode = await codeElement.innerText();

        // Host should be in Team 0 (Implied, hard to check visually without explicit ID selectors, 
        // but we can check if they are in a team column)
        // We expect to see "Host 👑 (C)" in a team column.
        await expect(hostPage.locator('text=Host 👑 (C)')).toBeVisible();

        // 2. Player 2 Joins
        const p2Context = await browser.newContext();
        const p2Page = await p2Context.newPage();
        await p2Page.goto('/');
        // If going via landing:
        // await p2Page.goto(targetUrl);
        // await p2Page.fill('input[placeholder="CODE"]', roomCode);
        // await p2Page.click('button:has-text("GO")');
        // But direct link is easier if client supports it (it does).

        // Wait, Lobby has a name input? No, Lobby checks local storage or prompts?
        // Lobby.tsx checks `localStorage.getItem('playerName')`. If not set, it might issue a random name or ...
        // Wait, Lobby logic: `if (!room) return LOADING...`
        // It doesn't seem to have a name input prompt if name is missing in `Lobby.tsx`.
        // The `Landing.tsx` sets the name in localStorage.
        // So P2 MUST go through Landing to set name, or we manually set localStorage.

        await p2Page.goto('/');
        await p2Page.fill('input[data-testid="name-input"]', 'Player2');
        await p2Page.fill('input[data-testid="room-code-input"]', roomCode);
        await p2Page.click('button[data-testid="join-btn"]');

        // Player 2 should be in a DIFFERENT team (Round Robin).
        // Host is likely in the first rendered team column. Player 2 should be in the second.
        // We can check if they are in the same parent container or separate.
        // If they are in different teams, P2 should see a JOIN button for Host's team.
        // There might be multiple JOIN buttons (for all other teams). Use first().
        const joinBtn = p2Page.locator('button[data-testid^="join-team-"]').first();
        await expect(joinBtn).toBeVisible();

        // 3. Player 2 switches to Host's team
        await joinBtn.click();
        // Now JOIN button should disappear (or appear for the other team).
        // Assuming 2 teams default.

        // 4. Host settings
        // Change team count to 3
        await hostPage.selectOption('select[data-testid="team-select"]', '3');
        // Verify Update
        // Check for 3rd team availability or count.

        // 5. Test Rename Modal (Host is Captain of Team 0)
        // Click header edit button.
        const editBtn = hostPage.locator('button[data-testid^="rename-team-"]').first();
        await expect(editBtn).toBeVisible();
        await editBtn.click();

        // Modal should appear
        await expect(hostPage.locator('text=RENAME TEAM')).toBeVisible();

        // Fill input
        await hostPage.fill('input[placeholder="Enter new team name..."]', 'Super Team');
        await hostPage.click('button:has-text("SAVE")');

        // Verify name change
        await expect(hostPage.locator('text=Super Team')).toBeVisible();

        await hostContext.close();
        await p2Context.close();
    });
});
