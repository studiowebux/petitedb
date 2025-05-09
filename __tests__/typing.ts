import { PetiteDB } from "../src/mod.ts";

export type Collections = "reload" | "load" | "configs";

const db = new PetiteDB<Collections>("./types.db.json");

db.create("reload", "1", { ts: new Date().getTime() });
const result = db.read<{ ts: number }>("reload", "1");
console.log(result?.ts);

db.create("configs", "1", { ts: new Date().getTime(), enabled: false });
const result1 = db.read<{ ts: number; enabled: boolean }>("configs", "a");
console.log(result1?.ts, result1?.enabled);
