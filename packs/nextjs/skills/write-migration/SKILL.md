---
name: write-migration
description: Change the Postgres schema safely using Drizzle - edit the schema, generate SQL, review it, then apply. Use when adding or altering a table, column, index, or constraint.
---
# Write a database migration

Schema lives in `src/server/db/schema.ts` as TypeScript. Migrations are
generated from it - never hand-write a migration file, and never edit one that
has already been applied.

## Flow

1. **Edit the schema** in `src/server/db/schema.ts`.

2. **Generate the SQL**:
   ```bash
   pnpm db:generate
   ```

3. **Read the generated file** in `drizzle/` before applying it. This is the
   step that catches destructive surprises. Look for:
   - `DROP COLUMN` / `DROP TABLE` - is that data loss intended?
   - A new `NOT NULL` column with no default on a non-empty table: it will fail.
     Add it nullable, backfill, then tighten in a second migration.
   - A unique index on a column with existing duplicates: it will fail.

4. **Apply**:
   ```bash
   pnpm db:migrate
   ```

5. **Verify against the running database**, not just the type checker:
   ```bash
   docker compose exec -T postgres psql -U postgres -d app -c '\d+ your_table'
   ```

## Conventions

- Table names are `snake_case` and plural; TypeScript exports are `camelCase`.
- Every table gets `id` (uuid, `defaultRandom()`), `createdAt`, and `updatedAt`.
- Declare foreign keys with `.references(() => other.id)` and state the delete
  behaviour explicitly - the default is `NO ACTION`, which is rarely what you want.
- Commit the generated `drizzle/*.sql` files. They are the migration history.

## Recovering from a bad local migration

Local data is disposable; a wrong migration is fixed by rebuilding, not by
editing history:

```bash
docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed
```
