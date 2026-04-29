# Expense Assistant MCP Server

A TypeScript MCP (Model Context Protocol) server for personal expense tracking. AI agents invoke structured tools over stdio to log, query, and summarise expenses — replacing unreliable direct prompting with deterministic, type-safe endpoints backed by SQLite.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Tool Reference](#tool-reference)
5. [Data Models](#data-models)
6. [For AI Agents — Decision Guide](#for-ai-agents--decision-guide)
7. [Testing](#testing)
8. [Environment Variables](#environment-variables)
9. [Development Notes](#development-notes)

---

## Architecture

```
Telegram Bot / AI Agent (OpenClaw / Hermes)
        │  MCP stdio transport
        ▼
Expense Assistant MCP Server (Node.js + TypeScript)
        │
        ├── SQLite database  →  data/expenses.db
        └── Attachment files →  data/attachments/<uuid>.<ext>
```

**Key design decisions:**

- **Fixed categories** — prevents the AI from inventing ad-hoc category names that break aggregations.
- **File-path-based attachments** — the agent downloads a file (e.g. from Telegram), passes the absolute OS path to MCP; MCP copies it internally. No base64 over the wire.
- **Relative paths in DB** — `file_path` stored as `attachments/uuid.ext` relative to the data dir, so the entire `data/` folder can be relocated via `EXPENSE_DATA_DIR` without breaking references.
- **`get_expense` resolves absolute paths** — attachment `file_path` in responses is the resolved absolute OS path, ready to pass to Telegram's `sendDocument` API.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build
npm run build

# 3. Start (used by MCP host / agent)
npm start
```

### Register with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
    "mcpServers": {
        "expense-assistant": {
            "command": "node",
            "args": ["/absolute/path/to/Expense-Assistant-Mcp/dist/index.js"],
            "env": {
                "EXPENSE_DATA_DIR": "/absolute/path/to/data"
            }
        }
    }
}
```

### Register with other MCP hosts

Any host that supports stdio MCP transport can launch the server with:

```bash
node dist/index.js
```

---

## Configuration

| Environment Variable | Default               | Description                                                                                      |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `EXPENSE_DATA_DIR`   | `<project root>/data` | Absolute path for SQLite DB and attachment files. Set this to a persistent volume in production. |
| `EXPENSE_TIMEZONE`   | `Asia/Kuala_Lumpur`   | IANA timezone name. Controls display formatting of all returned timestamps and the period grouping in `expense_summary`. |

The data directory is created automatically on first run. It contains:

```
data/
  expenses.db          # SQLite database
  attachments/         # Copied attachment files (uuid-named)
```

---

## Tool Reference

### `list_categories`

Returns the canonical list of valid category values. **Call this before `add_expense` if the user has not explicitly named a category** — do not guess.

**Parameters:** none

**Returns:**

```json
{
    "categories": [
        "食物",
        "饮料",
        "交通",
        "购物",
        "娱乐",
        "居家",
        "数码用品",
        "医疗",
        "旅行",
        "其他"
    ],
    "note": "当类别为'其他'时，请提供 sub_category 字段说明具体类别。"
}
```

---

### `add_expense`

Records a new expense.

| Parameter      | Type                    | Required     | Description                               |
| -------------- | ----------------------- | ------------ | ----------------------------------------- |
| `amount`       | `number`                | ✅           | Positive value in MYR                     |
| `category`     | `string`                | ✅           | Must match a value from `list_categories` |
| `description`  | `string`                | ✅           | Short description of the expense          |
| `date`         | `string` (ISO 8601 with offset) | —            | e.g. `"2026-04-29T14:30:00+08:00"`. UTC (`Z`) also accepted. Defaults to now. |
| `sub_category` | `string`                | ✅ if `其他` | Required when category is `其他`          |
| `remark`       | `string`                | —            | Additional notes                          |

**Returns:** Full `Expense` object including generated `id`. All timestamps are returned in local time (`EXPENSE_TIMEZONE`).

**Example:**

```json
{
    "amount": 12.5,
    "category": "食物",
    "description": "Char kway teow",
    "date": "2026-04-29T12:30:00+08:00"
}
```

---

### `bulk_add_expenses`

Inserts multiple expense records in a single atomic transaction. Use this instead of calling `add_expense` in a loop when you have several items to record at once — saves token count and round-trips.

| Parameter  | Type        | Required | Description                                                   |
| ---------- | ----------- | -------- | ------------------------------------------------------------- |
| `expenses` | `Expense[]` | ✅       | Array of 1–100 expense objects (same schema as `add_expense`) |

Each item in `expenses` follows the same rules as `add_expense`: `amount`, `category`, `description` are required; `date`, `sub_category`, `remark` are optional.

**Atomicity:** all records are validated before any insert begins. A validation failure on any single item rejects the entire batch — no partial inserts.

**Returns:**

```json
{
  "count": 3,
  "expenses": [...],
  "warnings": ["Record 1: category '其他' provided without sub_category"]
}
```

---

### `get_expense`

Retrieves a single expense by its UUID, including all attached files.

| Parameter | Type     | Required | Description         |
| --------- | -------- | -------- | ------------------- |
| `id`      | `string` | ✅       | UUID of the expense |

**Returns:** `ExpenseWithAttachments`. Each attachment's `file_path` is an **absolute OS path** ready to pass to Telegram's `sendDocument` API.

**Returns error** if the id does not exist.

---

### `list_expenses`

Queries the expense ledger with optional filters and pagination.

| Parameter    | Type                    | Required | Description                                |
| ------------ | ----------------------- | -------- | ------------------------------------------ |
| `start_date` | `string` (ISO 8601 with offset) | —        | e.g. `"2026-04-29T00:00:00+08:00"`. UTC (`Z`) also accepted. Inclusive. |
| `end_date`   | `string` (ISO 8601 with offset) | —        | e.g. `"2026-04-29T23:59:59+08:00"`. UTC (`Z`) also accepted. Inclusive. |
| `category`   | `string`                | —        | Filter by exact category name              |
| `limit`      | `number`                | —        | Max records per page (default 20, max 100) |
| `offset`     | `number`                | —        | Skip this many records (default 0)         |

**Returns:**

```json
{
  "expenses": [...],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```

`total` is the full count matching the filters — compare `total` vs `offset + limit` to determine if more pages exist. Results are sorted **newest-first**.

---

### `update_expense`

Partially updates an existing expense. Only pass the fields you want to change.

| Parameter      | Type                    | Required | Description          |
| -------------- | ----------------------- | -------- | -------------------- |
| `id`           | `string`                | ✅       | UUID of the expense  |
| `amount`       | `number`                | —        | New amount           |
| `category`     | `string`                | —        | New category         |
| `description`  | `string`                | —        | New description      |
| `date`         | `string` (ISO 8601 with offset) | —        | e.g. `"2026-04-29T14:30:00+08:00"`. UTC (`Z`) also accepted. |
| `sub_category` | `string \| null`        | —        | Pass `null` to clear |
| `remark`       | `string \| null`        | —        | Pass `null` to clear |

**Returns:** Updated `Expense` object, or an error if the id does not exist.

---

### `delete_expense`

Permanently removes an expense and all its attachments — both the DB rows and the physical files on disk. **Irreversible.**

| Parameter | Type     | Required | Description         |
| --------- | -------- | -------- | ------------------- |
| `id`      | `string` | ✅       | UUID of the expense |

**Returns:** Confirmation string including how many attachment files were deleted.

---

### `bulk_delete_expenses`

Permanently deletes multiple expense records and all their attachments (DB rows + physical files) in a single atomic transaction. Use this instead of calling `delete_expense` in a loop.

| Parameter | Type       | Required | Description                            |
| --------- | ---------- | -------- | -------------------------------------- |
| `ids`     | `string[]` | ✅       | Array of 1–100 expense UUIDs to delete |

IDs that do not exist are silently skipped and reported in `not_found_ids` — the remaining valid IDs are still deleted. **Irreversible.**

**Returns:**

```json
{
    "deleted_count": 3,
    "not_found_count": 1,
    "not_found_ids": ["ghost-uuid"],
    "attachments_removed": 5
}
```

---

### `add_attachment`

Copies a file into the MCP data store and links it to an expense.

| Parameter           | Type     | Required | Description                                     |
| ------------------- | -------- | -------- | ----------------------------------------------- |
| `expense_id`        | `string` | ✅       | UUID of the target expense (must exist)         |
| `file_path`         | `string` | ✅       | **Absolute OS path** to the source file         |
| `original_filename` | `string` | ✅       | Display name for the file                       |
| `mime_type`         | `string` | —        | MIME type (default: `application/octet-stream`) |
| `remark`            | `string` | —        | Optional note about the attachment              |

The source file is **copied** — the original is not moved or deleted. Typical flow: Telegram bot downloads the file → passes its temp path here.

**Returns:** New `ExpenseAttachment` record including its `id`.

---

### `remove_attachment`

Deletes a single attachment — both the DB record and the physical file.

| Parameter | Type     | Required | Description            |
| --------- | -------- | -------- | ---------------------- |
| `id`      | `string` | ✅       | UUID of the attachment |

Does not affect the parent expense or other attachments. **Returns error** if the id does not exist.

---

### `expense_summary`

Generates an aggregated financial report for a date range.

| Parameter    | Type                                   | Required | Description                                |
| ------------ | -------------------------------------- | -------- | ------------------------------------------ |
| `start_date` | `string` (ISO 8601 with offset)        | ✅       | e.g. `"2026-04-01T00:00:00+08:00"`. UTC (`Z`) also accepted. Inclusive. |
| `end_date`   | `string` (ISO 8601 with offset)        | ✅       | e.g. `"2026-04-30T23:59:59+08:00"`. UTC (`Z`) also accepted. Inclusive. |
| `group_by`   | `"day" \| "week" \| "month" \| "year"` | —        | Time-series granularity (default: `"day"`) |

**Returns:**

```json
{
    "period": { "start": "...", "end": "..." },
    "total_spending": 342.5,
    "transaction_count": 18,
    "by_category": [
        { "category": "食物", "total": 120.0, "count": 8, "percentage": 35.04 }
    ],
    "by_period": [{ "period": "2025-01-15", "total": 45.0, "count": 3 }]
}
```

---

## Data Models

```typescript
interface Expense {
    id: string // UUID v4
    amount: number // MYR
    category: string // One of EXPENSE_CATEGORIES
    sub_category: string | null
    description: string
    remark: string | null
    date: string // ISO 8601 UTC
    created_at: string // ISO 8601 UTC
    updated_at: string // ISO 8601 UTC
}

interface ExpenseAttachment {
    id: string // UUID v4
    expense_id: string // FK → expenses.id
    file_path: string // Relative in DB; absolute in get_expense responses
    original_filename: string
    mime_type: string
    remark: string | null
    created_at: string // ISO 8601 UTC
}

interface ExpenseWithAttachments extends Expense {
    attachments: ExpenseAttachment[]
}
```

---

## For AI Agents — Decision Guide

Use this flowchart to decide which tool to call:

```
User mentions a purchase / expense
    │
    ├─ Single item + category unclear?
    │       └─ call list_categories first, then add_expense
    │
    ├─ Single item + category known → add_expense
    │       └─ User also sends a receipt / file?
    │               └─ download the file to disk → add_attachment
    │
    └─ Multiple items at once (e.g. "I bought X, Y, Z today")
            └─ bulk_add_expenses (one call, one transaction, saves tokens)

User asks "how much did I spend?" / "show my summary"
    └─ expense_summary (choose group_by based on time range asked)

User asks to see a specific record
    └─ get_expense (returns attachments with absolute file_path)

User asks to list / search records
    └─ list_expenses (apply filters + pagination as needed)

User wants to fix a mistake
    └─ update_expense (partial — only pass the changed fields)

User wants to delete
    ├─ Single expense → delete_expense (also removes its files)
    ├─ Multiple expenses → bulk_delete_expenses (pass all IDs at once)
    └─ Just one file from an expense → remove_attachment

User asks to send / view an attached file
    └─ get_expense → read file_path from attachments → sendDocument(file_path)
```

**Important rules for agents:**

- Never invent a category name — always use `list_categories` when in doubt.
- `date` is always ISO 8601 UTC. Convert "today", "yesterday", "last Monday" to UTC before passing.
- Prefer `bulk_add_expenses` over looping `add_expense` — fewer round-trips, atomic, lower token cost.
- Prefer `bulk_delete_expenses` over looping `delete_expense` for the same reasons.
- `get_expense` returns absolute `file_path` values — use them directly with `fs.readFile` or Telegram's `sendDocument`.
- `delete_expense` and `bulk_delete_expenses` delete files too — confirm with the user before calling.

---

## Testing

### Automated tests (query layer + utilities)

```bash
npm test
```

Runs 64 tests across two suites using Vitest with an in-memory SQLite database — no files are written to your data directory:

| Suite                      | Coverage                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/queries.test.ts`    | `insertExpense`, `getExpenseById`, `listExpenses`, `updateExpense`, `deleteExpense`, `bulkInsertExpenses`, `bulkDeleteExpenses`, attachment CRUD, `getExpenseSummary` (all `group_by` modes) |
| `tests/attachment.test.ts` | `mimeToExt` (all MIME categories), `saveAttachment` (copy, extension inference, error handling), `deleteAttachmentFile` (existing file, missing file)                                        |

Watch mode for development:

```bash
npm run test:watch
```

### Interactive GUI testing (MCP Inspector)

To explore and manually invoke tools through a visual interface:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

This opens the MCP Inspector in your browser. You can call any tool, inspect the schema, and see raw responses — ideal for smoke-testing after changes or verifying tool descriptions.

---

## Environment Variables

| Variable           | Default               | Purpose                                                                   |
| ------------------ | --------------------- | ------------------------------------------------------------------------- |
| `EXPENSE_DATA_DIR` | `<project root>/data` | Redirect DB + attachments to a persistent volume outside the project tree |
| `EXPENSE_TIMEZONE` | `Asia/Kuala_Lumpur`   | IANA timezone name for display formatting and `expense_summary` grouping  |

---

## Development Notes

- **Adding a category:** Edit the `EXPENSE_CATEGORIES` tuple in `src/types.ts`. The change propagates automatically to all Zod schemas and `list_categories`.
- **Attachment storage:** Files are copied (not moved) from the source path. The MCP owns its copy; the caller's original is untouched.
- **Date convention (Store UTC, Display Local):** The DB stores all timestamps in UTC. Agents pass dates with a timezone offset (e.g. `2026-04-29T14:30:00+08:00`) — the server normalises them to UTC before writing. On the way out, all timestamps are formatted to local time using `EXPENSE_TIMEZONE`. Agents receive human-readable local strings; no mental UTC arithmetic required.
- **SQLite FK cascade:** `ON DELETE CASCADE` on `expense_attachments` means deleting an expense automatically removes its DB rows — but the filesystem cleanup (`deleteAttachmentFile`) is handled explicitly in `delete-expense.ts` because SQLite cascade only handles rows, not files.
- **`EXPENSE_DATA_DIR` in tests:** Attachment tests override this env var to a temp directory, so tests never touch `data/`. Always restore it in `afterEach`.
