import fastify from 'fastify';
import cors from '@fastify/cors';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { HeliusScanner as TokenScanner } from './services/heliusScanner';
import { AutoTrader } from './services/autoTrader';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { BagsSDK, signAndSendTransaction } from '@bagsfm/bags-sdk';

// Load Environment Variables (Auto-detect or use override)
// Find .env file by searching up the directory tree
function findEnvFile(): string {
    const fs = require('fs');

    // If explicit path provided, use it
    if (process.env.ENV_PATH) {
        const explicitPath = path.resolve(process.env.ENV_PATH);
        if (fs.existsSync(explicitPath)) {
            return explicitPath;
        }
    }

    // Search up the directory tree for .env file
    let currentDir = process.cwd();
    const rootPath = path.parse(currentDir).root; // Get root (C:\ or /)

    while (currentDir !== rootPath) {
        const envPath = path.join(currentDir, '.env');
        if (fs.existsSync(envPath)) {
            return envPath;
        }
        // Move up one directory
        currentDir = path.dirname(currentDir);
    }

    // Fallback to relative .env
    return '.env';
}

const envPath = findEnvFile();
dotenv.config({ path: envPath });
console.log(`🔧 Loading Env from: ${path.resolve(envPath)}`);
console.log(`   Current working directory: ${process.cwd()}`);

const server = fastify({ logger: true });

// CONFIGURABLE GATING
const WHITELIST = (process.env.WHITELIST_ADDRESSES || "").split(',').map(a => a.trim());
// Tiers can be configured via Env, defaulting to the User's requested 10M / 100M
const TIER_1_THRESHOLD = parseFloat(process.env.TIER_1_THRESHOLD || "10000000"); // 10 Million
const TIER_2_THRESHOLD = parseFloat(process.env.TIER_2_THRESHOLD || "100000000"); // 100 Million
const GATING_MODE = process.env.GATING_MODE || "TOKEN"; // "TOKEN" or "USD"

// DATABASE: SQLite
// Use absolute path in production to avoid CWD issues
const dbPath = process.env.NODE_ENV === 'production'
    ? '/var/www/bagsscan/bagsscan.db'
    : (process.env.DATABASE_PATH || path.join(process.cwd(), 'bagsscan.db'));

const db = new Database(dbPath);
console.log(`📂 Database Path: ${dbPath}`);

// Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS system_stats (
        id INTEGER PRIMARY KEY,
        token_price TEXT NOT NULL,
        market_cap TEXT NOT NULL,
        burn_rate TEXT NOT NULL,
        next_cycle DATETIME NOT NULL,
        treasury_balance TEXT NOT NULL,
        is_connected BOOLEAN NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

