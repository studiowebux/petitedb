import PetiteDB from "../../src/mod.ts";

type Collections = "users" | "roles"
const db= await PetiteDB.CreateDb<Collections>("./db/test.json", {verbose: true})

await db.configure("users", {
    "pk": "id",
    "sk": null
})

await db.configure("roles", {
    "pk": "id",
    "sk": "name"
})

// await db.insertOne("users", {
//     id: 1,
//     firstname: "John"
// })

// await db.insertOne("users", {
//     id: 2,
//     firstname: "Jane"
// })

// await db.insertOne("roles", {
//     id: 2,
//     name: "administrator"
// })

await db.upsert("roles", {id: 2},{
    id: 2,
    name: "administrator",
    "label": "A"
})

await db.updateOne<{id: number, name: string, label: string}>("roles", {id: 2},{
    "label": "ABC"
})

await db.shutdown();