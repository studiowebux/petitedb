// deno test -A
import { assertEquals } from "@std/assert";
import { PetiteDB } from "../src/mod.ts";

const db = new PetiteDB("database.json");

Deno.test("Create record", () => {
  db.create("category", "shoes", { name: "Shoe" });
  assertEquals(db.read("category", "shoes"), { name: "Shoe" });
});

Deno.test("Upsert record", () => {
  db.upsert("category", "shoes", { name: "shoes" });
  assertEquals(db.read("category", "shoes"), { name: "shoes" });
});

Deno.test("Upsert second record", () => {
  db.upsert("category", "hats", { name: "Hats" });
  assertEquals(db.read("category", "hats"), { name: "Hats" });
});

Deno.test("Update record", () => {
  db.update("category", "shoes", { name: "Shoes" });
  assertEquals(db.read("category", "shoes"), { name: "Shoes" });
});

Deno.test("Read record", () => {
  assertEquals(db.read("category", "shoes"), { name: "Shoes" });
});

Deno.test("Find record", () => {
  assertEquals(db.find("category", { name: "Shoes" }), [{ name: "Shoes" }]);
});

Deno.test("Delete record", () => {
  db.delete("category", "shoes");
  assertEquals(db.read("category", "shoes"), null);
  assertEquals(db.read("category", "hats"), { name: "Hats" });
});
