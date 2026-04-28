import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initDatabase } from './db/init.js';

import { register as registerAddExpense } from './tools/add-expense.js';
import { register as registerGetExpense } from './tools/get-expense.js';
import { register as registerListExpenses } from './tools/list-expenses.js';
import { register as registerUpdateExpense } from './tools/update-expense.js';
import { register as registerDeleteExpense } from './tools/delete-expense.js';
import { register as registerAddAttachment } from './tools/add-attachment.js';
import { register as registerRemoveAttachment } from './tools/remove-attachment.js';
import { register as registerExpenseSummary } from './tools/expense-summary.js';
import { register as registerListCategories } from './tools/list-categories.js';

const db = initDatabase();

const server = new McpServer({
  name: 'expense-assistant',
  version: '1.0.0',
});

// Register all tools
registerAddExpense(server, db);
registerGetExpense(server, db);
registerListExpenses(server, db);
registerUpdateExpense(server, db);
registerDeleteExpense(server, db);
registerAddAttachment(server, db);
registerRemoveAttachment(server, db);
registerExpenseSummary(server, db);
registerListCategories(server);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
