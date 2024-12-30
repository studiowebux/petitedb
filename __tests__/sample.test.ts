import { PetiteDB } from "../src/mod.ts";

const db = new PetiteDB("results/sample.json");

Deno.test("Create record", () => {
  db.create("items", "shoe1", { category: "shoe", name: "Shoe 1" });
  db.create("items", "shoe2", { category: "shoe", name: "Shoe 2" });
  db.create("items", "shoe3", { category: "shoe", name: "Shoe 3" });
  db.create("items", "shoe4", { category: "shoe", name: "Shoe 4" });
  db.create("items", "shoe5", { category: "shoe", name: "Shoe 5" });
  db.create("items", "shoe6", { category: "shoe", name: "Shoe 6" });

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
