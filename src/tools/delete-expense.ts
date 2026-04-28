import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { deleteExpense } from "../db/queries.js"
import { DeleteExpenseSchema } from "../types.js"
import { deleteAttachmentFile } from "../utils/attachment.js"

export function register(server: McpServer, db: Database.Database): void {
    server.registerTool(
        "delete_expense",
        {
            description:
                "Permanently removes an expense record and all its attachments — both the database rows and " +
                "the physical files on disk. This action is irreversible. " +
                "Returns a confirmation message including how many attachment files were deleted. " +
                "永久删除一条消费记录及其全部附件（数据库行 + 磁盘文件），不可恢复。",
            inputSchema: DeleteExpenseSchema.shape,
        },
        async (args) => {
            try {
                const { id } = DeleteExpenseSchema.parse(args)
                const result = deleteExpense(db, id)

                if (!result.deleted) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `未找到ID为 ${id} 的消费记录。Expense not found.`,
                            },
                        ],
                        isError: true,
                    }
                }

                // Filesystem cleanup runs after the DB commit succeeds, so a
                // partial failure leaves orphaned files rather than broken DB refs.
                for (const filePath of result.attachmentPaths) {
                    deleteAttachmentFile(filePath)
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: `已删除消费记录 ${id}，同时删除了 ${result.attachmentPaths.length} 个附件。`,
                        },
                    ],
                }
            } catch (err) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `错误: ${err instanceof Error ? err.message : String(err)}`,
                        },
                    ],
                    isError: true,
                }
            }
        },
    )
}
