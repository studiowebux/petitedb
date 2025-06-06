import { PetiteDB } from "../../src/mod.ts";
import { nameGenerator } from "../data.ts";

type Person = {
  fullname: string;
  createdAt: Date;
};

console.time("total");

Deno.mkdirSync("db", { recursive: true });

const db = new PetiteDB<"people">("db/demo.json", {
  "autoCommit": true,
  "maxWritesBeforeFlush": 1000,
  "walLogPath": "wal/wal.log",
});

await db.load();

console.time("generator");
await Promise.all(
  [...Array(10_000).keys()].map(async () => {
    await db.insertOne<Person>("people", {
      fullname: nameGenerator(),
      createdAt: new Date(),
    });
  }),
);
console.timeEnd("generator");

await db.shutdown();

console.timeEnd("total");
