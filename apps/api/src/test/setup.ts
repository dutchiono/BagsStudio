import dotenv from 'dotenv';
import { beforeAll } from 'vitest';

beforeAll(() => {
  // Load test environment variables
  dotenv.config({ path: '.env.test' });

  // Fallback to regular .env if .env.test doesn't exist
  if (!process.env.HELIUS_API_KEY) {
    dotenv.config();
  }
});
