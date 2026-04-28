import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { ExpenseSummarySchema } from '../types.js';
import { getExpenseSummary } from '../db/queries.js';

export function register(server: McpServer, db: Database.Database): void {
  server.registerTool(
    'expense_summary',
    {
      description:
        "Generates an aggregated financial report for a date range. " +
        "'start_date' and 'end_date' are required ISO 8601 UTC datetime strings. " +
        "'group_by' controls time-series granularity: 'day' | 'week' | 'month' | 'year' (default: 'day'). " +
        "Returns: " +
        "total_spending (sum of all amounts in MYR), " +
        "transaction_count (number of records), " +
        "by_category (per-category breakdown with total, count, percentage of total spend), " +
        "by_period (time-series rows with period label, total, count — sorted chronologically). " +
        "获取指定日期范围的消费汇总，含分类占比和时间趋势分组，group_by 支持 day/week/month/year。",
      inputSchema: ExpenseSummarySchema.shape,
    },
    async (args) => {
      try {
        const { start_date, end_date, group_by } = ExpenseSummarySchema.parse(args);
        const summary = getExpenseSummary(db, start_date, end_date, group_by);

        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `错误: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
