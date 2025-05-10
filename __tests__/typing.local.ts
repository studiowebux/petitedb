import { PetiteDB } from "../src/mod.ts";

export type Collections = "reload" | "load" | "configs";

const db = new PetiteDB<Collections>("types.db.json", {
  "walLogPath": "wal.log",
  autoCommit: false,
});

await db.load();

const id = await db.create("reload", { ts: new Date().getTime() });
const result = db.read<{ ts: number }>("reload", { _id: id });
console.log(id, result?.record.ts);

const id1 = await db.create("configs", {
  ts: new Date().getTime(),
  enabled: false,
});
const result1 = db.read<{ ts: number; enabled: boolean }>("configs", {
  _id: id1,
});
console.log(id1, result1?.record.ts, result1?.record.enabled);

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await timeout(15_000);
await db.commit();
