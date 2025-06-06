<div align="center">

<h2>Petite DB</h2>

[![JSR](https://jsr.io/badges/@studiowebux/petitedb)](https://jsr.io/@studiowebux/petitedb)

<p>The minimalistic NoSQL in-memory/on-disk database</p>

<p align="center">
  <a href="https://github.com/studiowebux/petitedb/issues">Report Bug</a>
  ·
  <a href="https://github.com/studiowebux/petitedb/issues">Request Feature</a>
</p>
</div>

---

## About

- Ideal for test, offline applications and Proof-of-Concept
- Manage data in memory
- Store and load data to/from a JSON file
- Uses Write-Ahead Logging (WAL) to increase performance
- Collection data is split into individual files.
- Configurable (see table below)ù
- Core operations:
  - Create, update, upsert, delete records
    - `insertOne` / `insertMany`
    - `updateOne`
    - `upsert`
    - `deleteOne` / `deleteMany`
  - Drop Collection
    - `drop`
  - Count
    - `count`
  - Retrieve configurable amount of random records (`sample()`)
    - `sample`
  - Snapshot and Clear data
    - `getData`
    - `clear`
  - Support Typescript Types: _Data_ (`Schema`) and _Collections_ (`string`)
- Support Saving BigInt in JSON file
- Added `_meta` object for each record (not fully implemented)
  - createdAt
  - updatedAt
  - Version (increase when update and upsert)
- Added simple indexing (by _id)

---

## Installation and Usage

1. Install deno: https://deno.com
2. `deno add @studiowebux/petitedb`
3. `import { PetiteDB } from "@studiowebux/petitedb@^2.1.2";`

>  Version 2.2.0+ has breaking changes.

**Example:**

see `demo/` directory, there are many examples.

**Clean Shutdown**

```ts
const db = new PetiteDB(...);

await db.shutdown()
```

**Options**

| Parameter            | Description                                                                                 | Default           |
| -------------------- | ------------------------------------------------------------------------------------------- | ----------------- |
| autoCommit           | If true, the database will be commited automatically when `maxWritesBeforeFlush` is reached | `true`            |
| walLogPath           |  WAL File name                                                                              | `db_name.wal.log` |
| maxWritesBeforeFlush |   Number of entries to store in the WAL before saving on-disk                               | `100`             |
| memoryOnly           |  Ephemeral DB only                                                                          | `false`           |
| verbose              |  Enables all log levels                                                                     | `false`           |

---

## Contributing

1. Fork the project
2. Create a Feature Branch
3. Commit your changes
4. Push your changes
5. Create a PR

<details>
<summary>Working with your local branch</summary>

**Branch Checkout:**

```bash
git checkout -b <feature|fix|release|chore|hotfix>/prefix-name
```

> Your branch name must starts with [feature|fix|release|chore|hotfix] and use a
> / before the name; Use hyphens as separator; The prefix correspond to your
> Kanban tool id (e.g. abc-123)

**Keep your branch synced:**

```bash
git fetch origin
git rebase origin/master
```

**Commit your changes:**

```bash
git add .
git commit -m "<feat|ci|test|docs|build|chore|style|refactor|perf|BREAKING CHANGE>: commit message"
```

> Follow this convention commitlint for your commit message structure

**Push your changes:**

```bash
git push origin <feature|fix|release|chore|hotfix>/prefix-name
```

**Examples:**

```bash
git checkout -b release/v1.15.5
git checkout -b feature/abc-123-something-awesome
git checkout -b hotfix/abc-432-something-bad-to-fix
```

```bash
git commit -m "docs: added awesome documentation"
git commit -m "feat: added new feature"
git commit -m "test: added tests"
```

</details>

## License

Distributed under the MIT License. See LICENSE for more information.

## Contact

- Tommy Gingras @ tommy@studiowebux.com | Studio Webux

<div>
<b> | </b>
<a href="https://www.buymeacoffee.com/studiowebux" target="_blank"
      ><img
        src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
        alt="Buy Me A Coffee"
        style="height: 30px !important; width: 105px !important"
        height="30"
        width="105"
/></a>
<b> | </b>
<a href="https://webuxlab.com" target="_blank"
      ><img
        src="https://webuxlab-static.s3.ca-central-1.amazonaws.com/logoAmpoule.svg"
        alt="Webux Logo"
        style="height: 30px !important"
        height="30"
/> Webux Lab</a>
<b> | </b>
</div>
