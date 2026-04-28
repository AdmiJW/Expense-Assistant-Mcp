import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EXPENSE_CATEGORIES } from '../types.js';

export function register(server: McpServer): void {
  server.registerTool(
    'list_categories',
    {
      description:
        "Returns the canonical list of valid expense categories accepted by add_expense and update_expense. " +
        "Call this before add_expense when the user has not explicitly named a category — do not guess or invent category names. " +
        "Also returns a note about the '其他' (Other) sub_category requirement. " +
        "返回所有合法消费类别，add_expense 前若类别不明确须先调用此工具，不得猜测类别名称。",
    },
    async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            categories: EXPENSE_CATEGORIES,
            note: "当类别为'其他'时，请提供 sub_category 字段说明具体类别。",
          }, null, 2),
        }],
      };
    },
  );
}
