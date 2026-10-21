import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { computeCoreResults } from '../src/core/analysisCore.js';

const SESSION_KEY = 'alephEfes:session';
const genesis = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8'));
const deuteronomy = JSON.parse(fs.readFileSync('public/corpus/books/deuteronomy.json', 'utf8'));
const sourceSection = deuteronomy.sections.find((section) => section.id === 'deuteronomy-0154');
const errors = new WeakMap();

test.beforeEach(({ page }) => {
    const messages = [];
    errors.set(page, messages);
    page.on('pageerror', (error) => messages.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function open(page, text = 'אב אב', mode = 'aleph-zero') {
    await page.addInitScript(({ text, mode, key }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, text, mode, corpusSelection: null }));
    }, { text, mode, key: SESSION_KEY });
    await page.goto('/');
    if (text.trim()) await ready(page);
}

async function ready(page) {
    await expect(page.locator('.app-stats-panel')).toBeVisible();
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.app-analysis-results')).not.toHaveAttribute('inert', '');
}

async function view(page, label) {
    await page.getByRole('button', { name: label, exact: true }).click();
}

async function download(page, format) {
    const menu = page.locator('.workspace-export-menu').first();
    if (!await menu.getAttribute('open').then((value) => value !== null)) await menu.locator('summary button').click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `ייצא ${format}`, exact: true }).first().click();
    const file = await pending;
    let content = '';
    for await (const chunk of await file.createReadStream()) content += chunk.toString();
    return content.replace(/^\uFEFF/, '');
}

async function json(page) { return JSON.parse(await download(page, 'JSON')); }

function csvRows(text) {
    const rows = []; let row = []; let value = ''; let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (char === '"') {
            if (quoted && text[i + 1] === '"') { value += '"'; i += 1; }
            else quoted = !quoted;
        } else if (char === ',' && !quoted) { row.push(value); value = ''; }
        else if (char === '\n' && !quoted) { rows.push([...row, value]); row = []; value = ''; }
        else value += char;
    }
    if (value || row.length) rows.push([...row, value]);
    const [headers, ...values] = rows;
    return values.filter((record) => record.length > 1).map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index]])));
}

for (const mode of ['aleph-zero', 'aleph-one']) {
    test(`paste and file drop retain the complete MAM section (${mode})`, async ({ page }) => {
        await open(page, '', mode);
        const input = page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true });
        const expected = computeCoreResults(sourceSection.calculationText, mode);
        for (const action of ['paste', 'drop']) {
            await input.fill('');
            await input.evaluate((element, { text, action }) => {
                const transfer = new DataTransfer();
                if (action === 'paste') {
                    transfer.setData('text/plain', text);
                    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
                } else {
                    transfer.items.add(new File([text], 'section.txt', { type: 'text/plain' }));
                    element.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
                }
            }, { text: sourceSection.calculationText, action });
            await expect(input).toHaveValue(sourceSection.calculationText);
            await ready(page);
            await view(page, 'פירוט');
            const result = await json(page);
            const words = result.lines.flatMap((line) => line.words);
            expect(words).toHaveLength(7);
            expect(words.reduce((sum, word) => sum + word.units, 0)).toBe(expected.grandTotals.units);
            expect(result.metadata.mode).toBe(mode);
        }
    });

    test(`the value map counts text occurrences once across equivalent layers (${mode})`, async ({ page }) => {
        await open(page, 'אב אב', mode);
        await view(page, 'מפת ערכים');
        const result = await json(page);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toMatchObject({ totalOccurrences: 2, uniqueWordCount: 1, avgOccurrences: 2, layerCount: 3 });
        expect(result.rows[0].topWords).toEqual([{ word: 'אב', occurrences: 2, layers: ['H', 'T', 'U'] }]);
        expect(result.metadata).toMatchObject({ mode, filters: { U: true, T: true, H: true, Prime: false } });
        const csv = csvRows(await download(page, 'CSV'));
        expect(csv[0].total_occurrences).toBe('2');
        expect(csv[0].analysis_mode).toBe(mode);
    });

    test(`pinned text, CSV and JSON select the same words (${mode})`, async ({ page, context }) => {
        await open(page, 'אב בא גד', mode);
        const card = page.getByRole('button', { name: 'נעץ מילה אב', exact: true });
        await card.focus();
        await page.keyboard.press('Enter');
        await expect(card).toHaveAttribute('aria-pressed', 'true');
        const result = await json(page);
        const words = result.clusters.flatMap((cluster) => cluster.words.map((word) => word.word));
        expect(words).toEqual(['אב', 'בא']);
        const csv = csvRows(await download(page, 'CSV'));
        expect(csv.map((row) => row.word)).toEqual(words);
        expect(csv.every((row) => row.analysis_mode === mode)).toBe(true);
        if (mode === 'aleph-zero') {
            await context.grantPermissions(['clipboard-read', 'clipboard-write']);
            await page.locator('.workspace-export-menu').first().locator('summary button').click();
            await page.locator('.app-export-toolbar').getByRole('button', { name: 'העתק', exact: true }).click();
            await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('- אב');
            const copied = await page.evaluate(() => navigator.clipboard.readText());
            expect(copied).toContain('- בא');
            expect(copied).not.toContain('- גד');
        }
    });
}