`);

// IN-MEMORY WEBSOCKET CLIENT TRACKING
const scannerClients = new Set<WebSocket>(); // Scanner update clients

// INITIALIZE SCANNER
const tokenScanner = new TokenScanner(db);

// INITIALIZE AUTO TRADER (if private key is available)
let autoTrader: AutoTrader | null = null;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const BAGS_API_KEY = process.env.BAGS_API_KEY || process.env.BAGS_PARTNER_API_KEY;
const SOLANA_RPC = process.env.SOLANA_RPC || process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=10f7605c-3004-4638-9562-b911c4714150';
// Guardrail: disable server-funded token deploys unless explicitly enabled
const ALLOW_SERVER_FUNDED_TOKEN_DEPLOYS = process.env.ALLOW_SERVER_FUNDED_TOKEN_DEPLOYS === 'true';

if (AGENT_PRIVATE_KEY && BAGS_API_KEY) {
    try {
        const traderConnection = new Connection(SOLANA_RPC, 'confirmed');
        const traderSDK = new BagsSDK(BAGS_API_KEY, traderConnection, 'confirmed');
        autoTrader = new AutoTrader(db, traderConnection, traderSDK, AGENT_PRIVATE_KEY);
        console.log('🤖 Auto Trader initialized (monitoring mode - trading disabled by default)');
    } catch (error: any) {
        console.error('⚠️  Failed to initialize Auto Trader:', error.message);
    }
} else {
    console.log('⚠️  Auto Trader disabled (AGENT_PRIVATE_KEY or BAGS_API_KEY not set)');
}

server.register(cors, { origin: '*' });

// AUTH ENDPOINT
server.post('/auth/verify', async (req, reply) => {
    const { wallet, signature, message } = req.body as { wallet: string, signature: string, message: string };

    try {
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = bs58.decode(wallet);

        const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

        if (!verified) {
            return reply.code(401).send({ error: "Invalid Signature" });
        }

        // TIER EVALUATION
        const isWhitelisted = WHITELIST.includes(wallet);
        let tier = "PUBLIC";

        if (isWhitelisted) {
            tier = "HOLDER_100M"; // Whitelist bypasses to top tier
        } else {
            // TODO: INTEGRATE HELIUS API HERE FOR REAL BALANCE CHECK
            // For now, we simulate success for anyone who signs properly
            // In next step, we add the actual Helius Call
            tier = "HOLDER_10M";
        }

        return { status: "ok", tier, wallet, mode: GATING_MODE, thresholds: { t1: TIER_1_THRESHOLD, t2: TIER_2_THRESHOLD } };

    } catch (e) {
        console.error(e);
        return reply.code(400).send({ error: "Auth Process Failed" });
    }
});

server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date() };
});

server.get('/stats', async () => {
    try {
        const row = db.prepare('SELECT * FROM system_stats ORDER BY updated_at DESC LIMIT 1').get() as any;
        if (!row) {
            return { tokenPrice: "---", marketCap: "---", burnRate: "---", nextCycle: Date.now(), treasuryBalance: "---", isConnected: false };
        }
        return {
            tokenPrice: row.token_price,
            marketCap: row.market_cap,
            burnRate: row.burn_rate,
            nextCycle: new Date(row.next_cycle).getTime(),
            treasuryBalance: row.treasury_balance,
            isConnected: row.is_connected === 1
        };
    } catch (e) {
        return { tokenPrice: "---", marketCap: "---", burnRate: "---", nextCycle: Date.now(), treasuryBalance: "---", isConnected: false };
    }
});


// BAGSSCAN ENDPOINTS
server.get('/scanner/tokens', async (req, reply) => {
    const query = req.query as any;

    const filters = {
        minMcap: query.minMcap ? parseFloat(query.minMcap) : 0,
        maxMcap: query.maxMcap ? parseFloat(query.maxMcap) : undefined,
        minHolders: query.minHolders ? parseInt(query.minHolders) : 0,
        minMcapGrowth: query.minMcapGrowth ? parseFloat(query.minMcapGrowth) : 0,
        minHolderGrowth: query.minHolderGrowth ? parseFloat(query.minHolderGrowth) : 0,
        maxAgeHours: query.maxAgeHours ? parseInt(query.maxAgeHours) : undefined,
        sortBy: query.sortBy || 'marketCap',
        sortOrder: (query.sortOrder || 'desc') as 'asc' | 'desc',
        limit: query.limit ? parseInt(query.limit) : 50,
    };

    try {
        const tokens = await tokenScanner.getTokens(filters);
        return { success: true, tokens, count: tokens.length };
    } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
    }
});

server.post('/scanner/add-token', async (req, reply) => {
    const { mintAddress, creatorAddress } = req.body as { mintAddress: string, creatorAddress: string };

    if (!mintAddress) {
        return reply.code(400).send({ success: false, error: 'mintAddress required' });
    }

    try {
        await tokenScanner.addToken(mintAddress, creatorAddress || 'unknown');
        return { success: true, message: 'Token added and tracking initiated' };
    } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
    }
});

server.post('/scanner/update-all', async (req, reply) => {
    try {
        await tokenScanner.updateAllTokens();
        return { success: true, message: 'All tokens updated' };
    } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
    }
});

// TRADING ENDPOINTS
if (autoTrader) {
    // Get trading opportunities (indicators - no trades executed)
    server.get('/trading/opportunities', async (req, reply) => {
        try {
            const opportunities = await autoTrader!.getRunnerOpportunities();
            return { success: true, opportunities, count: opportunities.length };
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message });
        }
    });

    // Get trading status
    server.get('/trading/status', async (req, reply) => {
        try {
            const status = autoTrader!.getStatus();
            return { success: true, ...status };
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message });
        }
    });

    // Enable trading (step 1 of 2)
    server.post('/trading/enable', async (req, reply) => {
        try {
            autoTrader!.enableTrading();
            return { success: true, message: 'Trading enabled - trades will now execute' };
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message });
        }
    });

    // Disable trading (stops executing trades)
    server.post('/trading/disable', async (req, reply) => {
        try {
            autoTrader!.disableTrading();
            return { success: true, message: 'Trading disabled - monitoring continues' };
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message });
        }
    });

    // Start monitoring (step 2 of 2 - separate from enable)
    server.post('/trading/start-monitoring', async (req, reply) => {
        try {
            autoTrader!.startMonitoring();
            return { success: true, message: 'Monitoring started' };
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message });
        }
    });

    // Stop monitoring
    server.post('/trading/stop', async (req, reply) => {
        try {
            autoTrader!.stopTrading();
            return { success: true, message: 'Trading stopped' };
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message });
        }
    });

    server.get('/trading/positions', async (req, reply) => {
        try {
            const query = req.query as { status?: 'open' | 'sold' | 'stopped' | 'partial' };
            const status = query.status;
            const positions = autoTrader!.getPositions(status);
            return { success: true, positions, count: positions.length };
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message });
        }
    });

    server.post('/trading/config', async (req, reply) => {
        try {
            const config = req.body as any;
            autoTrader!.updateConfig(config);
            // Return the config that was just set
            return { success: true, message: 'Config updated', config };
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message });
        }
    });

    // Manually trigger buy for specific token
    server.post('/trading/buy', async (req, reply) => {
        try {
            const { mintAddress, tokenName, tokenSymbol } = req.body as {
                mintAddress: string;
                tokenName: string;
                tokenSymbol: string;
            };

            if (!mintAddress || !tokenName || !tokenSymbol) {
                return reply.code(400).send({
                    success: false,
                    error: 'mintAddress, tokenName, and tokenSymbol are required',
                });
            }

            console.log(`\n🎯 MANUAL BUY TRIGGERED`);
            console.log(`   Requested by API`);
            const result = await autoTrader!.executeBuy(mintAddress, tokenName, tokenSymbol);

            if (result.success) {
                return {
                    success: true,
                    message: 'Buy executed successfully',
                    signature: result.signature,
                };
            } else {
                return reply.code(400).send({
                    success: false,
                    error: result.error || 'Buy failed',
                });
            }
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message });
        }
    });
} else {
    // Return error if trader not initialized
    server.post('/trading/*', async (req, reply) => {
        return reply.code(503).send({
            success: false,
            error: 'Trading not available. Set AGENT_PRIVATE_KEY and BAGS_API_KEY in .env'
        });
    });
}

server.post('/scanner/backtest', async (req, reply) => {
    const { hours } = req.body as { hours?: number };
    const hoursAgo = hours || 6; // Default 6 hours

    try {
        const tokensFound = await tokenScanner.backtestPastLaunches(hoursAgo);
        return { success: true, message: `Backtest complete`, tokensFound, hoursAgo };
    } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
    }
});

// BAGSSTUDIO ENDPOINTS - Website Generation & Token Deployment
server.post('/bagsstudio/generate-website', async (req, reply) => {
    const { tokenName, colors, features, description } = req.body as {
        tokenName: string;
        colors?: string;
        features?: string[];
        description?: string;
    };

    if (!tokenName) {
        return reply.code(400).send({ success: false, error: 'tokenName required' });
    }

    try {
        // Generate website using OpenAI (GPT-4o)
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
            return reply.code(503).send({ success: false, error: 'OPENAI_API_KEY not configured' });
        }

        const prompt = `
