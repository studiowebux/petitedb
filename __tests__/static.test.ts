import { assertEquals } from "@std/assert/equals";
import PetiteDB from "../src/mod.ts";

Deno.test("Instantiate and load db from static function", async () => {
    const db = await PetiteDB.CreateDb("results/static.json")
  assertEquals(db instanceof PetiteDB, true);
});