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
test('workspace preferences survive reload and an empty editor stays available', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'עשרות', exact: true }).click();
    await page.getByRole('button', { name: 'שכיחות', exact: true }).click();
    await page.getByRole('button', { name: 'קפל עורך', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'ערוך טקסט', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'שכיחות', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'עשרות', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'איפוס מסננים', exact: true }).click();
    await expect(page.getByRole('button', { name: 'עשרות', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'ערוך טקסט', exact: true }).click();
    await page.locator('textarea').fill('');
    await expect(page.locator('textarea')).toBeVisible();
});
test('network pause and static worker failure preserve interactive selection', async ({ page }) => {
    await page.route('**/*networkLayout.worker*', (route) => route.abort());
    await open(page);
    await page.getByRole('button', { name: 'רשת קשרים', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('פריסה סטטית');
    await page.getByLabel('בחירת מילה ברשת').fill('אב');
    await page.getByRole('button', { name: 'בחר', exact: true }).click();
    await expect(page.locator('.workspace-network-selection')).toContainText('אב');
    await page.getByRole('button', { name: 'הגדל את רשת הקשרים', exact: true }).click();
});
test('network animation can be paused and resumed', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'רשת קשרים', exact: true }).click();
    await page.getByRole('button', { name: 'השהה תנועה', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('מושהית');
    await page.getByRole('button', { name: 'המשך תנועה', exact: true }).click();
    await expect(page.getByRole('button', { name: 'השהה תנועה', exact: true })).toBeVisible();
});
