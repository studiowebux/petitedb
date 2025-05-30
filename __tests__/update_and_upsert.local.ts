import PetiteDB from "../src/mod.ts";

const db = await PetiteDB.CreateDb("results/update_and_upsert.json");

type User = {
  id: number, 
  name: string,
  age?: number
}

await db.upsert<User>("test", {
  id: 1,
}, {
  id: 1,
  name: "Bob",
});

await db.upsert<User>("test", {
  id: 1,
}, {
  id: 1,
  name: "Bob II",
});

await db.updateOne<User>("test", {
  id: 1,
}, {
  id: 1,
  age: 56,
});
await db.shutdown();
