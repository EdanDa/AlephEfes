import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const genesis = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8'));
const section = genesis.sections[0];
const selection = { bookSlug: 'genesis', bookName: 'בראשית', scope: 'section', startSectionOrdinal: 1, endSectionOrdinal: 1, sectionCount: 1 };
async function open(page, { text = 'אב אב ה מם ממ', mode = 'aleph-zero', source = null, preferences = {} } = {}) {
    await page.addInitScript((record) => localStorage.setItem('alephEfes:session', JSON.stringify(record)), { version: 2, text, mode, corpusSelection: source, preferences });
    await page.goto('/');
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
}
async function inspect(page, word) {
    const search = page.getByPlaceholder('חפש מילה, מספר או צירוף כמו 20+11...');
    if (await search.count()) await search.fill(word);
    await page.getByRole('button', { name: `בדוק מילה ${word}`, exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.research-position')).toBeVisible();
    return dialog;
}
for (const mode of ['aleph-zero', 'aleph-one']) {
    test(`inspector exact positions, counts and keyboard focus (${mode})`, async ({ page }) => {
        await open(page, { mode });
        const trigger = page.getByRole('button', { name: 'בדוק מילה אב', exact: true });
        await trigger.focus(); await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog');
        await expect(dialog.locator('.research-count')).toHaveText('2 מופעים בקטע הנוכחי');
        await expect(dialog.locator('.research-position')).toContainText('מילה 1 מתוך 5');
        await dialog.getByRole('button', { name: 'המופע הבא', exact: true }).click();
        await expect(dialog.locator('.research-position')).toContainText('אותיות 3–4');
        await dialog.getByLabel('מספור מילים', { exact: true }).check(); await dialog.getByLabel('מספור אותיות', { exact: true }).check(); await dialog.getByLabel('סמני מרכז', { exact: true }).check();
        await expect(dialog).toContainText('מרכז המילים: 3'); await expect(dialog).toContainText('אין שיוך ליחידת MAM');
        await expect(dialog.locator('.research-values')).toContainText(mode === 'aleph-zero' ? 'U=1' : 'U=3');
        await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
    });
}
test('current MAM source is verified and corpus search stays separate from main analysis', async ({ page }) => {
    const requests = []; page.on('request', (request) => { if (request.url().includes('/corpus/')) requests.push(request.url()); });
    await open(page, { text: section.calculationText, source: selection });
    expect(requests.some((url) => url.includes('word-occurrences'))).toBe(false);
    const dialog = await inspect(page, 'אלהים');
    await expect(dialog).toContainText('genesis-0001'); await expect(dialog).toContainText('גבול אחרי: פתוחה');
    expect(requests.filter((url) => url.includes('/books/')).length).toBe(1);
    await dialog.getByRole('button', { name: 'חפש בכל המקרא', exact: true }).click();
    await expect(dialog.locator('.research-scope')).toContainText('כל המקרא');
    await expect(dialog.getByLabel('ספר', { exact: true })).toBeVisible();
    await dialog.getByLabel('ספר', { exact: true }).selectOption('exodus');
    await expect(dialog.locator('.research-unit-source')).toContainText('exodus-');
    await expect(page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true })).toHaveValue(section.calculationText);
    expect(requests.some((url) => url.includes('word-occurrences'))).toBe(true);
    expect(requests.some((url) => url.includes('/books/leviticus'))).toBe(false);
    await dialog.getByRole('button', { name: 'טען פרשיה זו לניתוח הראשי', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible(); await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('alephEfes:session')).corpusSelection?.bookSlug)).toBe('exodus');
});
test('hash mismatch and failed index loads provide retry without inventing source attribution', async ({ page }) => {
    let broken = true;
    await page.route('**/corpus/books/genesis.json', async (route) => { if (broken) await route.fulfill({ json: { sections: [] } }); else await route.continue(); });
    await open(page, { text: section.calculationText, source: selection });
    await page.getByPlaceholder('חפש מילה, מספר או צירוף כמו 20+11...').fill('אלהים');
    await page.getByRole('button', { name: 'בדוק מילה אלהים', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('alert')).toContainText('אינו תואם'); await expect(dialog.locator('.research-unit-source')).toHaveCount(0);
    broken = false; await dialog.getByRole('button', { name: 'נסה שוב', exact: true }).click();
    await expect(dialog.locator('.research-unit-source')).toContainText('genesis-0001');
    await page.route('**/*word-occurrences.json', (route) => route.abort());
    await dialog.getByRole('button', { name: 'חפש בכל המקרא', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible();
    await page.unroute('**/*word-occurrences.json'); await dialog.getByRole('button', { name: 'נסה שוב', exact: true }).click();
    await expect(dialog.locator('.research-scope')).toContainText('כל המקרא');
});
test('detail rows open their own repeated occurrence and filters do not alter inspector counts', async ({ page }) => {
    await open(page, { text: '\nאב אב\n\nאב', preferences: { view: 'lines', filters: { U: true, T: false, H: false, Prime: false } } });
    await page.getByRole('button', { name: 'פתח הכל', exact: true }).click();
    await page.getByRole('button', { name: 'בדוק מילה אב', exact: true }).nth(1).click();
    await expect(page.getByRole('dialog').locator('.research-position')).toContainText('מילה 2 מתוך 2');
    await expect(page.getByRole('dialog').locator('.research-count')).toContainText('3 מופעים');
    await expect(page.getByRole('dialog').locator('.research-unit-source')).toContainText('שורה 2');
});
test('frequency and graph word selections expose the same inspector', async ({ page }) => {
    await open(page, { text: 'אב אב בא' });
    await page.getByRole('button', { name: 'שכיחות', exact: true }).click();
    await page.getByRole('button', { name: 'הצג מילים עם הערך 1', exact: true }).click();
    await inspect(page, 'אב'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'רשת', exact: true }).click();
    await page.getByLabel('בחירת מילה ברשת').fill('אב'); await page.getByRole('button', { name: 'בחר', exact: true }).click();
    await inspect(page, 'אב'); await expect(page.getByRole('dialog').locator('.research-count')).toContainText('2 מופעים');
});
test('graph exposes all value matches and distinguishes occurrences from forms', async ({ page }) => {
    await open(page, { text: 'אב אב בא גד' });
    await page.getByRole('button', { name: 'גרף', exact: true }).click();
    await page.getByLabel('בחר ערך לבדיקה', { exact: true }).selectOption('1');
    await expect(page.locator('.app-value-map')).toContainText('מופעים: 3');
    await expect(page.locator('.app-value-map')).toContainText('מילים ייחודיות: 2');
    await expect(page.locator('.app-value-map').getByRole('button', { name: 'בדוק מילה אב', exact: true })).toBeVisible();
    await expect(page.locator('.app-value-map').getByRole('button', { name: 'בדוק מילה בא', exact: true })).toBeVisible();
    await expect(page.locator('.app-value-map')).not.toContainText('ציון גישור');
    await page.getByRole('button', { name: 'עשרות', exact: true }).click(); await page.getByRole('button', { name: 'מאות', exact: true }).click();
    await expect(page.locator('.app-value-map')).toContainText('מופעים: 3');
    await page.getByRole('button', { name: 'יחידות', exact: true }).click();
    await expect(page.locator('.app-value-map').getByRole('status')).toContainText('אין ערכים');
    await expect.poll(() => page.locator('.app-value-canvas canvas').evaluate((canvas) => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.every((value) => value === 0))).toBe(true);
});
test('even word and letter centers remain visible without enabling numbering', async ({ page }) => {
    await open(page, { text: 'אב גד' }); const dialog = await inspect(page, 'אב');
    await dialog.getByLabel('סמני מרכז', { exact: true }).check();
    await expect(dialog.locator('[aria-label="מרכז בין אותיות"]')).toHaveCount(1);
    await expect(dialog.locator('[aria-label="מרכז בין מילים"]')).toHaveCount(1);
    await expect(dialog).toContainText('מרכז המילים: בין 1 ל־2');
    await expect(dialog).toContainText('מרכז האותיות: בין 2 ל־3');
});

for (const theme of ['light', 'dark']) for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
    test(`inspector visual and enlarged text: ${theme} ${size.width}`, async ({ page }, testInfo) => {
        await page.setViewportSize(size); await page.emulateMedia({ colorScheme: theme });
        await page.addInitScript((theme) => localStorage.setItem('alephThemeMode', theme), theme);
        await open(page, { text: 'אב אב ה מם ממ' });
        const dialog = await inspect(page, 'אב');
        await dialog.getByLabel('מספור מילים', { exact: true }).check(); await dialog.getByLabel('מספור אותיות', { exact: true }).check(); await dialog.getByLabel('סמני מרכז', { exact: true }).check();
        await page.screenshot({ path: testInfo.outputPath('inspector.png') });
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        const box = await dialog.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
        await page.evaluate(() => document.documentElement.style.fontSize = '24px');
        await dialog.getByRole('button', { name: 'סגור חלונית', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('inspector-enlarged.png') });
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        await page.keyboard.press('Tab'); expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog')))).toBe(true);
        await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    });
}
