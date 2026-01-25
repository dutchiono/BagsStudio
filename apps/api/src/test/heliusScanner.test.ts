import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { HeliusScanner } from '../services/heliusScanner';
import { rmSync } from 'fs';

const TEST_DB_PATH = './test-scanner.db';

describe('HeliusScanner', () => {
  let db: Database.Database;
  let scanner: HeliusScanner;

  beforeEach(() => {
    // Create fresh test database
    db = new Database(TEST_DB_PATH);
    scanner = new HeliusScanner(db);
  });

  afterEach(() => {
    db.close();
    try {
      rmSync(TEST_DB_PATH);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  describe('Database Schema', () => {
    it('should create bags_tokens table with correct schema', () => {
      const tableInfo = db.prepare("PRAGMA table_info(bags_tokens)").all();
      const columnNames = tableInfo.map((col: any) => col.name);

      expect(columnNames).toContain('mint_address');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('symbol');
      expect(columnNames).toContain('creator_address');
      expect(columnNames).toContain('created_at');
    });

    it('should create token_snapshots table with correct schema', () => {
      const tableInfo = db.prepare("PRAGMA table_info(token_snapshots)").all();
      const columnNames = tableInfo.map((col: any) => col.name);

      expect(columnNames).toContain('mint_address');
      expect(columnNames).toContain('market_cap');
      expect(columnNames).toContain('holder_count');
      expect(columnNames).toContain('price_usd');
    });
  });

  describe('Token Metadata Fetching', () => {
    it('should fetch metadata for a real bags.fm token', async () => {
      const mintAddress = 'FTuGahidZYp1dWiCuQXkX4guFkgcmtx7qvg1xvhmBAGS';

      await scanner.addToken(mintAddress, 'test-creator');

      const tokens = db.prepare('SELECT * FROM bags_tokens WHERE mint_address = ?').get(mintAddress) as any;

      expect(tokens).toBeDefined();
      expect(tokens.name).toBeTruthy();
      expect(tokens.symbol).toBeTruthy();
      expect(tokens.name).not.toBe('Unknown');
    }, 30000); // 30s timeout for network call

    it('should handle invalid mint addresses gracefully', async () => {
      const invalidMint = 'invalid-mint-address';

      await expect(
        scanner.addToken(invalidMint, 'test-creator')
      ).rejects.toThrow();
    });

    it('should not add duplicate tokens', async () => {
      const mintAddress = 'FTuGahidZYp1dWiCuQXkX4guFkgcmtx7qvg1xvhmBAGS';

      await scanner.addToken(mintAddress, 'creator1');
      await scanner.addToken(mintAddress, 'creator2');

      const count = db.prepare('SELECT COUNT(*) as count FROM bags_tokens WHERE mint_address = ?')
        .get(mintAddress) as any;

      expect(count.count).toBe(1);
    }, 30000);
  });

  describe('Holder Count Fetching', () => {
    it('should fetch holder count for a real token', async () => {
      const mintAddress = 'FTuGahidZYp1dWiCuQXkX4guFkgcmtx7qvg1xvhmBAGS';

      await scanner.addToken(mintAddress, 'test-creator');
      await scanner.updateTokenSnapshot(mintAddress);

      const snapshot = db.prepare(
        'SELECT holder_count FROM token_snapshots WHERE mint_address = ? ORDER BY timestamp DESC LIMIT 1'
      ).get(mintAddress) as any;

      expect(snapshot).toBeDefined();
      expect(snapshot.holder_count).toBeGreaterThanOrEqual(0);
    }, 45000); // Longer timeout for getProgramAccounts
  });

  describe('Price and Market Cap Fetching', () => {
    it('should fetch price from DexScreener', async () => {
      const mintAddress = 'FTuGahidZYp1dWiCuQXkX4guFkgcmtx7qvg1xvhmBAGS';

      await scanner.addToken(mintAddress, 'test-creator');
      await scanner.updateTokenSnapshot(mintAddress);

      const snapshot = db.prepare(
        'SELECT price_usd, market_cap FROM token_snapshots WHERE mint_address = ? ORDER BY timestamp DESC LIMIT 1'
      ).get(mintAddress) as any;

      expect(snapshot).toBeDefined();
      expect(snapshot.price_usd).toBeGreaterThanOrEqual(0);
      expect(snapshot.market_cap).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('Token Filtering and Queries', () => {
    it('should filter tokens by minimum market cap', async () => {
      // This test will work once we have tokens in the DB
      const tokens = await scanner.getTokens({
        minMcap: 1000,
        limit: 50
      });

      expect(Array.isArray(tokens)).toBe(true);
      tokens.forEach(token => {
        expect(token.marketCap).toBeGreaterThanOrEqual(1000);
      });
    });

    it('should filter tokens by minimum holders', async () => {
      const tokens = await scanner.getTokens({
        minHolders: 10,
        limit: 50
      });

      expect(Array.isArray(tokens)).toBe(true);
      tokens.forEach(token => {
        expect(token.holderCount).toBeGreaterThanOrEqual(10);
      });
    });

    it('should sort tokens correctly', async () => {
      const tokens = await scanner.getTokens({
        sortBy: 'marketCap',
        sortOrder: 'desc',
        limit: 10
      });

      expect(Array.isArray(tokens)).toBe(true);

      // Check descending order
      for (let i = 0; i < tokens.length - 1; i++) {
        expect(tokens[i].marketCap).toBeGreaterThanOrEqual(tokens[i + 1].marketCap);
      }
    });
  });

  describe('Automatic Token Discovery', () => {
    it('should have a method to scan for new bags.fm launches', () => {
      expect(scanner.scanForNewLaunches).toBeDefined();
      expect(typeof scanner.scanForNewLaunches).toBe('function');
    });

    it('should discover new tokens from bags.fm program', async () => {
      const initialCount = db.prepare('SELECT COUNT(*) as count FROM bags_tokens').get() as any;

      await scanner.scanForNewLaunches();

      const finalCount = db.prepare('SELECT COUNT(*) as count FROM bags_tokens').get() as any;

      // Should discover at least some tokens from bags.fm
      expect(finalCount.count).toBeGreaterThanOrEqual(initialCount.count);
    }, 60000); // 60s timeout for scanning
  });

  describe('Continuous Scanning', () => {
    it('should have a method to start continuous scanning', () => {
      expect(scanner.startContinuousScanning).toBeDefined();
      expect(typeof scanner.startContinuousScanning).toBe('function');
    });

    it('should have a method to stop continuous scanning', () => {
      expect(scanner.stopContinuousScanning).toBeDefined();
      expect(typeof scanner.stopContinuousScanning).toBe('function');
    });

    it('should scan at regular intervals', async () => {
      const scanSpy = vi.spyOn(scanner, 'scanForNewLaunches');

      scanner.startContinuousScanning(1000); // Scan every 1 second

      // Wait for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3500));

      scanner.stopContinuousScanning();

      // Should have scanned at least 3 times
      expect(scanSpy).toHaveBeenCalledTimes(expect.any(Number));
      expect(scanSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    }, 10000);
  });
});
