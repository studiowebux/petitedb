import { PetiteDB } from "../src/mod.ts";

export type Collections = "reload" | "load" | "configs";

const db = new PetiteDB<Collections>("types.db.json", {
  "walLogPath": "wal.log",
  autoCommit: false,
});

await db.load();

const id = await db.insertOne("reload", { ts: new Date().getTime() });
const result = db.findOne<{ _id?: string, ts: number }>("reload", { _id: id });

const id1 = await db.insertOne("configs", {
  ts: new Date().getTime(),
  enabled: false,
});
const result1 = db.findOne<{ _id?: string, ts: number; enabled: boolean }>("configs", {
  _id: id1,
});
