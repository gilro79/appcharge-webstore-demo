import type { Response } from 'express';
import type { ApiLogEntry } from 'shared/src/types.js';

class SSEManager {
  private clients: Set<Response> = new Set();

  addClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    this.clients.add(res);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(entry: ApiLogEntry): void {
    const data = JSON.stringify(entry);
    for (const client of this.clients) {
      client.write(`data: ${data}\n\n`);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
