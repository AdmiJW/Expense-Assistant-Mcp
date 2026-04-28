import type Database from "better-sqlite3"
import { insertExpense, insertAttachment } from "../../src/db/queries.js"
import type { Expense, ExpenseAttachment } from "../../src/types.js"

export function seedExpense(
    db: Database.Database,
    overrides: Partial<Parameters<typeof insertExpense>[1]> = {},
): Expense {
    return insertExpense(db, {
        amount: 10.5,
        category: "食物",
        description: "Test lunch",
        ...overrides,
    })
}

export function seedAttachment(
    db: Database.Database,
    expenseId: string,
    overrides: Partial<{
        file_path: string
        original_filename: string
        mime_type: string
        remark: string
    }> = {},
): ExpenseAttachment {
    return insertAttachment(db, {
        expense_id: expenseId,
        file_path: "attachments/test-file.jpg",
        original_filename: "receipt.jpg",
        mime_type: "image/jpeg",
        ...overrides,
    })
}
