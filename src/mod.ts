import { appendFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { TextLineStream } from "@std/streams";
import { JsonParseStream } from "@std/json";

type LockType = "collection" | "row";

type Id = string;
type Collection = string;

// deno-lint-ignore no-explicit-any
type Schema = Record<string, any>;

type DatabaseRow = {
  record: Schema;
  _meta: {
    pk?: string;
    sk?: string;
    readonly?: string[];
    schema?: Record<string, string>;
  };
};
type DatabaseRowReturn<T> = DatabaseRow & { record: T & Schema };
type KeyRecord = Record<Id, DatabaseRow>;
type DatabaseDataType = Record<Collection, KeyRecord>;

type WALEntry = {
  op: "insert" | "update" | "delete";
  collection: string;
  id: string;
  data?: unknown;
  query?: unknown;
};

export const replacer = (_key: unknown, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;

/**
 * PetiteDB is a simple in-memory database with file persistence using JSON.
 *
 * @class PetiteDB
 */
export class PetiteDB<C extends string> {
  private dbFilePath: string;
  private data: DatabaseDataType;
  private lock: boolean;

  private autoId: boolean;
  private autoCommit: boolean;

  private locks: Map<string, { type: LockType; ids?: Set<string> }>;

  private walLogPath?: string;

  private writeCount: number;
  private maxWritesBeforeFlush: number;
  private saveQueue: Promise<void> = Promise.resolve();

  private memoryOnly: boolean;

  /**
   * Constructs a new instance of PetiteDB with the given file path.
   *
   * @param {string} filePath - The file path for the database file.
   * @param {Object} options - Optional configuration options for the database.
   * @param {boolean} [options.autoCommit=true] [default: true] - If true, the database will be commitd automatically after each operation.
   * @param {boolean} [options.autoId=false] [default: false] - If true, a unique identifier will be generated automatically.
   * @param {boolean} [options.watch=false] [default: false] - (Experimental/Unstable) If true, It sets a fs watch to reload the db file when modified.
   * @param {boolean} [options.walLogPath="db_name.wal.log"] [default: "db_name.wal.log"] - Can rename the WAL file
   * @param {boolean} [options.maxWritesBeforeFlush=100] [default: 100] - Number of entries before saving on-disk
   * @param {boolean} [options.memoryOnly=false] [default: false] - Ephemeral DB only
   *
   * @class PetiteDB
   */
  constructor(
    filePath: string,
    options?: {
      autoCommit?: boolean;
      autoId?: boolean;
      watch?: boolean;
      walLogPath?: string;
      maxWritesBeforeFlush?: number;
      memoryOnly?: boolean;
    },
  ) {
    Deno.mkdirSync(dirname(filePath), {recursive: true})
    this.dbFilePath = filePath;

    this.data = {};
    this.lock = false;

    this.locks = new Map();

    this.autoCommit = options?.autoCommit === undefined
      ? true
      : options?.autoCommit;
    this.autoId = options?.autoId === undefined ? false : options?.autoId;

    if (options?.watch === true) {
      this.watch();
    }

    this.writeCount = 0;
    this.maxWritesBeforeFlush = options?.maxWritesBeforeFlush || 100;

    if (options?.memoryOnly === true) {
      this.memoryOnly = true;
    } else {
      this.memoryOnly = false;

      Deno.mkdirSync("wal", { recursive: true });
      this.walLogPath = options?.walLogPath ||
        `wal/${basename(filePath, extname(filePath))}.wal.log`;

      this.setupShutdownHook();
    }
  }

  /**
   * Returns the in memory data
   */
  public GetData(): DatabaseDataType {
    return this.data;
  }

  /**
   * Loads the database from the file system.
   * Rebuild the WAL (if anything in it)
   * Create database if empty
   */
  public async load(): Promise<void> {
    if (this.memoryOnly === true) {
      this.data = {};
      return;
    }

    if (existsSync(this.dbFilePath)) {
      const fileData = Deno.readTextFileSync(this.dbFilePath);
      try {
        this.data = JSON.parse(fileData);
      } catch (_) {
        // console.error((e as Error).message);
        console.log("Rebuilding file structure using an empty database.");
        this.data = {};
      }
      // console.log("Database loaded");

      if (this.walLogPath) {
        // console.log("Restoring WAL");
        await this.replay(this.defaultApply(this));
        await this.flush();
        await this.truncate();
        // console.log("WAL Restored");
      }
    }

    console.log("Database is ready");
  }

  /*
   * Watch the db file path for external updates and reload the changes if any.
   * Useful when debugging and doing manual editing of the file.
   */
  public async watch(): Promise<void> {
    const watcher = Deno.watchFs(this.dbFilePath, { recursive: false });

    // NOTE: Known issue, it triggers the event twice. (noticed on deno 2.1.4 and 2.1.5)
    // This is a debug-only feature, will investigate later.
    // Handle file changes
    for await (const event of watcher) {
      if (event.kind === "modify") {
        while (this.lock) {
          console.warn("[Watch] Database is locked or inaccessible");
        }

        this.lock = true;
        const fileData = Deno.readTextFileSync(this.dbFilePath);
        this.data = JSON.parse(fileData);
        this.lock = false;
      }
    }
  }

  /**
   * Commits the current state of the database to the file system after maxWritesBeforeFlush is reached.
   */
  public commit(): Promise<void> {
    this.saveQueue = this.saveQueue.then(async () => {
      try {
        if (++this.writeCount >= this.maxWritesBeforeFlush) {
          this.writeCount = 0;
          await this.flush(); // writes full DB and truncates WAL
        }
      } catch (err) {
        console.error("[commit] WAL write failed:", err);
      }
    });

    return this.saveQueue;
  }

  /**
   * Commits the current state of the database to the file system
   */
  public async flush(): Promise<void> {
    while (this.lock) {
      // console.warn("[Flush] Database is locked or inaccessible");
    }

    this.lock = true;

    for (const [collection, rows] of Object.entries(this.data)) {
      const filename = `${dirname(this.dbFilePath)}${sep}${
        basename(this.dbFilePath, extname(this.dbFilePath))
      }.${collection}.json`;
      const tmp = await Deno.makeTempFile({ prefix: `petitedb-${collection}` });
      // FIXME: Next optimization is to get rid of JSON format; cause it increases considerably the time to write on-disk
      // The reason of this project is to allow an easy and intuitive way to view and edit json data for a POC.
      await Deno.writeTextFile(tmp, JSON.stringify(rows, replacer));
      await Deno.rename(tmp, filename);
    }
    
    await this.truncate(); // resets WAL

    this.lock = false;
  }

  // Lock Management
  private lockResource(collection: C, id?: string): boolean {
    const lockKey = collection;
    const lock = this.locks.get(lockKey);

    if (lock) {
      if (lock.type === "collection") {
        return false; // Collection is locked
      } else if (lock.type === "row" && id && lock.ids?.has(id)) {
        return false; // Row is locked
      }
    }

    if (!lock) {
      this.locks.set(lockKey, {
        type: id ? "row" : "collection",
        ids: id ? new Set([id]) : undefined,
      });
    } else if (lock.type === "row" && id) {
      lock.ids?.add(id);
    }

    return true;
  }

  private unlockResource(collection: C, id?: string): void {
    const lockKey = collection;
    const lock = this.locks.get(lockKey);

    if (lock) {
      if (lock.type === "collection") {
        this.locks.delete(lockKey);
      } else if (lock.type === "row" && id) {
        lock.ids?.delete(id);
        if (lock.ids?.size === 0) {
          this.locks.delete(lockKey);
        }
      }
    }
  }

  private check(collection: C) {
    if (!collection || collection === "") {
      throw new Error("No collection provided");
    }
    if (!this.data || Object.keys(this.data).length === 0) {
      throw new Error("No data in the database");
    }
  }

  /**
   * Creates a new record in the specified collection.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @param {Schema} record - The data for the new record.
   * @return {boolean} True if the record was created successfully, false otherwise.
   */
  public async create<T extends Schema>(
    collection: C,
    id: string,
    record: T,
  ): Promise<boolean> {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      if (!this.data[collection]) {
        this.data[collection] = {};
      }
      if (this.data[collection][id]) {
        console.error(`${this.dbFilePath} Record '${id}' already exists`);
        return false; // Record already exists
      }
      let data = record;
      if (this.autoId) {
        const uuid = randomUUID();
        if (this.data[collection][uuid]) {
          console.error(`${this.dbFilePath} Record '${uuid}' already exists`);
          return false; // Record already exists
        }
        data = { _id: uuid, ...record };
      }

      await this.append({
        op: "insert",
        collection,
        data,
        id,
      });

      this.data[collection][id] = { _meta: {}, record: data };

      if (this.autoCommit) {
        await this.commit();
        await this.truncate();
      }

      return true;
    } finally {
      this.unlockResource(collection, id);
    }
  }

  /**
   * Retrieves a record from the specified collection by its ID.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @return {(DatabaseRowReturn<T> | null)} The retrieved record, or null if not found.
   */
  public read<T extends Schema>(
    collection: C,
    id: string,
  ): DatabaseRowReturn<T> | null {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      this.check(collection);
      return this.data[collection]?.[id] as DatabaseRowReturn<T> || null;
    } finally {
      this.unlockResource(collection, id);
    }
  }

  /**
   * Retrieves all records from the specified collection.
   *
   * @param {string} collection - The name of the collection.
   * @return {(DatabaseRowReturn<T>[] | null)} The retrieved record, or null if not found.
   */
  public readAll<T extends Schema>(
    collection: C,
  ): DatabaseRowReturn<T>[] | null {
    if (!this.lockResource(collection)) {
      throw new Error("Resource is locked");
    }
    try {
      this.check(collection);
      return Object.values(this.data[collection]) as DatabaseRowReturn<T>[] ||
        null;
    } finally {
      this.unlockResource(collection);
    }
  }

  /**
   * Updates an existing record in the specified collection with the provided data.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @param {Partial<Schema>} record - The new data for the record (only updated fields).
   * @return {boolean} True if the record was updated successfully, false otherwise.
   */
  public async update<T extends Schema>(
    collection: C,
    id: string,
    record: Partial<T>,
  ): Promise<boolean> {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      this.check(collection);
      if (!this.data[collection]?.[id]) {
        return false;
      } // Record does not exist

      const data = { ...this.data[collection][id].record, ...record };

      await this.append({
        op: "update",
        collection,
        data,
        id,
      });

      this.data[collection][id] = { _meta: {}, record: data };

      if (this.autoCommit) {
        await this.commit();
        await this.truncate();
      }

      return true;
    } finally {
      this.unlockResource(collection, id);
    }
  }

  /**
   * Deletes a record from the specified collection by its ID.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @return {boolean} True if the record was deleted successfully, false otherwise.
   */
  public async delete(collection: C, id: string): Promise<boolean> {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      this.check(collection);
      if (!this.data[collection]?.[id]) {
        return false;
      } // Record does not exist

      await this.append({
        op: "delete",
        collection,
        id,
      });

      delete this.data[collection][id];

      if (this.autoCommit) {
        await this.commit();
        await this.truncate();
      }

      return true;
    } finally {
      this.unlockResource(collection, id);
    }
  }

  /**
   * Find one to many rows and delete them using the key
   * @param collection
   * @param query
   * @param key [default: id] - uses this key to delete the item
   * @returns {number} number of item deleted
   */
  public async findAndDelete<T extends Schema>(
    collection: C,
    query: Partial<T>,
    key: string = "id",
  ): Promise<number> {
    const rows = this.find<T>(collection, query);

    for (const row of rows) {
      await this.delete(collection, row.record[key]);
    }

    return rows.length;
  }

  /**
   * Upserts (inserts or updates) a record in the specified collection with the provided data.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @param {Schema} record - The new data for the record.
   */
  public async upsert<T extends Schema>(
    collection: C,
    id: string,
    record: T,
  ): Promise<boolean> {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      this.check(collection);
      if (!this.data[collection]) this.data[collection] = {};

      let data = { ...this.data[collection][id].record, ...record };

      if (this.autoId && !this.data[collection]?.[id]?.record._id) {
        const uuid = crypto.randomUUID();
        if (this.data[collection][uuid]) {
          console.error(`${this.dbFilePath} Record '${uuid}' already exists`);
          return false; // Record already exists
        }
        data = {
          _id: uuid,
          ...this.data[collection][id].record,
          ...record,
        };
      }

      await this.append({
        op: "update",
        collection,
        data,
        id,
      });

      this.data[collection][id] = { _meta: {}, record: data };

      if (this.autoCommit) {
        await this.commit();
        await this.truncate();
      }

      return true;
    } finally {
      this.unlockResource(collection, id);
    }
  }

  /**
   * Return the number of rows found for a query in a collection
   * @param collection
   * @param query
   * @returns {number}
   */
  public count<T extends Schema>(collection: C, query: Partial<T>): number {
    const rows = this.find<T>(collection, query);
    return rows.length;
  }

  /**
   * Finds records in the specified collection that match the provided query criteria.
   *
   * @param {string} collection - The name of the collection.
   * @param {Partial<Schema>} query - The query criteria to match records against.
   * @return {DatabaseRow[]} An array of matching records, or an empty array if no matches are found.
   */
  public find<T extends Schema>(
    collection: C,
    query: Partial<T>,
  ): DatabaseRowReturn<T>[] {
    if (!this.lockResource(collection)) {
      throw new Error("Resource is locked");
    }
    try {
      this.check(collection);
      const results: DatabaseRowReturn<T>[] = [];
      const records = this.data[collection];
      if (!records) return results;
      for (const key in records) {
        const record = records[key];
        let matches = true;
        if (!query || Object.keys(query).length === 0) {
          // When query is empty we return everything.
          matches = true;
        } else {
          for (const field in query) {
            if (record.record[field] !== query[field]) {
              matches = false;
              break;
            }
          }
        }
        if (matches) results.push(record as DatabaseRowReturn<T>);
      }
      return results;
    } finally {
      this.unlockResource(collection);
    }
  }

  /**
   * Using the length for the amount of results, returns randomly entries from the query
   * @param collection
   * @param query
   * @param length
   * @returns  {Array<Schema|null>}
   */
  public sample<T extends Schema>(
    collection: C,
    query: Partial<T>,
    length: number = 1,
  ): Array<DatabaseRow | null> {
    const results: DatabaseRow[] = this.find<T>(collection, query);
    if (!results) {
      return [];
    }
    const selection: Array<DatabaseRow | null> = [];
    for (let i = 0; i < length; i++) {
      if (results.length <= 0) {
        selection.push(null);
        continue;
      }
      const min = 0;
      const max = results.length;
      const index = Math.floor(Math.random() * (min - max) + max);
      selection.push(results[index]);
      results.splice(index, 1);
    }
    return selection;
  }

  /**
   * Clears all records from the database.
   */
  public async clear(): Promise<void> {
    if (existsSync(this.dbFilePath)) {
      this.data = {};
      if (this.autoCommit) {
        await this.commit();
      }
      // cleanup WAL as we just dumped the whole DB
      await this.truncate();
    }
  }

  /**
   * Drop one collection.
   * @param collection
   */
  public async drop(collection: C): Promise<void> {
    if (existsSync(this.dbFilePath)) {
      this.data[collection] = {};
      if (this.autoCommit) {
        await this.commit();
      }
    }
  }

  /**
   * Append an operation to the WAL before applying it.
   */
  async append(entry: WALEntry): Promise<void> {
    if (this.walLogPath) {
      const line = JSON.stringify(entry, replacer) + "\n";
      await appendFile(this.walLogPath, line, "utf8");
    }
  }

  /**
   * Truncate the WAL file after successful commit.
   */
  async truncate(): Promise<void> {
    if (this.walLogPath) {
      await writeFile(this.walLogPath, "", "utf8");
    }
  }

  /**
   * Load and Apply the WAL (execute when the database is loaded)
   * @param apply
   * @returns
   */
  async replay(apply: (entry: WALEntry) => Promise<void>): Promise<void> {
    try {
      if (!this.walLogPath) {
        return;
      }

      using f = await Deno.open(this.walLogPath, { read: true });

      const readable = f.readable
        .pipeThrough(new TextDecoderStream()) // decode Uint8Array to string
        .pipeThrough(new TextLineStream()) // split string line by line
        .pipeThrough(new JsonParseStream()); // parse each chunk as JSON

      for await (const line of readable) {
        try {
          const entry = line as WALEntry;
          await apply(entry);
        } catch (err) {
          console.error("Invalid WAL entry, skipping:", line);
          console.error(err);
        }
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        // WAL file doesn't exist — nothing to replay
        return;
      }
      throw err;
    }
  }

  /**
   * Default function to load and apply the WAL
   * @param db
   * @returns
   */
  public defaultApply(
    db: PetiteDB<string>,
  ): (entry: WALEntry) => Promise<void> {
    return async (entry: WALEntry) => {
      // console.debug(entry);
      switch (entry.op) {
        case "insert":
          await db.create(
            entry.collection as C,
            entry.id,
            entry.data as Schema,
          );

          return;
        case "update":
          await db.update(
            entry.collection as C,
            entry.id,
            entry.data as Schema,
          );
          return;
        case "delete":
          await db.delete(entry.collection as C, entry.id);
          return;
      }
    };
  }

  /**
   * Setup shutdown hook to automatically flush the database (when autoCommit is true)
   */
  private setupShutdownHook() {
    const shutdown = async () => {
      console.log("[Shutdown] Flushing database before exit...");
      try {
        if (this.autoCommit) {
          await this.flush();
          console.log("[Shutdown] Flush complete.");
        }
      } catch (err) {
        console.error("[Shutdown] Failed to flush database:", err);
      } finally {
        Deno.exit();
      }
    };

    addEventListener("unload", async () => {
      await shutdown();
    });

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      Deno.addSignalListener(signal, shutdown);
    }
  }
}