You are a senior creative technologist designing a boutique, high-end interactive microsite.
Avoid generic AI layouts, stock gradients, excessive emojis, or childish meme styles.

Generate a complete, production-ready React + TypeScript + Tailwind CSS website.

Project:
Name: ${tokenName}
Colors: ${colors || 'tasteful, restrained, modern'}
Features: ${(features || ['hero section', 'tokenomics']).join(', ')}
Description: ${description || 'A modern experimental Solana project'}

Design Philosophy:
- Cute but restrained: playful motion and shapes, not cartoonish visuals
- Modern, intentional, product-grade
- Subtle humor through motion and interaction, not jokes or memes
- No rainbow gradients, no comic fonts, no emoji spam

Slop Machine Motif:
- Repeating modular elements (tiles, tokens, nodes, or glyphs)
- Hypnotic looping or recursive motion
- Visual metaphor of a machine endlessly producing variations
- Motif should appear in the hero or background and subtly animate

Interaction & Motion:
- Use Framer Motion for animation
- Include at least one continuous motion system (drifting tiles, orbiting elements, conveyor-like movement, or recursive loops)
- Animations should be smooth, slow, and deliberate—not flashy
- Use transforms (translate, rotate, scale) and opacity only
- No scroll hijacking or parallax libraries

Typography:
- Use a modern grotesk or neo-grotesk sans-serif
- Strong hierarchy with large headlines and comfortable body text
- Generous whitespace and clear line-height
- Avoid thin fonts and excessive letter spacing
- Text should feel designed, not like default Tailwind

