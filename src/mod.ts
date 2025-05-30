import { hrtime } from "node:process";
import { appendFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, sep } from "node:path";
import { randomUUID } from "node:crypto";

import { TextLineStream } from "@std/streams";
import { JsonParseStream } from "@std/json";

import Logger from "@studiowebux/deno-minilog";

/**
 * Lock type used within the database.
 */
export type LockType = "collection" | "row";

/**
 * Collection within a database schema.
 */
export type Collection = string;

/**
 * Database schema definition.
 */
// deno-lint-ignore no-explicit-any
export type Schema = Record<string, any>;

/**
 * Meta information about the record.
 * Not fully implemented.
 */
export type Meta = {
  pk?: string;
  sk?: string;
  readonly?: string[];
  schema?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  version: string;
};

/**
 * Meta information about a collection.
 * Not fully implemented.
 * Currently only the PK and SK are implemented
 */
export type Configuration = {
  pk: string;
  sk: string | null;
};

/**
 * Represents a row within the database.
 * @property {object} _doc - The document stored in this row.
 */
export type DatabaseRow = {
  record: Schema;
  _meta: Meta;
};

/**
 * A promise representing a future value of a database row.
 * @template T
 * @extends Promise<T>
 */
export type DatabaseRowReturn<T> = DatabaseRow & { record: T & Schema };

/**
 * Enumeration of the types of data that can be stored in the database.
 */
export type DatabaseDataType = Record<Collection, DatabaseRow[]>;

/**
 * Enumeration of index types available for database operations.
 */
export type DatabaseIndexType = Record<Collection, Map<string, DatabaseRow>>;

/**
 * An entry representing a Write-Ahead Log (WAL) operation.
 */
export type WALEntry = {
  op: "insert" | "update" | "delete";
  collection: string;
  id?: string; // @deprecated
  data?: Schema;
  query?: Partial<Schema>;
};

/**
 * Replacer function for JSON serialization to control how objects are converted into strings.
 */
