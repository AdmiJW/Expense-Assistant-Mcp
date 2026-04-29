import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type Database from 'better-sqlite3'
import { ExpenseSummarySchema } from '../types.js'
import { getExpenseSummary } from '../db/queries.js'
import { toUTC, toLocalDisplay, getUtcOffsetStr } from '../utils/date.js'

export function register(server: McpServer, db: Database.Database): void {
    server.registerTool(
        'expense_summary',
        {
            description:
                "Generates an aggregated financial report for a date range. " +
                "'start_date' and 'end_date' are required. They accept ISO 8601 datetime with timezone offset, e.g. '2026-04-29T00:00:00+08:00'. UTC strings ('Z' suffix) also accepted. " +
                "'group_by' controls time-series granularity: 'day' | 'week' | 'month' | 'year' (default: 'day'). " +
                "Returns: " +
                "total_spending (sum of all amounts in MYR), " +
                "transaction_count (number of records), " +
                "by_category (per-category breakdown with total, count, percentage of total spend), " +
                "by_period (time-series rows with period label in local time, total, count — sorted chronologically). " +
                "获取指定日期范围的消费汇总，含分类占比和时间趋势分组，group_by 支持 day/week/month/year，时间以本地时区显示。",
            inputSchema: ExpenseSummarySchema.shape,
        },
        async (args) => {
            try {
                const { start_date, end_date, group_by } = ExpenseSummarySchema.parse(args)
                const startUTC = toUTC(start_date)
                const endUTC   = toUTC(end_date)

                const summary = getExpenseSummary(db, startUTC, endUTC, group_by, getUtcOffsetStr())

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            ...summary,
                            period: {
                                start: toLocalDisplay(summary.period.start),
                                end:   toLocalDisplay(summary.period.end),
                            },
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