test('pinned exports respect hidden layers, search scope, and prime filtering', async ({ page }) => {
    await open(page, 'ברא אל');
    await page.getByRole('button', { name: 'עשרות', exact: true }).click();
    await page.getByRole('button', { name: 'מאות', exact: true }).click();
    await page.getByRole('button', { name: 'נעץ מילה ברא', exact: true }).click();
    expect((await json(page)).clusters.flatMap((group) => group.words.map((word) => word.word))).toEqual(['ברא']);
    expect(csvRows(await download(page, 'CSV')).map((row) => row.word)).toEqual(['ברא']);
    await page.getByRole('button', { name: '♢ ראשוני', exact: true }).click();
    expect((await json(page)).clusters.flatMap((group) => group.words.map((word) => word.word))).toEqual([]);
    await page.getByRole('button', { name: '♢ ראשוני', exact: true }).click();
    await page.getByPlaceholder('חפש מילה, מספר או צירוף כמו 20+11...').fill('ברא');
    await page.getByRole('button', { name: 'נעץ מילה ברא', exact: true }).click();
    expect((await json(page)).clusters.flatMap((group) => group.words.map((word) => word.word))).toEqual(['ברא']);
});

test('pending input immediately blocks stale exports and discards superseded responses', async ({ page }) => {
    await page.addInitScript(() => {
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
            postMessage(message) {
                if (message.text === 'גד גד') setTimeout(() => super.postMessage(message), 1800);
                else super.postMessage(message);
            }
        };
    });
    await open(page);
    await view(page, 'פירוט');
    const input = page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true });
    await input.fill('גד גד');
    await expect(page.getByRole('status')).toContainText('מחשב');
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('inert', '');
    await expect(page.locator('.app-export-toolbar button').first()).toBeDisabled();
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.locator('.app-export-toolbar button').last().evaluate((button) => button.click());
    expect(downloaded).toBe(false);
    // Allow the obsolete job to start before issuing a different input/mode.
    await page.waitForTimeout(400);
    await input.fill('אבגד');
    await page.getByRole('button', { name: 'א=1', exact: true }).click();
    await ready(page);
    await page.waitForTimeout(1900);
    const result = await json(page);
    expect(result.mode).toBe('aleph-one');
    expect(result.lines[0].lineText).toBe('אבגד');
    expect(result.lines[0].words[0].units).toBe(10);
});

