import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import Database from 'better-sqlite3';
import { BagsSDK, signAndSendTransaction } from '@bagsfm/bags-sdk';
import bs58 from 'bs58';

const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Trading configuration
interface TradingConfig {
    minMcapGrowth: number | null; // Minimum % mcap growth to trigger buy (null = disabled)
    minMcapGrowthEnabled: boolean; // Whether mcap growth filter is enabled
    minHolders: number | null; // Minimum holder count (null = disabled)
    minHoldersEnabled: boolean; // Whether min holders filter is enabled
    minVolume: number | null; // Minimum 24h volume in USD to trigger buy (null = disabled)
    minVolumeEnabled: boolean; // Whether volume filter is enabled
    buyAmountSOL: number; // Amount of SOL to spend per trade
    profitTargetPercent: number; // First profit target % (e.g., 50 = 50% profit) - sells 50% of position
    secondProfitTargetPercent: number; // Second profit target % for remaining 50% (e.g., 100 = 100% profit)
    stopLossPercent: number; // Stop loss % (e.g., -10 = 10% loss)
    maxPositions: number; // Maximum number of concurrent positions
    minMcap: number; // Minimum market cap to trade (3000)
    enabled: boolean; // Whether trading is enabled (manual control)
}

const DEFAULT_CONFIG: TradingConfig = {
    minMcapGrowth: 5, // 5% mcap growth in 5m (default)
    minMcapGrowthEnabled: true,
    minHolders: 20, // Minimum 20 holders (default)
    minHoldersEnabled: true,
    minVolume: 1000, // $1K volume (default)
    minVolumeEnabled: true,
    buyAmountSOL: 0.1, // 0.1 SOL per trade (default)
    profitTargetPercent: 50, // Take 50% profit at 50% gain (sells 50% of position)
    secondProfitTargetPercent: 100, // Take remaining 50% profit at 100% gain (if conditions met)
    stopLossPercent: -10, // Stop loss at -10%
    maxPositions: 5, // Max 5 concurrent positions
    minMcap: 3000, // Minimum 3k mcap
    enabled: false, // Disabled by default - must be manually enabled
};

export interface TradingPosition {
    id: number;
    mintAddress: string;
    tokenName: string;
    tokenSymbol: string;
    buyPrice: number;
    buyAmountSOL: number;
    buyAmountTokens: number;
    buyTimestamp: number;
    currentPrice?: number;
    profitPercent?: number;
    status: 'open' | 'sold' | 'stopped' | 'partial'; // 'partial' = sold 50%, holding remaining 50%
    sellPrice?: number;
    sellTimestamp?: number;
    remainingTokens?: number; // Remaining tokens after first partial sell
    firstSellPrice?: number; // Price when first 50% was sold
    firstSellTimestamp?: number;
}

export class AutoTrader {
    private db: Database.Database;
    private connection: Connection;
    private bagsSDK: BagsSDK;
    private wallet: Keypair;
    private config: TradingConfig;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private isMonitoring: boolean = false;

    constructor(
        db: Database.Database,
        connection: Connection,
        bagsSDK: BagsSDK,
        privateKey: string
    ) {
        this.db = db;
        this.connection = connection;
        this.bagsSDK = bagsSDK;
        this.wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
        this.config = DEFAULT_CONFIG;
        this.initSchema();
    }

