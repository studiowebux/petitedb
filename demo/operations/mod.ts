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
  "maxWritesBeforeFlush": 100,
  "walLogPath": "wal/wal.log",
  "watch": false,
});

await db.load();

console.time("generator");
await Promise.all(
  [...Array(10).keys()].map(async () => {
    await db.create("people", {
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
  { _id: "f1e414fb-d44d-4c8e-a4e5-64b43c904f65" },
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

const fullname = nameGenerator();

const id = await db.create<Person>("people", {
  fullname,
  createdAt: new Date(),
});
console.log("Created", db.read<Person>("people", { _id: id }));

await db.update<Person>("people", { _id: id }, { fullname: `${fullname} II` });
console.log("Updated", db.read<Person>("people", { _id: id }));

await db.upsert<Person>("people", { _id: id }, {
  fullname,
  createdAt: new Date(),
});
console.log("upserted", db.read<Person>("people", { _id: id }));

await db.delete("people", id);
console.log("deleted", db.read<Person>("people", { _id: id }));

const fullname1 = nameGenerator();

const id1 = await db.create<Person>("people", {
  fullname: fullname1,
  createdAt: new Date(),
});
console.log("Created #1", db.read<Person>("people", { _id: id1 }));

const rowsCount = await db.findAndDelete("people", { _id: id1 });
console.log("rowsCount", rowsCount);
console.log("Deleted #1", db.read<Person>("people", { _id: id1 }));

await db.drop("people");
console.log("Dropped collection", db.readAll<Person>("people"));

await db.clear();
console.log("Dropped database", db.GetData());

console.timeEnd("Setters");

console.time("mutate on disk");

// Save on-disk following this property: maxWritesBeforeFlush
await db.commit();

// Save on-disk immediately (not recommended for heavy load)
await db.flush();

console.timeEnd("mutate on disk");
await db.shutdown();

console.timeEnd("total");