for (const failure of ['load', 'constructor', 'post', 'error', 'messageerror', 'reply', 'malformed']) {
    test(`calculation falls back after worker ${failure} failure`, async ({ page }) => {
        if (failure === 'load') await page.route('**/*coreResults.worker*', (route) => route.abort());
        else await page.addInitScript((failure) => {
            const NativeWorker = window.Worker;
            if (failure === 'constructor') { window.Worker = class { constructor() { throw new Error('worker blocked'); } }; return; }
            window.Worker = class extends NativeWorker {
                postMessage(message) {
                    if (failure === 'post') throw new Error('post failed');
                    setTimeout(() => {
                        if (failure === 'reply' || failure === 'malformed') this.dispatchEvent(new MessageEvent('message', { data: { requestId: message.requestId, ...(failure === 'reply' ? { error: 'computation failed' } : { results: {} }) } }));
                        else this.dispatchEvent(failure === 'error' ? new ErrorEvent('error', { message: 'worker crashed', cancelable: true }) : new MessageEvent('messageerror'));
                    }, 20);
                }
            };
        }, failure);
        await open(page);
        await view(page, 'פירוט');
        expect((await json(page)).lines[0].words).toHaveLength(2);
        await expect(page.getByRole('alert')).toHaveCount(0);
    });
}

test('a failed fallback displays a retry action and preserves the saved text', async ({ page }) => {
    await page.route('**/*coreResults.worker*', (route) => route.abort());
    await page.addInitScript(() => {
        window.failCalculation = true;
        const split = String.prototype.split;
        String.prototype.split = function (...args) {
            if (window.failCalculation && String(this) === 'אב אב') throw new Error('simulated calculation failure');
            return split.apply(this, args);
        };
    });
    await open(page, '');
    await page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true }).fill('אב אב');
    await expect(page.getByRole('alert')).toContainText('אפשר לנסות שוב');
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).text).toBe('אב אב');
    await page.evaluate(() => { window.failCalculation = false; });
    await page.getByRole('button', { name: 'נסה שוב', exact: true }).click();
    await ready(page);
    await expect(page.getByRole('alert')).toHaveCount(0);
});

test('editing text and changing modes reset stale frequency selections', async ({ page }) => {
    await open(page);
    await view(page, 'שכיחות');
    const row = page.locator('.app-frequency-table-row').first();
    await row.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('heading', { name: 'מילים עם הערך 1', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true }).fill('גד גד');
    await ready(page);
    await expect(page.getByRole('heading', { name: /מילים עם הערך/ })).toHaveCount(0);
    await page.locator('.app-frequency-table-row').first().click();
    await page.getByRole('button', { name: 'א=1', exact: true }).click();
    await ready(page);
    await expect(page.getByRole('heading', { name: /מילים עם הערך/ })).toHaveCount(0);
    const mode = page.getByRole('button', { name: 'א=1', exact: true });
    await mode.click();
    await expect(mode).toHaveAttribute('aria-pressed', 'true');
    await ready(page);
});

