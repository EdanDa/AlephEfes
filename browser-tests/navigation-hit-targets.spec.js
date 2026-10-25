import { test, expect } from '@playwright/test';

// Move a real side control into the transparent horizontal band of the sticky
// navigation. Use screen coordinates: locator.click() can scroll an obstructed
// control away from the bar and hide the failure a user experiences.
async function alignWithNavigation(target) {
    await target.evaluate((element) => {
        const nav = document.querySelector('.app-view-nav');
        const rect = element.getBoundingClientRect();
        const middle = parseFloat(getComputedStyle(nav).top) + nav.getBoundingClientRect().height / 2;
        scrollTo({ top: scrollY + rect.top + rect.height / 2 - middle, behavior: 'instant' });
    });
}
async function clickAtCenter(page, target) {
    const box = await target.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

for (const theme of ['light', 'dark']) for (const width of [1280, 1440, 1920]) {
    test(`sticky navigation leaves side controls clickable: ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((theme) => {
            localStorage.setItem('alephThemeMode', theme);
            localStorage.setItem('alephEfes:session', JSON.stringify({ version: 2, text: Array(12).fill('אב ה אב\nגד גד ה\nמם ם').join('\n'), mode: 'aleph-one', preferences: { view: 'lines' } }));
        }, theme);
        await page.goto('/');
        await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
        await expect(page.locator('.app-view-nav')).toHaveCSS('position', 'sticky');
        await page.getByRole('button', { name: 'פתח הכל', exact: true }).click();
        const choice = page.getByRole('button', { name: 'ספירה מ־0', exact: true });
        await alignWithNavigation(choice);
        const nav = await page.locator('.app-view-nav').boundingBox();
        const pill = await page.locator('.app-view-tabs').boundingBox();
        const target = await choice.boundingBox();
        const x = target.x + target.width / 2, y = target.y + target.height / 2;
        expect(y).toBeGreaterThanOrEqual(nav.y);
        expect(y).toBeLessThanOrEqual(nav.y + nav.height);
        expect(x).toBeGreaterThan(pill.x + pill.width);
        await page.screenshot({ path: testInfo.outputPath('sticky-side-controls.png') });
        await clickAtCenter(page, choice);
        await expect(choice).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 });

        const collapse = page.getByRole('button', { name: 'קפל הכל', exact: true });
        await alignWithNavigation(collapse);
        await clickAtCenter(page, collapse);
        await expect(page.locator('.app-line-card tbody')).toHaveCount(0, { timeout: 2_000 });
        const expand = page.getByRole('button', { name: 'פתח הכל', exact: true });
        await alignWithNavigation(expand);
        await clickAtCenter(page, expand);
        await expect(page.locator('.app-line-card tbody')).toHaveCount(36);

        // The opaque navigation itself must still receive pointer and keyboard input.
        await page.getByRole('button', { name: 'קבוצות', exact: true }).click();
        await expect(page.getByRole('button', { name: 'קבוצות', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'פירוט', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('button', { name: 'פירוט', exact: true })).toHaveAttribute('aria-pressed', 'true');
    });
}