const replacer = (_key: unknown, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;

/**
 * Increment a hexadecimal version number by one.
 * @param {string} hex - The current hexadecimal version number as a string.
 * @returns {string} - The incremented hexadecimal version number.
 */
function incrementHexVersion(currentVersion: string) {
  const next = BigInt(`0x${currentVersion}`) + 1n;
  return next.toString(16); // return as hex string
}

/**
 * PetiteDB is a simple in-memory database with file persistence using JSON.
 *
 * @class PetiteDB
 */
export class PetiteDB<C extends string> {
  private dbFilePath: string;
  private data: DatabaseDataType;
  private index: DatabaseIndexType;
  private lock: boolean;

  private autoCommit: boolean;

  private locks: Map<string, { type: LockType; ids?: Set<string> }>;

  private walLogPath?: string;

  private writeCount: number;
  private maxWritesBeforeFlush: number;
  private saveQueue: Promise<void> = Promise.resolve();

  private memoryOnly: boolean;

  private logger: Logger;

  private configurations: Record<string, Configuration>;

  /**
   * Constructs a new instance of PetiteDB with the given file path.
   *
   * @param {string} filePath - The file path for the database file.
   * @param {Object} options - Optional configuration options for the database.
   * @param {boolean} [options.autoCommit=true] [default: true] - If true, the database will be commitd automatically after each operation.
   * @param {boolean} [options.walLogPath="db_name.wal.log"] [default: "db_name.wal.log"] - Can rename the WAL file
   * @param {boolean} [options.maxWritesBeforeFlush=100] [default: 100] - Number of entries before saving on-disk
   * @param {boolean} [options.memoryOnly=false] [default: false] - Ephemeral DB only
   * @param {boolean} [options.verbose=false] [default: false] - Enables logs
   *
   * @class PetiteDB
   */
  constructor(
    filePath: string,
    options?: {
      autoCommit?: boolean;
      walLogPath?: string;
      maxWritesBeforeFlush?: number;
      memoryOnly?: boolean;
      verbose?: boolean;
    },
  ) {
    Deno.mkdirSync(dirname(filePath), { recursive: true });
    this.dbFilePath = filePath;

    this.data = {};
    this.index = {};

    this.lock = false;

    this.locks = new Map();

    this.autoCommit = options?.autoCommit === undefined
      ? true
      : options?.autoCommit;

    this.writeCount = 0;
    this.maxWritesBeforeFlush = options?.maxWritesBeforeFlush || 100;

    if (options?.memoryOnly === true) {
      this.memoryOnly = true;
    } else {
      this.memoryOnly = false;

      Deno.mkdirSync("wal", { recursive: true });
      this.walLogPath = options?.walLogPath ||
        `wal${sep}${basename(filePath, extname(filePath))}.wal.log`;
    }

    this.logger = new Logger({
      info: true,
      error: true,
      debug: options?.verbose === true ? true : false,
      verbose: options?.verbose === true ? true : false,
      warn: options?.verbose === true ? true : false,
      trace: options?.verbose === true ? true : false,
    });

    this.configurations = {};
  }

  /**
   * Creates a new database and initializes it with default settings.
   * @returns {Promise<PetiteDB>} - A promise that resolves to the newly created PetiteDB instance.
   */
  static async CreateDb<C extends string>(filePath: string, options?: {
    autoCommit?: boolean;
    walLogPath?: string;
    maxWritesBeforeFlush?: number;
    memoryOnly?: boolean;
    verbose?: boolean;
  }): Promise<PetiteDB<C>> {
    const db = new PetiteDB<C>(filePath, options);
    await db.load();

    return db;
  }

  /**
   * Retrieves data from the database.
   * @returns {Record<string, any>} - The in-memory representation of all data within the database.
   */
  public getData(): DatabaseDataType {
    return this.data;
  }

  /**
   * Loads the existing database from disk into memory.
   * @returns {Promise<void>}
   */
  public async load(): Promise<void> {
    if (this.memoryOnly === true) {
      this.logger.verbose("Setup in-memory only database");
      this.data = {};
      this.index = {};
      return;
    }

    const start = hrtime();
    try {
      this.logger.debug(
        `Loading collections configurations`,
      );
      const collections = Deno.readTextFileSync(this.dbFilePath);
      const collectionsArray: Record<string, Configuration> = JSON.parse(
        collections,
      );
      this.logger.verbose(
        `Found ${
          Object.keys(collectionsArray).join(",") || "No Configurations"
        }`,
      );

      this.configurations = {};
      for (const [collection, config] of Object.entries(collectionsArray)) {
        this.logger.verbose(`Load ${collection} file in-memory `);
        const filename = `${dirname(this.dbFilePath)}${sep}${
          basename(this.dbFilePath, extname(this.dbFilePath))
        }.${collection}.json`;
        const fileData = Deno.readTextFileSync(filename);
        const data = JSON.parse(fileData) as DatabaseRow[];

        this.configurations[collection] = config as Configuration;
        if (!data) {
          this.logger.debug(
            `Initializing empty collection for '${collection}'`,
          );
          this.data[collection] = [];
          this.index[collection] = new Map();
        } else {
          this.data[collection] = data;
          this.index[collection] = new Map(
            data.map((row) => [row.record._id, row]),
          );
        }
      }
    } catch (e) {
      this.logger.warn((e as Error).message);
      this.logger.info("Rebuilding file structure using an empty database.");
      this.data = {};
    }

    this.logger.verbose("Database Loaded");

    if (this.walLogPath) {
      this.logger.verbose("Restoring WAL");
      await this.replay(this.defaultApply(this));
      await this.flush();

      this.logger.verbose("WAL restored");
    }
    const end = hrtime(start);

    this.logger.info(
      `Database is ready in ${end[0] + end[1] / Math.pow(10, 9)}ms`,
    );
  }

  /**
   * Commits current changes to the database and triggers a write operation if necessary.
   * @returns {Promise<void>}
   */
  public commit(): Promise<void> {
    this.logger.verbose("Commit WAL");
    this.saveQueue = this.saveQueue.then(async () => {
      try {
        if (++this.writeCount >= this.maxWritesBeforeFlush) {
          this.writeCount = 0;
          await this.flush(); // writes full DB and truncates WAL
        }
      } catch (err) {
        this.logger.error("[commit] WAL write failed:", err);
      }
    });

    return this.saveQueue;
  }

  /**
   * Flushes data from memory to disk, ensuring persistence.
   * @returns {Promise<void>}
   */
  public async flush(): Promise<void> {
    this.logger.verbose("Flush WAL");
    while (this.lock) {
      this.logger.warn("[Flush] Database is locked or inaccessible");
    }

    this.lock = true;

    try {
      const configurations: Record<string, Configuration> = {}; // Variable to add unconfigured collection
      for (const [collection, rows] of Object.entries(this.data)) {
        const filename = `${dirname(this.dbFilePath)}${sep}${
          basename(this.dbFilePath, extname(this.dbFilePath))
        }.${collection}.json`;
        const tmp = await Deno.makeTempFile({
          prefix: `petitedb-${collection}`,
        });
        // FIXME: Next optimization is to get rid of JSON format; cause it increases considerably the time to write on-disk
        // The reason of this project is to allow an easy and intuitive way to view and edit json data for a POC.
        await Deno.writeTextFile(
          tmp,
          JSON.stringify(rows, replacer),
        );
        await Deno.rename(tmp, filename);
        configurations[collection] = { pk: "", sk: null };
      }

      await this.updateConfigurations(configurations);

      await this.truncate(); // resets WAL
    } catch (e) {
      console.error(e);
    }

    this.lock = false;
  }

  /**
   * Update the collection configurations
   * @param configurations
   */
  private async updateConfigurations(
    configurations: Record<string, Configuration>,
  ) {
    const tmpCollectionConfigurations = await Deno.makeTempFile({
      prefix: `petitedb-configs`,
    });
    await Deno.writeTextFile(
      tmpCollectionConfigurations,
      JSON.stringify({ ...configurations, ...this.configurations }),
    );
    await Deno.rename(tmpCollectionConfigurations, this.dbFilePath);
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

  /**
   * Check if a collection is valid.
   * @param collection
   */
  private check(collection: C) {
    if (!collection || collection === "") {
      throw new Error("No collection provided");
    }

    if (!this.data || Object.keys(this.data).length === 0) {
      this.data[collection] = [];
      this.index[collection] = new Map();
      this.logger.warn("No data in the collection; Initializing collection.");
    }
  }

  /**
   * Create many records in the specified collection.
   *
   * @param {C} collection - The name of the collection.
   * @param {T[]} record - The data for the new record.
   * @param {{skipWAL}} config - when skipWAL is enabled, it skips appending into the WAL file
   * @return {Promise<string[]>} new id
   */
  public async insertMany<T extends Schema>(
    collection: C,
    records: T[],
    { skipWAL }: { skipWAL?: boolean } = {},
  ): Promise<string[]> {
    const newIds: string[] = [];
    for (const record of records) {
      const id = await this.insertOne(collection, record, { skipWAL });
      newIds.push(id);
    }

    return newIds;
  }
  /**
   * Creates a new record in the specified collection.
   *
   * @param {C} collection - The name of the collection.
   * @param {T} record - The data for the new record.
   * @param {{skipWAL}} config - when skipWAL is enabled, it skips appending into the WAL file
   * @return {Promise<string>} new id
   */
  public async insertOne<T extends Schema>(
    collection: C,
    record: T,
    { skipWAL }: { skipWAL?: boolean } = {},
  ): Promise<string> {
    const uuid = randomUUID();
    if (!this.lockResource(collection, uuid)) {
      throw new Error("Resource is locked");
    }

    try {
      if (!this.data[collection]) {
        this.index[collection] = new Map();
        this.data[collection] = [];
      }

      if (this.index[collection].has(uuid)) {
        throw new Error(
          `Collection '${collection}': Record '_id: ${uuid}' already exists`,
        );
      }

      this.logger.verbose("PK", this.configurations[collection]?.pk);
      this.logger.verbose("SK", this.configurations[collection]?.sk);
      const pkKey = this.configurations[collection]?.pk;
      const skKey = this.configurations[collection]?.sk;
      if (pkKey) {
        if (
          this.data[collection].find((entry) =>
            entry.record[pkKey] === record[pkKey] &&
            (skKey && entry.record[skKey] === record[skKey] || !skKey)
          )
        ) {
          throw new Error(
            `Collection '${collection}': Record 'PK: ${record[pkKey]}, SK: ${
              skKey ? record[skKey] : "None"
            }' already exists`,
          );
        }
      }

      const data = { ...record, _id: uuid };

      await this.append({
        op: "insert",
        collection,
        data,
      }, skipWAL);

      const ts = new Date().getTime();
      const input = {
        _meta: { createdAt: ts, updatedAt: ts, version: "0" },
        record: data,
      };

      this.index[collection].set(uuid, input);
      this.data[collection].push(input);

      if (this.autoCommit) {
        await this.commit();
      }

      return uuid;
    } finally {
      this.unlockResource(collection, uuid);
    }
  }

  /**
   * Updates an existing record in the specified collection with the provided data.
   *
   * @param {string} collection - The name of the collection.
   * @param {Partial<T>} query - The unique identifier for the record.
   * @param {Partial<Schema>} record - The new data for the record (only updated fields).
   * @param {{skipWAL}} config - when skipWAL is enabled, it skips appending into the WAL file
   * @return {boolean} True if the record was updated successfully, false otherwise.
   */
  public async updateOne<T extends Schema>(
    collection: C,
    query: Partial<T>,
    record: Partial<T>,
    { skipWAL }: { skipWAL?: boolean } = {},
  ): Promise<boolean> {
    this.logger.verbose("Update", collection, query);
    const existingRecord = this.findOne(collection, query);
    if (!existingRecord) {
      return false;
    } // Record does not exist

    if (!this.lockResource(collection, query._id)) {
      throw new Error("Resource is locked");
    }
    try {
      this.check(collection);
      if (query._id && !this.index[collection]?.has(query._id)) {
        return false;
      } // Record does not exist

      const data = {
        ...existingRecord!.record,
        ...record,
      };

      await this.append({
        op: "update",
        collection,
        data,
        query,
      }, skipWAL);

      const ts = new Date().getTime();
      const input = {
        _meta: {
          ...existingRecord!._meta,
          updatedAt: ts,
          version: incrementHexVersion(
            existingRecord!._meta.version || "0",
          ),
        },
        record: data,
      };

      this.index[collection].set(existingRecord.record._id, input);

      const idx = this.data[collection].findIndex((record) => {
        let matches = false;
        for (const field in query) {
          if (record.record[field] !== query[field]) {
            break;
          }
          matches = true;
        }

        return matches;
      });
      this.logger.verbose("Matches index: ", idx);
      this.data[collection][idx] = input;

      if (this.autoCommit) {
        await this.commit();
      }

      return true;
    } finally {
      this.unlockResource(collection, query._id);
    }
  }

  /**
   * Deletes first record found from the specified collection using a query.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @param {{skipWAL}} config - when skipWAL is enabled, it skips appending into the WAL file
   * @return {boolean} True if the record was deleted successfully, false otherwise.
   */
  public async deleteOne<T extends Schema>(
    collection: C,
    query: Partial<T>,
    { skipWAL }: { skipWAL?: boolean } = {},
  ): Promise<boolean> {
    const existingRecord = this.findOne(collection, query);
    if (!existingRecord) {
      return false;
    } // Record does not exist

    if (!this.lockResource(collection, existingRecord.record._id)) {
      throw new Error("Resource is locked");
    }
    try {
      this.check(collection);
      if (!this.index[collection]?.has(existingRecord.record._id)) {
        return false;
      } // Record does not exist

      await this.append({
        op: "delete",
        collection,
        query,
      }, skipWAL);

      this.index[collection].delete(existingRecord.record._id);
      this.data[collection] = this.data[collection].filter((r) =>
        r.record._id !== existingRecord.record._id
      );

      if (this.autoCommit) {
        await this.commit();
      }

      return true;
    } finally {
      this.unlockResource(collection, existingRecord.record._id);
    }
  }

  /**
   * Find one to many rows and delete them using the key
   * @param collection
   * @param query
   * @param key [default: id] - uses this key to delete the item
   * @param {{skipWAL}} config - when skipWAL is enabled, it skips appending into the WAL file
   * @returns {number} number of item deleted
   */
  public async deleteMany<T extends Schema>(
    collection: C,
    query: Partial<T>,
    { skipWAL }: { skipWAL?: boolean } = {},
  ): Promise<number> {
    const rows = this.find<T>(collection, query);

    for (const row of rows) {
      await this.deleteOne(collection, { _id: row.record._id }, { skipWAL });
    }

    return rows.length;
  }

  /**
   * Upserts (inserts or updates) a record in the specified collection with the provided data.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @param {Schema} record - The new data for the record.
   * @param {{skipWAL}} config - when skipWAL is enabled, it skips appending into the WAL file
   * @returns {Promise<string>} record id
   */
  public async upsert<T extends Schema>(
    collection: C,
    query: Partial<T>,
    record: T,
    { skipWAL }: { skipWAL?: boolean } = {},
  ): Promise<string> {
    this.logger.verbose("Upsert", collection, query);
    const existingRecord = this.findOne(collection, query);

    try {
      this.check(collection);
      if (!this.index[collection]) {
        this.index[collection] = new Map();
        this.data[collection] = [];
      }

      if (
        (query._id && !this.index[collection].has(query._id)) || !existingRecord
      ) {
        this.logger.verbose("Upsert: Record not found");
        const id = await this.insertOne(collection, record);
        return id;
      }

      this.logger.verbose("Upsert: Record found, updating");
      if (!this.lockResource(collection, query._id)) {
        throw new Error("Resource is locked");
      }

      const data = {
        ...existingRecord!.record,
        ...record,
      };

      await this.append({
        op: "update",
        collection,
        data,
        query,
      }, skipWAL);

      const ts = new Date().getTime();
      const input = {
        _meta: {
          ...existingRecord!._meta,
          updatedAt: ts,
          createdAt: ts, // TODO: Should we keep the original creating date ?
          version: incrementHexVersion(
            existingRecord!._meta.version || "0",
          ),
        },
        record: data,
      };

      this.logger.verbose("PK", this.configurations[collection]?.pk);
      this.logger.verbose("SK", this.configurations[collection]?.sk);
      const pkKey = this.configurations[collection]?.pk;
      const skKey = this.configurations[collection]?.sk;

      this.index[collection].set(existingRecord!.record._id, input);
      const index = this.data[collection].findIndex((row) =>
        row.record._id === query._id ||
        (pkKey && row.record[pkKey] === record[pkKey] &&
          (skKey && row.record[skKey] === record[skKey] || !skKey))
      );

      this.data[collection][index] = input;

      if (this.autoCommit) {
        await this.commit();
      }

      return existingRecord!.record._id;
    } finally {
      this.unlockResource(collection, query._id);
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
   * Finds and return the first record in the specified collection that matches the provided query criteria.
   *
   * @param {C} collection - The name of the collection.
   * @param {Partial<T>} query - The query criteria to match records against.
   * @return {DatabaseRowReturn<T> | undefined} first record to match or undefined.
   */
  public findOne<T extends Schema>(
    collection: C,
    query: Partial<T>,
  ): DatabaseRowReturn<T> | undefined {
    const results = this.find<T>(collection, query);
    return structuredClone(results.at(0));
  }

  /**
   * Finds records in the specified collection that match the provided query criteria.
   *
   * @param {C} collection - The name of the collection.
   * @param {Partial<T>} query - The query criteria to match records against.
   * @return {DatabaseRowReturn<T>[]} An array of matching records, or an empty array if no matches are found.
   */
  public find<T extends Schema>(
    collection: C,
    query?: Partial<T>,
  ): DatabaseRowReturn<T>[] {
    if (!this.lockResource(collection)) {
      throw new Error("Resource is locked");
    }
    try {
      this.check(collection);
      const results: DatabaseRowReturn<T>[] = [];
      const records = [...this.data[collection]?.values()];
      if (!records) {
        return structuredClone(results);
      }
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
        if (matches) {
          results.push(record as DatabaseRowReturn<T>);
        }
      }
      return structuredClone(results);
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
    this.data = {};
    if (this.autoCommit) {
      await this.commit();
    }
    // cleanup WAL as we just dumped the whole DB
    await this.truncate();
  }

  /**
   * Drop one collection.
   * @param collection
   */
  public async drop(collection: C): Promise<void> {
    if (this.index[collection]) {
      this.index[collection].clear();
      this.data[collection] = [];
    }
    if (this.autoCommit) {
      await this.commit();
    }
  }

  /**
   * Append an operation to the WAL before applying it.
   */
  async append(entry: WALEntry, skipWAL = false): Promise<void> {
    if (this.walLogPath && !skipWAL) {
      this.logger.verbose("Append entry in WAL");
      const line = JSON.stringify(entry, replacer) + "\n";
      await appendFile(this.walLogPath, line, "utf8");
    }
  }

  /**
   * Truncate the WAL file after successful commit.
   */
  async truncate(skipWAL = false): Promise<void> {
    if (this.walLogPath && !skipWAL) {
      this.logger.verbose("Truncate WAL");
      await writeFile(this.walLogPath, "", "utf8");
    }
  }

  /**
   * Load and Apply the WAL (execute when the database is loaded)
   * @param apply
   * @returns {Promise<void>}
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
          this.logger.error("Invalid WAL entry, skipping:", line);
          this.logger.error(err);
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
      switch (entry.op) {
        case "insert":
          await db.insertOne(
            entry.collection as C,
            entry.data as Schema,
            { skipWAL: true },
          );
          return;
        case "update":
          await db.updateOne(
            entry.collection as C,
            entry.query!,
            entry.data!,
            { skipWAL: true },
          );
          return;
        case "delete":
          await db.deleteOne(entry.collection as C, { _id: entry.query!._id }, {
            skipWAL: true,
          });
          return;
      }
    };
  }

  /**
   * Clean shutdown of the database
   */
  public async shutdown() {
    this.logger.info("[Shutdown] Flushing database before exit...");
    try {
      if (this.autoCommit) {
        await this.flush();
        this.logger.info("[Shutdown] Flush complete.");
      }
    } catch (err) {
      this.logger.error("[Shutdown] Failed to flush database:", err);
    } finally {
      this.logger.info("[Shutdown] Complete");
      Deno.exit(0);
    }
  }
  /**
   * Set configuration for a collection
   * @param collection
   * @returns {Promise<void>}
   */

  public async configure(collection: C, configuration: Configuration) {
    this.configurations[collection] = configuration;
    await this.updateConfigurations(this.configurations);
  }

  /**
   * Get the current configuration for a collection
   * @param collection
   * @returns {void}
   */
  public getConfiguration(collection: C): Configuration {
    return this.configurations[collection];
  }
}

export default PetiteDB;
