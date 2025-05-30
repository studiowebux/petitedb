import { PetiteDB } from "../../src/mod.ts";
import { nameGenerator } from "../data.ts";

type Person = {
  _id?: string;
  fullname: string;
  createdAt: Date;
};

console.time("total");

Deno.mkdirSync("db", { recursive: true });

const db = new PetiteDB<"people">("db/demo.json", {
  "autoCommit": true,
  "maxWritesBeforeFlush": 100,
  "walLogPath": "wal/wal.logc",
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

await db.shutdown();

console.timeEnd("total");
