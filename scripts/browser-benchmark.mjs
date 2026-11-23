import { chromium, devices, expect } from '@playwright/test';
import fs from 'node:fs';

const baseURL = process.env.BENCHMARK_URL || 'http://127.0.0.1:4188';
const output = process.argv[2] || '.cache/verification/workspace-benchmark.json';
const book = JSON.parse(fs.readFileSync('public/corpus/books/genesis.json', 'utf8'));
const text = book.sections.map((section) => section.calculationText).join('\n');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined });
const runs = [];
try {
    for (let run = 0; run < 5; run += 1) {
        const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        await page.addInitScript((text) => {
            localStorage.setItem('alephEfes:session', JSON.stringify({ version: 1, text, mode: 'aleph-zero', corpusSelection: null }));
        }, text);
        const started = Date.now();
        await page.goto(baseURL);
        await expect(page.locator('.app-analysis-results')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
        const readyMs = Date.now() - started;
        await page.waitForTimeout(500);
        await page.getByRole('heading', { name: 'קבוצות לפי שורש דיגיטלי', exact: true }).evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY, behavior: 'instant' }));
        await page.waitForTimeout(250);
        const elements = await page.locator('*').count();
        runs.push({ readyMs, groupElements: elements });
        await context.close();
    }
} finally { await browser.close(); }
const median = (key) => runs.map((run) => run[key]).sort((a, b) => a - b)[2];
const report = { baseURL, device: 'Pixel 7 emulation, 390x844, desktop CPU without throttling', runs, median: Object.fromEntries(Object.keys(runs[0]).map((key) => [key, median(key)])) };
fs.mkdirSync(new URL('../.cache/verification/', import.meta.url), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
