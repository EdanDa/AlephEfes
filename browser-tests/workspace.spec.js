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
test('network pause and static worker failure preserve interactive selection', async ({ page }) => {
    await page.route('**/*networkLayout.worker*', (route) => route.abort());
    await open(page);
    await page.getByRole('button', { name: 'רשת', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('פריסה סטטית');
    await page.getByLabel('בחירת מילה ברשת').fill('אב');
    await page.getByRole('button', { name: 'בחר', exact: true }).click();
    await expect(page.locator('.workspace-network-selection')).toContainText('אב');
    await page.getByRole('button', { name: 'הגדל את רשת הקשרים', exact: true }).click();
});
test('network animation can be paused and resumed', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'רשת', exact: true }).click();
    await page.getByRole('button', { name: 'השהה תנועה', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('מושהית');
    await page.getByRole('button', { name: 'המשך תנועה', exact: true }).click();
    await expect(page.getByRole('button', { name: 'השהה תנועה', exact: true })).toBeVisible();
});

for (const failure of ['post', 'error', 'malformed', 'obsolete']) test(`network worker ${failure} recovery`, async ({ page }) => {
    await page.addInitScript((failure) => {
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
            constructor(url, options) { super(url, options); this.network = String(url).includes('networkLayout.worker'); }
            postMessage(message, ...rest) {
                if (!this.network || message.type !== 'init') return super.postMessage(message, ...rest);
                if (failure === 'post') throw new Error('post failed');
                if (failure === 'obsolete') super.postMessage(message, ...rest);
                setTimeout(() => this.dispatchEvent(failure === 'error' ? new ErrorEvent('error', { cancelable: true }) : new MessageEvent('message', { data: failure === 'malformed' ? null : { generation: 'obsolete', positions: new Float32Array(0) } })), 10);
            }
        };
    }, failure);
    await open(page); await page.getByRole('button', { name: 'רשת', exact: true }).click();
    if (failure === 'obsolete') await expect(page.getByRole('status')).not.toContainText('פריסה סטטית');
    else await expect(page.getByRole('status')).toContainText('פריסה סטטית');
    await page.getByLabel('בחירת מילה ברשת').fill('אב'); await page.getByRole('button', { name: 'בחר', exact: true }).click();
    await expect(page.locator('.workspace-network-selection')).toContainText('אב');
});
