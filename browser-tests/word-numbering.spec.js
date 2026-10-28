import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { computeCoreResults } from '../src/core/analysisCore.js';

const text = 'אב ה אב־מם ם\nגד\n\nה אב';
async function open(page, mode = 'aleph-zero', extra = {}) {
    await page.addInitScript((record) => {
        if (!localStorage.getItem('alephEfes:session')) localStorage.setItem('alephEfes:session', JSON.stringify(record));
    }, { version: 2, text, mode, preferences: { view: 'lines' }, ...extra });
    await page.goto('/');
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('button', { name: 'פתח הכל', exact: true }).click();
}
const numbers = (line) => line.locator('.research-detail-position');
const choice = (page, start) => page.getByRole('group', { name: 'תחילת מספור המילים' }).getByRole('button', { name: `ספירה מ־${start}`, exact: true });
const summaryLetters = (page) => page.locator('.app-stats-grid > div').filter({ has: page.getByText('אותיות', { exact: true }) }).locator('.app-stat-value');

for (const mode of ['aleph-zero', 'aleph-one']) test(`line letter counts use every canonical occurrence before filtering (${mode})`, async ({ page }) => {
    const passage = 'אָב ה אב־מם ם ך\nא\n\nבית שן';
    await open(page, mode, { text: passage });
    const counts = page.locator('.app-line-letter-count');
    await page.getByRole('button', { name: 'תקציר הטקסט', exact: true }).click();
    await expect(summaryLetters(page)).toHaveText('15');
    await expect(counts).toHaveText(['סה״כ אותיות: 9', 'סה״כ אותיות: 1', 'סה״כ אותיות: 5']);
    // A standalone א is one letter even when its numerical value is zero.
    await expect(counts.nth(1)).toBeVisible();
    await choice(page, 0).click();
    await page.getByRole('button', { name: 'קפל הכל', exact: true }).click();
    await expect(counts).toHaveText(['סה״כ אותיות: 9', 'סה״כ אותיות: 1', 'סה״כ אותיות: 5']);
    await page.getByRole('button', { name: 'פתח הכל', exact: true }).click();
    await page.getByRole('button', { name: 'עשרות', exact: true }).click();
    const dr = computeCoreResults(passage, mode).wordDataMap.get('ה').dr;
    await page.getByRole('button', { name: `ש"ד ${dr}`, exact: true }).click();
    await expect(counts.first()).toHaveText('סה״כ אותיות: 9');
    await expect(summaryLetters(page)).toHaveText('15');
    await expect(page.locator('.app-line-card').first().locator('tbody tr')).toHaveCount(1);
    await page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true }).fill('א־ב');
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
    await expect(counts).toHaveText(['סה״כ אותיות: 2']);
    await expect(summaryLetters(page)).toHaveText('2');
});

for (const mode of ['aleph-zero', 'aleph-one']) test(`Tanakh letter counts agree across book, section, range and analysis (${mode})`, async ({ page }) => {
    await open(page, mode);
    const sections = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8')).sections;
    const letters = (items) => items.map((section) => (section.calculationText.match(/[א-ת]/g) || []).length);
    const sum = (items) => letters(items).reduce((total, count) => total + count, 0);
    await page.getByRole('button', { name: 'פתח תנ״ך', exact: true }).click();
    const count = page.locator('.tanakh-letter-count dd');
    await expect(count).toHaveText(sum(sections).toLocaleString('he-IL'));
    await page.getByRole('button', { name: 'פרשיה אחת', exact: true }).click();
    await page.locator('#tanakh-section').selectOption('2');
    await expect(count).toHaveText(sum(sections.slice(1, 2)).toLocaleString('he-IL'));
    await page.getByRole('button', { name: 'טווח פרשיות', exact: true }).click();
    await page.locator('#tanakh-range-end').selectOption('3');
    await expect(count).toHaveText(sum(sections.slice(1, 3)).toLocaleString('he-IL'));
    await page.locator('.tanakh-actions button').click();
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('button', { name: 'תקציר הטקסט', exact: true }).click();
    await expect(summaryLetters(page)).toHaveText(String(sum(sections.slice(1, 3))));
    await expect(page.locator('.app-line-letter-count')).toHaveText(letters(sections.slice(1, 3)).map((count) => `סה״כ אותיות: ${count}`));
});

