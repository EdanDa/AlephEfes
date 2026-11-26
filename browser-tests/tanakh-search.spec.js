import { test, expect } from '@playwright/test';

test('a creation transition opens both sections and keeps the search available', async ({ page }) => {
    await page.goto('/?lang=en');
    const search = page.getByRole('search');
    await search.getByRole('searchbox').fill('יום אחד ויאמר אלהים');
    const result = search.getByRole('button', { name: /Genesis · Sections 1–2/ });
    await expect(result.locator('mark')).toHaveText(['יום אחד', 'ויאמר אלהים']);
    await expect(result.locator('.tanakh-match-boundary')).toContainText('Open section');
    const filter = search.getByLabel('Section filter');
    await filter.selectOption('within');
    await expect(search.getByRole('status')).toHaveText('No matches for this filter.');
    await filter.selectOption('across');
    await result.click();
    await expect(page.locator('#tanakh-range-start')).toHaveValue('1');
    await expect(page.locator('#tanakh-range-end')).toHaveValue('2');
    const highlighted = page.locator('.tanakh-preview mark');
    await expect(highlighted).toHaveCount(2);
    await expect(highlighted.first()).toBeFocused();
    await expect(highlighted.first()).toBeInViewport();
    expect((await highlighted.allTextContents()).map(text => text.normalize('NFKD').replace(/[^א-ת ]/gu, ''))).toEqual(['יום אחד', 'ויאמר אלהים']);
    await expect(page.locator('.tanakh-preview .tanakh-match-boundary')).toContainText('פפ');
    await page.locator('.app-language-switch').click();
    await expect(page.locator('.tanakh-preview .tanakh-match-boundary')).toContainText('פתוחה');
    await page.locator('.app-language-switch').click();
    await page.getByRole('button', { name: 'Analyze 2 sections' }).click();
    await expect(page.locator('.app-textarea')).toHaveValue(/יום אחד\nויאמר אלהים/);
    await page.getByRole('button', { name: 'Close Tanakh' }).click();
    await expect(filter).toHaveValue('across');
    await expect(result).toBeVisible();
});

test('Hebrew search shows both poetic dividers and highlights the three source lines', async ({ page }) => {
    await page.goto('/?lang=he');
    const search = page.getByRole('search');
    const lines = ['מי כמכה באלם יהוה', 'מי כמכה נאדר בקדש', 'נורא תהלת עשה פלא'];
    await search.getByRole('searchbox').fill(lines.join(' '));
    const filter = search.getByLabel('סינון לפי פרשיות');
    await filter.selectOption('count:2');
    await filter.selectOption('shirah-setumah-like');
    const result = search.getByRole('button', { name: /שמות · פרשיות 64–66/ });
    await expect(result.locator('mark')).toHaveText(lines);
    await expect(result.locator('.tanakh-match-boundary')).toHaveText(['גבול שירה דמוי סתומה · מ:ששש', 'גבול שירה דמוי סתומה · מ:ששש']);
    await result.click();
    await expect(page.locator('.tanakh-preview mark')).toHaveCount(3);
    await expect(page.locator('.tanakh-preview .tanakh-match-boundary')).toHaveCount(2);
    await expect(page.locator('#tanakh-range-end')).toHaveValue('66');
    await page.locator('#tanakh-range-end').selectOption('67');
    await expect(page.locator('.tanakh-preview mark')).toHaveCount(0);
    await search.getByRole('searchbox').fill(lines[0]);
    await filter.selectOption('whole');
    await search.getByRole('button', { name: /שמות · פרשיה 64/ }).click();
    await expect(page.locator('#tanakh-section')).toHaveValue('64');
});

