import { z } from "zod"

export const EXPENSE_CATEGORIES = [
    "食物",
    "饮料",
    "交通",
    "购物",
    "娱乐",
    "居家",
    "数码用品",
    "医疗",
    "旅行",
    "其他",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const CategorySchema = z.enum(EXPENSE_CATEGORIES)

// --- Zod Schemas for tool inputs ---

export const AddExpenseSchema = z.object({
    amount: z.number().positive(),
    category: CategorySchema,
    description: z.string().min(1),
    date: z.string().datetime().optional(),
    sub_category: z.string().optional(),
    remark: z.string().optional(),
})

export const GetExpenseSchema = z.object({
    id: z.string().min(1),
})

export const ListExpensesSchema = z.object({
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    category: CategorySchema.optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
})

export const UpdateExpenseSchema = z.object({
    id: z.string().min(1),
    amount: z.number().positive().optional(),
    category: CategorySchema.optional(),
    sub_category: z.string().nullable().optional(),
    description: z.string().min(1).optional(),
    remark: z.string().nullable().optional(),
    date: z.string().datetime().optional(),
})

export const DeleteExpenseSchema = z.object({
    id: z.string().min(1),
})

export const BulkAddExpenseSchema = z.object({
    expenses: z.array(AddExpenseSchema).min(1).max(100),
})

export const BulkDeleteExpenseSchema = z.object({
    ids: z.array(z.string().min(1)).min(1).max(100),
})

export const AddAttachmentSchema = z.object({
    expense_id: z.string().min(1),
    file_path: z.string().min(1),
    original_filename: z.string().min(1),
    mime_type: z.string().default("application/octet-stream"),
    remark: z.string().optional(),
})

export const RemoveAttachmentSchema = z.object({
    id: z.string().min(1),
})

export const ExpenseSummarySchema = z.object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    group_by: z.enum(["day", "week", "month", "year"]).default("day"),
})

// --- TypeScript interfaces ---

export interface Expense {
    id: string
    amount: number
    category: string
    sub_category: string | null
    description: string
    remark: string | null
    date: string
    created_at: string
    updated_at: string
}

export interface ExpenseAttachment {
    id: string
    expense_id: string
    file_path: string
    original_filename: string
    mime_type: string
    remark: string | null
    created_at: string
}

export interface ExpenseWithAttachments extends Expense {
    attachments: ExpenseAttachment[]
}
