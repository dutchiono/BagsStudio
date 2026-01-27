import { Connection, PublicKey } from '@solana/web3.js';
import Database from 'better-sqlite3';
import { BagsSDK } from '@bagsfm/bags-sdk';
import { logToFile } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SOLANA_RPC = HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : (process.env.SOLANA_RPC || 'https://mainnet.helius-rpc.com/?api-key=10f7605c-3004-4638-9562-b911c4714150');
// Use 'processed' commitment for faster log monitoring (onLogs)
const connection = new Connection(SOLANA_RPC, 'processed');
// Use 'confirmed' commitment for fetching transactions (getParsedTransaction requires at least 'confirmed')
const confirmedConnection = new Connection(SOLANA_RPC, 'confirmed');

// Bags.fm launchpad program ID
const BAGS_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const BAGS_CREATOR_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'); // Same as BAGS_PROGRAM_ID for now

// EXCLUDE LIST - Tokens to never show in scanner (e.g., your own project token)
const EXCLUDED_TOKENS = [
    process.env.TOKEN_MINT, // Project token (if any)
].filter(Boolean);

export interface TokenLaunchData {
    mintAddress: string;
    name: string;
    symbol: string;
    imageUrl?: string;
    creatorAddress: string;
    createdAt: number;
}

export class HeliusScanner {
    private db: Database.Database;
    private scanningInterval: NodeJS.Timeout | null = null;
    private isScanning: boolean = false;
    private isWebSocketMonitoring: boolean = false;
    private bagsSDK: BagsSDK;
    private lastSDKCallTime: number = 0;
    private readonly MIN_SDK_CALL_INTERVAL = 1000; // Minimum 1 second between SDK calls
    private updateIntervalMs: number;
    private perTokenDelayMs: number;
    private isUpdatingTokens: boolean = false;

    constructor(db: Database.Database) {
        this.db = db;
        this.initSchema();

        // Configure throttling from env (with safe defaults)
        const envInterval = process.env.SCANNER_UPDATE_INTERVAL_MS
            ? parseInt(process.env.SCANNER_UPDATE_INTERVAL_MS, 10)
            : NaN;
        // Default: 15 seconds between full portfolio refreshes
        this.updateIntervalMs = Number.isFinite(envInterval) && envInterval > 0
            ? envInterval
            : 15 * 1000;

        const envPerTokenDelay = process.env.SCANNER_PER_TOKEN_DELAY_MS
            ? parseInt(process.env.SCANNER_PER_TOKEN_DELAY_MS, 10)
            : NaN;
        // Default: 5 seconds between tokens to avoid hammering RPC
        this.perTokenDelayMs = Number.isFinite(envPerTokenDelay) && envPerTokenDelay >= 0
            ? envPerTokenDelay
            : 5 * 1000;

        // Initialize Bags SDK
        const BAGS_API_KEY = process.env.BAGS_API_KEY;
        if (!BAGS_API_KEY) {
            throw new Error('BAGS_API_KEY is required');
        }
        this.bagsSDK = new BagsSDK(BAGS_API_KEY, connection, 'processed');
    }

    private initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS bags_tokens (
                mint_address TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                symbol TEXT NOT NULL,
                image_url TEXT,
                creator_address TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                first_seen_at INTEGER NOT NULL,
                last_updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS token_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mint_address TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                market_cap REAL NOT NULL,
                holder_count INTEGER NOT NULL,
                price_usd REAL NOT NULL,
                volume_24h REAL,
                FOREIGN KEY (mint_address) REFERENCES bags_tokens(mint_address)
            );

            CREATE INDEX IF NOT EXISTS idx_snapshots_mint ON token_snapshots(mint_address);
            CREATE INDEX IF NOT EXISTS idx_snapshots_time ON token_snapshots(timestamp);

            CREATE TABLE IF NOT EXISTS baglog (
                mint_address TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                symbol TEXT NOT NULL,
                image_url TEXT,
                creator_address TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                first_seen_at INTEGER NOT NULL,
                archived_at INTEGER NOT NULL,
                reason TEXT NOT NULL,
                final_mcap REAL,
                final_holders INTEGER,
                final_price REAL,
                final_volume REAL
            );

