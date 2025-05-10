// deno test -A
import { assertEquals, assertObjectMatch } from "@std/assert";
import { PetiteDB } from "../src/mod.ts";

try {
  Deno.removeSync("results/database.json");
  Deno.removeSync("results/autoid.json");
  Deno.removeSync("results/cc.json");
  Deno.removeSync("results/cc1.json");
  Deno.removeSync("results/cc2.json");
  Deno.removeSync("results/cc3.json");
  Deno.removeSync("results/cc4.json");
  Deno.removeSync("results/cc5.json");
} catch {
  // ok
}

const db = new PetiteDB("results/database.json", {
  maxWritesBeforeFlush: 1000,
});
await db.load();

Deno.test("Create record", async () => {
  const id = await db.create("category", { name: "Shoe" });
  assertObjectMatch(db.read("category", { _id: id })!.record, { name: "Shoe" });
});

Deno.test("Upsert record", async () => {
  const id = await db.create("category", { name: "Shoe" });
  await db.upsert("category", { _id: id }, { name: "shoes" });
  assertObjectMatch(db.read("category", { _id: id })!.record, {
    name: "shoes",
  });
});

Deno.test("Upsert second record", async () => {
  const id = await db.upsert("category", { _id: "inexisting" }, {
    name: "Hats",
  });
  assertObjectMatch(db.read("category", { _id: id })!.record, {
    name: "Hats",
  });
});

Deno.test("Update record", async () => {
  const id = await db.create("category", { name: "Shoe" });
  await db.update("category", { _id: id }, { name: "Shoes" });
  assertObjectMatch(db.read("category", { _id: id })!.record, {
    name: "Shoes",
  });
});

Deno.test("Read record", async () => {
  const id = await db.create("category", { name: "Shoe" });
  assertObjectMatch(db.read("category", { _id: id })!.record, { name: "Shoe" });
});

Deno.test("Find record", () => {
  assertEquals(
    db.find<{ name: string }>("category", { name: "Shoes" }).length,
    1,
  );
});

Deno.test("Delete record", async () => {
  const id = await db.create("category", { name: "Shoe" });
  const id1 = await db.create("category", { name: "Hats" });
  await db.delete("category", id);
  assertEquals(db.read("category", { _id: id }), null);
  assertObjectMatch(db.read("category", { _id: id1 })!.record, {
    name: "Hats",
  });
});

Deno.test("Read all record", () => {
  assertEquals(db.readAll("category").length, 7);
});

Deno.test("Create and Read with auto id", async () => {
  const db1 = new PetiteDB<"movies">("results/autoid.json", {
    autoCommit: true,
  });
  await db1.load();
  await db1.create("movies", { title: "test 1" });
  await db1.create("movies", { title: "test 2" });
  await db1.create("movies", { title: "test 3" });
  assertEquals(db1.readAll("movies")?.length, 3);
});

Deno.test("Create 100 entries", async () => {
  const db1 = new PetiteDB<"moviesCC">("results/cc.json", {
    autoCommit: true,
  });
  await db1.load();
  await Promise.all(
    [...Array(100).keys()].map(async (i) =>
      await db1.create("moviesCC", { title: `test ${i}` })
    ),
  );
  assertEquals(db1.readAll("moviesCC")?.length, 100);
});

Deno.test("Create 500 entries", async () => {
  const db1 = new PetiteDB<"moviesCC">("results/cc1.json", {
    autoCommit: true,
  });
  await db1.load();
  await Promise.all(
    [...Array(500).keys()].map(async (i) =>
      await db1.create("moviesCC", { title: `test ${i}` })
    ),
  );
  assertEquals(db1.readAll("moviesCC")?.length, 500);
});

Deno.test("Create 1000 entries", async () => {
  const db1 = new PetiteDB<"moviesCC">("results/cc2.json", {
    autoCommit: true,
  });
  await db1.load();
  await Promise.all(
    [...Array(1000).keys()].map(async (i) =>
      await db1.create("moviesCC", { title: `test ${i}` })
    ),
  );
  assertEquals(db1.readAll("moviesCC")?.length, 1000);
});

Deno.test("Create 10000 entries", async () => {
  const db1 = new PetiteDB<"moviesCC">("results/cc3.json", {
    autoCommit: true,
  });
  await db1.load();
  await Promise.all(
    [...Array(10000).keys()].map(async (i) =>
      await db1.create("moviesCC", { title: `test ${i}` })
    ),
  );
  assertEquals(db1.readAll("moviesCC")?.length, 10000);
});

Deno.test("Read all 10000 entries", async () => {
  const db1 = new PetiteDB<"moviesCC">("results/cc3.json", {
    autoCommit: true,
  });
  await db1.load();
  assertEquals(db1.readAll("moviesCC")?.length, 10000);
});

Deno.test("Create database and clear", async () => {
  const db1 = new PetiteDB<"movies">("results/clear.json");
  await db1.load();
  await db1.create("movies", { title: "test 1" });
  await db1.create("movies", { title: "test 2" });
  await db1.create("movies", { title: "test 3" });
  assertEquals(db1.readAll("movies")?.length, 3);
  await db1.clear();
  assertEquals(db1.GetData(), {});
});

Deno.test(
  "Create 10000 entries without auto commit and without commit, stays in WAL and gonna be restore next start",
  async () => {
    try {
      Deno.writeTextFileSync("wal/cc4.wal.log", "");
    } catch {
      // do nothing for this test
    }
    const db1 = new PetiteDB<"moviesCC">("results/cc4.json", {
      autoCommit: false,
    });
    await db1.load();
    await Promise.all(
      [...Array(10000).keys()].map(async (i) =>
        await db1.create("moviesCC", { title: `test ${i}` })
      ),
    );
    assertEquals(db1.readAll("moviesCC")?.length, 10000);
  },
);

Deno.test(
  "Create 10000 entries without auto commit and commit at the end",
  async () => {
    const db1 = new PetiteDB<"moviesCC">("results/cc5.json", {
      autoCommit: false,
    });
    await db1.load();
    await Promise.all(
      [...Array(10000).keys()].map(async (i) =>
        await db1.create("moviesCC", { title: `test ${i}` })
      ),
    );
    assertEquals(db1.readAll("moviesCC")?.length, 10000);
    await db1.flush();
  },
);
