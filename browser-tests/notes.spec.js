import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const genesis = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8'));
async function open(page, { text = 'אב אב ה', mode = 'aleph-zero', selection = null } = {}) {
    await page.addInitScript((record) => localStorage.setItem('alephEfes:session', JSON.stringify(record)), { version: 2, text, mode, corpusSelection: selection });
    await page.goto('/'); await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
}
async function menuNote(page) {
    await page.locator('.workspace-export-menu').first().locator('summary button').click();
    await page.getByRole('button', { name: 'הערת מחקר', exact: true }).click();
    return page.getByRole('dialog', { name: 'הערת מחקר', exact: true });
}
async function downloaded(page, button) {
    const pending = page.waitForEvent('download'); await button.click(); const download = await pending;
    let content = ''; for await (const chunk of await download.createReadStream()) content += chunk;
    expect(download.suggestedFilename()).toMatch(/\.md$/); return content;
}
for (const mode of ['aleph-zero', 'aleph-one']) test(`note preview, clipboard and Markdown are identical (${mode})`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, { mode }); await page.getByRole('button', { name: 'נעץ מילה אב', exact: true }).click();
    const dialog = await menuNote(page), preview = dialog.locator('.research-note-preview');
    await expect(preview).toBeVisible(); const text = await preview.textContent();
    expect(text).toContain('2 מופעים, 1 צורות מילים שונות'); expect(text).toContain('אב אב ה');
    expect(text).toContain(mode === 'aleph-zero' ? 'א=0' : 'א=1');
    expect(await downloaded(page, dialog.getByRole('button', { name: 'הורד .md', exact: true }))).toBe(text);
    await dialog.getByRole('button', { name: 'העתק', exact: true }).click();
    // Windows clipboard text uses CRLF even when writeText receives LF.
    await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, '\n'))).toBe(text);
    await page.keyboard.press('Escape'); await expect(page.locator('.workspace-export-menu summary button').first()).toBeFocused();
});
test('a source range requires explicit unit choice and keeps its verified source in the note', async ({ page }) => {
    const selection = { bookSlug: 'genesis', bookName: 'בראשית', scope: 'range', startSectionOrdinal: 1, endSectionOrdinal: 2, sectionCount: 2 };
    await open(page, { text: genesis.sections.slice(0, 2).map((section) => section.calculationText).join('\n'), selection });
    const dialog = await menuNote(page);
    await expect(dialog.getByRole('button', { name: 'הורד .md', exact: true })).toBeDisabled(); await expect(dialog.locator('.research-note-preview')).toHaveCount(0);
    await dialog.getByLabel('יחידה להערת המחקר').selectOption('genesis-0002');
    await expect(dialog.locator('.research-note-preview')).toContainText(genesis.sections[1].calculationText);
    await expect(dialog.locator('.research-note-preview')).toContainText(genesis.sections[1].calculationHash);
    await expect(dialog.locator('.research-note-preview')).not.toContainText(genesis.sections[0].calculationText);
});
test('manual notes use the selected original line without assigning a MAM source', async ({ page }) => {
    await open(page, { text: 'אב אב\n\nה גד' });
    const input = page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true });
    await input.focus(); await input.evaluate((element) => { element.setSelectionRange(element.value.length, element.value.length); document.dispatchEvent(new Event('selectionchange')); });
    const dialog = await menuNote(page);
    await expect(dialog.getByLabel('יחידה להערת המחקר')).toHaveValue('manual-line-3');
    await expect(dialog.locator('.research-note-preview')).toContainText('ה גד'); await expect(dialog.locator('.research-note-preview')).toContainText('אין שיוך ל־MAM');
});
test('a corpus inspector note contains the complete unit list and an explicitly partial corpus result', async ({ page }) => {
    await open(page, { text: 'אלהים אלהים' });
    await page.getByRole('button', { name: 'בדוק מילה אלהים', exact: true }).click();
    const inspector = page.getByRole('dialog', { name: 'בדיקת מילה · אלהים', exact: true });
    await inspector.getByRole('button', { name: 'חפש בכל המקרא', exact: true }).click();
    await expect(inspector.locator('.research-unit-source')).toContainText('genesis-0001');
    await inspector.getByRole('button', { name: 'הערת מחקר', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'הערת מחקר', exact: true });
    await expect(dialog.getByLabel('יחידה להערת המחקר')).toHaveValue('genesis-0001');
    const text = await dialog.locator('.research-note-preview').textContent();
    expect(text).toContain('זו אינה רשימת כל המופעים במקרא'); expect(text).toContain('הרשימה מלאה עבור היחידה שנבחרה: 6 מופעים');
    expect(text.split('\n').filter((line) => line.startsWith('| אלהים |'))).toHaveLength(6);
    await page.keyboard.press('Escape'); await expect(inspector.getByRole('button', { name: 'הערת מחקר', exact: true })).toBeFocused();
});
test('graph notes use the selected value and active layer filters', async ({ page }) => {
    await open(page, { text: 'אב אב בא גד' });
    await page.getByRole('button', { name: 'גרף', exact: true }).click(); await page.getByLabel('בחר ערך לבדיקה').selectOption('1');
    await page.getByRole('button', { name: 'עשרות', exact: true }).click(); await page.getByRole('button', { name: 'מאות', exact: true }).click();
    const dialog = await menuNote(page);
    await expect(dialog.locator('.research-note-preview')).toContainText('ערך נבחר: 1');
    await expect(dialog.locator('.research-note-preview')).toContainText('U=פעיל, T=כבוי, H=כבוי');
    await expect(dialog.locator('.research-note-preview')).toContainText('3 מופעים, 2 צורות מילים שונות');
});
test('clipboard rejection falls back inside the note dialog and leaves download available', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
        document.execCommand = () => { window.fallbackNote = document.activeElement.value; return window.canCopyNote !== false; };
    });
    await open(page); const dialog = await menuNote(page); await expect(dialog.locator('.research-note-preview')).toBeVisible();
    const text = await dialog.locator('.research-note-preview').textContent();
    await dialog.getByRole('button', { name: 'העתק', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('ההערה הועתקה'); expect(await page.evaluate(() => window.fallbackNote)).toBe(text);
    await page.evaluate(() => window.canCopyNote = false); await dialog.getByRole('button', { name: 'העתק', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('אינה זמינה');
    expect(await downloaded(page, dialog.getByRole('button', { name: 'הורד .md', exact: true }))).toBe(text);
});
for (const theme of ['light', 'dark']) for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
    test(`note visual and focus: ${theme} ${size.width}`, async ({ page }, testInfo) => {
        await page.setViewportSize(size); await page.emulateMedia({ colorScheme: theme }); await page.addInitScript((theme) => localStorage.setItem('alephThemeMode', theme), theme);
        await open(page); const dialog = await menuNote(page); await expect(dialog.locator('.research-note-preview')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('note.png') }); expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        await page.evaluate(() => document.documentElement.style.fontSize = '24px'); await page.screenshot({ path: testInfo.outputPath('note-enlarged.png') });
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        await dialog.getByRole('button', { name: 'הורד .md', exact: true }).focus(); await page.keyboard.press('Tab');
        expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog')))).toBe(true); await page.keyboard.press('Escape');
    });
}
