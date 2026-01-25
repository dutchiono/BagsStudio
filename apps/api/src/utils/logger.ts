import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const SCANNER_LOG = path.join(LOG_DIR, 'scanner.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function logToFile(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = data
        ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n\n`
        : `[${timestamp}] ${message}\n`;

    // Also log to console
    console.log(message, data || '');

    // Append to file
    fs.appendFileSync(SCANNER_LOG, logEntry);
}

export function clearScannerLog() {
    if (fs.existsSync(SCANNER_LOG)) {
        fs.unlinkSync(SCANNER_LOG);
    }
    logToFile('🆕 Scanner log started');
}
