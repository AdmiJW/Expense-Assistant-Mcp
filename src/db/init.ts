import Database from "better-sqlite3"
import { getDbPath } from "../utils/paths.js"

export function initDatabase(): Database.Database {
    const db = new Database(getDbPath())

    // WAL mode allows concurrent readers during a write, which matters when
    // the MCP server and an external backup process run simultaneously.
    db.pragma("journal_mode = WAL")

    // Cascade DELETE on expense_attachments only fires when FK enforcement is ON;
    // SQLite disables it by default — this pragma is the required guard.
    db.pragma("foreign_keys = ON")

    db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      sub_category TEXT,
      description TEXT NOT NULL,
      remark TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_attachments (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    );

    -- Speeds up date-range filters used by list_expenses and expense_summary.
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

    -- Speeds up the category equality filter used by list_expenses.
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

    -- Speeds up attachment lookups when fetching a single expense (get_expense).
    CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense_id ON expense_attachments(expense_id);
  `)

    return db
}
