import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './browser-tests',
    fullyParallel: true,
    workers: 2,
    timeout: 45_000,
    expect: { timeout: 10_000 },
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        baseURL: 'http://127.0.0.1:4187',
        launchOptions: { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4187 --strictPort',
        url: 'http://127.0.0.1:4187',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
