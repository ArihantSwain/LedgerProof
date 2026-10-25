import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:60000,use:{baseURL:'http://localhost:3000'},webServer:{command:'npm run start -- --hostname 127.0.0.1',env:{LEDGERPROOF_ALLOW_LOCAL:'true'},url:'http://localhost:3000',reuseExistingServer:!process.env.CI},workers:1});
