import { MongoClient, type Collection, type Db } from 'mongodb';

let client: MongoClient;
let db: Db;

export async function connectMongo(uri: string): Promise<void> {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  console.log('Connected to MongoDB Atlas');
}

/**
 * MongoDB-backed store that mirrors the synchronous Store<T> interface.
 * Data is cached in memory; writes persist to MongoDB in the background.
 * Call `await store.init()` once after connectMongo() before using.
 */
export class MongoStore<T extends { id: string }> {
  private items: Map<string, T> = new Map();
  private collection: Collection;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.collection = db.collection(name);
  }

  /** Load all docs from MongoDB into memory. Call once at startup. */
  async init(): Promise<void> {
    const docs = await this.collection.find().toArray();
    for (const doc of docs) {
      const { _id, ...rest } = doc as any;
      this.items.set(rest.id, rest as T);
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
    this.collection.updateOne(
      { id: item.id },
      { $set: item as any },
      { upsert: true },
    ).catch(err => console.error(`[MongoStore:${this.name}] create error:`, err));
    return item;
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const existing = this.items.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, id } as T;
    this.items.set(id, updated);
    this.collection.updateOne(
      { id },
      { $set: updated as any },
    ).catch(err => console.error(`[MongoStore:${this.name}] update error:`, err));
    return updated;
  }

  delete(id: string): boolean {
    const result = this.items.delete(id);
    if (result) {
      this.collection.deleteOne({ id })
        .catch(err => console.error(`[MongoStore:${this.name}] delete error:`, err));
    }
    return result;
  }

  clear(): void {
    this.items.clear();
    this.collection.deleteMany({})
      .catch(err => console.error(`[MongoStore:${this.name}] clear error:`, err));
  }

  seed(items: T[]): void {
    if (this.items.size === 0) {
      items.forEach(item => this.items.set(item.id, item));
      // Spread each item to avoid insertMany mutating originals with _id
      this.collection.insertMany(items.map(i => ({ ...i })) as any[])
        .catch(err => console.error(`[MongoStore:${this.name}] seed error:`, err));
    }
  }
}
