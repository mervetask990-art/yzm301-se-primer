import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // AI Studio exports run on Vite; override with CYPRESS_BASE_URL if the port differs
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:3000',
    supportFile: false,
    viewportWidth: 390,
    viewportHeight: 844,
  },
  video: true,
  screenshotOnRunFailure: true,
});
