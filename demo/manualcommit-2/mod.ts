import { PetiteDB } from "../../src/mod.ts";
import { nameGenerator } from "../data.ts";

console.time("total");

Deno.mkdirSync("db", { recursive: true });

const db = new PetiteDB<"people">("db/demo.json", {
  "autoCommit": false,
  "maxWritesBeforeFlush": 100,
  "walLogPath": "wal/wal.log",
  "watch": false,
});

await db.load();

console.time("generator");
await Promise.all(
  [...Array(10_000).keys()].map(async () => {
    await db.create("people", {
      fullname: nameGenerator(),
      createdAt: new Date(),
    });
  }),
);
console.timeEnd("generator");

// await db.flush();

console.timeEnd("total");
