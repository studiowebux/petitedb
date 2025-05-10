import { PetiteDB } from "../../src/mod.ts";
import { nameGenerator } from "../data.ts";

type Person = {
  fullname: string;
  createdAt: Date;
  balance: bigint;
};

console.time("total");

Deno.mkdirSync("db", { recursive: true });

const db = new PetiteDB<"people">("db/demo.json", {
  "autoCommit": true,
  "maxWritesBeforeFlush": 100,
  "walLogPath": "wal/wal.log",
  "watch": false,
});

await db.load();

console.time("generator");
await Promise.all(
  [...Array(2).keys()].map(async () => {
    await db.create<Person>("people", {
      fullname: nameGenerator(),
      createdAt: new Date(),
      balance: 10_000_000_000n,
    });
  }),
);
console.timeEnd("generator");

console.time("Getters");

const databaseDump = db.GetData();
console.log("databaseDump", databaseDump);

console.time("mutate on disk");

// Save on-disk immediately (not recommended for heavy load)
await db.shutdown();

console.timeEnd("mutate on disk");

console.timeEnd("total");