    private initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS trading_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mint_address TEXT NOT NULL,
                token_name TEXT NOT NULL,
                token_symbol TEXT NOT NULL,
                buy_price REAL NOT NULL,
                buy_amount_sol REAL NOT NULL,
                buy_amount_tokens REAL NOT NULL,
                buy_timestamp INTEGER NOT NULL,
                current_price REAL,
                profit_percent REAL,
                status TEXT NOT NULL DEFAULT 'open',
                sell_price REAL,
                sell_timestamp INTEGER,
                remaining_tokens REAL,
                first_sell_price REAL,
                first_sell_timestamp INTEGER,
                UNIQUE(mint_address, status) WHERE status = 'open' OR status = 'partial'
            );

            CREATE INDEX IF NOT EXISTS idx_positions_status ON trading_positions(status);
            CREATE INDEX IF NOT EXISTS idx_positions_mint ON trading_positions(mint_address);
        `);
    }

    /**
     * Check if a token meets buy criteria (runner detection)
     */
    private async shouldBuyToken(
        mintAddress: string,
        mcapGrowth5m: number,
        holderCount: number,
        volume24h: number,
        marketCap: number
    ): Promise<boolean> {
        // Check minimum mcap
        if (marketCap < this.config.minMcap) {
            return false;
        }

        // Check if we already have a position
        const existingPosition = this.db.prepare(`
            SELECT * FROM trading_positions
            WHERE mint_address = ? AND (status = 'open' OR status = 'partial')
        `).get(mintAddress) as TradingPosition | undefined;

        if (existingPosition) {
            return false; // Already have a position
        }

        // Check if we're at max positions
        const openPositions = this.db.prepare(`
            SELECT COUNT(*) as count FROM trading_positions WHERE status IN ('open', 'partial')
        `).get() as { count: number };

        if (openPositions.count >= this.config.maxPositions) {
            return false; // At max positions
        }

        // Check runner criteria (only if enabled)
        const criteria: boolean[] = [];

        if (this.config.minMcapGrowthEnabled && this.config.minMcapGrowth !== null) {
            criteria.push(mcapGrowth5m >= this.config.minMcapGrowth);
        }

        if (this.config.minHoldersEnabled && this.config.minHolders !== null) {
            criteria.push(holderCount >= this.config.minHolders);
        }

        if (this.config.minVolumeEnabled && this.config.minVolume !== null) {
            criteria.push(volume24h >= this.config.minVolume);
        }

        // Must meet all enabled criteria, or at least 2 if 3 are enabled
        if (criteria.length === 0) return false; // No filters enabled
        if (criteria.length === 1) return criteria[0]; // Single filter
        if (criteria.length === 2) return criteria.every(Boolean); // Both must pass
        // 3 filters: at least 2 must pass
        return criteria.filter(Boolean).length >= 2;
    }

    /**
     * Execute buy order using Bags SDK (public for manual triggers)
     */
    async executeBuy(mintAddress: string, tokenName: string, tokenSymbol: string): Promise<{ success: boolean; signature?: string; error?: string }> {
        try {
            const tokenMint = new PublicKey(mintAddress);
            const buyAmountLamports = Math.floor(this.config.buyAmountSOL * 1e9); // Convert SOL to lamports

            console.log(`\n╔══════════════════════════════════════════════════════╗`);
            console.log(`║  💰 EXECUTING BUY ORDER                              ║`);
            console.log(`╚══════════════════════════════════════════════════════╝`);
            console.log(`   Token: ${tokenSymbol} (${tokenName})`);
            console.log(`   Mint: ${mintAddress.substring(0, 8)}...${mintAddress.substring(mintAddress.length - 8)}`);
            console.log(`   Amount: ${this.config.buyAmountSOL} SOL (${buyAmountLamports.toLocaleString()} lamports)`);
            console.log(`   Wallet: ${this.wallet.publicKey.toBase58()}`);

            // Check wallet balance first
            const balance = await this.connection.getBalance(this.wallet.publicKey);
            const balanceSOL = balance / 1e9;
            console.log(`   Wallet Balance: ${balanceSOL.toFixed(4)} SOL`);

            if (balanceSOL < this.config.buyAmountSOL + 0.01) { // Need extra for fees
                const error = `Insufficient SOL balance. Need ${this.config.buyAmountSOL + 0.01} SOL, have ${balanceSOL.toFixed(4)} SOL`;
                console.error(`   ❌ ${error}`);
                return { success: false, error };
            }

            console.log(`\n   📊 Getting trade quote...`);
            // Get quote
            const quote = await this.bagsSDK.trade.getQuote({
                inputMint: SOL_MINT,
                outputMint: tokenMint,
                amount: buyAmountLamports,
                slippageMode: 'auto',
            });

            console.log(`   ✅ Quote received:`);
            console.log(`      Expected tokens: ${parseFloat(quote.outAmount).toLocaleString()}`);
            console.log(`      Min tokens (slippage): ${parseFloat(quote.minOutAmount).toLocaleString()}`);
            console.log(`      Price impact: ${quote.priceImpactPct}%`);
            console.log(`      Slippage: ${(quote.slippageBps / 100).toFixed(2)}%`);

            // Check price impact (don't buy if too high)
            const priceImpact = parseFloat(quote.priceImpactPct);
            if (priceImpact > 5) { // Max 5% price impact
                const error = `Price impact too high (${priceImpact}%), max allowed is 5%`;
                console.log(`   ⚠️  ${error}`);
                return { success: false, error };
            }

            console.log(`\n   🔨 Creating swap transaction...`);
            // Create swap transaction
            const swapResult = await this.bagsSDK.trade.createSwapTransaction({
                quoteResponse: quote,
                userPublicKey: this.wallet.publicKey,
            });

            console.log(`   ✅ Transaction created:`);
            console.log(`      Compute units: ${swapResult.computeUnitLimit?.toLocaleString() || 'N/A'}`);
            console.log(`      Priority fee: ${swapResult.prioritizationFeeLamports?.toLocaleString() || 'N/A'} lamports`);

            console.log(`\n   🔐 Signing and sending transaction...`);
            // Sign and send
            const commitment = this.bagsSDK.state.getCommitment();
            const signature = await signAndSendTransaction(
                this.connection,
                commitment,
                swapResult.transaction,
                this.wallet
            );

            console.log(`   ✅ Transaction sent!`);
            console.log(`      Signature: ${signature}`);
            console.log(`      Status: Pending confirmation...`);

            // Wait for confirmation
            console.log(`\n   ⏳ Waiting for confirmation...`);
            await this.connection.confirmTransaction(signature, 'confirmed');
            console.log(`   ✅ Transaction confirmed!`);

            // Get current price
            const currentPrice = parseFloat(quote.outAmount) / parseFloat(quote.inAmount) * 1e9; // Approximate price per token

            // Record position
            const buyTimestamp = Date.now();
            this.db.prepare(`
                INSERT INTO trading_positions (
                    mint_address, token_name, token_symbol,
                    buy_price, buy_amount_sol, buy_amount_tokens,
                    buy_timestamp, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
            `).run(
                mintAddress,
                tokenName,
                tokenSymbol,
                currentPrice,
                this.config.buyAmountSOL,
                parseFloat(quote.outAmount),
                buyTimestamp
            );

            return { success: true, signature };
        } catch (error: any) {
            console.error(`❌ Buy failed for ${mintAddress}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute partial sell (e.g., 50% of position)
     */
    private async executePartialSell(position: TradingPosition, fraction: number): Promise<{ success: boolean; signature?: string; error?: string }> {
        try {
            const tokenMint = new PublicKey(position.mintAddress);
            const sellAmount = Math.floor(position.buyAmountTokens * fraction); // Sell fraction of tokens
            const remainingTokens = position.buyAmountTokens - sellAmount;

            console.log(`\n╔══════════════════════════════════════════════════════╗`);
            console.log(`║  💸 EXECUTING PARTIAL SELL (${(fraction * 100).toFixed(0)}%)                        ║`);
            console.log(`╚══════════════════════════════════════════════════════╝`);
            console.log(`   Token: ${position.tokenSymbol} (${position.tokenName})`);
            console.log(`   Mint: ${position.mintAddress.substring(0, 8)}...${position.mintAddress.substring(position.mintAddress.length - 8)}`);
            console.log(`   Selling: ${sellAmount.toLocaleString()} tokens`);
            console.log(`   Keeping: ${remainingTokens.toLocaleString()} tokens`);
            console.log(`   Original buy price: $${position.buyPrice.toFixed(8)}`);

            // Get quote
            const quote = await this.bagsSDK.trade.getQuote({
                inputMint: tokenMint,
                outputMint: SOL_MINT,
                amount: sellAmount,
                slippageMode: 'auto',
            });

            // Create swap transaction
            const swapResult = await this.bagsSDK.trade.createSwapTransaction({
                quoteResponse: quote,
                userPublicKey: this.wallet.publicKey,
            });

            // Sign and send
            const commitment = this.bagsSDK.state.getCommitment();
            const signature = await signAndSendTransaction(
                this.connection,
                commitment,
                swapResult.transaction,
                this.wallet
            );

            console.log(`   ✅ Transaction sent!`);
            console.log(`      Signature: ${signature}`);
            console.log(`      Status: Pending confirmation...`);

            // Wait for confirmation
            console.log(`\n   ⏳ Waiting for confirmation...`);
            await this.connection.confirmTransaction(signature, 'confirmed');
            console.log(`   ✅ Transaction confirmed!`);

            // Update position to 'partial' status
            const sellPrice = parseFloat(quote.outAmount) / parseFloat(quote.inAmount) * 1e9;
            const sellTimestamp = Date.now();
            const profitPercent = ((sellPrice - position.buyPrice) / position.buyPrice) * 100;
            const solReceived = parseFloat(quote.outAmount) / 1e9;

            this.db.prepare(`
                UPDATE trading_positions
                SET status = 'partial',
                    first_sell_price = ?,
                    first_sell_timestamp = ?,
                    remaining_tokens = ?,
                    profit_percent = ?
                WHERE id = ?
            `).run(sellPrice, sellTimestamp, remainingTokens, profitPercent, position.id);

            console.log(`   ✅ Partial sell completed!`);
            console.log(`      SOL received: ${solReceived.toFixed(4)} SOL`);
            console.log(`      First TP Profit: ${profitPercent.toFixed(2)}%`);
            console.log(`      Holding ${remainingTokens.toLocaleString()} tokens for second TP (target: ${this.config.secondProfitTargetPercent}%)`);
            console.log(`      Transaction: https://solscan.io/tx/${signature}`);
            console.log(`─────────────────────────────────────────────────`);

            return { success: true, signature };
        } catch (error: any) {
            console.error(`❌ Partial sell failed:`);
            console.error(`   Token: ${position.tokenSymbol}`);
            console.error(`   Error: ${error.message}`);
            console.error(`   Stack: ${error.stack}`);
            console.log(`─────────────────────────────────────────────────`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute sell order using Bags SDK (full sell - for remaining 50% or stop loss)
     */
    private async executeSell(position: TradingPosition): Promise<{ success: boolean; signature?: string; error?: string }> {
        try {
            const tokenMint = new PublicKey(position.mintAddress);
            // If partial, sell remaining tokens; otherwise sell all
            const sellAmount = position.status === 'partial' && position.remainingTokens
                ? Math.floor(position.remainingTokens)
                : Math.floor(position.buyAmountTokens);

            const isStopLoss = position.profitPercent && position.profitPercent <= this.config.stopLossPercent;
            const isSecondTP = position.status === 'partial';

            console.log(`\n╔══════════════════════════════════════════════════════╗`);
            console.log(`║  💸 EXECUTING ${isStopLoss ? 'STOP LOSS' : isSecondTP ? 'FINAL SELL (2nd TP)' : 'SELL'} ORDER               ║`);
            console.log(`╚══════════════════════════════════════════════════════╝`);
            console.log(`   Token: ${position.tokenSymbol} (${position.tokenName})`);
            console.log(`   Mint: ${position.mintAddress.substring(0, 8)}...${position.mintAddress.substring(position.mintAddress.length - 8)}`);
            console.log(`   Selling: ${sellAmount.toLocaleString()} tokens`);
            console.log(`   Original buy price: $${position.buyPrice.toFixed(8)}`);
            if (position.firstSellPrice) {
                console.log(`   First sell price: $${position.firstSellPrice.toFixed(8)}`);
            }

            // Get quote
            const quote = await this.bagsSDK.trade.getQuote({
                inputMint: tokenMint,
                outputMint: SOL_MINT,
                amount: sellAmount,
                slippageMode: 'auto',
            });

            // Create swap transaction
            const swapResult = await this.bagsSDK.trade.createSwapTransaction({
                quoteResponse: quote,
                userPublicKey: this.wallet.publicKey,
            });

            // Sign and send
            const commitment = this.bagsSDK.state.getCommitment();
            const signature = await signAndSendTransaction(
                this.connection,
                commitment,
                swapResult.transaction,
                this.wallet
            );

            console.log(`   ✅ Transaction sent!`);
            console.log(`      Signature: ${signature}`);
            console.log(`      Status: Pending confirmation...`);

            // Wait for confirmation
            console.log(`\n   ⏳ Waiting for confirmation...`);
            await this.connection.confirmTransaction(signature, 'confirmed');
            console.log(`   ✅ Transaction confirmed!`);

            // Update position
            const sellPrice = parseFloat(quote.outAmount) / parseFloat(quote.inAmount) * 1e9;
            const sellTimestamp = Date.now();
            const solReceived = parseFloat(quote.outAmount) / 1e9;

            // Calculate profit based on original buy price
            const profitPercent = ((sellPrice - position.buyPrice) / position.buyPrice) * 100;

            const finalStatus = profitPercent <= this.config.stopLossPercent ? 'stopped' : 'sold';

            this.db.prepare(`
                UPDATE trading_positions
                SET status = ?,
                    sell_price = ?,
                    sell_timestamp = ?,
                    profit_percent = ?
                WHERE id = ?
            `).run(finalStatus, sellPrice, sellTimestamp, profitPercent, position.id);

            console.log(`   ✅ Sell completed!`);
            console.log(`      SOL received: ${solReceived.toFixed(4)} SOL`);
            console.log(`      Final Profit: ${profitPercent.toFixed(2)}%`);
            console.log(`      Status: ${finalStatus.toUpperCase()}`);
            console.log(`      Transaction: https://solscan.io/tx/${signature}`);
            console.log(`─────────────────────────────────────────────────`);

            return { success: true, signature };
        } catch (error: any) {
            console.error(`❌ Sell failed:`);
            console.error(`   Token: ${position.tokenSymbol}`);
            console.error(`   Error: ${error.message}`);
            console.error(`   Stack: ${error.stack}`);
            console.log(`─────────────────────────────────────────────────`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Monitor open positions and check for sell conditions
     */
    private async monitorPositions(): Promise<void> {
        const openPositions = this.db.prepare(`
            SELECT * FROM trading_positions WHERE status IN ('open', 'partial')
        `).all() as TradingPosition[];

        for (const position of openPositions) {
            try {
                // Get current price from DexScreener
                const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${position.mintAddress}`);
                const data = await response.json();

                if (!data.pairs || data.pairs.length === 0) {
                    continue; // No price data available
                }

                const currentPrice = parseFloat(data.pairs[0].priceUsd);
                // For partial positions, calculate profit based on buy price (not first sell price)
                // This ensures we're measuring from initial entry point
                const profitPercent = ((currentPrice - position.buyPrice) / position.buyPrice) * 100;

                // Update position with current price
                this.db.prepare(`
                    UPDATE trading_positions
                    SET current_price = ?, profit_percent = ?
                    WHERE id = ?
                `).run(currentPrice, profitPercent, position.id);

                // Check sell conditions
                if (position.status === 'open' && profitPercent >= this.config.profitTargetPercent) {
                    // First TP: Sell 50% of position
                    console.log(`🎯 First profit target reached for ${position.tokenSymbol} (${profitPercent.toFixed(2)}%) - selling 50%`);
                    await this.executePartialSell(position, 0.5); // Sell 50%
                } else if (position.status === 'partial' && profitPercent >= this.config.secondProfitTargetPercent) {
                    // Second TP: Sell remaining 50% (needs to hit second TP target)
                    console.log(`🎯 Second profit target reached for ${position.tokenSymbol} (${profitPercent.toFixed(2)}%) - selling remaining 50%`);
                    await this.executeSell(position);
                } else if (profitPercent <= this.config.stopLossPercent) {
                    // Stop loss applies to both open and partial positions
                    console.log(`🛑 Stop loss triggered for ${position.tokenSymbol} (${profitPercent.toFixed(2)}%)`);
                    await this.executeSell(position);
                }
            } catch (error: any) {
                console.error(`Failed to monitor position ${position.mintAddress}:`, error.message);
            }
        }
    }

    /**
     * Get runner opportunities (without executing trades - for indicators)
     */
    async getRunnerOpportunities(): Promise<Array<{
        mintAddress: string;
        name: string;
        symbol: string;
        marketCap: number;
        holderCount: number;
        mcapGrowth5m: number;
        volume24h: number;
        reason: string;
    }>> {
        try {
            // Get tokens with recent growth
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
                        t.first_seen_at,
                        s.market_cap,
                        s.holder_count,
                        s.volume_24h,
                        ROW_NUMBER() OVER (PARTITION BY t.mint_address ORDER BY s.timestamp DESC) as rn
                    FROM bags_tokens t
                    LEFT JOIN token_snapshots s ON t.mint_address = s.mint_address
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
                )
                SELECT
                    ls.mint_address,
                    ls.name,
                    ls.symbol,
                    ls.market_cap,
                    ls.holder_count,
                    ls.volume_24h,
                    CASE WHEN s5m.mcap_5m > 0
                        THEN ((ls.market_cap - s5m.mcap_5m) / s5m.mcap_5m * 100)
                        ELSE 0
                    END as mcap_growth_5m
                FROM latest_snapshots ls
                LEFT JOIN closest_5m s5m ON ls.mint_address = s5m.mint_address
                WHERE ls.rn = 1
                  AND ls.market_cap >= ${this.config.minMcap}
                  AND ls.first_seen_at >= ${now - 15 * 60 * 1000}  -- Only tokens from last 15 minutes
            `;

            const tokens = this.db.prepare(query).all() as any[];

            const opportunities: Array<{
                mintAddress: string;
                name: string;
                symbol: string;
                marketCap: number;
                holderCount: number;
                mcapGrowth5m: number;
                volume24h: number;
                reason: string;
            }> = [];

            for (const token of tokens) {
                const shouldBuy = await this.shouldBuyToken(
                    token.mint_address,
                    token.mcap_growth_5m || 0,
                    token.holder_count || 0,
                    token.volume_24h || 0,
                    token.market_cap || 0
                );

                if (shouldBuy) {
                    console.log(`🚀 Runner detected: ${token.symbol} (${token.name})`);
                    opportunities.push({
                        mintAddress: token.mint_address,
                        name: token.name,
                        symbol: token.symbol,
                        marketCap: token.market_cap || 0,
                        holderCount: token.holder_count || 0,
                        mcapGrowth5m: token.mcap_growth_5m || 0,
                        volume24h: token.volume_24h || 0,
                        reason: `Meets runner criteria: ${token.mcap_growth_5m?.toFixed(2)}% growth, ${token.holder_count} holders`
                    });
                    // Only execute buy if trading is enabled
                    if (this.config.enabled) {
                    await this.executeBuy(token.mint_address, token.name, token.symbol);
                    }
                }
            }

            return opportunities;
        } catch (error: any) {
            console.error('Failed to check for runners:', error.message);
            return [];
        }
    }

    /**
     * Check for runner opportunities (alias for getRunnerOpportunities)
     */
    async checkForRunners(): Promise<void> {
        await this.getRunnerOpportunities();
    }

    /**
     * Enable trading (two-step process)
     */
    enableTrading(): void {
        this.config.enabled = true;
        console.log('✅ Trading ENABLED - trades will now execute automatically');
        console.log(`   Wallet: ${this.wallet.publicKey.toBase58()}`);
        console.log(`   Config:`, this.config);
    }

    /**
     * Disable trading (stops executing trades, but continues monitoring)
     */
    disableTrading(): void {
        this.config.enabled = false;
        console.log('⏸️  Trading DISABLED - only monitoring/indicators will run');
    }

    /**
     * Start automated trading monitoring (doesn't enable trading, just starts monitoring)
     */
    startMonitoring(): void {
        if (this.isMonitoring) {
            console.log('Monitoring already active');
            return;
        }

        console.log('👁️  Starting trading monitoring (indicators only)...');
        console.log(`   Wallet: ${this.wallet.publicKey.toBase58()}`);
        console.log(`   Trading Enabled: ${this.config.enabled}`);
        this.isMonitoring = true;

        // Check for runners every 30 seconds
        this.monitoringInterval = setInterval(async () => {
            try {
                // Always check for opportunities (for indicators)
                await this.checkForRunners();
                // Only monitor positions if trading is enabled
                if (this.config.enabled) {
                    await this.monitorPositions();
                }
            } catch (error) {
                console.error('Trading cycle error:', error);
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Start automated trading (legacy - calls startMonitoring)
     */
    startTrading(): void {
        this.startMonitoring();
    }

    /**
     * Stop automated trading monitoring
     */
    stopTrading(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        this.config.enabled = false;
        console.log('🛑 Trading monitoring stopped');
    }

    /**
     * Get current trading status
     */
    getStatus(): { monitoring: boolean; enabled: boolean; config: TradingConfig } {
        return {
            monitoring: this.isMonitoring,
            enabled: this.config.enabled,
            config: this.config,
        };
    }

    /**
     * Get all positions
     */
    getPositions(status?: 'open' | 'sold' | 'stopped' | 'partial'): TradingPosition[] {
        if (status) {
            return this.db.prepare(`
                SELECT * FROM trading_positions WHERE status = ? ORDER BY buy_timestamp DESC
            `).all(status) as TradingPosition[];
        }
        return this.db.prepare(`
            SELECT * FROM trading_positions ORDER BY buy_timestamp DESC
        `).all() as TradingPosition[];
    }

    /**
     * Update trading configuration
     */
    updateConfig(config: Partial<TradingConfig>): void {
        // Merge config, preserving existing values if not provided
        this.config = {
            ...this.config,
            ...config,
            // Ensure enabled flags are boolean
            minMcapGrowthEnabled: config.minMcapGrowthEnabled !== undefined ? config.minMcapGrowthEnabled : this.config.minMcapGrowthEnabled,
            minHoldersEnabled: config.minHoldersEnabled !== undefined ? config.minHoldersEnabled : this.config.minHoldersEnabled,
            minVolumeEnabled: config.minVolumeEnabled !== undefined ? config.minVolumeEnabled : this.config.minVolumeEnabled,
        };
        console.log('📝 Trading config updated:', JSON.stringify(this.config, null, 2));
    }
}