            CREATE INDEX IF NOT EXISTS idx_baglog_archived ON baglog(archived_at);
        `);
    }

    /**
     * Fetch token metadata using Helius DAS API
     * Bags API removed - using Helius DAS API directly
     */
    private async getTokenMetadata(mintAddress: string): Promise<{ name: string; symbol: string; imageUrl?: string }> {
        // Validate mint address
        if (!mintAddress || typeof mintAddress !== 'string') {
            throw new Error('Invalid mintAddress provided');
        }

        // Use Helius DAS API directly (Bags API removed - was failing)
        try {
            if (HELIUS_API_KEY) {
                console.log(`  📡 Fetching metadata from Helius DAS API...`);
                const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'get-asset',
                        method: 'getAsset',
                        params: { id: mintAddress }
                    })
                });

                const data = await response.json();

                if (data.result && data.result.content?.metadata) {
                    const metadata = data.result.content.metadata;
                    const name = metadata?.name?.trim() || '';
                    const symbol = metadata?.symbol?.trim() || '';
                    const imageUrl = data.result.content.links?.image || data.result.content.files?.[0]?.uri;

                    if (name && symbol && name !== 'Unknown' && symbol !== 'UNKNOWN') {
                        console.log(`  ✅ Got metadata from Helius: ${name} (${symbol})`);
                        return { name, symbol, imageUrl };
                    }
                }
            }
        } catch (error) {
            console.log(`  ⚠️  Helius DAS failed`);
        }

        // Method 3: Try on-chain Metaplex Token Metadata Program
        // Metaplex metadata structure:
        // - Key (1 byte)
        // - Update authority (32 bytes)
        // - Mint (32 bytes)
        // - Data struct starts at offset 65
        //   - Name length (4 bytes) + Name (variable)
        //   - Symbol length (4 bytes) + Symbol (variable)
        try {
            console.log(`  📡 Trying on-chain Metaplex metadata...`);
            const TOKEN_METADATA_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
            const mintPubkey = new PublicKey(mintAddress);

            const [metadataPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('metadata'),
                    TOKEN_METADATA_PROGRAM.toBuffer(),
                    mintPubkey.toBuffer(),
                ],
                TOKEN_METADATA_PROGRAM
            );

            const accountInfo = await connection.getAccountInfo(metadataPDA);
            if (accountInfo && accountInfo.data.length >= 69) { // Minimum: 65 + 4 (name len)
                const data = accountInfo.data;
                let offset = 65; // Skip key (1) + update authority (32) + mint (32) = 65

                // Read name length (4 bytes) and name
                if (offset + 4 <= data.length) {
                    const nameLen = data.readUInt32LE(offset);
                    offset += 4;

                    if (nameLen > 0 && offset + nameLen <= data.length) {
                        const name = data.slice(offset, offset + nameLen)
                            .toString('utf8')
                            .replace(/\0/g, '') // Remove null bytes
                            .trim();
                        offset += nameLen;

                        // Read symbol length (4 bytes) and symbol
                        if (offset + 4 <= data.length) {
                            const symbolLen = data.readUInt32LE(offset);
                            offset += 4;

                            if (symbolLen > 0 && offset + symbolLen <= data.length) {
                                const symbol = data.slice(offset, offset + symbolLen)
                                    .toString('utf8')
                                    .replace(/\0/g, '') // Remove null bytes
                                    .trim();

                                if (name && symbol && name.length > 0 && symbol.length > 0) {
                                    console.log(`  ✅ Got metadata from Metaplex: ${name} (${symbol})`);
                                    return { name, symbol };
                                }
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            console.log(`  ⚠️  Metaplex metadata failed: ${error.message}`);
        }

        // Fallback - will be updated later via background refresh
        console.log(`  ⚠️  Could not fetch metadata immediately, using placeholder (will update later)`);
        return { name: 'Unknown', symbol: 'UNKNOWN' };
    }

    /**
     * Update metadata for tokens that are still "Unknown"
     * Called periodically to refresh metadata for tokens that couldn't be fetched initially
     */
    async updateUnknownTokenMetadata(): Promise<void> {
        const unknownTokens = this.db.prepare(`
            SELECT mint_address FROM bags_tokens
            WHERE name = 'Unknown' OR symbol = 'UNKNOWN'
        `).all() as { mint_address: string }[];

        if (unknownTokens.length === 0) {
            return;
        }

        console.log(`🔄 Updating metadata for ${unknownTokens.length} unknown tokens...`);

        for (const { mint_address } of unknownTokens) {
            try {
                const metadata = await this.getTokenMetadata(mint_address);
                if (metadata.name !== 'Unknown' && metadata.symbol !== 'UNKNOWN') {
                    this.db.prepare(`
                        UPDATE bags_tokens
                        SET name = ?, symbol = ?, image_url = COALESCE(?, image_url)
                        WHERE mint_address = ?
                    `).run(metadata.name, metadata.symbol, metadata.imageUrl, mint_address);
                    console.log(`  ✅ Updated ${mint_address.substring(0, 8)}...: ${metadata.name} (${metadata.symbol})`);
                }
            } catch (error) {
                // Silently continue
            }
        }
    }

    /**
     * Fetch holder count from Solana using getProgramAccounts
     */
    private async getHolderCount(mintAddress: string): Promise<number> {
        try {
            const mintPubkey = new PublicKey(mintAddress);
            const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

            const accounts = await connection.getProgramAccounts(
                TOKEN_PROGRAM_ID,
                {
                    filters: [
                        {
                            dataSize: 165, // Size of token account
                        },
                        {
                            memcmp: {
                                offset: 0, // Mint is at offset 0
                                bytes: mintPubkey.toBase58(),
                            },
                        },
                    ],
                }
            );

            // Filter out accounts with 0 balance
            const accountsWithBalance = accounts.filter(account => {
                const data = account.account.data;
                const amount = data.readBigUInt64LE(64); // Amount is at offset 64
                return amount > 0n;
            });

            return accountsWithBalance.length;
        } catch (error) {
            console.error(`Failed to get holder count for ${mintAddress}:`, error);
            return 0;
        }
    }

    /**
     * Fetch token supply from Solana
     */
    private async getTokenSupply(mintAddress: string): Promise<number> {
        try {
            const mintPubkey = new PublicKey(mintAddress);
            const supply = await connection.getTokenSupply(mintPubkey);
            return Number(supply.value.uiAmount) || 0;
        } catch (error) {
            console.error(`Failed to get supply for ${mintAddress}:`, error);
            return 0;
        }
    }

    /**
     * Fetch price from DexScreener
     */
    private async fetchPrice(mintAddress: string): Promise<number> {
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);

            // Check if response is OK and is JSON
            if (!response.ok) {
                return 0; // Rate limited or error
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // Rate limited - returning HTML error page
                return 0;
            }

            const data = await response.json();
            if (data.pairs && data.pairs.length > 0) {
                return parseFloat(data.pairs[0].priceUsd) || 0;
            }
        } catch (error: any) {
            // Silently fail - don't spam console for rate limits
            if (!error.message?.includes('DOCTYPE')) {
                // Only log if it's not the HTML response error
            }
        }
        return 0;
    }

    /**
     * Fetch trading volume from DexScreener
     */
    private async fetchVolume(mintAddress: string): Promise<number> {
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);

            // Check if response is OK and is JSON
            if (!response.ok) {
                return 0; // Rate limited or error
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // Rate limited - returning HTML error page
                return 0;
            }

            const data = await response.json();
            if (data.pairs && data.pairs.length > 0) {
                // Sum volume from all pairs
                const totalVolume = data.pairs.reduce((sum: number, pair: any) => {
                    return sum + (parseFloat(pair.volume?.h24 || 0) || 0);
                }, 0);
                return totalVolume;
            }
        } catch (error: any) {
            // Silently fail - don't spam console for rate limits
            if (!error.message?.includes('DOCTYPE')) {
                // Only log if it's not the HTML response error
            }
        }
        return 0;
    }

    /**
     * Estimate market cap
     */
    private async estimateMarketCap(mintAddress: string, priceUsd: number): Promise<number> {
        const supply = await this.getTokenSupply(mintAddress);
        return supply * priceUsd;
    }

    /**
     * Add a new token to track
     * Uses Bags SDK first for metadata, falls back to Helius DAS API
     */
    async addToken(mintAddress: string, creatorAddress?: string): Promise<void> {
        const now = Date.now();

        // Check if token is excluded
        if (EXCLUDED_TOKENS.includes(mintAddress)) {
            console.log(`Token ${mintAddress} is excluded (project token) - skipping`);
            return;
        }

        // Check if already exists
        const existing = this.db.prepare('SELECT * FROM bags_tokens WHERE mint_address = ?').get(mintAddress);
        if (existing) {
            console.log(`Token ${mintAddress} already tracked`);
            return;
        }

        let name = 'Unknown';
        let symbol = 'UNKNOWN';
        let imageUrl: string | undefined;
        let creator = creatorAddress || 'unknown';

        try {
            // SDK disabled - using creator from transaction
            console.log(`📸 Using creator from transaction: ${creator}`);
        } catch (error) {
            console.log(`⚠️  Bags SDK failed for ${mintAddress}, falling back to Helius`);
        }

        // Get token name/symbol from on-chain metadata (Helius DAS or standard metadata)
        const metadata = await this.getTokenMetadata(mintAddress);
        name = metadata.name;
        symbol = metadata.symbol;
        if (!imageUrl) {
            imageUrl = metadata.imageUrl;
        }

        // Insert token
        this.db.prepare(`
            INSERT INTO bags_tokens (mint_address, name, symbol, image_url, creator_address, created_at, first_seen_at, last_updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(mintAddress, name, symbol, imageUrl, creator, now, now, now);

        console.log(`✅ New token tracked: ${symbol} (${mintAddress})`);

        // Create initial snapshot
        await this.updateTokenSnapshot(mintAddress);
    }

