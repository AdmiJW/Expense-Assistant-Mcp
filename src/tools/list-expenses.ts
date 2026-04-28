import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { ListExpensesSchema } from '../types.js';
import { listExpenses } from '../db/queries.js';

export function register(server: McpServer, db: Database.Database): void {
  server.registerTool(
    'list_expenses',
    {
      description:
        "Queries the expense ledger with optional filters. " +
        "'start_date' / 'end_date' are ISO 8601 UTC datetime strings (inclusive range). " +
        "'category' narrows results to a single category — value must match list_categories exactly. " +
        "Results are sorted newest-first by date. " +
        "'limit' (default 20, max 100) and 'offset' control pagination. " +
        "Returns { expenses: Expense[], total: number, limit, offset } where 'total' is the count matching " +
        "the current filters — compare total vs offset+limit to determine if further pages exist. " +
        "列出消费记录，支持日期范围和类别筛选及分页，按日期倒序排列。",
      inputSchema: ListExpensesSchema.shape,
    },
    async (args) => {
      try {
        const filters = ListExpensesSchema.parse(args);
        const result = listExpenses(db, filters);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...result,
              limit: filters.limit,
              offset: filters.offset,
            }, null, 2),
          }],
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
