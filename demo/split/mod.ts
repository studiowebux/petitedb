import { PetiteDB } from "../../src/mod.ts";
import { nameGenerator } from "../data.ts";

type Person = {
  fullname: string;
  createdAt: Date;
};

type Weather = {
  temp: number;
  createdAt: Date;
};

console.time("total");

const db = new PetiteDB<"people" | "weather">("db/demo.json", {
  "autoCommit": true,
  "maxWritesBeforeFlush": 100,
  "walLogPath": "wal/wal.log",
  "watch": false,
  "memoryOnly": false,
});

await db.load();

console.time("generator");
await Promise.all([
  Promise.all(
    [...Array(1000).keys()].map(async () => {
      await db.create<Person>("people", {
        fullname: nameGenerator(),
        createdAt: new Date(),
      });
    }),
  ),
  Promise.all(
    [...Array(1000).keys()].map(async () => {
      await db.create<Weather>("weather", {
        temp: Math.random() * 10,
        createdAt: new Date(),
      });
    }),
  ),
]);

console.timeEnd("generator");

console.timeEnd("total");
