import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // Always check fresh

export async function GET() {
    try {
        const versionPath = path.join(process.cwd(), 'public', 'version.json');
        if (fs.existsSync(versionPath)) {
            const versionData = fs.readFileSync(versionPath, 'utf8');
            return NextResponse.json(JSON.parse(versionData));
        }
        return NextResponse.json({ version: 'dev', timestamp: new Date().toISOString() });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read version' }, { status: 500 });
    }
}
