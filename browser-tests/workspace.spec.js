import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { computeCoreResults } from '../src/core/analysisCore.js';

const genesis = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8'));
async function open(page, text = 'אב אב בא גד') {
    await page.addInitScript((text) => {
        if (!localStorage.getItem('alephEfes:session')) localStorage.setItem('alephEfes:session', JSON.stringify({ version: 1, text, mode: 'aleph-zero' }));
    }, text);
    await page.goto('/');
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
}
test('large groups remain bounded while exports include every word', async ({ page }) => {
    const text = genesis.sections.map((section) => section.calculationText).join('\n');
    await open(page, text);
    expect(await page.locator('*').count()).toBeLessThan(5000);
    await page.locator('.workspace-export-menu summary button').first().click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ייצא JSON', exact: true }).first().click();
    let data = ''; for await (const chunk of await (await pending).createReadStream()) data += chunk;
    expect(JSON.parse(data).clusters.flatMap((group) => group.words).length).toBe(computeCoreResults(text, 'aleph-zero').allWords.length);
    await page.getByPlaceholder('חפש מילה, מספר או צירוף כמו 20+11...').fill('בראשית');
    await expect(page.getByRole('button', { name: 'נעץ מילה בראשית', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'נעץ מילה בראשית', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'נעץ מילה בראשית', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
test('workspace preferences survive reload and editor/modes stay available', async ({ page }) => {
    await page.addInitScript(() => {
        if (!localStorage.getItem('alephEfes:session')) localStorage.setItem('alephEfes:session', JSON.stringify({ version: 2, text: 'אב אב', mode: 'aleph-zero', preferences: { isEditorCollapsed: true } }));
    });
    await open(page);
    await page.getByRole('button', { name: 'עשרות', exact: true }).click();
    await page.getByRole('button', { name: 'שכיחות', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'א=1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'קפל עורך', exact: true })).toHaveCount(0);
    await expect(page.locator('.workspace-context')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'שכיחות', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'עשרות', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'עשרות', exact: true }).click();
    await expect(page.getByRole('button', { name: 'עשרות', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('textarea').fill('');
    await expect(page.locator('textarea')).toBeVisible();
});
for (const theme of ['light', 'dark']) test(`desktop views, export menus and enlarged type: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((theme) => localStorage.setItem('alephThemeMode', theme), theme);
    await open(page, genesis.sections.slice(0, 3).map((section) => section.calculationText).join('\n'));
    await page.evaluate(() => document.documentElement.style.fontSize = '20px');
    for (const [key, name] of [['clusters', 'קבוצות'], ['lines', 'פירוט'], ['frequency', 'שכיחות']]) {
        await page.getByRole('button', { name, exact: true }).click();
        const heading = page.locator('.app-results-header').last();
        await heading.evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 90, behavior: 'instant' }));
        await page.screenshot({ path: testInfo.outputPath(`${key}.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const menu = page.locator('.workspace-export-menu').first(); await menu.locator('summary button').click();
        const box = await menu.locator('.workspace-export-options').boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(1441);
        await page.screenshot({ path: testInfo.outputPath(`${key}-export.png`) }); await page.keyboard.press('Escape');
    }
});
