import { PetiteDB } from "../src/mod.ts";

const db = new PetiteDB<"items">("results/sample.json");
await db.load();

Deno.test("Create record", async () => {
  await db.insertOne("items", { category: "shoe", name: "Shoe 1" });
  await db.insertOne("items", { category: "shoe", name: "Shoe 2" });
  await db.insertOne("items", { category: "shoe", name: "Shoe 3" });
  await db.insertOne("items", { category: "shoe", name: "Shoe 4" });
  await db.insertOne("items", { category: "shoe", name: "Shoe 5" });
  await db.insertOne("items", { category: "shoe", name: "Shoe 6" });

  db.sample("items", { category: "shoe" }, 3);
  db.sample("items", { category: "shoe" }, 1);
  db.sample("items", { category: "shoe" }, 7);
  db.sample("items", { category: "hat" }, 1);
  db.sample("items", { category: "hat" }, 3);

  // console.log(samples);
  // console.log(sample);
  // console.log(invalid);
  // console.log(inexistant);
  // console.log(inexistants);
  // No assert as it is random.
});
