import { randomUUID } from "node:crypto";
import { PetiteDB } from "../../src/mod.ts";
import { nameGenerator } from "../data.ts";

type Person = {
  id: string;
  fullname: string;
  createdAt: Date;
};

console.time("total");

const db = new PetiteDB<"people">("db/demo.json", {
  "autoCommit": false,
  "autoId": false,
  "maxWritesBeforeFlush": 100,
  "walLogPath": "wal/wal.log",
  "watch": false,
  memoryOnly: true,
});

await db.load();

console.time("generator");
await Promise.all(
  [...Array(10).keys()].map(async () => {
    const id = randomUUID();
    await db.create("people", id, {
      id,
      fullname: nameGenerator(),
      createdAt: new Date(),
    });
  }),
);
console.timeEnd("generator");

console.time("Getters");

const databaseDump = db.GetData();
console.log("databaseDump", databaseDump);

const people = db.find<Person>("people", { fullname: "Isaac Hernandez" });
console.log("people", people);
const allPeople = db.find<Person>("people", {});
console.log("allPeople", allPeople);

const personById = db.read<Person>(
  "people",
  "f1e414fb-d44d-4c8e-a4e5-64b43c904f65",
);
console.log("personById", personById);

const collectionDump = db.readAll<Person>("people");
console.log("collectionDump", collectionDump);

const sampling = db.sample<Person>("people", {}, 3);
console.log("sampling", sampling);

const count = db.count("people", {});
console.log("count", count);

console.timeEnd("Getters");

console.time("Setters");

const id = randomUUID();
const fullname = nameGenerator();

await db.create<Person>("people", id, {
  id,
  fullname,
  createdAt: new Date(),
});
console.log("Created", db.read<Person>("people", id));

await db.update<Person>("people", id, { fullname: `${fullname} II` });
console.log("Updated", db.read<Person>("people", id));

await db.upsert<Person>("people", id, {
  id,
  fullname,
  createdAt: new Date(),
});
console.log("upserted", db.read<Person>("people", id));

await db.delete("people", id);
console.log("deleted", db.read<Person>("people", id));

const id1 = randomUUID();
const fullname1 = nameGenerator();

await db.create<Person>("people", id1, {
  id: id1,
  fullname: fullname1,
  createdAt: new Date(),
});
console.log("Created #1", db.read<Person>("people", id1));

const rowsCount = await db.findAndDelete("people", { id: id1 });
console.log("rowsCount", rowsCount);
console.log("Deleted #1", db.read<Person>("people", id1));

await db.drop("people");
console.log("Dropped collection", db.readAll<Person>("people"));

await db.clear();
console.log("Dropped database", db.GetData());

console.timeEnd("Setters");

console.timeEnd("total");
