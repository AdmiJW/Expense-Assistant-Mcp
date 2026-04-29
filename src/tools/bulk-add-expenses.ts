import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { bulkInsertExpenses } from "../db/queries.js"
import { BulkAddExpenseSchema } from "../types.js"
import type { Expense } from "../types.js"
import { toUTC, toLocalDisplay } from "../utils/date.js"

const fmt = (e: Expense): Expense => ({
    ...e,
    date:       toLocalDisplay(e.date),
    created_at: toLocalDisplay(e.created_at),
    updated_at: toLocalDisplay(e.updated_at),
})

export function register(server: McpServer, db: Database.Database): void {
    server.registerTool(
        "bulk_add_expenses",
        {
            description:
                "Inserts multiple expense records in a single atomic transaction — use this instead of " +
                "calling add_expense repeatedly when you have several items to record at once. " +
                "'expenses' is an array of 1–100 expense objects, each following the same schema as " +
                "add_expense (amount, category, description; optional date/sub_category/remark). " +
                "'date' accepts ISO 8601 datetime with timezone offset, e.g. '2026-04-29T14:30:00+08:00'. UTC strings ('Z' suffix) also accepted. " +
                "All records are validated before any insert begins; a validation failure on any single " +
                "item rejects the entire batch with no partial inserts. " +
                "Returns { count, expenses: Expense[], warnings } where 'warnings' lists any records " +
                "that used category '其他' without providing sub_category. Timestamps are returned in local time. " +
                "一次性批量插入最多100条消费记录，使用单一事务保证原子性；任意一条验证失败则整批拒绝。",
            inputSchema: BulkAddExpenseSchema.shape,
        },
        async (args) => {
            try {
                const { expenses } = BulkAddExpenseSchema.parse(args)
                const normalized = expenses.map(e => e.date ? { ...e, date: toUTC(e.date) } : e)
                const created = bulkInsertExpenses(db, normalized)

                // Warn per-index for 其他 without sub_category — same check as add_expense
                const warnings = expenses
                    .map((e, i) =>
                        e.category === "其他" && !e.sub_category
                            ? `Record ${i}: category '其他' provided without sub_category`
                            : null,
                    )
                    .filter((w): w is string => w !== null)

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                { count: created.length, expenses: created.map(fmt), warnings },
                                null,
                                2,
                            ),
                        },
                    ],
                }
            } catch (err) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `错误: ${err instanceof Error ? err.message : String(err)}`,
                        },
                    ],
                    isError: true,
                }
            }
        },
    )
}