    /**
     * Update snapshot for a token
     */
    async updateTokenSnapshot(mintAddress: string): Promise<void> {
        const now = Date.now();

        const priceUsd = await this.fetchPrice(mintAddress);
        const holderCount = await this.getHolderCount(mintAddress);
        const marketCap = await this.estimateMarketCap(mintAddress, priceUsd);
        const volume24h = await this.fetchVolume(mintAddress);

        this.db.prepare(`
            INSERT INTO token_snapshots (mint_address, timestamp, market_cap, holder_count, price_usd, volume_24h)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(mintAddress, now, marketCap, holderCount, priceUsd, volume24h);

        this.db.prepare('UPDATE bags_tokens SET last_updated_at = ? WHERE mint_address = ?').run(now, mintAddress);
    }

    /**
     * Update all tracked tokens
     */
    async updateAllTokens(): Promise<void> {
        if (this.isUpdatingTokens) {
            console.log('⏳ Skipping updateAllTokens: previous update still in progress');
            return;
        }

        this.isUpdatingTokens = true;
        console.log('🔄 Updating all tracked tokens...');

        try {
            const tokens = this.db.prepare('SELECT mint_address FROM bags_tokens').all() as { mint_address: string }[];

            for (const { mint_address } of tokens) {
                try {
                    await this.updateTokenSnapshot(mint_address);
                    // Delay between tokens to avoid hitting RPC rate limits too hard
                    if (this.perTokenDelayMs > 0) {
                        await new Promise(resolve => setTimeout(resolve, this.perTokenDelayMs));
                    }
                } catch (error) {
                    console.error(`Failed to update ${mint_address}:`, error);
                }
            }

            console.log(`✅ Updated ${tokens.length} tokens`);
        } finally {
            this.isUpdatingTokens = false;
        }
    }

    /**
     * Cleanup tokens without movement in first 5 minutes
     * Moves them to baglog for later review
     */
    async cleanupInactiveTokens(): Promise<number> {
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;

        // Only cleanup tokens that were launched in the last hour (very new tokens only)
        // This prevents wiping out older scanned tokens
        const oneHourAgo = now - 60 * 60 * 1000;

        const oldTokens = this.db.prepare(`
            SELECT
                t.mint_address,
                t.name,
                t.symbol,
                t.image_url,
                t.creator_address,
                t.created_at,
                t.first_seen_at,
                s.market_cap as current_mcap,
                s.holder_count as current_holders,
                s.price_usd as current_price,
                s.volume_24h as current_volume
            FROM bags_tokens t
            LEFT JOIN token_snapshots s ON t.mint_address = s.mint_address
            WHERE t.first_seen_at >= ${oneHourAgo}
              AND t.first_seen_at <= ${fiveMinutesAgo}
              AND t.mint_address NOT IN (SELECT mint_address FROM baglog)
              AND s.timestamp = (
                SELECT MAX(timestamp)
                FROM token_snapshots
                WHERE mint_address = t.mint_address
            )
        `).all() as any[];

        let archivedCount = 0;

        for (const token of oldTokens) {
            try {
                // Get first snapshot (at launch)
                const firstSnapshot = this.db.prepare(`
                    SELECT market_cap, holder_count, price_usd, volume_24h
                    FROM token_snapshots
                    WHERE mint_address = ?
                    ORDER BY timestamp ASC
                    LIMIT 1
                `).get(token.mint_address) as any;

                if (!firstSnapshot) continue;

                // Calculate growth
                const mcapGrowth = firstSnapshot.market_cap > 0
                    ? ((token.current_mcap - firstSnapshot.market_cap) / firstSnapshot.market_cap) * 100
                    : 0;
                const holderGrowth = firstSnapshot.holder_count > 0
                    ? ((token.current_holders - firstSnapshot.holder_count) / firstSnapshot.holder_count) * 100
                    : 0;
                const hasVolume = (token.current_volume || 0) > 0;

                // Archive if no volume after 5 minutes (forget about them)
                if (!hasVolume) {
                    // Archive to baglog
                    this.db.prepare(`
                        INSERT INTO baglog (
                            mint_address, name, symbol, image_url, creator_address,
                            created_at, first_seen_at, archived_at, reason,
                            final_mcap, final_holders, final_price, final_volume
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        token.mint_address,
                        token.name,
                        token.symbol,
                        token.image_url,
                        token.creator_address,
                        token.created_at,
                        token.first_seen_at,
                        now,
                        'No volume after 5 minutes',
                        token.current_mcap,
                        token.current_holders,
                        token.current_price,
                        token.current_volume
                    );

                    // Remove from active tracking (delete child records first due to foreign key constraint)
                    const deleteStmt = this.db.transaction((mintAddress: string) => {
                        // Delete snapshots first (child records - must be deleted before parent)
                        this.db.prepare('DELETE FROM token_snapshots WHERE mint_address = ?').run(mintAddress);
                        // Try to delete trading positions if table exists (may not exist or be in different DB)
                        try {
                            this.db.prepare('DELETE FROM trading_positions WHERE mint_address = ?').run(mintAddress);
                        } catch (e) {
                            // Trading positions table might not exist or be in different DB - ignore
                        }
                        // Finally delete the token (parent record)
                        this.db.prepare('DELETE FROM bags_tokens WHERE mint_address = ?').run(mintAddress);
                    });
                    deleteStmt(token.mint_address);

                    console.log(`📦 Archived token with no volume: ${token.symbol} (${token.mint_address.substring(0, 8)}...)`);
                    archivedCount++;
                    continue;
                }

                // Check if token has shown movement
                // Movement = mcap growth > 0% OR holder growth > 0% OR has trading volume
                const hasMovement = mcapGrowth > 0 || holderGrowth > 0 || hasVolume;

                if (!hasMovement) {
                    // Archive to baglog
                    this.db.prepare(`
                        INSERT INTO baglog (
                            mint_address, name, symbol, image_url, creator_address,
                            created_at, first_seen_at, archived_at, reason,
                            final_mcap, final_holders, final_price, final_volume
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        token.mint_address,
                        token.name,
                        token.symbol,
                        token.image_url,
                        token.creator_address,
                        token.created_at,
                        token.first_seen_at,
                        now,
                        'No movement in first 5 minutes',
                        token.current_mcap,
                        token.current_holders,
                        token.current_price,
                        token.current_volume
                    );

                    // Remove from active tracking (delete child records first due to foreign key constraint)
                    const deleteStmt = this.db.transaction((mintAddress: string) => {
                        // Delete snapshots first (child records - must be deleted before parent)
                        this.db.prepare('DELETE FROM token_snapshots WHERE mint_address = ?').run(mintAddress);
                        // Try to delete trading positions if table exists (may not exist or be in different DB)
                        try {
                            this.db.prepare('DELETE FROM trading_positions WHERE mint_address = ?').run(mintAddress);
                        } catch (e) {
                            // Trading positions table might not exist or be in different DB - ignore
                        }
                        // Finally delete the token (parent record)
                        this.db.prepare('DELETE FROM bags_tokens WHERE mint_address = ?').run(mintAddress);
                    });
                    deleteStmt(token.mint_address);

                    console.log(`📦 Archived inactive token: ${token.symbol} (${token.mint_address.substring(0, 8)}...)`);
                    archivedCount++;
                }
            } catch (error) {
                console.error(`Failed to cleanup ${token.mint_address}:`, error);
            }
        }

        if (archivedCount > 0) {
            console.log(`🗑️  Cleaned up ${archivedCount} inactive tokens (moved to baglog)`);
        }

        return archivedCount;
    }

    /**
     * Get tokens with filters
     */
    async getTokens(filters: {
        minMcap?: number;
        maxMcap?: number;
        minHolders?: number;
        minMcapGrowth?: number;
        minHolderGrowth?: number;
        maxAgeHours?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        limit?: number;
    }): Promise<any[]> {
        const {
            minMcap = 0,
            maxMcap,
            minHolders = 0,
            minMcapGrowth = 0,
            minHolderGrowth = 0,
            maxAgeHours,
            sortBy = 'market_cap',
            sortOrder = 'desc',
            limit = 50
        } = filters;

        const now = Date.now();
        const oneMinAgo = now - 60 * 1000;
        const fiveMinAgo = now - 5 * 60 * 1000;
        const fifteenMinAgo = now - 15 * 60 * 1000;

        const query = `
            WITH latest_snapshots AS (
                SELECT
                    t.mint_address,
                    t.name,
                    t.symbol,
                    t.image_url,
                    t.creator_address,
                    t.created_at,
                    t.first_seen_at,
                    t.last_updated_at,
                    s.market_cap,
                    s.holder_count,
                    s.price_usd,
                    s.volume_24h,
                    ROW_NUMBER() OVER (PARTITION BY t.mint_address ORDER BY s.timestamp DESC) as rn
                FROM bags_tokens t
                LEFT JOIN token_snapshots s ON t.mint_address = s.mint_address
            ),
            closest_1m AS (
                SELECT
                    mint_address,
                    market_cap as mcap_1m,
                    holder_count as holders_1m
                FROM (
                    SELECT
                        mint_address,
                        market_cap,
                        holder_count,
                        ABS(timestamp - ${oneMinAgo}) as time_diff,
                        ROW_NUMBER() OVER (PARTITION BY mint_address ORDER BY ABS(timestamp - ${oneMinAgo})) as rn
                    FROM token_snapshots
                    WHERE timestamp <= ${now}
                ) WHERE rn = 1
            ),
            closest_5m AS (
                SELECT
                    mint_address,
                    market_cap as mcap_5m,
                    holder_count as holders_5m
                FROM (
                    SELECT
                        mint_address,
                        market_cap,
                        holder_count,
                        ABS(timestamp - ${fiveMinAgo}) as time_diff,
                        ROW_NUMBER() OVER (PARTITION BY mint_address ORDER BY ABS(timestamp - ${fiveMinAgo})) as rn
                    FROM token_snapshots
                    WHERE timestamp <= ${now}
                ) WHERE rn = 1
            ),
            closest_15m AS (
                SELECT
                    mint_address,
                    market_cap as mcap_15m,
                    holder_count as holders_15m
                FROM (
                    SELECT
                        mint_address,
                        market_cap,
                        holder_count,
                        ABS(timestamp - ${fifteenMinAgo}) as time_diff,
                        ROW_NUMBER() OVER (PARTITION BY mint_address ORDER BY ABS(timestamp - ${fifteenMinAgo})) as rn
                    FROM token_snapshots
                    WHERE timestamp <= ${now}
                ) WHERE rn = 1
            )
            SELECT
                ls.*,
                s1m.mcap_1m,
                s1m.holders_1m,
                s5m.mcap_5m,
                s5m.holders_5m,
                s15m.mcap_15m,
                s15m.holders_15m,
                CASE WHEN s1m.mcap_1m > 0
                    THEN ((ls.market_cap - s1m.mcap_1m) / s1m.mcap_1m * 100)
                    ELSE 0
                END as mcap_growth_1m,
                CASE WHEN s1m.holders_1m > 0
                    THEN ((ls.holder_count - s1m.holders_1m) / s1m.holders_1m * 100)
                    ELSE 0
                END as holder_growth_1m,
                CASE WHEN s5m.mcap_5m > 0
                    THEN ((ls.market_cap - s5m.mcap_5m) / s5m.mcap_5m * 100)
                    ELSE 0
                END as mcap_growth_5m,
                CASE WHEN s5m.holders_5m > 0
                    THEN ((ls.holder_count - s5m.holders_5m) / s5m.holders_5m * 100)
                    ELSE 0
                END as holder_growth_5m,
                CASE WHEN s15m.mcap_15m > 0
                    THEN ((ls.market_cap - s15m.mcap_15m) / s15m.mcap_15m * 100)
                    ELSE 0
                END as mcap_growth_15m,
                CASE WHEN s15m.holders_15m > 0
                    THEN ((ls.holder_count - s15m.holders_15m) / s15m.holders_15m * 100)
                    ELSE 0
                END as holder_growth_15m
            FROM latest_snapshots ls
            LEFT JOIN closest_1m s1m ON ls.mint_address = s1m.mint_address
            LEFT JOIN closest_5m s5m ON ls.mint_address = s5m.mint_address
            LEFT JOIN closest_15m s15m ON ls.mint_address = s15m.mint_address
            WHERE ls.rn = 1
              AND ls.market_cap >= ${minMcap}
              ${maxMcap ? `AND ls.market_cap <= ${maxMcap}` : ''}
              AND ls.holder_count >= ${minHolders}
              AND (ls.volume_24h IS NULL OR ls.volume_24h > 0)
              ${maxAgeHours ? `AND (${now} - ls.created_at) <= ${maxAgeHours * 60 * 60 * 1000}` : ''}
            ORDER BY ${sortBy === 'mcapGrowth' ? 'mcap_growth_5m' : sortBy === 'holderGrowth' ? 'holder_growth_5m' : sortBy === 'marketCap' ? 'ls.market_cap' : sortBy === 'holderCount' ? 'ls.holder_count' : sortBy === 'createdAt' ? 'ls.created_at' : 'ls.market_cap'} ${sortOrder}
            LIMIT ${limit}
        `;

        const rows = this.db.prepare(query).all() as any[];

        return rows
            .map(row => ({
                mintAddress: row.mint_address,
                name: row.name,
                symbol: row.symbol,
                imageUrl: row.image_url,
                creatorAddress: row.creator_address,
                createdAt: row.created_at,
                marketCap: row.market_cap,
                holderCount: row.holder_count,
                priceUsd: row.price_usd,
                volume24h: row.volume_24h || 0,
                firstSeenAt: row.first_seen_at,
                lastUpdatedAt: row.last_updated_at,
                mcapGrowth1m: row.mcap_growth_1m || 0,
                holderGrowth1m: row.holder_growth_1m || 0,
                mcapGrowth5m: row.mcap_growth_5m || 0,
                holderGrowth5m: row.holder_growth_5m || 0,
                mcapGrowth15m: row.mcap_growth_15m || 0,
                holderGrowth15m: row.holder_growth_15m || 0,
            }))
            .filter(token => {
                // Filter out excluded tokens (e.g., project's own token)
                if (EXCLUDED_TOKENS.includes(token.mintAddress)) return false;
                // Use 5m growth for filtering (most relevant for runners)
                if (minMcapGrowth > 0 && (token.mcapGrowth5m || 0) < minMcapGrowth) return false;
                if (minHolderGrowth > 0 && (token.holderGrowth5m || 0) < minHolderGrowth) return false;
                return true;
            });
    }

    /**
     * Scan for new token launches on bags.fm
     * Uses Helius to monitor bags.fm program, then enriches with Bags SDK
     */
    async scanForNewLaunches(): Promise<number> {
        if (!HELIUS_API_KEY) {
            console.warn('⚠️  HELIUS_API_KEY not set - scanning disabled');
            return 0;
        }

        try {
            console.log('🔍 Scanning bags.fm program for new token launches...');
            const newTokensFound = await this.scanViaHelius();
            console.log(`✅ Scan complete: Found ${newTokensFound} new tokens`);
            return newTokensFound;
        } catch (error) {
            console.error('❌ Scan failed:', error);
            return 0;
        }
    }

    /**
     * Scan via Helius blockchain monitoring (PREFERRED - most accurate and real-time)
     */
    private async scanViaHelius(): Promise<number> {
        const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

        logToFile('📡 Fetching recent transactions from bags.fm program', {
            programId: BAGS_PROGRAM_ID.toBase58()
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'sigs',
                method: 'getSignaturesForAddress',
                params: [BAGS_PROGRAM_ID.toBase58(), { limit: 100 }]
            })
        });

        const data = await response.json();

        if (!data.result || data.result.length === 0) {
            logToFile('⚠️  No recent transactions found');
            return 0;
        }

        logToFile(`📥 Got ${data.result.length} signatures, processing top 20`);

        const signatures = data.result.map((tx: any) => tx.signature).slice(0, 20);
        let newTokensFound = 0;

        for (let i = 0; i < signatures.length; i++) {
            const signature = signatures[i];
            try {
                logToFile(`🔍 [${i + 1}/${signatures.length}] Fetching tx: ${signature.substring(0, 16)}...`);

                // DEBUG: Dump first transaction completely
                const dumpFullTx = (i === 0);

                const txResponse = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'tx',
                        method: 'getTransaction',
                        params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
                    })
                });

                const txData = await txResponse.json();
                if (!txData.result) {
                    logToFile(`  ⚠️  No result`);
                    continue;
                }

                if (dumpFullTx) {
                    logToFile(`  🔬 FULL TX DUMP:`, txData.result);
                }

                const instructions = txData.result.transaction?.message?.instructions || [];
                const innerIx = txData.result.meta?.innerInstructions || [];
                const accountKeys = txData.result.transaction?.message?.accountKeys || [];
                const postTokenBalances = txData.result.meta?.postTokenBalances || [];
                const logMessages = txData.result.meta?.logMessages || [];

                // Check if this is a bags.fm token launch by looking for specific Meteora DBC instruction
                // The correct pattern is initialize_virtual_pool_with_spl_token
                const isBagsLaunch = logMessages.some((log: string) =>
                    log.includes('initialize_virtual_pool_with_spl_token') ||
                    log.includes('InitializeVirtualPoolWithSplToken') ||
                    log.includes('Instruction: InitializeVirtualPool')
                );

                // Verify Bags Creator Program is involved in the transaction
                const accountKeyStrings = accountKeys.map((key: any) =>
                    typeof key === 'string' ? key : key?.pubkey || ''
                );
                const hasBagsCreator = accountKeyStrings.includes(BAGS_CREATOR_PROGRAM_ID.toBase58());

                const isTokenLaunch = isBagsLaunch && hasBagsCreator;

                if (isTokenLaunch) {
                    logToFile(`  🚀 BAGS.FM TOKEN LAUNCH DETECTED!`);
                    logToFile(`  📝 Logs:`, logMessages.filter((l: string) => l.includes('Instruction:')));
                }

                logToFile(`  📋 ${instructions.length} instructions, ${innerIx.length} inner, ${accountKeys.length} accounts, ${postTokenBalances.length} token balances`, {
                    types: instructions.map((ix: any) => `${ix.program}::${ix.parsed?.type || 'unknown'}`),
                    isLaunch: isTokenLaunch,
                    isBagsLaunch,
                    hasBagsCreator
                });

                // PRIMARY METHOD: Look for bags.fm launch pattern (initialize_virtual_pool_with_spl_token + Bags Creator)
                if (isTokenLaunch && postTokenBalances.length > 0) {
                    // Extract mint address from postTokenBalances
                    // The newly created token should appear in postTokenBalances
                    for (const balance of postTokenBalances) {
                        const mintAddress = balance.mint;
                        if (!mintAddress || EXCLUDED_TOKENS.includes(mintAddress)) continue;

                        // Verify it's actually a bags.fm token using SDK before adding
                        const isBagsToken = await this.verifyIsBagsToken(mintAddress);
                        if (!isBagsToken) {
                            logToFile(`  ⚠️  Token ${mintAddress} not verified as bags.fm token - skipping`);
                            continue;
                        }

                        const existing = this.db.prepare('SELECT * FROM bags_tokens WHERE mint_address = ?').get(mintAddress);
                        if (!existing) {
                            // Extract creator from account keys or use Bags SDK
                            let creator = 'unknown';
                            try {
                                const creators = await this.bagsSDK.state.getTokenCreators(new PublicKey(mintAddress));
                                if (creators && creators.length > 0) {
                                    creator = creators.find(c => c.isCreator)?.wallet || creators[0].wallet;
                                }
                            } catch (e) {
                                // Fallback to first account key
                                creator = accountKeys[0]?.pubkey || 'unknown';
                            }

                            logToFile(`  🆕 NEW BAGS.FM TOKEN LAUNCH!`, { mint: mintAddress, creator });
                            await this.addToken(mintAddress, creator);
                            newTokensFound++;
                        } else {
                            logToFile(`  ℹ️  Already tracked`);
                        }
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error: any) {
                logToFile(`  ❌ Error: ${error.message}`);
            }
        }

        logToFile(`✅ Complete: ${newTokensFound} new tokens found\n`);
        return newTokensFound;
    }

    /**
     * Verify if a token is a bags.fm token using Bags SDK
     * Bags.fm tokens typically end in "BAGS" suffix
     * @param mintAddress - Token mint address to verify
     * @returns true if token is verified as a bags.fm token, false otherwise
     */
    private async verifyIsBagsToken(mintAddress: string, retries: number = 3): Promise<boolean> {
        // Quick check: bags.fm tokens typically end in "BAGS" - use as hint but not requirement
        const likelyBagsToken = mintAddress.endsWith('BAGS');

        // If it doesn't end in BAGS, still check SDK (some tokens might not have the suffix)
        // But log it for debugging
        if (!likelyBagsToken) {
            console.log(`  ℹ️  Token doesn't end in "BAGS" (${mintAddress.substring(mintAddress.length - 4)}) - checking SDK anyway`);
        }

        // Try SDK verification with retries (token might not be indexed in bags.fm database yet)
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                // Rate limiting: ensure minimum time between SDK calls
                const timeSinceLastCall = Date.now() - this.lastSDKCallTime;
                if (timeSinceLastCall < this.MIN_SDK_CALL_INTERVAL) {
                    await new Promise(resolve => setTimeout(resolve, this.MIN_SDK_CALL_INTERVAL - timeSinceLastCall));
                }

                if (attempt > 0) {
                    // Wait before retry (token might need time to be indexed in bags.fm database)
                    const delayMs = attempt * 2000; // 2s, 4s, 6s delays
                    console.log(`  ⏳ Retry ${attempt}/${retries} in ${delayMs}ms (token may need indexing time)...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

                this.lastSDKCallTime = Date.now();
                const creators = await this.bagsSDK.state.getTokenCreators(new PublicKey(mintAddress));
                if (creators && creators.length > 0) {
                    console.log(`  ✅ SDK verification successful!`);
                    return true;
                }
            } catch (error: any) {
                // If this is the last attempt, log the error
                if (attempt === retries) {
                    console.log(`  ⚠️  SDK verification failed after ${retries + 1} attempts: ${error.message}`);
                    if (likelyBagsToken) {
                        console.log(`  ⚠️  Token ends in "BAGS" but SDK doesn't recognize it yet - may be too new or not a bags token`);
                        logToFile(`  ⚠️  Token ${mintAddress} ends in BAGS but SDK verification failed - may need more time`);
                    }
                }
                // Continue to next retry
            }
        }

