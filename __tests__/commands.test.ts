// deno test -A
import { assertEquals } from "@std/assert";
import { PetiteDB } from "../src/mod.ts";

try {
  Deno.removeSync("results/database.json");
  Deno.removeSync("results/autoid.json");
  Deno.removeSync("results/cc.json");
  Deno.removeSync("results/cc1.json");
  Deno.removeSync("results/cc2.json");
  Deno.removeSync("results/cc3.json");
  Deno.removeSync("results/cc3.json");
  Deno.removeSync("results/cc4.json");
} catch {
  // ok
}

const db = new PetiteDB("results/database.json");

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

Deno.test("Read all record", () => {
  assertEquals(db.readAll("category"), [{ name: "Hats" }]);
});

Deno.test("Create and Read with auto id", () => {
  const db1 = new PetiteDB("results/autoid.json", {
    autoSave: true,
    autoId: false,
  });

  assertEquals(db1.create("movies", "movie1", { title: "test 1" }), true);
  assertEquals(db1.create("movies", "movie2", { title: "test 2" }), true);
  assertEquals(db1.create("movies", "movie3", { title: "test 3" }), true);
  assertEquals(db1.readAll("movies")?.length, 3);
});

Deno.test("Create 100 entries", async () => {
  const db1 = new PetiteDB("results/cc.json", {
    autoSave: true,
    autoId: false,
  });

  await Promise.all(
    [...Array(100).keys()].map((i) =>
      db1.create("moviesCC", `movie${i}`, { title: `test ${i}` }),
    ),
  );
  assertEquals(db1.readAll("moviesCC")?.length, 100);
});

Deno.test("Create 500 entries", async () => {
  const db1 = new PetiteDB("results/cc1.json", {
    autoSave: true,
    autoId: false,
  });

  await Promise.all(
    [...Array(500).keys()].map((i) =>
      db1.create("moviesCC", `movie${i}`, { title: `test ${i}` }),
    ),
  );
  assertEquals(db1.readAll("moviesCC")?.length, 500);
});

Deno.test("Create 1000 entries", async () => {
  const db1 = new PetiteDB("results/cc2.json", {
    autoSave: true,
    autoId: false,
  });

  await Promise.all(
    [...Array(1000).keys()].map((i) =>
      db1.create("moviesCC", `movie${i}`, { title: `test ${i}` }),
    ),
  );
  assertEquals(db1.readAll("moviesCC")?.length, 1000);
});

Deno.test("Create 10000 entries", async () => {
  const db1 = new PetiteDB("results/cc3.json", {
    autoSave: true,
    autoId: false,
  });

  await Promise.all(
    [...Array(10000).keys()].map((i) =>
      db1.create("moviesCC", `movie${i}`, { title: `test ${i}` }),
    ),
  );
  assertEquals(db1.readAll("moviesCC")?.length, 10000);
});

Deno.test("Read all 10000 entries", () => {
  const db1 = new PetiteDB("results/cc3.json", {
    autoSave: true,
    autoId: false,
  });

  assertEquals(db1.readAll("moviesCC")?.length, 10000);
});

Deno.test("Create database and clear", () => {
  const db1 = new PetiteDB("results/clear.json");

  assertEquals(db1.create("movies", "movie1", { title: "test 1" }), true);
  assertEquals(db1.create("movies", "movie2", { title: "test 2" }), true);
  assertEquals(db1.create("movies", "movie3", { title: "test 3" }), true);
  assertEquals(db1.readAll("movies")?.length, 3);
  db1.clear();
  assertEquals(db1.GetData(), {});
});

Deno.test(
  "Create 10000 entries without auto save and without snapshot",
  async () => {
    const db1 = new PetiteDB("results/cc4.json", {
      autoId: true,
      autoSave: false,
    });

    await Promise.all(
      [...Array(10000).keys()].map((i) =>
        db1.create("moviesCC", `movie${i}`, { title: `test ${i}` }),
      ),
    );
    assertEquals(db1.readAll("moviesCC")?.length, 10000);
  },
);

Deno.test(
  "Create 10000 entries without auto save and snapshot at the end",
  async () => {
    const db1 = new PetiteDB("results/cc5.json", {
      autoId: true,
      autoSave: false,
    });

    await Promise.all(
      [...Array(10000).keys()].map((i) =>
        db1.create("moviesCC", `movie${i}`, { title: `test ${i}` }),
      ),
    );
    assertEquals(db1.readAll("moviesCC")?.length, 10000);
    db1.snapshot();
  },
);
