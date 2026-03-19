import fs from 'fs';
import path from 'path';

export class Store<T extends { id: string }> {
  private items: Map<string, T> = new Map();
  private persistPath?: string;

  constructor(name: string, persist = false) {
    if (persist) {
      const dataDir = path.join(process.cwd(), '.data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      this.persistPath = path.join(dataDir, `${name}.json`);
      this.load();
    }
  }

  private load(): void {
    if (!this.persistPath) return;
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8')) as T[];
        data.forEach((item) => this.items.set(item.id, item));
      }
    } catch {
      // Start fresh on parse errors
    }
  }

  private save(): void {
    if (!this.persistPath) return;
    try {
      fs.writeFileSync(this.persistPath, JSON.stringify(this.getAll(), null, 2));
    } catch {
      // Ignore write errors
    }
  }

  getAll(): T[] {
    return Array.from(this.items.values());
  }

  getById(id: string): T | undefined {
    return this.items.get(id);
  }

  findBy(predicate: (item: T) => boolean): T | undefined {
    return this.getAll().find(predicate);
  }

  filterBy(predicate: (item: T) => boolean): T[] {
    return this.getAll().filter(predicate);
  }

  create(item: T): T {
    this.items.set(item.id, item);
    this.save();
    return item;
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const existing = this.items.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, id };
    this.items.set(id, updated);
    this.save();
    return updated;
  }

  delete(id: string): boolean {
    const result = this.items.delete(id);
    if (result) this.save();
    return result;
  }

  clear(): void {
    this.items.clear();
    this.save();
  }

  seed(items: T[]): void {
    if (this.items.size === 0) {
      items.forEach((item) => this.items.set(item.id, item));
      this.save();
    }
  }
}