for (const scope of ['section', 'range']) {
    test(`source ${scope} and mode survive navigator reopening and page reload`, async ({ page }) => {
        await open(page, '');
        await page.getByRole('button', { name: 'פתח תנ״ך', exact: true }).click();
        await expect(page.locator('.tanakh-actions button')).toBeVisible();
        const scopeLabel = scope === 'section' ? 'פרשיה אחת' : 'טווח פרשיות';
        await page.getByRole('button', { name: scopeLabel, exact: true }).click();
        await page.locator(scope === 'section' ? '#tanakh-section' : '#tanakh-range-start').selectOption('3');
        if (scope === 'range') await page.locator('#tanakh-range-end').selectOption('5');
        await page.locator('.tanakh-actions button').click();
        await ready(page);
        const inputText = await page.locator('textarea').inputValue();
        await page.getByRole('button', { name: 'סגור תנ״ך', exact: true }).click();
        await page.getByRole('button', { name: 'פתח תנ״ך', exact: true }).click();
        await expect(page.locator('.tanakh-actions button')).toBeVisible();
        await expect(page.getByRole('button', { name: scopeLabel, exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator(scope === 'section' ? '#tanakh-section' : '#tanakh-range-start')).toHaveValue('3');
        await page.getByRole('button', { name: 'א=1', exact: true }).click();
        await ready(page);
        await page.reload();
        await ready(page);
        await expect(page.locator('textarea')).toHaveValue(inputText);
        await expect(page.getByRole('button', { name: 'א=1', exact: true })).toHaveAttribute('aria-pressed', 'true');
        // Focusing and leaving unchanged text must preserve its MAM association.
        await page.locator('textarea').focus();
        await page.getByRole('button', { name: 'א=1', exact: true }).click();
        await page.getByRole('button', { name: 'תקציר הטקסט', exact: true }).click();
        await expect(page.locator('.app-stats-grid')).toContainText('פרשיות');
        await view(page, 'פירוט');
        const result = await json(page);
        expect(result.metadata.corpusSelection).toMatchObject({ bookSlug: 'genesis', scope, startSectionOrdinal: 3, endSectionOrdinal: scope === 'section' ? 3 : 5 });
        await page.locator('textarea').fill('אב');
        await ready(page);
        expect((await json(page)).metadata.corpusSelection).toBeNull();
    });
}

test('legacy saved text migrates without overwriting it on reload', async ({ page }) => {
    await page.addInitScript(() => { if (!localStorage.getItem('alephEfes:session')) localStorage.setItem('alephCodeText', 'בראשית ברא'); });
    await page.goto('/');
    await ready(page);
    await expect(page.locator('textarea')).toHaveValue('בראשית ברא');
    await page.getByRole('button', { name: 'א=1', exact: true }).click();
    await ready(page);
    await page.reload();
    await ready(page);
    await expect(page.getByRole('button', { name: 'א=1', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard buttons remain readable when the Tailwind CDN is unavailable', async ({ page }) => {
    await page.route('https://cdn.tailwindcss.com**', (route) => route.abort());
    await page.addInitScript(() => localStorage.setItem('alephThemeMode', 'dark'));
    await open(page, 'אב גד ברא');
    await view(page, 'שכיחות');
    const row = page.locator('.app-frequency-table-row').first();
    const styles = await row.evaluate((button) => ({
        font: getComputedStyle(button).fontSize,
        parentFont: getComputedStyle(button.parentElement).fontSize,
        background: getComputedStyle(button).backgroundColor,
        border: getComputedStyle(button).borderLeftWidth,
    }));
    expect(styles.font).toBe(styles.parentFont);
    expect(styles.background).toBe('rgba(0, 0, 0, 0)');
    expect(styles.border).toBe('0px');
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: /מילים עם הערך/ })).toBeVisible();
});

for (const theme of ['light', 'dark']) {
    for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
        test(`mobile visual checks: ${theme} ${size.width}×${size.height}`, async ({ page }, testInfo) => {
            await page.setViewportSize(size);
            await page.emulateMedia({ colorScheme: theme });
            await page.addInitScript((theme) => localStorage.setItem('alephThemeMode', theme), theme);
            await open(page, genesis.sections.slice(0, 7).map((section) => section.calculationText).join('\n'));
            for (const mode of ['aleph-zero', 'aleph-one']) {
                await page.getByRole('button', { name: mode === 'aleph-zero' ? 'א=0' : 'א=1', exact: true }).click();
                await ready(page);
                for (const [key, label] of [['frequency', 'שכיחות'], ['lines', 'פירוט'], ['clusters', 'קבוצות'], ['map', 'מפת ערכים'], ['network', 'רשת קשרים']]) {
                    await view(page, label);
                    // Let the view-change scroll finish scheduling, then frame the actual controls.
                    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                    const heading = key === 'network'
                        ? page.getByRole('heading', { name: 'מפת קשרים (רשת)', exact: true })
                        : page.locator('.app-results-header').last();
                    await heading.evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 12, behavior: 'instant' }));
                    await page.screenshot({ path: testInfo.outputPath(`${mode}-${key}.png`) });
                    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
                    expect((await page.locator('.app-view-nav').boundingBox()).height).toBeLessThan(110);
                    const overlaps = await page.locator('.app-results-header').evaluateAll((headers) => headers.flatMap((header) => {
                        const boxes = [...header.children].map((element) => element.getBoundingClientRect()).filter((box) => box.width && box.height);
                        return boxes.flatMap((box, index) => boxes.slice(index + 1).filter((other) => Math.min(box.right, other.right) - Math.max(box.left, other.left) > 2 && Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 2));
                    }).length);
                    expect(overlaps).toBe(0);
                }
            }
        });
    }
}
