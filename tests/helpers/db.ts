import Database from "better-sqlite3"

/**
 * Creates a fresh in-memory SQLite database with the full schema applied.
 * Each test that calls this gets an isolated DB — no shared state between tests.
 */
export function createTestDb(): Database.Database {
    const db = new Database(":memory:")

    db.pragma("journal_mode = WAL")
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

        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
        CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense_id ON expense_attachments(expense_id);
    `)

    return db
}
