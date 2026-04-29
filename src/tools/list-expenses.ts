import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type Database from 'better-sqlite3'
import { ListExpensesSchema } from '../types.js'
import type { Expense } from '../types.js'
import { listExpenses } from '../db/queries.js'
import { toUTC, toLocalDisplay } from '../utils/date.js'

const fmt = (e: Expense): Expense => ({
    ...e,
    date:       toLocalDisplay(e.date),
    created_at: toLocalDisplay(e.created_at),
    updated_at: toLocalDisplay(e.updated_at),
})

export function register(server: McpServer, db: Database.Database): void {
    server.registerTool(
        'list_expenses',
        {
            description:
                "Queries the expense ledger with optional filters. " +
                "'start_date' / 'end_date' accept ISO 8601 datetime with timezone offset, e.g. '2026-04-29T00:00:00+08:00'. UTC strings ('Z' suffix) also accepted. Range is inclusive. " +
                "'category' narrows results to a single category — value must match list_categories exactly. " +
                "Results are sorted newest-first by date. " +
                "'limit' (default 20, max 100) and 'offset' control pagination. " +
                "Returns { expenses: Expense[], total: number, limit, offset } where 'total' is the count matching " +
                "the current filters — compare total vs offset+limit to determine if further pages exist. Timestamps are returned in local time. " +
                "列出消费记录，支持日期范围和类别筛选及分页，按日期倒序排列，时间以本地时区显示。",
            inputSchema: ListExpensesSchema.shape,
        },
        async (args) => {
            try {
                const filters = ListExpensesSchema.parse(args)
                if (filters.start_date) filters.start_date = toUTC(filters.start_date)
                if (filters.end_date)   filters.end_date   = toUTC(filters.end_date)

                const result = listExpenses(db, filters)

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            expenses: result.expenses.map(fmt),
                            total: result.total,
                            limit: filters.limit,
                            offset: filters.offset,
                        }, null, 2),
                    }],
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
