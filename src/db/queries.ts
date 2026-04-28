import type Database from "better-sqlite3"
import { v4 as uuidv4 } from "uuid"
import type {
    Expense,
    ExpenseAttachment,
    ExpenseWithAttachments,
} from "../types.js"
import { nowUTC } from "../utils/date.js"

// --- Expense CRUD ---

// 'date' defaults to nowUTC() (Malaysia UTC+8) when the caller omits it,
// matching the convention used everywhere else in the system.
export function insertExpense(
    db: Database.Database,
    data: {
        amount: number
        category: string
        description: string
        date?: string
        sub_category?: string
        remark?: string
    },
): Expense {
    const id = uuidv4()
    const now = nowUTC()
    const date = data.date ?? nowUTC()

    db.prepare(
        `
    INSERT INTO expenses (id, amount, category, sub_category, description, remark, date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    ).run(
        id,
        data.amount,
        data.category,
        data.sub_category ?? null,
        data.description,
        data.remark ?? null,
        date,
        now,
        now,
    )

    return db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as Expense
}

export function getExpenseById(
    db: Database.Database,
    id: string,
): ExpenseWithAttachments | null {
    const expense = db
        .prepare("SELECT * FROM expenses WHERE id = ?")
        .get(id) as Expense | undefined
    if (!expense) return null

    const attachments = db
        .prepare(
            "SELECT * FROM expense_attachments WHERE expense_id = ? ORDER BY created_at",
        )
        .all(id) as ExpenseAttachment[]
    return { ...expense, attachments }
}

export function listExpenses(
    db: Database.Database,
    filters: {
        start_date?: string
        end_date?: string
        category?: string
        limit: number
        offset: number
    },
): { expenses: Expense[]; total: number } {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filters.start_date) {
        conditions.push("date >= ?")
        params.push(filters.start_date)
    }
    if (filters.end_date) {
        conditions.push("date <= ?")
        params.push(filters.end_date)
    }
    if (filters.category) {
        conditions.push("category = ?")
        params.push(filters.category)
    }

    const where =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const total = (
        db
            .prepare(`SELECT COUNT(*) as count FROM expenses ${where}`)
            .get(...params) as { count: number }
    ).count

    const expenses = db
        .prepare(
            `SELECT * FROM expenses ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
        )
        .all(...params, filters.limit, filters.offset) as Expense[]

    return { expenses, total }
}

export function updateExpense(
    db: Database.Database,
    id: string,
    fields: {
        amount?: number
        category?: string
        sub_category?: string | null
        description?: string
        remark?: string | null
        date?: string
    },
): Expense | null {
    const existing = db.prepare("SELECT id FROM expenses WHERE id = ?").get(id)
    if (!existing) return null

    const setClauses: string[] = []
    const params: unknown[] = []

    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
            setClauses.push(`${key} = ?`)
            params.push(value)
        }
    }

    if (setClauses.length === 0) {
        return db
            .prepare("SELECT * FROM expenses WHERE id = ?")
            .get(id) as Expense
    }

    setClauses.push("updated_at = ?")
    params.push(nowUTC())
    params.push(id)

    db.prepare(`UPDATE expenses SET ${setClauses.join(", ")} WHERE id = ?`).run(
        ...params,
    )

    return db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as Expense
}

export function deleteExpense(
    db: Database.Database,
    id: string,
): { deleted: boolean; attachmentPaths: string[] } {
    // Attachment file_paths must be fetched BEFORE the DELETE: the cascade wipes
    // the expense_attachments rows immediately, leaving nothing to query afterward.
    const attachments = db
        .prepare(
            "SELECT file_path FROM expense_attachments WHERE expense_id = ?",
        )
        .all(id) as { file_path: string }[]
    const attachmentPaths = attachments.map((i) => i.file_path)

    const result = db.prepare("DELETE FROM expenses WHERE id = ?").run(id)
    return { deleted: result.changes > 0, attachmentPaths }
}

// --- Image Attachments ---

