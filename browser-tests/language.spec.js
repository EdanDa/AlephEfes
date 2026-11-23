import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const babel = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8')).sections[31];

async function expectCenteredText(label, container) {
    const textCenter = await label.evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        return rect.left + rect.width / 2;
    });
    const box = await container.boundingBox();
    expect(Math.abs(textCenter - box.x - box.width / 2)).toBeLessThanOrEqual(2);
}

for (const width of [320, 1280]) {
    test(`reading labels stay centered and explain digital roots in both languages at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/?lang=he');
        await page.locator('.app-textarea').fill(babel.calculationText);
        await expect(page.locator('.workspace-group-heading').first()).toBeVisible();
        for (const lang of ['he', 'en']) {
            if (lang === 'en') await page.locator('.app-language-switch').click();
            const tabs = page.locator('.app-view-tab');
            const middleTab = tabs.nth(1);
            await expectCenteredText(middleTab.locator('.app-view-tab-label'), page.locator('.app-view-tabs'));
            for (const tab of await tabs.all()) await expectCenteredText(tab.locator('.app-view-tab-label'), tab);
            await expect(page.locator('.app-legend-items > *')).toHaveCount(4);
            await expect(page.locator('.app-legend-items > button')).toHaveCount(4);
            const fontSize = page.getByRole('combobox', { name: lang === 'he' ? 'גודל גופן' : 'Font size', exact: true });
            await expectCenteredText(page.locator('.app-text-size-control > span').first(), fontSize);
            await expect(fontSize).toHaveCSS('text-align-last', 'center');
            await expect(page.locator('.app-subtitle')).toContainText(lang === 'he' ? 'טקסט עברי' : 'Hebrew text');

            const groupHeading = page.locator('.workspace-group-heading').first();
            await expectCenteredText(groupHeading, page.locator('.workspace-virtual-groups'));
            const title = page.locator('.app-results-card .app-dr-heading');
            await expectCenteredText(title.locator('.bilingual-label > span'), page.locator('.app-results-card'));
            await title.getByRole('button').focus();
            const tooltip = title.getByRole('tooltip');
            await expect(tooltip).toContainText(lang === 'he' ? 'השורש הספרתי נקרא ״שורש דיגיטלי״' : 'The digital root is the single digit');
            await expect(tooltip).toContainText('985');
            await page.keyboard.press('Escape');
            await expect(tooltip).toBeHidden();
            await middleTab.click();
            const line = page.locator('.app-line-heading-row').first();
            await expectCenteredText(line.getByRole('heading'), line);
            const lines = page.locator('.app-segmented-control button').first();
            await expectCenteredText(lines, lines);
            await tabs.last().click();
        }
    });
}

for (const width of [320, 390, 990, 1280]) {
    test(`translated result controls keep their positions in every view at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(text => localStorage.setItem('alephEfes:session', JSON.stringify({
            version: 2, mode: 'aleph-zero', text, preferences: { view: new URLSearchParams(location.search).get('view') },
            corpusSelection: { bookSlug: 'genesis', bookName: 'בראשית', scope: 'section', startSectionOrdinal: 32, endSectionOrdinal: 32, sectionCount: 1 },
        })), babel.calculationText);
        for (const [view, words] of [['lines', false], ['lines', true], ['clusters', false], ['hot-words', false], ['hot-words', true]]) {
            await page.goto('/?lang=he&view=' + view);
            await expect(page.locator('.workspace-export-menu')).toBeVisible();
            if (words) {
                await page.locator('.app-segmented-control').getByRole('button', { name: 'מילים', exact: true }).click();
                await page.locator('.app-language-switch').scrollIntoViewIfNeeded();
            }
            const controls = page.locator([
                '.app-header-copy', '.app-source-controls button', '.app-legend button', '.app-input-toolbar button',
                '.app-text-size-control select', '.app-textarea', '.app-stats-toggle', '.app-view-tab',
                '.app-results-header summary button', '.app-segmented-control button', '.research-numbering-options button',
                '.research-detail-controls > button', '.app-frequency-table-header button', '.app-word-frequency-row:first-child button', '.app-results-card input',
            ].join(', '));
            const bounds = () => controls.evaluateAll(elements => elements.map(element => {
                const { left, top, width, height } = element.getBoundingClientRect();
                return [left, top, width, height];
            }));
            const before = await bounds();
            await page.locator('.app-language-switch').click();
            await expect(page.locator('html')).toHaveAttribute('lang', 'en');
            await expect(page.locator('.app-view-tab-label')).toHaveText(['Frequency', 'Details', 'Groups']);
            const after = await bounds();
            expect(after.length).toBe(before.length);
            for (const [i, rect] of before.entries()) {
                const name = await controls.nth(i).evaluate(el => el.getAttribute('aria-label') || el.textContent || el.tagName);
                expect(Math.max(...rect.map((v, j) => Math.abs(v - after[i][j]))), view + ' ' + name).toBeLessThanOrEqual(2);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        }
    });
}

