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

for (const language of ['he', 'en']) {
    test(`mobile tabs stay centered before and after scrolling in ${language}`, async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme: language === 'he' ? 'dark' : 'light' });
        await page.goto('/?lang=' + language);
        const dock = page.locator('.app-view-tabs');
        const top = dock.locator('.app-nav-top');
        for (const width of [375, 320, 390, 430, 844]) {
            await page.setViewportSize({ width, height: width === 844 ? 390 : 780 });
            await expect(page.locator('.app-view-nav')).toHaveCSS('position', 'fixed');
            await expect(top).toBeHidden();
            const box = await dock.boundingBox();
            const viewport = await page.evaluate(() => document.documentElement.clientWidth);
            expect(Math.abs(box.x - (viewport - box.x - box.width))).toBeLessThanOrEqual(1);
            if (width === 375) {
                const editor = await page.locator('.app-card').boundingBox();
                expect(Math.abs(editor.x - box.x)).toBeLessThanOrEqual(1);
                await page.screenshot({ path: testInfo.outputPath('phone-workspace.png') });
            }
            await page.locator('.app-textarea').fill('בראשית ברא אלהים\n'.repeat(30));
            await expect(page.locator('.app-stats-toggle')).toBeVisible();
            await page.evaluate(() => window.scrollTo(0, 600));
            await expect(top).toBeVisible();
            expect(await dock.boundingBox()).toEqual(box);
            const arrow = await top.boundingBox();
            expect(arrow.y + arrow.height).toBeLessThanOrEqual(box.y);
            await top.tap();
            await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
            await page.locator('.app-textarea').fill('');
        }
    });
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
