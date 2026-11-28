import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const genesis = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8'));
const section = genesis.sections[74];
for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) test(`long corpus layout: ${theme} ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.addInitScript(({ theme, text }) => {
        localStorage.setItem('alephThemeMode', theme);
        localStorage.setItem('alephEfes:session', JSON.stringify({ version: 2, text, mode: 'aleph-zero', corpusSelection: { bookSlug: 'genesis', bookName: 'בראשית', scope: 'section', startSectionOrdinal: 75, endSectionOrdinal: 75, sectionCount: 1 } }));
    }, { theme, text: section.calculationText });
    await page.goto('/'); await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('textbox', { name: 'חיפוש בקבוצות' }).fill('הישמעאלים');
    const card = page.getByRole('button', { name: 'נעץ מילה הישמעאלים', exact: true });
    await card.scrollIntoViewIfNeeded();
    await expect.poll(() => card.locator('.research-word-title').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await card.locator('.research-word-title').evaluate((element) => { const range = document.createRange(); range.selectNodeContents(element); return range.getClientRects().length; })).toBe(1);
    expect(await card.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('long-word-card.png') });
    await page.evaluate(() => document.documentElement.style.fontSize = '24px');
    await expect.poll(() => card.locator('.research-word-title').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect.poll(() => card.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await card.scrollIntoViewIfNeeded();
    expect(await page.locator('.app-view-tab-label').evaluateAll((labels) => labels.every((element) => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('long-word-enlarged.png') });
    await page.evaluate(() => document.documentElement.style.fontSize = '16px');

    await page.getByRole('button', { name: 'פירוט', exact: true }).click();
    await page.getByRole('button', { name: 'מילים', exact: true }).click();
    const rows = page.locator('.research-detail-table tbody tr');
    await rows.first().scrollIntoViewIfNeeded();
    expect((await rows.nth(1).boundingBox()).height).toBeLessThan(width < 704 ? 112 : 80);
    await page.screenshot({ path: testInfo.outputPath('compact-detail-rows.png') });
    await page.getByRole('button', { name: 'בדוק מילה אשתו', exact: true }).click();
    const inspector = page.getByRole('dialog', { name: 'בדיקת מילה · אשתו', exact: true });
    await inspector.getByRole('button', { name: 'חפש בכל המקרא', exact: true }).click();
    await inspector.getByLabel('יחידת MAM', { exact: true }).selectOption('genesis-0092');
    await expect(inspector.locator('.research-unit-source')).toContainText('genesis-0092');
    await inspector.getByLabel('מספור מילים', { exact: true }).check();
    await inspector.getByLabel('מספור אותיות', { exact: true }).check();
    const tail = inspector.locator('[data-word-position="479"]'); await tail.scrollIntoViewIfNeeded();
    expect(await tail.locator('.research-letter').evaluateAll((letters) => letters.map((element) => element.lastChild.textContent).join(''))).toBe('במצרים');
    const sizes = await inspector.locator('[data-letter-position] small').evaluateAll((elements) => elements.map((element) => { const box = element.getBoundingClientRect(); return { x: box.x, right: box.right, y: box.y, h: box.height }; }));
    const collisions = sizes.some((box, index) => sizes.slice(index + 1).some((other) => Math.abs(box.y - other.y) < 1 && Math.min(box.right, other.right) - Math.max(box.x, other.x) > 0.5));
    expect(collisions).toBe(false);
    expect(await inspector.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('four-digit-letter-positions.png') });
    await inspector.getByRole('button', { name: 'הערת מחקר', exact: true }).click();
    const note = page.getByRole('dialog', { name: 'הערת מחקר', exact: true });
    await expect(note.getByRole('table')).toBeVisible();
    await expect(note.locator('tbody tr')).toHaveCount(2);
    await expect(note.locator('.research-note-preview')).not.toContainText('##');
    await note.getByRole('table').scrollIntoViewIfNeeded();
    expect(await note.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('formatted-note-table.png') });
});

const ezekiel = JSON.parse(fs.readFileSync('public/corpus/books/ezekiel.json', 'utf8')).sections[29];
test('repeated prime totals show numbers on phones and neutral ditto marks on desktop', async ({ page }) => {
    await page.goto('/?lang=en');
    await page.locator('.app-textarea').fill('א ג');
    await page.getByRole('button', { name: 'Details', exact: true }).click();
    const totals = page.locator('.app-line-totals').first();
    const values = totals.locator('.detail-number:visible');
    await expect(values).toHaveText(['2 ♢', '2 ♢', '2 ♢', '2']);
    const prime = await values.first().evaluate(el => getComputedStyle(el).color);
    await expect(values.nth(1)).toHaveCSS('color', prime);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(values).toHaveText(['2 ♢', '2']);
    const ditto = totals.locator('.detail-ditto:visible');
    await expect(ditto).toHaveText(['〃', '〃']);
    const neutral = await totals.evaluate(el => getComputedStyle(el).color);
    await expect(ditto.first()).toHaveCSS('color', neutral);
    await expect(ditto.last()).toHaveCSS('color', neutral);
});

for (const [width, lang, theme] of [[375, 'he', 'dark'], [320, 'en', 'light']]) {
    test(`read the entire Ezekiel word calculation at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 800 });
        await page.addInitScript(({ text, theme }) => {
            localStorage.setItem('alephThemeMode', theme);
            localStorage.setItem('alephEfes:session', JSON.stringify({
                version: 2, text, mode: 'aleph-zero', preferences: { view: 'lines', wordNumberingStart: 0 },
            }));
        }, { text: ezekiel.calculationText, theme });
        await page.goto('/?lang=' + lang);
        const line = page.locator('.app-line-card').first();
        const toggle = line.locator('.app-line-disclosure');
        if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
        const table = line.getByRole('table');
        const row = table.locator('tbody tr').first();
        await expect(row.locator('.app-letter-sum')).toHaveText('5 + 9 + 0 + 12 + 19');
        await expect(row.locator('.detail-metric bdi:visible')).toHaveText(['45', '144', '144', '9']);
        await expect(table.locator('tbody tr')).toHaveCount(138);
        for (const fontSize of ['16px', '24px']) {
            await page.evaluate(size => document.documentElement.style.fontSize = size, fontSize);
            expect(await table.evaluate(element => {
                const container = element.parentElement;
                return container.scrollWidth <= container.clientWidth + 1 && [...element.querySelectorAll('td')].every(cell =>
                    cell.scrollWidth <= cell.clientWidth + 1);
            })).toBe(true);
            if (fontSize === '16px') {
                await line.locator('.app-line-totals').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
                await page.screenshot({ path: testInfo.outputPath('ezekiel-phone.png'), scale: 'css' });
            }
        }
        await row.getByRole('button', { name: /ויאמר/ }).click();
        await expect(page.getByRole('dialog')).toContainText('ויאמר');
    });
}
