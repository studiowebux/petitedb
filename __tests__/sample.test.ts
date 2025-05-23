import { PetiteDB } from "../src/mod.ts";

const db = new PetiteDB<"items">("results/sample.json");
await db.load();

Deno.test("Create record", async () => {
  await db.create("items", { category: "shoe", name: "Shoe 1" });
  await db.create("items", { category: "shoe", name: "Shoe 2" });
  await db.create("items", { category: "shoe", name: "Shoe 3" });
  await db.create("items", { category: "shoe", name: "Shoe 4" });
  await db.create("items", { category: "shoe", name: "Shoe 5" });
  await db.create("items", { category: "shoe", name: "Shoe 6" });

  const samples = db.sample("items", { category: "shoe" }, 3);
  const sample = db.sample("items", { category: "shoe" }, 1);
  const invalid = db.sample("items", { category: "shoe" }, 7);
  const inexistant = db.sample("items", { category: "hat" }, 1);
  const inexistants = db.sample("items", { category: "hat" }, 3);

  console.log(samples);
  console.log(sample);
  console.log(invalid);
  console.log(inexistant);
  console.log(inexistants);
  // No assert as it is random.
});
