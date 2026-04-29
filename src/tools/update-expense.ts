import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type Database from 'better-sqlite3'
import { UpdateExpenseSchema } from '../types.js'
import type { Expense } from '../types.js'
import { updateExpense } from '../db/queries.js'
import { toUTC, toLocalDisplay } from '../utils/date.js'

const fmt = (e: Expense): Expense => ({
    ...e,
    date:       toLocalDisplay(e.date),
    created_at: toLocalDisplay(e.created_at),
    updated_at: toLocalDisplay(e.updated_at),
})

export function register(server: McpServer, db: Database.Database): void {
    server.registerTool(
        'update_expense',
        {
            description:
                "Partially updates an existing expense record. " +
                "'id' is required; supply only the fields you want to change — omitted fields are left untouched. " +
                "'date' accepts an ISO 8601 datetime with timezone offset, e.g. '2026-04-29T14:30:00+08:00'. UTC strings ('Z' suffix) also accepted. " +
                "'sub_category' and 'remark' accept null to clear a previously set value. " +
                "Returns the updated Expense object with timestamps in local time, or an error if the id does not exist. " +
                "部分更新消费记录，仅需传入要修改的字段，id 必填，返回更新后的完整记录（时间以本地时区显示）。",
            inputSchema: UpdateExpenseSchema.shape,
        },
        async (args) => {
            try {
                const { id, ...fields } = UpdateExpenseSchema.parse(args)
                if (fields.date) fields.date = toUTC(fields.date)

                const hasFields = Object.values(fields).some((v) => v !== undefined)
                if (!hasFields) {
                    return {
                        content: [{ type: 'text', text: '请至少提供一个要修改的字段。Please provide at least one field to update.' }],
                        isError: true,
                    }
                }

                const expense = updateExpense(db, id, fields)
                if (!expense) {
                    return {
                        content: [{ type: 'text', text: `未找到ID为 ${id} 的消费记录。Expense not found.` }],
                        isError: true,
                    }
                }

                return {
                    content: [{ type: 'text', text: JSON.stringify(fmt(expense), null, 2) }],
                }
            } catch (err) {
                return {
                    content: [{ type: 'text', text: `错误: ${err instanceof Error ? err.message : String(err)}` }],
                    isError: true,
                }
            }
        },
    )
}