export function insertAttachment(
    db: Database.Database,
    data: {
        expense_id: string
        file_path: string
        original_filename: string
        mime_type: string
        remark?: string
    },
): ExpenseAttachment {
    const id = uuidv4()
    const now = nowUTC()

    db.prepare(
        `
    INSERT INTO expense_attachments (id, expense_id, file_path, original_filename, mime_type, remark, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    ).run(
        id,
        data.expense_id,
        data.file_path,
        data.original_filename,
        data.mime_type,
        data.remark ?? null,
        now,
    )

    return db
        .prepare("SELECT * FROM expense_attachments WHERE id = ?")
        .get(id) as ExpenseAttachment
}

export function deleteAttachment(
    db: Database.Database,
    id: string,
): { deleted: boolean; file_path?: string } {
    const attachment = db.prepare("SELECT file_path FROM expense_attachments WHERE id = ?").get(id) as { file_path: string } | undefined;
    if (!attachment) return { deleted: false };
    const result = db.prepare("DELETE FROM expense_attachments WHERE id = ?").run(id);
    return { deleted: result.changes > 0, file_path: attachment.file_path };
}

export function getAttachmentById(
    db: Database.Database,
    id: string,
): ExpenseAttachment | null {
    return (
        (db
            .prepare("SELECT * FROM expense_attachments WHERE id = ?")
            .get(id) as ExpenseAttachment | undefined) ?? null
    )
}

// --- Summary / Aggregation ---

// totalAll || 1 guards against division-by-zero when the result set is empty
// (no expenses in the date range), which would otherwise produce NaN percentages.
export function getExpenseSummary(
    db: Database.Database,
    startDate: string,
    endDate: string,
    groupBy: "day" | "week" | "month" | "year",
): {
    period: { start: string; end: string }
    total_spending: number
    transaction_count: number
    by_category: {
        category: string
        total: number
        count: number
        percentage: number
    }[]
    by_period: { period: string; total: number; count: number }[]
} {
    const baseWhere = "WHERE date >= ? AND date <= ?"
    const baseParams = [startDate, endDate]

    const spending = (
        db
            .prepare(
                `SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${baseWhere}`,
            )
            .get(...baseParams) as { total: number }
    ).total

        const txCount = (
        db
            .prepare(`SELECT COUNT(*) as count FROM expenses ${baseWhere}`)
            .get(...baseParams) as { count: number }
    ).count

    const byCategory = db
        .prepare(
            `SELECT category, SUM(amount) as total, COUNT(*) as count
       FROM expenses ${baseWhere}
       GROUP BY category ORDER BY total DESC`,
        )
        .all(...baseParams) as {
        category: string
        total: number
        count: number
    }[]

    const totalAll = byCategory.reduce((s, r) => s + r.total, 0) || 1
    const byCategoryWithPct = byCategory.map((r) => ({
        ...r,
        total: Math.round(r.total * 100) / 100,
        percentage: Math.round((r.total / totalAll) * 10000) / 100,
    }))

    // strftime('%Y-%W') groups by SQLite calendar week number (Sunday-anchored),
    // not ISO-8601 Monday-anchored weeks — close enough for trend analysis.
    let periodExpr: string
    switch (groupBy) {
        case "year":
            periodExpr = "substr(date, 1, 4)"
            break
        case "month":
            periodExpr = "substr(date, 1, 7)"
            break
        case "week":
            // ISO week: group by the Monday of each week
            periodExpr = "strftime('%Y-%W', date)"
            break
        default:
            periodExpr = "substr(date, 1, 10)"
    }

    const byPeriod = db
        .prepare(
            `SELECT ${periodExpr} as period, SUM(amount) as total, COUNT(*) as count
       FROM expenses ${baseWhere}
       GROUP BY period ORDER BY period`,
        )
        .all(...baseParams) as {
        period: string
        total: number
        count: number
    }[]

    return {
        period: { start: startDate, end: endDate },
        total_spending: Math.round(spending * 100) / 100,
        transaction_count: txCount,
        by_category: byCategoryWithPct,
        by_period: byPeriod.map((r) => ({
            ...r,
            total: Math.round(r.total * 100) / 100,
        })),
    }
}
