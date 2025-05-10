import { randomUUID } from "node:crypto";
import { PetiteDB } from "../src/mod.ts";

export type Collections = "reload" | "load" | "configs";

const db = new PetiteDB<Collections>("types.db.json", {
  "walLogPath": "wal.log",
  autoCommit: false,
});

await db.load();

const id = randomUUID();
await db.create("reload", id, { ts: new Date().getTime() });
const result = db.read<{ ts: number }>("reload", id);
console.log(id, result?.ts);

const id1 = randomUUID();
await db.create("configs", id1, { ts: new Date().getTime(), enabled: false });
const result1 = db.read<{ ts: number; enabled: boolean }>("configs", id1);
console.log(id1, result1?.ts, result1?.enabled);

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await timeout(15_000);
await db.commit();
