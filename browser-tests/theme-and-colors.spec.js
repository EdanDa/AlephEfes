import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const sections = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8')).sections.slice(0, 3);
async function open(page, { theme = 'light', system = 'dark', legacy = 'dark' } = {}) {
    await page.emulateMedia({ colorScheme: system });
    await page.addInitScript(({ theme, legacy, text }) => {
        if (!localStorage.getItem('alephThemeMode')) localStorage.setItem('alephThemeMode', theme);
        localStorage.setItem('alephTheme', legacy);
        localStorage.setItem('alephEfes:session', JSON.stringify({ version: 2, text, mode: 'aleph-zero', corpusSelection: { bookSlug: 'genesis', bookName: 'בראשית', scope: 'range', startSectionOrdinal: 1, endSectionOrdinal: 3, sectionCount: 3 } }));
    }, { theme, legacy, text: sections.map((section) => section.calculationText).join('\n') });
    await page.goto('/');
    await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false');
}

for (const item of [
    { modern: 'light', legacy: 'dark', system: 'dark', expected: 'light' },
    { modern: 'dark', legacy: 'light', system: 'light', expected: 'dark' },
    { modern: null, legacy: 'light', system: 'dark', expected: 'light' },
    { modern: 'invalid', legacy: 'dark', system: 'light', expected: 'dark' },
]) test(`theme before React: ${JSON.stringify(item)}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: item.system });
    await page.addInitScript(({ modern, legacy }) => { if (modern) localStorage.setItem('alephThemeMode', modern); localStorage.setItem('alephTheme', legacy); }, item);
    await page.route('**/assets/index-*.js', (route) => route.abort());
    await page.goto('/');
    expect(await page.locator('html').evaluate((element) => element.classList.contains('dark'))).toBe(item.expected === 'dark');
    expect(await page.locator('body').evaluate((element) => element.classList.contains('dark'))).toBe(item.expected === 'dark');
    await expect(page.locator('html')).toHaveCSS('color-scheme', item.expected);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', item.expected === 'dark' ? '#111827' : '#f5f6f4');
});

for (const theme of ['light', 'dark']) test(`explicit ${theme} overrides system and stale legacy theme through toggles and reload`, async ({ page }) => {
    await open(page, { theme, system: theme === 'light' ? 'dark' : 'light', legacy: theme === 'light' ? 'dark' : 'light' });
    const verify = async (current) => {
        await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', current);
        expect(await page.locator('html').evaluate((element) => element.classList.contains('dark'))).toBe(current === 'dark');
        expect(await page.locator('body').evaluate((element) => element.classList.contains('dark'))).toBe(current === 'dark');
        await expect(page.locator('html')).toHaveCSS('color-scheme', current);
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', current === 'dark' ? '#111827' : '#f5f6f4');
    };
    await verify(theme);
    await page.getByRole('button', { name: theme === 'light' ? 'עבור למצב כהה' : 'עבור למצב בהיר', exact: true }).click();
    await verify(theme === 'light' ? 'dark' : 'light');
    await page.reload(); await verify(theme === 'light' ? 'dark' : 'light');
});

for (const theme of ['light', 'dark']) for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }, { width: 1920, height: 1000 }]) {
    test(`color flower centered and keyboard accessible: ${theme} ${size.width}`, async ({ page }, testInfo) => {
        await page.setViewportSize(size); await open(page, { theme });
        const trigger = page.locator('.app-legend-items > button').first();
        if (size.width >= 1440) await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        await trigger.focus(); await page.keyboard.press('ArrowDown');
        const flower = page.getByRole('group', { name: 'צבעי הראשוניים', exact: true });
        await expect(flower).toBeVisible();
        await expect(page.locator('.app-prime-color-control, .app-prime-color-trigger')).toHaveCount(0);
        await expect(flower).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(flower).toHaveCSS('box-shadow', 'none');
        await expect(flower).toHaveCSS('border-top-width', '0px');
        const rect = await flower.boundingBox(), width = await page.evaluate(() => document.documentElement.clientWidth);
        expect(Math.abs(rect.x + rect.width / 2 - width / 2)).toBeLessThanOrEqual(2);
        expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
        await page.screenshot({ path: testInfo.outputPath('centered-flower.png') });
        await expect(flower.getByRole('button', { name: 'צבע צהוב', exact: true })).toBeFocused();
        await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
        await expect(page.locator('.app-legend')).toHaveAttribute('data-prime-color', 'red');
        await expect(trigger).toBeFocused(); await expect(flower).not.toBeVisible();
        await page.keyboard.press('ArrowDown'); await expect(flower).toBeVisible();
        await page.keyboard.press('Escape'); await expect(flower).not.toBeVisible(); await expect(trigger).toBeFocused();
        await page.keyboard.press('ArrowDown'); await expect(flower).toBeVisible();
        await page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true }).click();
        await expect(flower).not.toBeVisible();
    });
}

for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) test(`light workspace, dialogs and text contrast: ${size.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(size); await open(page);
    await page.getByRole('button', { name: 'תקציר הטקסט', exact: true }).click();
    const ratios = await page.locator('.app-stat-label, .app-stat-value, .app-stat-secondary, .app-legend-items button > span:last-child').evaluateAll((elements) => {
        const rgb = (value) => value.match(/[\d.]+/g).map(Number);
        const luminance = (channels) => channels.slice(0, 3).map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        return elements.map((element) => {
            let ancestor = element, background;
            while (ancestor) { const color = rgb(getComputedStyle(ancestor).backgroundColor); if (color.length === 3 || color[3] === 1) { background = color; break; } ancestor = ancestor.parentElement; }
            const a = luminance(rgb(getComputedStyle(element).color)), b = luminance(background || [255, 255, 255]);
            return { text: element.textContent, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        });
    });
    expect(ratios.filter((item) => item.ratio < 4.5)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('light-workspace.png') });
    for (const name of ['קבוצות', 'פירוט', 'שכיחות', 'גרף', 'רשת']) {
        await page.getByRole('button', { name, exact: true }).click();
        const target = name === 'רשת' ? page.getByRole('heading', { name: 'רשת', exact: true }) : page.locator('.app-results-header').last();
        await target.evaluate((element) => scrollTo({ top: scrollY + element.getBoundingClientRect().top - 90, behavior: 'instant' }));
        await page.screenshot({ path: testInfo.outputPath(`light-${name}.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await page.getByRole('button', { name: 'קבוצות', exact: true }).click();
    await page.getByPlaceholder('חפש מילה, מספר או צירוף כמו 20+11...').fill('בראשית');
    await page.getByRole('button', { name: 'בדוק מילה בראשית', exact: true }).click();
    const inspector = page.getByRole('dialog', { name: 'בדיקת מילה · בראשית', exact: true });
    await expect(inspector.locator('.research-unit-source')).toContainText('genesis-0001');
    await page.screenshot({ path: testInfo.outputPath('light-inspector.png') });
    await inspector.getByRole('button', { name: 'הערת מחקר', exact: true }).click();
    const note = page.getByRole('dialog', { name: 'הערת מחקר', exact: true });
    await expect(note.getByRole('table')).toBeVisible(); await page.screenshot({ path: testInfo.outputPath('light-note.png') });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'פתח תנ״ך', exact: true }).click();
    const navigator = page.getByRole('region', { name: 'בחירת טקסט מן התנ״ך', exact: true });
    await expect(navigator.getByRole('combobox', { name: 'התחלה', exact: true })).toBeVisible();
    await navigator.evaluate((element) => scrollTo({ top: scrollY + element.getBoundingClientRect().top, behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath('light-corpus.png') });
});

test('touching the existing legend opens the original flower and allows color selection', async ({ page }) => {
    await open(page);
    await page.locator('.app-legend-items > button').first().tap();
    const flower = page.getByRole('group', { name: 'צבעי הראשוניים', exact: true });
    await expect(flower).toBeVisible();
    await expect(flower.getByRole('button', { name: 'צבע צהוב', exact: true })).toHaveCSS('background-color', 'rgb(250, 204, 21)');
    await flower.getByRole('button', { name: 'צבע ורוד', exact: true }).tap();
    await expect(page.locator('.app-legend')).toHaveAttribute('data-prime-color', 'pink');
    await expect(flower).not.toBeVisible();
});

test.describe('desktop hover behavior', () => {
    test.use({ isMobile: false, hasTouch: false, viewport: { width: 1440, height: 1000 } });
    test('hovering the existing legend opens the centered flower and allows mouse selection', async ({ page }) => {
        await open(page);
        await page.locator('.app-legend').hover();
        const flower = page.getByRole('group', { name: 'צבעי הראשוניים', exact: true });
        await expect(flower).toBeVisible();
        const box = await flower.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await flower.getByRole('button', { name: 'צבע ורוד', exact: true }).click();
        await expect(page.locator('.app-legend')).toHaveAttribute('data-prime-color', 'pink');
        await expect(flower).not.toBeVisible();
    });
});