for (const mode of ['aleph-zero', 'aleph-one']) test(`line word numbering preserves original occurrences and mode (${mode})`, async ({ page }) => {
    await open(page, mode);
    const lines = page.locator('.app-line-card');
    await expect(numbers(lines.nth(0))).toHaveText(['1', '2', '3', '4', '5']);
    await expect(numbers(lines.nth(1))).toHaveCount(0);
    await expect(numbers(lines.nth(2))).toHaveText(['1', '2']);
    const totals = await page.locator('.app-line-totals').allTextContents();
    await choice(page, 0).focus(); await page.keyboard.press('Enter');
    await expect(choice(page, 0)).toHaveAttribute('aria-pressed', 'true');
    await expect(numbers(lines.nth(0))).toHaveText(['0', '1', '2', '3', '4']);
    await expect(numbers(lines.nth(2))).toHaveText(['0', '1']);
    expect(await page.locator('.app-line-totals').allTextContents()).toEqual(totals);
    await expect(page.getByRole('button', { name: mode === 'aleph-zero' ? 'א=0' : 'א=1', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // The third token is the second occurrence of אב; the inspector retains its canonical one-based position.
    const trigger = lines.nth(0).getByRole('button', { name: 'בדוק מילה אב', exact: true }).nth(1);
    await trigger.click();
    await expect(page.getByRole('dialog').locator('.research-position')).toContainText('מילה 3 מתוך 5');
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await page.getByRole('button', { name: 'מילים', exact: true }).click();
    await expect(page.locator('.app-word-table .research-detail-position')).toHaveCount(0);
    await page.getByRole('button', { name: 'שורות', exact: true }).click();
    await expect(choice(page, 0)).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
    await expect(choice(page, 0)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'פתח הכל', exact: true }).click();
    await expect(numbers(lines.nth(0))).toHaveText(['0', '1', '2', '3', '4']);

    const dr = computeCoreResults(text, mode).wordDataMap.get('ה').dr;
    await page.getByRole('button', { name: `ש"ד ${dr}`, exact: true }).click();
    await expect(numbers(lines.first())).toHaveText(['1']);
    await expect(numbers(lines.last())).toHaveText(['0']);
    await choice(page, 1).click();
    await expect(numbers(lines.first())).toHaveText(['2']);
    await expect(numbers(lines.last())).toHaveText(['1']);
});

test('MAM section numbering uses every original token and keeps research source positions', async ({ page }) => {
    const section = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8')).sections[0];
    await open(page, 'aleph-one', { text: section.calculationText, corpusSelection: { bookSlug: 'genesis', bookName: 'בראשית', scope: 'section', startSectionOrdinal: 1, endSectionOrdinal: 1, sectionCount: 1 } });
    const line = page.locator('.app-line-card').first();
    const count = computeCoreResults(section.calculationText, 'aleph-one').totalWordCount;
    await expect(numbers(line)).toHaveText(Array.from({ length: count }, (_, index) => String(index + 1)));
    await choice(page, 0).click();
    await expect(numbers(line)).toHaveText(Array.from({ length: count }, (_, index) => String(index)));
    await line.getByRole('button', { name: 'בדוק מילה בראשית', exact: true }).click();
    await expect(page.getByRole('dialog').locator('.research-position')).toContainText(`מילה 1 מתוך ${count}`);
    await expect(page.getByRole('dialog').locator('.research-unit-source')).toContainText('genesis-0001');
});

for (const theme of ['light', 'dark']) for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
    test(`word numbering layout: ${theme} ${size.width}`, async ({ page }, testInfo) => {
        await page.setViewportSize(size); await page.emulateMedia({ colorScheme: theme });
        await page.addInitScript((theme) => localStorage.setItem('alephThemeMode', theme), theme);
        await open(page);
        await page.getByRole('button', { name: 'תקציר הטקסט', exact: true }).click();
        await expect(summaryLetters(page)).toHaveText('13');
        await page.locator('.app-stats-panel').screenshot({ path: testInfo.outputPath('letter-summary.png') });
        await choice(page, 0).click();
        await page.locator('.research-detail-controls').evaluate((element) => scrollTo({ top: element.getBoundingClientRect().top + scrollY - 85, behavior: 'instant' }));
        await page.screenshot({ path: testInfo.outputPath('word-numbering.png') });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(await page.locator('.research-detail-word').evaluateAll((words) => words.every((element) => {
            const boxes = [...element.children].map((child) => child.getBoundingClientRect());
            return boxes.every((box, index) => boxes.slice(index + 1).every((other) => Math.min(box.right, other.right) <= Math.max(box.left, other.left)));
        }))).toBe(true);
        await page.evaluate(() => document.documentElement.style.fontSize = '24px');
        await choice(page, 0).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('word-numbering-enlarged.png') });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
}