Layout:
- Avoid generic 3-card feature grids
- Prefer asymmetry, staggered sections, or offset columns
- At least one section should visually break the vertical flow (horizontal band, pinned area, or looping container)
- Overall layout should feel like an experimental product microsite, not a generic landing page

Technical Requirements:
- Single-page React app
- TypeScript
- Tailwind CSS
- Responsive across mobile, tablet, and desktop
- Clean, readable, well-structured components

Footer:
- Include footer credit: "Built with 🎨 BagsStudio"

Output Rules:
- Return ONLY valid JSON
- Do NOT wrap JSON in markdown code fences
- Do NOT include explanations, comments, or prose outside the JSON
- All files must be complete and runnable
- No placeholder text like "Lorem ipsum"

JSON Structure:
{
  "files": [
    { "path": "src/App.tsx", "content": "..." },
    { "path": "src/index.css", "content": "..." }
  ]
}
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            })
        });

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        // Parse JSON from AI response (handle markdown code blocks)
        let filesData;
        try {
            const jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```/) || aiResponse.match(/\{[\s\S]*\}/);
            filesData = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : aiResponse);
        } catch (e) {
            console.error('Failed to parse AI response:', aiResponse.substring(0, 200));
            return reply.code(500).send({ success: false, error: 'Invalid AI response format' });
        }

        return { success: true, files: filesData.files };
    } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
    }
});

server.post('/bagsstudio/deploy-token', async (req, reply) => {
    // Hard guard so your server wallet never pays for user launches by accident
    if (!ALLOW_SERVER_FUNDED_TOKEN_DEPLOYS) {
        return reply.code(503).send({
            success: false,
            error: 'Server-funded token deployment is disabled. Use the Studio token launch flow where clients pay their own fees.'
        });
    }
    const { name, symbol, description, imageUrl, websiteUrl, twitterUrl, telegramUrl, initialBuySOL } = req.body as {
        name: string;
        symbol: string;
        description?: string;
        imageUrl?: string;
        websiteUrl?: string;
        twitterUrl?: string;
        telegramUrl?: string;
        initialBuySOL?: number;
    };

    if (!name || !symbol) {
        return reply.code(400).send({ success: false, error: 'name and symbol required' });
    }

    if (!AGENT_PRIVATE_KEY || !BAGS_API_KEY) {
        return reply.code(503).send({
            success: false,
            error: 'Token deployment unavailable. Set AGENT_PRIVATE_KEY and BAGS_API_KEY in .env'
        });
    }

    try {
        console.log(`🚀 Deploying token: ${name} ($${symbol})`);
        console.log(`   Description: ${description || 'A new Solana token'}`);
        console.log(`   Initial Buy: ${initialBuySOL || 0.1} SOL`);

        // Initialize BagsSDK
        const connection = new Connection(SOLANA_RPC, 'confirmed');
        const sdk = new BagsSDK(BAGS_API_KEY, connection, 'confirmed');

        // Parse wallet keypair
        let walletKeypair: Keypair;
        try {
            // Try parsing as base58-encoded secret key
            const secretKey = bs58.decode(AGENT_PRIVATE_KEY);
            walletKeypair = Keypair.fromSecretKey(secretKey);
        } catch {
            // Try parsing as JSON array
            const secretKeyArray = JSON.parse(AGENT_PRIVATE_KEY);
            const secretKey = new Uint8Array(secretKeyArray);
            walletKeypair = Keypair.fromSecretKey(secretKey);
        }

        console.log(`   Wallet: ${walletKeypair.publicKey.toBase58()}`);

        // Check wallet balance
        const balance = await connection.getBalance(walletKeypair.publicKey);
        const balanceSOL = balance / 1e9;
        const requiredSOL = (initialBuySOL || 0.1) + 0.05; // Buy amount + fees

        if (balanceSOL < requiredSOL) {
            return reply.code(400).send({
                success: false,
                error: `Insufficient balance. Have ${balanceSOL.toFixed(2)} SOL, need ${requiredSOL.toFixed(2)} SOL`
            });
        }

        console.log(`   Balance: ${balanceSOL.toFixed(2)} SOL ✅`);

        // Step 1: Create token metadata
        console.log(`\n📝 Creating token metadata...`);
        const { tokenMint, tokenMetadata } = await sdk.tokenLaunch.createTokenInfoAndMetadata({
            imageUrl: imageUrl || 'https://via.placeholder.com/512',
            name,
            symbol,
            description: description || `${name} - A new token on Solana`
        });

        console.log(`   Mint: ${tokenMint}`);
        console.log(`   Metadata: ${tokenMetadata}`);

        // Step 2: Create fee share config with 50/50 split
        console.log(`\n⚙️  Setting up fee configuration (50/50 split)...`);

        const platformWallet = process.env.BAGSSTUDIO_PLATFORM_WALLET;
        if (!platformWallet) {
            return reply.code(500).send({
                success: false,
                error: 'Platform wallet not configured. Set BAGSSTUDIO_PLATFORM_WALLET in .env'
            });
        }

        const { meteoraConfigKey } = await sdk.config.createBagsFeeShareConfig({
            payer: walletKeypair.publicKey,
            baseMint: new PublicKey(tokenMint),
            feeClaimers: [
                {
                    user: walletKeypair.publicKey,
                    userBps: 5000 // Creator: 50%
                },
                {
                    user: new PublicKey(platformWallet),
                    userBps: 5000 // BagsStudio Platform: 50%
                }
            ]
        });

        const configKey = meteoraConfigKey;

        console.log(`   Fee Config: ${configKey.toBase58()}`);
        console.log(`   Creator gets: 50% | Platform gets: 50%`);

        // Step 3: Create launch transaction
        console.log(`\n🔨 Creating launch transaction...`);
        const initialBuyLamports = Math.floor((initialBuySOL || 0.1) * 1e9);

        const transaction = await sdk.tokenLaunch.createLaunchTransaction({
            metadataUrl: tokenMetadata,
            tokenMint: new PublicKey(tokenMint),
            launchWallet: walletKeypair.publicKey,
            initialBuyLamports,
            configKey
        });

        console.log(`   Transaction created`);

        // Step 4: Sign and send transaction
        console.log(`\n📡 Sending transaction to Solana...`);
        const signature = await signAndSendTransaction(
            connection,
            'confirmed',
            transaction,
            walletKeypair
        );

        console.log(`\n✅ Token deployed successfully!`);
        console.log(`   Signature: ${signature}`);
        console.log(`   Mint: ${tokenMint}`);
        console.log(`   Bags.fm: https://bags.fm/token/${tokenMint}\n`);

        return {
            success: true,
            mint: tokenMint,
            signature,
            metadata: tokenMetadata,
            feeConfig: configKey.toBase58(),
            bagsUrl: `https://bags.fm/token/${tokenMint}`,
            explorer: `https://solscan.io/tx/${signature}`
        };

    } catch (error: any) {
        console.error('\n❌ Token deployment failed:', error);
        return reply.code(500).send({
            success: false,
            error: error.message,
            details: error.stack
        });
    }
});