for (const [width, height] of [[320, 740], [390, 844], [820, 850], [1280, 800]]) {
    test(`the language switch keeps the reading workspace in place at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height });
        await page.goto('/?lang=he');
        await page.getByRole('button', { name: 'פתח תנ״ך', exact: true }).click();
        await page.getByRole('button', { name: 'פרשיה אחת', exact: true }).click();
        await page.getByRole('button', { name: 'נתח את הפרשיה', exact: true }).click();
        await page.getByRole('button', { name: 'פירוט', exact: true }).click();
        const row = page.locator('.app-line-disclosure').first();
        if (await row.getAttribute('aria-expanded') !== 'true') await row.click();
        await expect(row).toHaveAttribute('aria-expanded', 'true');
        await page.locator('.app-stats-toggle').click();
        await page.locator('.app-language-switch').scrollIntoViewIfNeeded();
        const geometry = () => page.evaluate(() => Object.fromEntries([
            '.app-language-switch', '.app-header-copy', '.app-title', '.app-repository-link', '.app-value-table-action',
            '.app-theme-toggle', '.app-mode-toggle', '.app-clear-control', '.app-text-size-control select',
            '.app-source-controls button', '.app-input-toolbar', '.app-view-tabs', '.app-legend',
            '.tanakh-division-tabs', '.tanakh-scope-tabs', '.tanakh-section-navigation', '.tanakh-actions button',
            '.app-detail-summary .app-segmented-control', '.app-stats-grid', '.app-detail-summary summary button'
        ].map(selector => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return [selector, [r.left, r.top + scrollY]];
        })));
        const before = await geometry();
        await page.evaluate(() => { document.body.dataset.sameWorkspace = 'true'; });
        await page.locator('.app-language-switch').click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('body')).toHaveAttribute('data-same-workspace', 'true');
        await expect(page.getByRole('button', { name: 'One section', exact: true })).toBeVisible();
        await expect(page.locator('.app-text-size-control option:checked')).toHaveText('Medium');
        await expect(page.getByRole('button', { name: 'Details', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(row).toHaveAttribute('aria-expanded', 'true');
        const after = await geometry();
        for (const key of Object.keys(before)) {
            expect(Math.abs(after[key][0] - before[key][0]), key + ' x').toBeLessThanOrEqual(2);
            expect(Math.abs(after[key][1] - before[key][1]), key + ' y').toBeLessThanOrEqual(2);
        }
        const toggle = page.locator('.app-mode-toggle button').first();
        expect(await toggle.locator('bdo').getAttribute('dir')).toBe('ltr');
        await expect(toggle).toHaveText('א=0');
        const passage = row.locator('.app-line-text');
        await expect(passage).toHaveAttribute('dir', 'rtl');
        await expect(passage).toHaveCSS('word-break', 'normal');
        const table = page.locator('.research-detail-table').first();
        const word = await table.locator('thead th').first().boundingBox();
        const sum = await table.locator('thead th').nth(1).boundingBox();
        expect(word.x).toBeGreaterThan(sum.x);
        await expect(table.locator('tbody tr').first().locator('td').nth(1)).toHaveText('1+19+0+20+9+21');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await row.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('line-reading-en.png') });
        await page.locator('.app-language-switch').click();
        await expect(row).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByRole('button', { name: 'פרשיה אחת', exact: true })).toBeVisible();
    });
}

test('the centered globe and the Hebrew reading order survive an English interface', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('alephEfes:session', JSON.stringify({
        version: 2, text: 'בראשית ברא אלהים את השמים', mode: 'aleph-zero',
        corpusSelection: null, preferences: {},
    })));
    await page.goto('/?lang=en');
    const globe = page.getByRole('link', { name: 'עברית', exact: true });
    await expect(globe).toHaveText('🌐');
    for (const width of [390, 1100]) {
        await page.setViewportSize({ width, height: 800 });
        const centerOffset = await globe.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return Math.abs(rect.left + rect.width / 2 - document.documentElement.clientWidth / 2);
        });
        expect(centerOffset).toBeLessThanOrEqual(2);
    }
    await expect(page.getByRole('heading', { name: 'א=0', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: /Search for a Hebrew word/ }).fill('בראשית');
    await page.getByRole('button', { name: 'Inspect word בראשית', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('1 occurrence of בראשית in this unit');
    const passage = dialog.locator('.research-passage');
    await expect(passage).toHaveAttribute('dir', 'rtl');
    const first = passage.locator('[data-word-position="1"]');
    const second = passage.locator('[data-word-position="2"]');
    const rect1 = await first.boundingBox();
    const rect2 = await second.boundingBox();
    expect(rect1.x).toBeGreaterThan(rect2.x);
    await dialog.getByRole('checkbox', { name: 'Letter numbers' }).check();
    const letter1 = await first.locator('[data-letter-position="1"]').boundingBox();
    const letter2 = await first.locator('[data-letter-position="2"]').boundingBox();
    expect(letter1.x).toBeGreaterThan(letter2.x);
});

test('switching language preserves the Hebrew text, mapping and source', async ({ page }) => {
    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByRole('button', { name: 'Open Tanakh', exact: true }).click();
    await page.getByRole('button', { name: 'One section', exact: true }).click();
    await page.getByRole('button', { name: 'Analyze this section', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Text to analyze', exact: true });
    await expect(input).toHaveValue(/^בראשית ברא /);
    const text = await input.inputValue();
    await page.getByRole('button', { name: 'א=1', exact: true }).click();
    await page.getByRole('link', { name: 'עברית', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.getByRole('textbox', { name: 'טקסט לניתוח', exact: true })).toHaveValue(text);
    await expect(page.getByRole('heading', { name: 'א=1', exact: true })).toBeVisible();
    await expect(page.getByText(/MAM · בראשית · פרשיה 1/)).toBeVisible();
    await page.getByRole('link', { name: 'English', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'א=1', exact: true })).toBeVisible();
    await expect(page.getByText(/MAM · Genesis · Section 1/)).toBeVisible();
});
