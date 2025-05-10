import { PetiteDB } from "../src/mod.ts";

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const db = new PetiteDB<"reload">("./reload.db.json", { watch: true });
await db.load();
await db.create("reload", "1", { ts: new Date().getTime() });

while (true) {
  console.log(db.read("reload", "1"));
  await timeout(3000);
}
