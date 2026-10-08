import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const CONFIG_FILE = path.join(DATA_DIR, 'tools-personalization.json');

// Load initial value from disk on startup
let currentPayload: string;
try {
  currentPayload = fs.readFileSync(CONFIG_FILE, 'utf-8');
} catch {
  currentPayload = '{}';
}

export function getToolsPayload(): string {
  return currentPayload;
}

export function setToolsPayload(payload: string): void {
  currentPayload = payload;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, payload);
  } catch {
    // In-memory update still works even if disk write fails
  }
}
