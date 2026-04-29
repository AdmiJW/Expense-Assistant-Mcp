import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { insertExpense } from "../db/queries.js"
import { AddExpenseSchema } from "../types.js"
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
        "add_expense",
        {
            description:
                "Records a new expense. Amount is in MYR (positive number). " +
                "'category' must be one of the values returned by list_categories — call that tool first if the user has not specified a category. " +
                "'date' is an ISO 8601 datetime with timezone offset, e.g. '2026-04-29T14:30:00+08:00'. UTC strings ('Z' suffix) also accepted. Omit to default to now. " +
                "When category is '其他' (Other), 'sub_category' is required to describe the specific type. " +
                "Optional 'remark' stores extra notes. " +
                "Returns the full persisted Expense object including its generated 'id'. Timestamps are returned in local time. " +
                "添加一条消费记录。amount 为正数（马币MYR）。category 须为 list_categories 返回的合法值。date 可传本地时间（含时区偏移）或省略。",
            inputSchema: AddExpenseSchema.shape,
        },
        async (args) => {
            try {
                const data = AddExpenseSchema.parse(args)
                if (data.date) data.date = toUTC(data.date)

                const expense = insertExpense(db, data)

                let warning = ""
                if (data.category === "其他" && !data.sub_category) {
                    warning =
                        '\n⚠️ 类别为"其他"但未提供 sub_category，建议补充说明。'
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(fmt(expense), null, 2) + warning,
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
