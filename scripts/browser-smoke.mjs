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
    expect(errors).toEqual([]);
    console.log(`Stage ${stage} production smoke passed: ${url}`);
} finally { await browser.close(); }
