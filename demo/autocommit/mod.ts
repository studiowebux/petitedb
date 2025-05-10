import { randomUUID } from "node:crypto";
import { PetiteDB } from "../../src/mod.ts";
import { nameGenerator } from "../data.ts";

console.time("total");

Deno.mkdirSync("db", { recursive: true });

const db = new PetiteDB<"people">("db/demo.json", {
  "autoCommit": true,
  "autoId": false,
  "maxWritesBeforeFlush": 100,
  "walLogPath": "wal/wal.log",
  "watch": false,
});

await db.load();

console.time("generator");
await Promise.all(
  [...Array(10_000).keys()].map(async () => {
    const id = randomUUID();
    await db.create("people", id, {
      id,
      fullname: nameGenerator(),
      createdAt: new Date(),
    });
  }),
);
console.timeEnd("generator");

console.timeEnd("total");
