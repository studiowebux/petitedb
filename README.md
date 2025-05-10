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

- Manage data in memory
- Store and load data securely to/from a JSON file
- Uses Write-Ahead Logging (WAL) to increase performance
- Core operations:
  - Create, update, upsert, delete records
  - Drop Collection
  - Count, Read, Read all and Find specific records
  - Retrieve configurable amount of random records (`sample()`)
  - Snapshot and Clear data
  - Retrieve the raw data using `GetData`
  - Option to automatically add a `_id` per record
  - Option to manually commit the data to disk
  - Option for In-Memory Only
  - Support Typescript Types: _Data_ (`RecordType`) and _Collections_ (`string`)
- Ideal for test, offline applications and Proof-of-Concept
- Support Saving BigInt in JSON file
- Added `_meta` object for each record (not implemented)
  - createdAt
  - updatedAt
  - Version (increase when update and upsert)
- Collection data is split into individual files.
- Added simple indexing (by _id)

---

## Installation and Usage

1. Install deno: https://deno.com
2. `deno add @studiowebux/petitedb`
3. `import { PetiteDB } from "@studiowebux/petitedb@^2.0.0";`

>  Version 2.0.0+ has breaking changes.

**Example:**

see `demo/` directory, there are many examples.

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
