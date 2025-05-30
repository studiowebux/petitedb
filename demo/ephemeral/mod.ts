import { PetiteDB } from "../../src/mod.ts";
import { nameGenerator } from "../data.ts";

type Person = {
  _id?: string;
  fullname: string;
  createdAt: Date;
};

console.time("total");

const db = new PetiteDB<"people">("db/demo.json", {
  "autoCommit": false,
  "maxWritesBeforeFlush": 100,
  "walLogPath": "wal/wal.log",
  memoryOnly: true,
});

await db.load();

console.time("generator");
await Promise.all(
  [...Array(10).keys()].map(async () => {
    await db.insertOne("people", {
      fullname: nameGenerator(),
      createdAt: new Date(),
    });
  }),
);
console.timeEnd("generator");

console.time("Getters");

const databaseDump = db.getData();
console.log("databaseDump", databaseDump);

const people = db.find<Person>("people", { fullname: "Isaac Hernandez" });
console.log("people", people);

const allPeople = db.find<Person>("people", {});
console.log("allPeople", allPeople);

const personById = db.findOne<Person>(
  "people",
  { _id: "f1e414fb-d44d-4c8e-a4e5-64b43c904f65" },
);
console.log("personById", personById);

const collectionDump = db.find<Person>("people");
console.log("collectionDump", collectionDump);

const sampling = db.sample<Person>("people", {}, 3);
console.log("sampling", sampling);

const count = db.count("people", {});
console.log("count", count);

console.timeEnd("Getters");

console.time("Setters");

const fullname = nameGenerator();

const id = await db.insertOne<Person>("people", {
  fullname,
  createdAt: new Date(),
});
console.log("Created", db.findOne<Person>("people", { _id: id }));

await db.updateOne<Person>("people", { _id: id }, {
  fullname: `${fullname} II`,
});
console.log("Updated", db.findOne<Person>("people", { _id: id }));

await db.upsert<Person>("people", { _id: id }, {
  fullname,
  createdAt: new Date(),
});
console.log("upserted", db.findOne<Person>("people", { _id: id }));

await db.deleteOne("people", id);
console.log("deleted", db.findOne<Person>("people", { _id: id }));

const fullname1 = nameGenerator();

const id1 = await db.insertOne<Person>("people", {
  fullname: fullname1,
  createdAt: new Date(),
});
console.log("Created #1", db.findOne<Person>("people", { _id: id1 }));

const rowsCount = await db.deleteOne("people", { _id: id1 });
console.log("rowsCount", rowsCount);
console.log("Deleted #1", db.findOne<Person>("people", { _id: id1 }));

await db.drop("people");
console.log("Dropped collection", db.find<Person>("people"));

await db.clear();
console.log("Dropped database", db.getData());

console.timeEnd("Setters");

await db.shutdown();

console.timeEnd("total");