for (const width of [390, 1280]) {
    test(`opening a closed viewer brings a deep match into view at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 780 });
        await page.goto('/?lang=he');
        await expect(page.locator('.app-corpus-panel')).toHaveCount(0);
        await page.getByRole('searchbox').fill('ישופך');
        await page.getByRole('search').getByRole('button', { name: /ישופך/ }).click();

        await expect(page.locator('#tanakh-section')).toHaveValue('8');
        const match = page.locator('.tanakh-preview mark');
        await expect(match).toBeFocused();
        await expect.poll(() => match.evaluate(word => {
            const preview = word.closest('.tanakh-preview');
            const box = preview.getBoundingClientRect();
            const rect = word.getBoundingClientRect();
            return preview.scrollTop > 0 && rect.top >= box.top && rect.bottom <= box.bottom &&
                document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === word;
        })).toBe(true);
    });
}

test('search finds exact spellings and opens the selected pointed occurrence in One Section', async ({ page }) => {
    const bookRequests = [];
    page.on('request', request => { if (request.url().includes('/corpus/')) bookRequests.push(request.url()); });
    await page.goto('/?lang=en');
    await page.locator('.app-textarea').fill('אב');
    const search = page.getByRole('searchbox', { name: 'Search the Tanakh' });
    const results = page.locator('.tanakh-search-results button');
    await expect(search).toHaveAttribute('placeholder', 'Search for a word or phrase');
    await search.fill('20+11');
    await expect(search).toHaveValue('');
    expect(bookRequests).toHaveLength(0);
    await search.pressSequentially('crtah,');
    await expect(search).toHaveValue('בראשית');
    await page.keyboard.insertText('֖');
    await expect(search).toHaveValue('בראשית');
    await expect(results).toHaveCount(5);
    await expect(results.first()).toContainText('Genesis · Section 1');
    await expect(page.locator('.app-corpus-panel')).toHaveCount(0);
    await results.nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'One section', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tanakh-section')).toHaveValue('148');
    const match = page.locator('.tanakh-preview mark');
    await expect(match).toBeFocused();
    expect((await match.innerText()).normalize('NFKD').replace(/\p{M}/gu, '')).toBe('בראשית');
    await expect(page.locator('.app-textarea')).toHaveValue('אב');
    await page.getByRole('button', { name: 'Close Tanakh', exact: true }).click();
    await expect(page.locator('.app-corpus-panel')).toHaveCount(0);
    await expect(search).toHaveValue('בראשית');
    await expect(results).toHaveCount(5);
    await search.evaluate(input => {
        input.select();
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', 'בְּרֵאשִׁ֖ית\nבָּרָ֣א123ABC');
        input.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    });
    await expect(search).toHaveValue('בראשית ברא');
    await expect(results).toHaveCount(1);
    await results.first().click();
    await expect(page.locator('#tanakh-section')).toHaveValue('1');
    await expect(match).toHaveText('בְּרֵאשִׁ֖ית בָּרָ֣א');
    await search.fill('עַל־פְּנֵ֣י');
    await expect(search).toHaveValue('על פני');
    await results.first().click();
    await expect(match).toHaveText('עַל־פְּנֵ֣י');
    await page.getByRole('button', { name: 'Analyze this section', exact: true }).click();
    await expect(page.locator('.app-textarea')).toHaveValue(/^בראשית ברא /);
    expect(bookRequests.some(url => url.endsWith('/aleph-efes-tanakh-corpus.json'))).toBe(false);
});

test('search can retry an index load, page through matches, and clear stale results', async ({ page }) => {
    await page.route('**/*word-occurrences.json', route => route.abort(), { times: 1 });
    await page.goto('/?lang=he');
    const region = page.getByRole('search');
    const input = region.getByRole('searchbox');
    await expect(input).toHaveAttribute('placeholder', 'חפש מילה או צירוף');
    await input.fill('את');
    await region.getByRole('button', { name: 'נסה שוב' }).click();
    const results = region.getByRole('listitem');
    await expect(results).toHaveCount(8);
    await expect(results.first()).toContainText('מילה 4');
    await region.getByRole('button', { name: 'תוצאות נוספות' }).click();
    await expect(region.getByRole('status')).toContainText('9–16');
    await page.getByRole('button', { name: 'פתח תנ״ך', exact: true }).click();
    await page.getByRole('button', { name: 'סגור תנ״ך', exact: true }).click();
    await expect(input).toHaveValue('את');
    await expect(region.getByRole('status')).toContainText('9–16');
    await region.getByRole('button', { name: 'תוצאות קודמות' }).click();
    await expect(results.first()).toContainText('מילה 4');
    await input.fill('תתתתתתת');
    await expect(region.getByRole('status')).toHaveText('לא נמצאו מופעים בכתיב הזה.');
    await expect(results).toHaveCount(0);
    await input.fill('');
    await expect(region.getByRole('status')).toHaveCount(0);
});

test('Tanakh and Groups use separate queries and localized prompts', async ({ page }) => {
    await page.goto('/?lang=he');
    await page.locator('.app-textarea').fill('ל גל בל');
    const groups = page.getByRole('textbox', { name: 'חיפוש בקבוצות' });
    const tanakh = page.getByRole('searchbox');
    await expect(groups).toHaveAttribute('placeholder', 'חפש מילה או ערך');
    await expect(tanakh).toHaveAttribute('placeholder', 'חפש מילה או צירוף');
    await groups.fill('20+11');
    await expect(page.locator('.research-word-title')).toHaveText(['ל']);
    await tanakh.pressSequentially('akuo');
    await expect(tanakh).toHaveValue('שלום');
    await page.locator('.app-language-switch').click();
    await expect(tanakh).toHaveAttribute('placeholder', 'Search for a word or phrase');
    await expect(tanakh).toHaveValue('שלום');
    const translated = page.getByRole('textbox', { name: 'Search groups' });
    await expect(translated).toHaveValue('20+11');
    await expect(translated).toHaveAttribute('placeholder', 'Search for a word or value');
    await expect(translated).toHaveAccessibleDescription('20+11 finds words with both values in the selected layers.');
});
