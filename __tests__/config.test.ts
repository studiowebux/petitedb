import { assertEquals } from "@std/assert/equals";
import PetiteDB from "../src/mod.ts";
import { assertRejects } from "@std/assert/rejects";
import { timeStamp } from "node:console";

Deno.test("Create collection configurations", async () => {
  const db = await PetiteDB.CreateDb("results/configs.json");
  await db.configure("test", {
    pk: "id", // the id is unique
    sk: null,
  });

  const id = await db.insertOne("test", {
    id: 1,
  });
  assertEquals(id !== undefined, true);

  assertRejects(() =>
    db.insertOne("test", {
      id: 1,
    })
  );

  const id1 = await db.insertOne("test", {
    id: 2,
  });
  assertEquals(id1 !== undefined, true);
});

Deno.test("Create collection configurations II", async () => {
  const db = await PetiteDB.CreateDb("results/configs_2.json");
  await db.configure("test", {
    pk: "id", // the id is unique
    sk: "timestamp",
  });

  const id = await db.insertOne("test", {
    id: 1,
    timestamp: "2025-05-29"
  });
  assertEquals(id !== undefined, true);

  assertRejects(() =>
    db.insertOne("test", {
      id: 1,
      timestamp: "2025-05-29"
    })
  );

  const id1 = await db.insertOne("test", {
    id: 1,
    timestamp: "2025-05-28"
  });
  assertEquals(id1 !== undefined, true);
});
