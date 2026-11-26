import { expect, test } from '@playwright/test';

test('a named song opens with a numeric reference and enters analysis only on request', async ({ page }) => {
    await page.goto('/?lang=he');
    const editor = page.locator('.app-textarea');
    await editor.fill('אב');
    await page.getByRole('searchbox').fill('שירת הים');
    await page.getByRole('button', { name: /שירת הים · שמות 15:1–19 · פתח את השירה/ }).click();
    const heading = page.getByRole('heading', { name: 'שירת הים · שמות 15:1–19' });
    await expect(heading).toBeFocused();
    await expect(page.locator('.tanakh-song-unit')).toHaveCount(44);
    await expect(editor).toHaveValue('אב');
    await page.getByRole('button', { name: 'נתח את השירה' }).click();
    expect((await editor.inputValue()).split('\n')).toHaveLength(44);
    await expect(page.locator('.app-source-controls')).toContainText('שירת הים · שמות 15:1–19');
    await page.locator('.app-language-switch').click();
    await page.getByRole('combobox', { name: 'Biblical songs' }).selectOption('deborah');
    await expect(page.getByRole('heading', { name: 'Song of Deborah · Judges 5:1–31' })).toBeFocused();
    await expect(page.locator('.tanakh-song-unit')).toHaveCount(87);
    expect((await editor.inputValue()).split('\n')).toHaveLength(44);
});

test('a hit inside Haazinu links to the full song', async ({ page }) => {
    await page.goto('/?lang=en');
    await page.getByRole('searchbox').fill('האזינו השמים');
    await page.locator('.tanakh-search-results button').filter({ hasText: 'Deuteronomy' }).first().click();
    await expect(page.locator('.tanakh-preview mark').first()).toBeFocused();
    await page.getByRole('button', { name: /Open full song.*Deuteronomy 32:1–43/ }).click();
    await expect(page.locator('.tanakh-song-unit')).toHaveCount(68);
    await expect(page.getByRole('heading', { name: 'Haazinu · Deuteronomy 32:1–43' })).toBeFocused();
});

test('single-word variants show distinct counts, explanations, and the original written occurrence', async ({ page }) => {
    await page.goto('/?lang=en');
    await page.getByRole('searchbox').fill('פילגשים');
    const region = page.getByRole('search');
    await expect(region.getByRole('status')).toHaveText('Matches 1–2 of 2');
    await region.getByRole('button', { name: /Additional matches.*\(8\)/ }).click();
    await region.getByLabel('Spelling in the text').selectOption('ופלגשים');
    const group = region.locator('.tanakh-variants');
    await expect(group.locator('.tanakh-variant-reading')).toContainText('ו + פלגשים');
    await expect(group.locator('mark')).toHaveText(['ופלגשים']);
    await group.locator('.tanakh-search-results button').click();
    const match = page.locator('.tanakh-preview mark');
    await expect(match).toBeFocused();
    expect((await match.innerText()).normalize('NFKD').replace(/[^א-ת]/gu, '')).toBe('ופלגשים');
    await expect(region.getByRole('status')).toHaveText('Matches 1–2 of 2');
    await page.getByRole('searchbox').fill('יום אחד ויאמר אלהים');
    await expect(region.locator('.tanakh-variants')).toHaveCount(0);
    await expect(region.locator('.tanakh-search-results mark')).toHaveText(['יום אחד', 'ויאמר אלהים']);
});