const TOKEN_MINT = process.env.TOKEN_MINT || ""; // No default project token

// BACKGROUND: Price Tracker Service
async function updateSystemStats() {
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_MINT}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.pairs && data.pairs.length > 0) {
            const pair = data.pairs[0];
            const price = parseFloat(pair.priceUsd);
            const mcap = pair.fdv || (price * 1_000_000_000); // Fallback to 1B supply

            const priceStr = `$${price.toFixed(6)}`;
            const mcapStr = `$${(mcap / 1000).toFixed(1)}k`;
            const burnRate = "0.0%"; // Placeholder for now
            const treasury = "0 SOL"; // Placeholder

            // Insert into DB
            db.prepare(`
                INSERT INTO system_stats (token_price, market_cap, burn_rate, next_cycle, treasury_balance, is_connected)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(priceStr, mcapStr, burnRate, new Date(Date.now() + 3600000).toISOString(), treasury, 1);

            console.log(`Updated Stats: Price ${priceStr}, MCAP ${mcapStr}`);
        }
    } catch (e) {
        console.error("Failed to update price stats:", e);
    }
}

const start = async () => {
    try {
        // Start Price Tracker (Every 30s)
        setInterval(updateSystemStats, 30000);
        updateSystemStats(); // Run immediately

        // Start Token Scanner (continuous scanning for new launches + updates)
        // Uses WebSocket monitoring for real-time detection
        console.log('🔍 Starting BagsScan continuous scanning...');
        tokenScanner.startContinuousScanning();
        // Note: WebSocket monitoring is started automatically and runs continuously
        // Token updates happen every 30 seconds (handled internally)

        // Start Auto Trader monitoring (if initialized) - trading disabled by default
        if (autoTrader) {
            console.log('👁️  Starting trading monitoring (indicators only - trading disabled)...');
            autoTrader.startMonitoring();
        }

        const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`API listening on port ${port} (Redis-free mode)`);

        // SCANNER UPDATES WEBSOCKET SERVER
        const scannerWss = new WebSocketServer({ server: server.server, path: '/scanner/updates' });

        scannerWss.on('connection', (socket: WebSocket) => {
            console.log("📡 New Scanner WebSocket Connection");
            scannerClients.add(socket);

            socket.on('close', () => {
                scannerClients.delete(socket);
                console.log("Scanner WebSocket Disconnected");
            });

            socket.on('error', (error: Error) => {
                console.error("Scanner WebSocket Error:", error);
            });
        });

        console.log("📡 Scanner WebSocket Server ready on /scanner/updates");

        // Export broadcast function for scanner to use
        (global as any).broadcastScannerUpdate = (data: any) => {
            const msg = JSON.stringify(data);
            for (const client of scannerClients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(msg);
                }
            }
        };

    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
