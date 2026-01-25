import dotenv from 'dotenv';
dotenv.config();

const BAGS_API_URL = process.env.BAGS_API_URL || 'https://public-api-v2.bags.fm/api/v1';
const BAGS_API_KEY = process.env.BAGS_API_KEY;

if (!BAGS_API_KEY) {
    console.warn("⚠️  WARNING: BAGS_API_KEY not set. Bags.fm API calls will fail.");
}

export interface BagsTokenCreator {
    publicKey: string;
    createdAt: number;
    tokenMint: string;
    tokenName: string;
    tokenSymbol: string;
    tokenImage?: string;
}

export interface BagsClaimStats {
    totalClaimed: number;
    totalFees: number;
}

/**
 * Bags.fm API Client
 * Docs: https://docs.bags.fm/api-reference/introduction
 */
export class BagsClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey?: string, baseUrl?: string) {
        this.apiKey = apiKey || BAGS_API_KEY || '';
        this.baseUrl = baseUrl || BAGS_API_URL;
    }

    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            ...options?.headers,
        };

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Bags API Error (${response.status}): ${error}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(`Bags API Error: ${data.error || 'Unknown error'}`);
        }

        return data.response as T;
    }

    /**
     * Get all token creators (v3)
     * Endpoint: GET /token-launch/creator/v3
     * Returns all token launches from bags.fm
     */
    async getTokenCreators(): Promise<BagsTokenCreator[]> {
        const endpoint = `/token-launch/creator/v3`;
        return this.request<BagsTokenCreator[]>(endpoint);
    }

    /**
     * Get lifetime fees for a token
     * Endpoint: GET /token-launch/lifetime-fees?token_mint=<mint>
     */
    async getLifetimeFees(tokenMint: string): Promise<{ totalFees: number }> {
        return this.request<{ totalFees: number }>(`/token-launch/lifetime-fees?token_mint=${tokenMint}`);
    }

    /**
     * Get claim stats for a user
     * Endpoint: GET /token-launch/claim-stats?publicKey=<key>
     */
    async getClaimStats(publicKey: string): Promise<BagsClaimStats> {
        return this.request<BagsClaimStats>(`/token-launch/claim-stats?publicKey=${publicKey}`);
    }

    /**
     * Get claimable positions for a token
     * Endpoint: GET /token-launch/claimable-positions?publicKey=<key>
     */
    async getClaimablePositions(publicKey: string): Promise<any> {
        return this.request(`/token-launch/claimable-positions?publicKey=${publicKey}`);
    }
}

export const bagsClient = new BagsClient();