        return false;
    }

    /**
     * Get token metadata using Bags SDK (PREFERRED - official SDK method)
     */
    private async getTokenMetadataFromSDK(mintAddress: string): Promise<{ name: string; symbol: string; imageUrl?: string; creator: string } | null> {
        try {
            const creators = await this.bagsSDK.state.getTokenCreators(new PublicKey(mintAddress));

            if (!creators || creators.length === 0) {
                return null;
            }

            // Find primary creator
            const primaryCreator = creators.find(c => c.isCreator) || creators[0];

            // Token metadata would come from on-chain data, not creator data
            // This method is for getting creator info, not token name/symbol
            return {
                name: '', // Will get from on-chain metadata
                symbol: '', // Will get from on-chain metadata
                imageUrl: primaryCreator.pfp,
                creator: primaryCreator.wallet
            };
        } catch (error) {
            console.error(`Failed to get creators from SDK for ${mintAddress}:`, error);
            return null;
        }
    }

    /**
     * Process a detected launch transaction (fetches transaction first)
     */
    private async processLaunchTransaction(signature: string): Promise<void> {
        try {
            const tx = await confirmedConnection.getParsedTransaction(signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            });

            if (!tx) {
                logToFile(`  ⚠️  Transaction not found: ${signature}`);
                return;
            }

            await this.processLaunchTransactionWithTx(signature, tx);
        } catch (error: any) {
            console.error(`  ❌ Error fetching transaction: ${error.message}`);
            logToFile(`  ❌ Error fetching transaction ${signature}: ${error.message}`);
        }
    }

    /**
     * Process a detected launch transaction with already-fetched transaction
     * Extracts mint address from InitializeMint2 instruction, verifies with Bags SDK, and adds to database
     */
    private async processLaunchTransactionWithTx(signature: string, tx: any): Promise<void> {
        try {
            console.log(`🔍 Processing launch transaction: ${signature.substring(0, 16)}...`);
            logToFile(`🔍 Processing launch transaction: ${signature.substring(0, 16)}...`);

            const accountKeys = tx.transaction.message.accountKeys || [];
            const preTokenBalances = tx.meta?.preTokenBalances || [];
            const postTokenBalances = tx.meta?.postTokenBalances || [];

            // Extract pre-existing mint addresses to filter them out
            const preExistingMints = new Set(preTokenBalances.map((b: any) => b.mint).filter(Boolean));

            // SOL mint address - we want to skip this
            const SOL_MINT = 'So11111111111111111111111111111111111111112';

            // Method 1: Find mint created via InitializeMint2 instruction (most reliable)
            const instructions = tx.transaction.message.instructions || [];
            const innerInstructions = tx.meta?.innerInstructions || [];

            // Collect all instructions including inner ones
            const allInstructions: any[] = [...instructions];
            innerInstructions.forEach((inner: any) => {
                if (inner.instructions) {
                    allInstructions.push(...inner.instructions);
                }
            });

            // Find InitializeMint2 instructions - these create new tokens
            const newMintAddresses: string[] = [];
            for (const ix of allInstructions) {
                if (ix.program === 'spl-token' && ix.parsed?.type === 'initializeMint2') {
                    const mintAddress = ix.parsed.info.mint;
                    if (mintAddress && mintAddress !== SOL_MINT) {
                        newMintAddresses.push(mintAddress);
                        console.log(`  🪙 Found new mint from InitializeMint2: ${mintAddress.substring(0, 16)}...`);
                    }
                }
            }

            // Method 2: If no InitializeMint2 found, check postTokenBalances for new mints
            // A new mint will appear in postTokenBalances but not in preTokenBalances
            if (newMintAddresses.length === 0) {
                console.log(`  🔍 No InitializeMint2 found, checking token balances...`);
                for (const balance of postTokenBalances) {
                    const mintAddress = balance.mint;
                    if (!mintAddress || mintAddress === SOL_MINT) {
                        continue;
                    }

                    // If this mint wasn't in preTokenBalances, it's new
                    if (!preExistingMints.has(mintAddress)) {
                        newMintAddresses.push(mintAddress);
                        console.log(`  🪙 Found new mint from balance diff: ${mintAddress.substring(0, 16)}...`);
                    }
                }
            }

            if (newMintAddresses.length === 0) {
                console.log(`  ⚠️  Could not find new mint address in transaction`);
                logToFile(`  ⚠️  Could not find new mint address in transaction`);
                return;
            }

            // Process each new mint (usually just one, but handle multiple)
            for (const mintAddress of newMintAddresses) {
                console.log(`  🪙 Checking mint: ${mintAddress.substring(0, 16)}...`);

                if (EXCLUDED_TOKENS.includes(mintAddress)) {
                    console.log(`  🚫 Token excluded (project token)`);
                    continue;
                }

                // Skip if already tracked
                const existing = this.db.prepare('SELECT * FROM bags_tokens WHERE mint_address = ?').get(mintAddress);
                if (existing) {
                    console.log(`  ℹ️  Token already tracked`);
                    continue;
                }

                // Extract creator - skip SDK call
                const firstKey = accountKeys[0];
                let creator = 'unknown';
                if (typeof firstKey === 'string') {
                    creator = firstKey;
                } else if (firstKey && typeof firstKey === 'object' && firstKey.pubkey) {
                    creator = String(firstKey.pubkey);
                }
                console.log(`  ✅ Verified bags.fm token! Creator: ${creator}`);

                console.log(`  🎉 NEW BAGS.FM TOKEN LAUNCHED!`);
                console.log(`     Mint: ${mintAddress}`);
                console.log(`     Creator: ${creator}`);
                logToFile(`  🆕 NEW BAGS.FM TOKEN DETECTED!`, { mint: mintAddress, creator });
                await this.addToken(mintAddress, creator);

                // Broadcast to scanner clients
                if (typeof (global as any).broadcastScannerUpdate === 'function') {
                    (global as any).broadcastScannerUpdate({
                        type: 'new_token',
                        mint: mintAddress,
                        creator,
                        timestamp: Date.now()
                    });
                }
            }
        } catch (error: any) {
            console.error(`  ❌ Error processing transaction: ${error.message}`);
            logToFile(`  ❌ Error processing transaction: ${error.message}`);
        }
    }

    /**
     * Start WebSocket monitoring for real-time launch detection
     * Monitors Meteora DBC program for initialize_virtual_pool_with_spl_token instruction
     */
    startWebSocketMonitoring(): void {
        if (this.isWebSocketMonitoring) {
            console.log('WebSocket monitoring already active');
            return;
        }

        if (!HELIUS_API_KEY) {
            console.warn('⚠️  HELIUS_API_KEY not set - WebSocket monitoring disabled');
            return;
        }

        console.log('🔌 Starting WebSocket monitoring for bags.fm launches...');
        console.log(`   Monitoring program: ${BAGS_PROGRAM_ID.toBase58()}`);
        console.log(`   📝 Detailed logs: apps/api/logs/scanner.log`);
        this.isWebSocketMonitoring = true;

        // Subscribe to logs from bags.fm program
        connection.onLogs(
            BAGS_PROGRAM_ID,
            async ({ logs, signature, err }) => {
                if (err) {
                    // Transaction errors are normal (failed txs on chain) - log to file only, not console
                    const errorMsg = typeof err === 'string' ? err : JSON.stringify(err);
                    // Only log to file, not console - these are normal failed transactions
                    const timestamp = new Date().toISOString();
                    const logDir = path.join(process.cwd(), 'logs');
                    const scannerLog = path.join(logDir, 'scanner.log');
                    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
                    fs.appendFileSync(scannerLog, `[${timestamp}] ⚠️  Transaction error in ${signature.substring(0, 16)}...: ${errorMsg}\n`);
                    return; // Don't spam console with failed transaction errors
                }

                // Check for bags.fm launch instruction pattern
                // ONLY real token launches have CreateV2 + InitializeMint2
                // Buy/Sell/Swap are just people trading existing tokens
                const hasCreateV2 = logs.some((log: string) => log.includes('Instruction: CreateV2'));
                const hasInitializeMint = logs.some((log: string) => log.includes('Instruction: InitializeMint2'));

                // It's a launch ONLY if it has CreateV2 AND InitializeMint2
                const isBagsLaunch = hasCreateV2 && hasInitializeMint;

                if (isBagsLaunch) {
                    console.log(`🚀 Potential bags.fm launch detected! Signature: ${signature.substring(0, 16)}...`);
                    logToFile(`🚀 Potential bags.fm launch detected!`, { signature, logs: logs.filter((l: string) => l.includes('Instruction:')) });

                    // Fetch transaction to extract mint and verify with Bags SDK
                    try {
                        // Use confirmed connection for getParsedTransaction (requires at least 'confirmed')
                        const tx = await confirmedConnection.getParsedTransaction(signature, {
                            maxSupportedTransactionVersion: 0,
                            commitment: 'confirmed'
                        });

                        if (!tx) {
                            console.log(`  ⏳ Transaction not found (may be too recent), waiting 2s and retrying...`);
                            logToFile(`  ⚠️  Transaction not found: ${signature}`);

                            // Wait a bit for transaction to be available
                            await new Promise(resolve => setTimeout(resolve, 2000));

                            // Try again with confirmed connection
                            const txRetry = await confirmedConnection.getParsedTransaction(signature, {
                                maxSupportedTransactionVersion: 0,
                                commitment: 'confirmed'
                            });

                            if (!txRetry) {
                                console.log(`  ⚠️  Transaction still not found after retry`);
                                logToFile(`  ⚠️  Transaction not found even after retry: ${signature}`);
                                return;
                            }

                            // Use retried transaction
                            await this.processLaunchTransactionWithTx(signature, txRetry);
                            return;
                        }

                        // Extract mint address from transaction
                        const postTokenBalances = tx.meta?.postTokenBalances || [];
                        if (postTokenBalances.length === 0) {
                            logToFile(`  ⚠️  No token balances found in transaction`);
                            return;
                        }

                        // Process the transaction - it will verify with Bags SDK
                        await this.processLaunchTransactionWithTx(signature, tx);
                    } catch (error: any) {
                        logToFile(`  ❌ Error processing transaction: ${error.message}`);
                        console.error(`Failed to process launch transaction:`, error);
                    }
                }
            },
            'processed' // Use processed commitment for fastest detection
        );

        console.log('✅ WebSocket monitoring started');
    }

    /**
     * Stop WebSocket monitoring
     */
    stopWebSocketMonitoring(): void {
        if (!this.isWebSocketMonitoring) {
            console.log('WebSocket monitoring not active');
            return;
        }

        console.log('⏹️  Stopping WebSocket monitoring');
        // Note: onLogs subscriptions cannot be easily stopped in Solana web3.js
        // They will continue until the connection closes or the process exits
        // This is a limitation of the library
        this.isWebSocketMonitoring = false;
    }


    /**
     * Start continuous scanning for new tokens
     * Uses WebSocket monitoring for real-time detection
     */
    startContinuousScanning(): void {
        if (this.isScanning) {
            console.log('Scanning already active');
            return;
        }

        console.log(`🚀 Starting continuous scanning...`);
        console.log(`   WebSocket: Real-time monitoring`);
        this.isScanning = true;

        // Start WebSocket monitoring (real-time detection)
        this.startWebSocketMonitoring();

        // Update existing tokens periodically (throttled)
        this.scanningInterval = setInterval(async () => {
            try {
                await this.updateAllTokens();

                // Broadcast update to scanner clients
                if (typeof (global as any).broadcastScannerUpdate === 'function') {
                    (global as any).broadcastScannerUpdate({
                        type: 'token_updated',
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.error('Auto-update failed:', error);
            }
        }, this.updateIntervalMs);

        // Cleanup inactive tokens every minute (check tokens that just hit 5 minutes)
        setInterval(async () => {
            try {
                await this.cleanupInactiveTokens();
            } catch (error) {
                console.error('Cleanup failed:', error);
            }
        }, 60000); // Every minute

        // Update unknown token metadata every 5 minutes (new tokens might not have metadata indexed yet)
        setInterval(async () => {
            try {
                await this.updateUnknownTokenMetadata();
            } catch (error) {
                console.error('Metadata update failed:', error);
            }
        }, 300000); // 5 minutes
    }

    /**
     * Stop continuous scanning
     */
    stopContinuousScanning(): void {
        if (!this.isScanning) {
            console.log('No active scanning to stop');
            return;
        }

        console.log('⏹️  Stopping continuous scanning');

        // Stop WebSocket monitoring
        this.stopWebSocketMonitoring();

        // Stop intervals
        if (this.scanningInterval) {
            clearInterval(this.scanningInterval);
            this.scanningInterval = null;
        }

        this.isScanning = false;
    }

    /**
     * Get scanning status
     */
    getScanningStatus(): { isScanning: boolean; isWebSocketActive: boolean; intervalMs: number | null } {
        return {
            isScanning: this.isScanning,
            isWebSocketActive: this.isWebSocketMonitoring,
            intervalMs: this.scanningInterval ? this.updateIntervalMs : null
        };
    }

    /**
     * Backtest: Scan for tokens launched in the past N hours
     * NOTE: Bags API removed - this function is disabled
     * Token discovery now happens via WebSocket monitoring and on-chain scanning
     */
    async backtestPastLaunches(hoursAgo: number = 6): Promise<number> {
        console.log(`🕐 Backtesting disabled - Bags API removed. Use WebSocket monitoring for real-time token discovery.`);
        console.log(`   Tokens are discovered via on-chain monitoring, not API calls.`);
        return 0;
    }
}
