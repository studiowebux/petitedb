```bash
deno run -A mod.ts
```

This demo does not commit the data, so it stays in the wal.log; next time the
database is started, the wal.log is commited.
