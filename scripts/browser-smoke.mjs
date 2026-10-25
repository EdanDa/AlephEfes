import { chromium, expect, devices } from '@playwright/test';

const url = process.env.SMOKE_URL || 'https://aleph-efes.vercel.app';
const stage = Number(process.argv[2] || 1);
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined });
try {
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('alephEfes:session', JSON.stringify({ version: 1, text: 'אב אב ה', mode: 'aleph-one' })));
    await page.goto(url);
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('button', { name: 'א=1', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'רשת', exact: true }).click();
    await page.getByRole('button', { name: 'השהה תנועה', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('מושהית');
    if (stage >= 2) {
        await page.getByLabel('בחירת מילה ברשת').fill('אב'); await page.getByRole('button', { name: 'בחר', exact: true }).click();
        await page.getByRole('button', { name: 'בדוק מילה אב', exact: true }).click();
        await expect(page.getByRole('dialog').locator('.research-count')).toContainText('2 מופעים');
        await page.keyboard.press('Escape');
    }
    if (stage >= 3) {
        await page.getByRole('button', { name: 'קבוצות', exact: true }).click();
        await page.locator('.workspace-export-menu summary button').click();
        await page.getByRole('button', { name: 'הערת מחקר', exact: true }).click();
        await expect(page.getByRole('dialog').locator('.research-note-preview')).toContainText('אב אב ה');
        await expect(page.getByRole('dialog').getByRole('heading', { name: 'הערת מחקר — שורה 1', exact: true })).toBeVisible();
        await expect(page.getByRole('dialog').getByRole('table')).toBeVisible();
        const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'הורד .md', exact: true }).click(); await pending;
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'פירוט', exact: true }).click();
        await page.getByRole('button', { name: 'פתח הכל', exact: true }).click();
        await expect(page.locator('.research-detail-position')).toHaveText(['1', '2', '3']);
        await page.getByRole('button', { name: 'ספירה מ־0', exact: true }).click();
        await expect(page.locator('.research-detail-position')).toHaveText(['0', '1', '2']);
        await expect(page.getByRole('button', { name: 'א=1', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    if (stage >= 4) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true }).fill(Array(12).fill('אב ה אב\nגד גד ה\nמם ם').join('\n'));
        await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
        await page.getByRole('button', { name: 'פתח הכל', exact: true }).click();
        const clickBesideNavigation = async (target) => {
            await target.evaluate((element) => {
                const nav = document.querySelector('.app-view-nav'), rect = element.getBoundingClientRect();
                scrollTo({ top: scrollY + rect.top + rect.height / 2 - parseFloat(getComputedStyle(nav).top) - nav.getBoundingClientRect().height / 2, behavior: 'instant' });
            });
            const box = await target.boundingBox(), nav = await page.locator('.app-view-nav').boundingBox();
            const pill = await page.locator('.app-view-tabs').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
            expect(y).toBeGreaterThanOrEqual(nav.y); expect(y).toBeLessThanOrEqual(nav.y + nav.height);
            expect(x < pill.x || x > pill.x + pill.width).toBe(true);
            await page.mouse.click(x, y);
        };
        const countFromOne = page.getByRole('button', { name: 'ספירה מ־1', exact: true });
        await clickBesideNavigation(countFromOne);
        await expect(countFromOne).toHaveAttribute('aria-pressed', 'true');
        await clickBesideNavigation(page.getByRole('button', { name: 'קפל הכל', exact: true }));
        await expect(page.locator('.app-line-card tbody')).toHaveCount(0);
        await page.getByRole('button', { name: 'קבוצות', exact: true }).click();
        await expect(page.getByRole('button', { name: 'קבוצות', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    expect(errors).toEqual([]);
    console.log(`Stage ${stage} production smoke passed: ${url}`);
} finally { await browser.close(); }
