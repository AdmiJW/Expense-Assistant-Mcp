import { describe, it, expect, beforeEach } from "vitest"
import type Database from "better-sqlite3"
import {
    insertExpense,
    getExpenseById,
    listExpenses,
    updateExpense,
    deleteExpense,
    insertAttachment,
    getAttachmentById,
    deleteAttachment,
    getExpenseSummary,
    bulkInsertExpenses,
    bulkDeleteExpenses,
} from "../src/db/queries.js"
import { createTestDb } from "./helpers/db.js"
import { seedExpense, seedAttachment } from "./helpers/fixtures.js"

// ---------------------------------------------------------------------------
// insertExpense
// ---------------------------------------------------------------------------
describe("insertExpense", () => {
    let db: Database.Database
    beforeEach(() => { db = createTestDb() })

    it("persists all provided fields and returns the saved record", () => {
        const expense = insertExpense(db, {
            amount: 25.5,
            category: "食物",
            description: "Nasi lemak",
            date: "2025-01-15T08:00:00.000Z",
            sub_category: "breakfast",
            remark: "with extra sambal",
        })

        expect(expense.amount).toBe(25.5)
        expect(expense.category).toBe("食物")
        expect(expense.description).toBe("Nasi lemak")
        expect(expense.date).toBe("2025-01-15T08:00:00.000Z")
        expect(expense.sub_category).toBe("breakfast")
        expect(expense.remark).toBe("with extra sambal")
        expect(expense.id).toBeTruthy()
    })

    it("assigns a default date when omitted", () => {
        const before = new Date().toISOString()
        const expense = insertExpense(db, { amount: 5, category: "饮料", description: "Teh tarik" })
        const after = new Date().toISOString()

        expect(expense.date >= before).toBe(true)
        expect(expense.date <= after).toBe(true)
    })

    it("stores null for optional fields when not provided", () => {
        const expense = insertExpense(db, { amount: 3, category: "交通", description: "Bus fare" })
        expect(expense.sub_category).toBeNull()
        expect(expense.remark).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// getExpenseById
// ---------------------------------------------------------------------------
describe("getExpenseById", () => {
    let db: Database.Database
    beforeEach(() => { db = createTestDb() })

    it("returns the expense with an empty attachments array when none exist", () => {
        const expense = seedExpense(db)
        const result = getExpenseById(db, expense.id)

        expect(result).not.toBeNull()
        expect(result!.id).toBe(expense.id)
        expect(result!.attachments).toEqual([])
    })

    it("returns null for a nonexistent id", () => {
        expect(getExpenseById(db, "nonexistent-id")).toBeNull()
    })

    it("includes attachments after they are added", () => {
        const expense = seedExpense(db)
        seedAttachment(db, expense.id)

        const result = getExpenseById(db, expense.id)
        expect(result!.attachments).toHaveLength(1)
        expect(result!.attachments[0].expense_id).toBe(expense.id)
    })
})

// ---------------------------------------------------------------------------
// listExpenses
// ---------------------------------------------------------------------------
describe("listExpenses", () => {
    let db: Database.Database
    beforeEach(() => { db = createTestDb() })

    it("returns all records with their total count", () => {
        seedExpense(db, { date: "2025-01-01T00:00:00.000Z" })
        seedExpense(db, { date: "2025-01-02T00:00:00.000Z" })
        seedExpense(db, { date: "2025-01-03T00:00:00.000Z" })

        const { expenses, total } = listExpenses(db, { limit: 20, offset: 0 })
        expect(expenses).toHaveLength(3)
        expect(total).toBe(3)
    })

    it("sorts results newest-first", () => {
        seedExpense(db, { date: "2025-01-01T00:00:00.000Z" })
        seedExpense(db, { date: "2025-01-03T00:00:00.000Z" })
        seedExpense(db, { date: "2025-01-02T00:00:00.000Z" })

        const { expenses } = listExpenses(db, { limit: 20, offset: 0 })
        expect(expenses[0].date).toBe("2025-01-03T00:00:00.000Z")
        expect(expenses[2].date).toBe("2025-01-01T00:00:00.000Z")
    })

    it("filters by start_date (inclusive)", () => {
        seedExpense(db, { date: "2025-01-01T00:00:00.000Z" })
        seedExpense(db, { date: "2025-01-05T00:00:00.000Z" })

        const { expenses, total } = listExpenses(db, {
            start_date: "2025-01-03T00:00:00.000Z",
            limit: 20, offset: 0,
        })
        expect(total).toBe(1)
        expect(expenses[0].date).toBe("2025-01-05T00:00:00.000Z")
    })

    it("filters by end_date (inclusive)", () => {
        seedExpense(db, { date: "2025-01-01T00:00:00.000Z" })
        seedExpense(db, { date: "2025-01-10T00:00:00.000Z" })

        const { expenses, total } = listExpenses(db, {
            end_date: "2025-01-05T00:00:00.000Z",
            limit: 20, offset: 0,
        })
        expect(total).toBe(1)
        expect(expenses[0].date).toBe("2025-01-01T00:00:00.000Z")
    })

    it("filters by category", () => {
        seedExpense(db, { category: "食物" })
        seedExpense(db, { category: "交通" })
        seedExpense(db, { category: "食物" })

        const { expenses, total } = listExpenses(db, { category: "食物", limit: 20, offset: 0 })
        expect(total).toBe(2)
        expenses.forEach((e) => expect(e.category).toBe("食物"))
    })

    it("paginates correctly — total reflects full count not page size", () => {
        for (let i = 0; i < 5; i++) seedExpense(db)

        const page1 = listExpenses(db, { limit: 2, offset: 0 })
        expect(page1.expenses).toHaveLength(2)
        expect(page1.total).toBe(5)

        const page2 = listExpenses(db, { limit: 2, offset: 2 })
        expect(page2.expenses).toHaveLength(2)
        expect(page2.total).toBe(5)

        const page3 = listExpenses(db, { limit: 2, offset: 4 })
        expect(page3.expenses).toHaveLength(1)
        expect(page3.total).toBe(5)
    })

    it("returns empty array and zero total when no records match", () => {
        const { expenses, total } = listExpenses(db, { category: "娱乐", limit: 20, offset: 0 })
        expect(expenses).toHaveLength(0)
        expect(total).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// updateExpense
// ---------------------------------------------------------------------------
describe("updateExpense", () => {
    let db: Database.Database
    beforeEach(() => { db = createTestDb() })

    it("updates only the specified fields, leaving others unchanged", () => {
        const expense = seedExpense(db, { amount: 10, description: "Original" })
        const updated = updateExpense(db, expense.id, { amount: 99.9 })

        expect(updated!.amount).toBe(99.9)
        expect(updated!.description).toBe("Original")
        expect(updated!.category).toBe(expense.category)
    })

    it("clears sub_category and remark when set to null", () => {
        const expense = seedExpense(db, { sub_category: "snack", remark: "tasty" })
        const updated = updateExpense(db, expense.id, { sub_category: null, remark: null })

        expect(updated!.sub_category).toBeNull()
        expect(updated!.remark).toBeNull()
    })

    it("returns null for a nonexistent id", () => {
        expect(updateExpense(db, "ghost-id", { amount: 5 })).toBeNull()
    })

    it("returns the unmodified record when no fields are passed", () => {
        const expense = seedExpense(db, { amount: 42 })
        const result = updateExpense(db, expense.id, {})
        expect(result!.amount).toBe(42)
    })
})

// ---------------------------------------------------------------------------
// deleteExpense
// ---------------------------------------------------------------------------
describe("deleteExpense", () => {
    let db: Database.Database
    beforeEach(() => { db = createTestDb() })

    it("returns deleted:true and the expense is gone", () => {
        const expense = seedExpense(db)
        const result = deleteExpense(db, expense.id)

        expect(result.deleted).toBe(true)
        expect(getExpenseById(db, expense.id)).toBeNull()
    })

    it("returns empty attachmentPaths when no attachments exist", () => {
        const expense = seedExpense(db)
        const result = deleteExpense(db, expense.id)
        expect(result.attachmentPaths).toEqual([])
    })

    it("returns the attachment file_paths before deleting them", () => {
        const expense = seedExpense(db)
        seedAttachment(db, expense.id, { file_path: "attachments/receipt-1.jpg" })
        seedAttachment(db, expense.id, { file_path: "attachments/receipt-2.pdf" })

        const result = deleteExpense(db, expense.id)
        expect(result.attachmentPaths).toHaveLength(2)
        expect(result.attachmentPaths).toContain("attachments/receipt-1.jpg")
        expect(result.attachmentPaths).toContain("attachments/receipt-2.pdf")
    })

    it("cascades to attachment rows — they are gone after expense deletion", () => {
        const expense = seedExpense(db)
        const att = seedAttachment(db, expense.id)

        deleteExpense(db, expense.id)

        // Direct DB check — attachment row must be gone via FK cascade
        const row = db.prepare("SELECT id FROM expense_attachments WHERE id = ?").get(att.id)
        expect(row).toBeUndefined()
    })

    it("returns deleted:false for a nonexistent id", () => {
        const result = deleteExpense(db, "ghost-id")
        expect(result.deleted).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// insertAttachment / getAttachmentById / deleteAttachment
// ---------------------------------------------------------------------------
describe("attachment queries", () => {
    let db: Database.Database
    beforeEach(() => { db = createTestDb() })

    it("insertAttachment links to the expense and is retrievable by id", () => {
        const expense = seedExpense(db)
        const att = insertAttachment(db, {
            expense_id: expense.id,
            file_path: "attachments/invoice.pdf",
            original_filename: "invoice.pdf",
            mime_type: "application/pdf",
            remark: "Q1 invoice",
        })

        const retrieved = getAttachmentById(db, att.id)
        expect(retrieved).not.toBeNull()
        expect(retrieved!.expense_id).toBe(expense.id)
        expect(retrieved!.mime_type).toBe("application/pdf")
        expect(retrieved!.remark).toBe("Q1 invoice")
    })

    it("getAttachmentById returns null for a nonexistent id", () => {
        expect(getAttachmentById(db, "ghost-id")).toBeNull()
    })

    it("deleteAttachment removes the row and returns deleted:true with file_path", () => {
        const expense = seedExpense(db)
        const att = seedAttachment(db, expense.id, { file_path: "attachments/del-test.jpg" })

        const result = deleteAttachment(db, att.id)
        expect(result.deleted).toBe(true)
        expect(result.file_path).toBe("attachments/del-test.jpg")
        expect(getAttachmentById(db, att.id)).toBeNull()
    })

    it("deleteAttachment returns deleted:false for a nonexistent id", () => {
        const result = deleteAttachment(db, "ghost-id")
        expect(result.deleted).toBe(false)
        expect(result.file_path).toBeUndefined()
    })
})

// ---------------------------------------------------------------------------
// getExpenseSummary
// ---------------------------------------------------------------------------
describe("getExpenseSummary", () => {
    let db: Database.Database
    beforeEach(() => { db = createTestDb() })

    const START = "2025-01-01T00:00:00.000Z"
    const END   = "2025-01-31T23:59:59.999Z"

    it("returns zeros and empty arrays when no records exist in the range", () => {
        const summary = getExpenseSummary(db, START, END, "day")
        expect(summary.total_spending).toBe(0)
        expect(summary.transaction_count).toBe(0)
        expect(summary.by_category).toEqual([])
        expect(summary.by_period).toEqual([])
    })

    it("sums total_spending correctly", () => {
        seedExpense(db, { amount: 10, date: "2025-01-05T00:00:00.000Z" })
        seedExpense(db, { amount: 20, date: "2025-01-10T00:00:00.000Z" })
        seedExpense(db, { amount: 5.5, date: "2025-01-15T00:00:00.000Z" })

        const summary = getExpenseSummary(db, START, END, "day")
        expect(summary.total_spending).toBe(35.5)
        expect(summary.transaction_count).toBe(3)
    })

    it("excludes records outside the date range", () => {
        seedExpense(db, { amount: 100, date: "2024-12-31T23:59:59.000Z" })
        seedExpense(db, { amount: 50, date: "2025-01-15T00:00:00.000Z" })

        const summary = getExpenseSummary(db, START, END, "day")
        expect(summary.total_spending).toBe(50)
    })

    it("by_category percentages sum to 100 (within rounding tolerance)", () => {
        seedExpense(db, { amount: 30, category: "食物", date: "2025-01-01T00:00:00.000Z" })
        seedExpense(db, { amount: 20, category: "交通", date: "2025-01-01T00:00:00.000Z" })
        seedExpense(db, { amount: 50, category: "购物", date: "2025-01-01T00:00:00.000Z" })

        const summary = getExpenseSummary(db, START, END, "day")
        const totalPct = summary.by_category.reduce((s, r) => s + r.percentage, 0)
        expect(totalPct).toBeCloseTo(100, 0)
    })

    it("by_category is ordered by total descending", () => {
        seedExpense(db, { amount: 10, category: "饮料", date: "2025-01-01T00:00:00.000Z" })
        seedExpense(db, { amount: 90, category: "购物", date: "2025-01-01T00:00:00.000Z" })

        const summary = getExpenseSummary(db, START, END, "day")
        expect(summary.by_category[0].category).toBe("购物")
    })

    it("group_by day produces one row per distinct day", () => {
        seedExpense(db, { date: "2025-01-01T00:00:00.000Z" })
        seedExpense(db, { date: "2025-01-01T12:00:00.000Z" }) // same day
        seedExpense(db, { date: "2025-01-02T00:00:00.000Z" })

        const summary = getExpenseSummary(db, START, END, "day")
        expect(summary.by_period).toHaveLength(2)
        expect(summary.by_period[0].period).toBe("2025-01-01")
        expect(summary.by_period[0].count).toBe(2)
    })

    it("group_by month collapses multiple days into one row", () => {
        seedExpense(db, { date: "2025-01-05T00:00:00.000Z" })
        seedExpense(db, { date: "2025-01-20T00:00:00.000Z" })

        const summary = getExpenseSummary(db, START, END, "month")
        expect(summary.by_period).toHaveLength(1)
        expect(summary.by_period[0].period).toBe("2025-01")
        expect(summary.by_period[0].count).toBe(2)
    })

    it("group_by year collapses all January records into one row", () => {
        seedExpense(db, { date: "2025-01-05T00:00:00.000Z" })
        seedExpense(db, { date: "2025-01-28T00:00:00.000Z" })

        const summary = getExpenseSummary(db, START, END, "year")
        expect(summary.by_period).toHaveLength(1)
        expect(summary.by_period[0].period).toBe("2025")
    })

    it("returns period boundaries that match inputs", () => {
        const summary = getExpenseSummary(db, START, END, "day")
        expect(summary.period.start).toBe(START)
        expect(summary.period.end).toBe(END)
    })
})

// ---------------------------------------------------------------------------
// bulkInsertExpenses
// ---------------------------------------------------------------------------
describe("bulkInsertExpenses", () => {
    let db: Database.Database
    beforeEach(() => { db = createTestDb() })

    it("inserts all records and returns them in input order", () => {
        const results = bulkInsertExpenses(db, [
            { amount: 10, category: "食物", description: "Roti canai" },
            { amount: 20, category: "交通", description: "Grab ride" },
            { amount: 5.5, category: "饮料", description: "Teh tarik" },
        ])

        expect(results).toHaveLength(3)
        expect(results[0].description).toBe("Roti canai")
        expect(results[1].description).toBe("Grab ride")
        expect(results[2].description).toBe("Teh tarik")
    })

    it("persists all records to the database", () => {
        const results = bulkInsertExpenses(db, [
            { amount: 10, category: "食物", description: "A" },
            { amount: 20, category: "饮料", description: "B" },
        ])

        for (const r of results) {
            const fetched = getExpenseById(db, r.id)
            expect(fetched).not.toBeNull()
            expect(fetched!.id).toBe(r.id)
        }
    })

    it("returns correct count matching the input array length", () => {
        const results = bulkInsertExpenses(db, [
            { amount: 1, category: "食物", description: "X" },
            { amount: 2, category: "食物", description: "Y" },
            { amount: 3, category: "食物", description: "Z" },
        ])
        expect(results.length).toBe(3)
    })

    it("respects optional fields — sub_category and remark default to null", () => {
        const [result] = bulkInsertExpenses(db, [
            { amount: 5, category: "其他", description: "Misc" },
        ])
        expect(result.sub_category).toBeNull()
        expect(result.remark).toBeNull()
    })

    it("persists explicit date when provided", () => {
        const date = "2025-03-01T10:00:00.000Z"
        const [result] = bulkInsertExpenses(db, [
            { amount: 5, category: "食物", description: "Test", date },
        ])
        expect(result.date).toBe(date)
    })

    it("each returned record has a unique id", () => {
        const results = bulkInsertExpenses(db, [
            { amount: 1, category: "食物", description: "A" },
            { amount: 2, category: "食物", description: "B" },
            { amount: 3, category: "食物", description: "C" },
        ])
        const ids = results.map((r) => r.id)
        expect(new Set(ids).size).toBe(3)
    })
})

// ---------------------------------------------------------------------------
// bulkDeleteExpenses
// ---------------------------------------------------------------------------
describe("bulkDeleteExpenses", () => {
    let db: Database.Database
    beforeEach(() => { db = createTestDb() })

    it("deletes all specified IDs and reports them in deleted_ids", () => {
        const a = seedExpense(db)
        const b = seedExpense(db)
        const c = seedExpense(db)

        const result = bulkDeleteExpenses(db, [a.id, b.id, c.id])

        expect(result.deleted_ids).toHaveLength(3)
        expect(result.deleted_ids).toContain(a.id)
        expect(result.deleted_ids).toContain(b.id)
        expect(result.deleted_ids).toContain(c.id)
        expect(result.not_found_ids).toHaveLength(0)
    })

    it("records are actually gone from the database after deletion", () => {
        const a = seedExpense(db)
        const b = seedExpense(db)

        bulkDeleteExpenses(db, [a.id, b.id])

        expect(getExpenseById(db, a.id)).toBeNull()
        expect(getExpenseById(db, b.id)).toBeNull()
    })

    it("reports non-existent IDs in not_found_ids without affecting valid deletes", () => {
        const a = seedExpense(db)

        const result = bulkDeleteExpenses(db, [a.id, "ghost-1", "ghost-2"])

        expect(result.deleted_ids).toEqual([a.id])
        expect(result.not_found_ids).toContain("ghost-1")
        expect(result.not_found_ids).toContain("ghost-2")
        expect(getExpenseById(db, a.id)).toBeNull()
    })

    it("collects attachment file_paths from all deleted expenses", () => {
        const a = seedExpense(db)
        const b = seedExpense(db)
        seedAttachment(db, a.id, { file_path: "attachments/a1.jpg" })
        seedAttachment(db, a.id, { file_path: "attachments/a2.pdf" })
        seedAttachment(db, b.id, { file_path: "attachments/b1.jpg" })

        const result = bulkDeleteExpenses(db, [a.id, b.id])

        expect(result.attachmentPaths).toHaveLength(3)
        expect(result.attachmentPaths).toContain("attachments/a1.jpg")
        expect(result.attachmentPaths).toContain("attachments/a2.pdf")
        expect(result.attachmentPaths).toContain("attachments/b1.jpg")
    })

    it("cascade removes all attachment rows from the DB", () => {
        const expense = seedExpense(db)
        const att1 = seedAttachment(db, expense.id)
        const att2 = seedAttachment(db, expense.id)

        bulkDeleteExpenses(db, [expense.id])

        expect(getAttachmentById(db, att1.id)).toBeNull()
        expect(getAttachmentById(db, att2.id)).toBeNull()
    })

    it("returns empty deleted_ids when all IDs are not found", () => {
        const result = bulkDeleteExpenses(db, ["ghost-1", "ghost-2"])

        expect(result.deleted_ids).toHaveLength(0)
        expect(result.not_found_ids).toHaveLength(2)
        expect(result.attachmentPaths).toHaveLength(0)
    })

    it("duplicate IDs: first delete succeeds, second is treated as not_found", () => {
        const expense = seedExpense(db)

        const result = bulkDeleteExpenses(db, [expense.id, expense.id])

        expect(result.deleted_ids).toHaveLength(1)
        expect(result.not_found_ids).toHaveLength(1)
        expect(result.not_found_ids[0]).toBe(expense.id)
    })
})
