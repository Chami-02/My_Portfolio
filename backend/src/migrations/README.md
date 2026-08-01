# Migrations

Scripts that change the shape of existing data.

## Rules

1. **Every migration must be idempotent.** Running it twice must be safe.
2. **Never run against production without a fresh backup.**
3. **Always dry-run against a restored copy first.**
4. Migrations are numbered and run in order.
5. Once a migration has run in production, never edit it. Write a new one.

## How to run

```bash
# Dry run — reports what WOULD change, writes nothing
node src/migrations/001-blog-sections.js --dry-run

# Real run
node src/migrations/001-blog-sections.js