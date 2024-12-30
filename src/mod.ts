import { existsSync } from "@std/fs";

// deno-lint-ignore no-explicit-any
type RecordType = Record<string, any>;
type DatabaseType = Record<string, RecordType>;
type LockType = "collection" | "row";

/**
 * PetiteDB is a simple in-memory database with file persistence using JSON.
 *
 * @class PetiteDB
 */
export class PetiteDB {
  private dbFilePath: string;
  private data: DatabaseType;
  private lock: boolean;

  private autoId: boolean;
  private autoSave: boolean;

  private locks: Map<string, { type: LockType; ids?: Set<string> }>;

  /**
   * Constructs a new instance of PetiteDB with the given file path.
   *
   * @param {string} filePath - The file path for the database file.
   * @param {Object} options - Optional configuration options for the database.
   * @param {boolean} [options.autoSave=true] - If true, the database will be saved automatically after each operation.
   * @param {boolean} [options.autoId=false] - If true, a unique identifier will be generated automatically.
   *
   * @class PetiteDB
   */
  constructor(
    filePath: string,
    options?: { autoSave: boolean; autoId: boolean },
  ) {
    this.dbFilePath = filePath;
    this.data = {};
    this.lock = false;

    this.locks = new Map();

    this.autoSave = options?.autoSave === undefined ? true : options?.autoSave;
    this.autoId = options?.autoId === undefined ? false : options?.autoId;

    this.load();
  }

  /**
   * Returns the in memory data
   */
  public GetData(): DatabaseType {
    return this.data;
  }

  /**
   * Loads the database from the file system.
   *
   * @private
   */
  private load(): void {
    if (existsSync(this.dbFilePath)) {
      const fileData = Deno.readTextFileSync(this.dbFilePath);
      this.data = JSON.parse(fileData);
    }
  }

  /**
   * Saves the current state of the database to the file system.
   *
   * @private
   */
  private save(): void {
    while (this.lock) {
      console.warn("Database is locked or inaccessible");
    }
    this.lock = true;
    Deno.writeTextFileSync(this.dbFilePath, JSON.stringify(this.data, null, 2));
    this.lock = false;
  }

  // Lock Management
  private lockResource(collection: string, id?: string): boolean {
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

  private unlockResource(collection: string, id?: string): void {
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
   * Creates a new record in the specified collection.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @param {RecordType} record - The data for the new record.
   * @return {boolean} True if the record was created successfully, false otherwise.
   */
  public create(collection: string, id: string, record: RecordType): boolean {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      if (!this.data[collection]) {
        this.data[collection] = {};
      }
      if (this.data[collection][id]) {
        console.error(`Record '${id}' already exists`);
        return false; // Record already exists
      }
      if (this.autoId) {
        const uuid = crypto.randomUUID();
        if (this.data[collection][uuid]) {
          console.error(`Record '${uuid}' already exists`);
          return false; // Record already exists
        }
        this.data[collection][id] = { _id: uuid, ...record };
      } else {
        this.data[collection][id] = record;
      }

      if (this.autoSave) {
        this.save();
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
   * @return {(RecordType | null)} The retrieved record, or null if not found.
   */
  public read(collection: string, id: string): RecordType | null {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      return this.data[collection]?.[id] || null;
    } finally {
      this.unlockResource(collection, id);
    }
  }

  /**
   * Retrieves all records from the specified collection.
   *
   * @param {string} collection - The name of the collection.
   * @return {(RecordType | null)} The retrieved record, or null if not found.
   */
  // deno-lint-ignore no-explicit-any
  public readAll(collection: string): any[] | null {
    if (!this.lockResource(collection)) {
      throw new Error("Resource is locked");
    }
    try {
      return Object.values(this.data[collection]) || null;
    } finally {
      this.unlockResource(collection);
    }
  }

  /**
   * Updates an existing record in the specified collection with the provided data.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @param {Partial<RecordType>} record - The new data for the record (only updated fields).
   * @return {boolean} True if the record was updated successfully, false otherwise.
   */
  public update(
    collection: string,
    id: string,
    record: Partial<RecordType>,
  ): boolean {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      if (!this.data[collection]?.[id]) return false; // Record does not exist
      this.data[collection][id] = { ...this.data[collection][id], ...record };
      if (this.autoSave) {
        this.save();
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
  public delete(collection: string, id: string): boolean {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      if (!this.data[collection]?.[id]) return false; // Record does not exist
      delete this.data[collection][id];
      if (this.autoSave) {
        this.save();
      }
      return true;
    } finally {
      this.unlockResource(collection, id);
    }
  }

  /**
   * Upserts (inserts or updates) a record in the specified collection with the provided data.
   *
   * @param {string} collection - The name of the collection.
   * @param {string} id - The unique identifier for the record.
   * @param {RecordType} record - The new data for the record.
   */
  public upsert(collection: string, id: string, record: RecordType): boolean {
    if (!this.lockResource(collection, id)) {
      throw new Error("Resource is locked");
    }
    try {
      if (!this.data[collection]) this.data[collection] = {};
      if (this.autoId && !this.data[collection]?.[id]?._id) {
        const uuid = crypto.randomUUID();
        if (this.data[collection][uuid]) {
          console.error(`Record '${uuid}' already exists`);
          return false; // Record already exists
        } else {
          this.data[collection][id] = {
            _id: uuid,
            ...this.data[collection][id],
            ...record,
          };
        }
      } else {
        this.data[collection][id] = { ...this.data[collection][id], ...record };
      }
      if (this.autoSave) {
        this.save();
      }
      return true;
    } finally {
      this.unlockResource(collection, id);
    }
  }

  /**
   * Finds records in the specified collection that match the provided query criteria.
   *
   * @param {string} collection - The name of the collection.
   * @param {Partial<RecordType>} query - The query criteria to match records against.
   * @return {RecordType[]} An array of matching records, or an empty array if no matches are found.
   */
  public find(collection: string, query: Partial<RecordType>): RecordType[] {
    if (!this.lockResource(collection)) {
      throw new Error("Resource is locked");
    }
    try {
      const results: RecordType[] = [];
      const records = this.data[collection];
      if (!records) return results;
      for (const key in records) {
        const record = records[key];
        let matches = true;
        for (const field in query) {
          if (record[field] !== query[field]) {
            matches = false;
            break;
          }
        }
        if (matches) results.push(record);
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
   * @returns
   */
  public sample(
    collection: string,
    query: Partial<RecordType>,
    length: number = 1,
  ): Array<RecordType | null> {
    const results = this.find(collection, query);
    if (!results) {
      return [];
    }
    const selection: Array<RecordType | null> = [];
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
   *
   */
  public clear() {
    if (existsSync(this.dbFilePath)) {
      this.data = {};
      if (this.autoSave) {
        this.save();
      }
    }
  }

  /**
   * Creates a snapshot of the current state of the database, effectively "freezing" it in time.
   * And save data locally
   */
  public snapshot(): void {
    this.save();
  }
}
