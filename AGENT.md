# Expense Assistant MCP: Agent Context

This file is the quick-start context for future AI-assisted coding sessions in this repository.

## Project Snapshot

Expense Assistant MCP is a TypeScript MCP server for personal expense tracking. It exposes deterministic stdio tools for logging, querying, updating, deleting, summarizing, attaching files to, and calculating amounts for expenses backed by SQLite.

Primary runtime flow:

```text
Telegram Bot / AI Agent / Hermes
  -> MCP stdio transport
  -> Expense Assistant MCP Server
  -> SQLite database and attachment storage
```

Important directories and files:

- `src/index.ts`: MCP server setup and tool registration.
- `src/types.ts`: Zod input schemas and shared TypeScript interfaces.
- `src/tools/`: one MCP tool module per public tool.
- `src/db/queries.ts`: SQLite query and mutation logic.
- `src/utils/`: date, path, and attachment helpers.
- `tests/`: Vitest suites.
- `artifacts/SOUL.md`: Hermes persona, high-level behavior, boundaries, and continuity.
- `artifacts/SKILL.md`: Hermes MCP operation guide and tool-usage source of truth.
- `README.md`: human-facing project and tool documentation.

## Commands

```bash
npm install
npm run build
npm test
npm run test:watch
```

Manual MCP inspection:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

## Public Tools

Current MCP tools:

- `list_categories`
- `calculate`
- `add_expense`
- `bulk_add_expenses`
- `get_expense`
- `list_expenses`
- `update_expense`
- `delete_expense`
- `bulk_delete_expenses`
- `add_attachment`
- `remove_attachment`
- `expense_summary`

Tool implementation pattern:

- Add or update the Zod schema in `src/types.ts`.
- Implement the tool in `src/tools/<tool-name>.ts`.
- Register it in `src/index.ts`.
- Add focused tests in `tests/`.
- Update `README.md`, `artifacts/SKILL.md`, and this file if public behavior changes.

## Documentation Boundary

- `artifacts/SOUL.md` should stay short. It defines who Hermes/小赫 is, how it speaks, and what boundaries it must respect.
- `artifacts/SKILL.md` owns detailed MCP operation rules: dates, categories, calculator behavior, attachment workflows, summaries, and common mistakes.
- Do not duplicate detailed tool behavior into `SOUL.md`. It should refer to `SKILL.md` instead.
- Update `SOUL.md` only when persona, boundaries, continuity, or the reference relationship to `SKILL.md` changes.

## Calculator Contract

The `calculate` tool exists so agents do not perform money arithmetic themselves.

- Input is expression-only: `{ "expression": "(11.5+2.3+9)*1.06" }`.
- It does not parse raw natural language.
- Supported grammar: numbers, whitespace, `+`, `-`, `*`, `/`, parentheses, unary minus.
- Percent shorthand is not supported; agents must convert tax manually, e.g. 6% tax becomes `*1.06`.
- Arithmetic uses `decimal.js`.
- Money result uses `ceil_2dp`: always round upward to 2 decimal places.
- Use `rounded_result` for machine values and `rounded_result_text` for display.

## Date And Time Contract

The database stores timestamps in UTC, but public tool inputs accept ISO 8601 strings with timezone offsets.

For Hermes and user-facing agent instructions, prefer Malaysia time with explicit offset:

```text
2026-04-29T12:00:00+08:00
2026-04-29T00:00:00+08:00 to 2026-04-29T23:59:59+08:00
```

UTC `Z` strings are accepted, but do not instruct agents to do unnecessary UTC conversion for ordinary user phrases like "today" or "yesterday".

## Safety Rules

- Do not touch `data/`, `expenses.db`, `*.db`, `*.db-wal`, or `*.db-shm` unless the user explicitly asks.
- Do not delete or rewrite attachments outside a requested tool behavior change.
- Do not revert unrelated user changes.
- Be careful with destructive tools: `delete_expense`, `bulk_delete_expenses`, and attachment deletion are irreversible in normal use.
- Keep fixed categories authoritative. Do not invent categories; update `EXPENSE_CATEGORIES` in `src/types.ts` only when intentionally changing the public category set.
- If tool behavior, schemas, date rules, calculator behavior, or destructive-operation rules change, update `README.md`, `artifacts/SKILL.md`, and `AGENT.md` in the same change. Touch `artifacts/SOUL.md` only for persona/boundary changes.

## Verification Expectations

For code changes, run:

```bash
npm test
npm run build
```

For documentation-only changes, review:

```bash
git diff -- README.md AGENT.md artifacts/SKILL.md artifacts/SOUL.md
```

Run tests/build for documentation-only changes only if implementation files were also touched or if the docs reveal a likely code mismatch.
