import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { bulkDeleteExpenses } from "../db/queries.js"
import { BulkDeleteExpenseSchema } from "../types.js"
import { deleteAttachmentFile } from "../utils/attachment.js"

export function register(server: McpServer, db: Database.Database): void {
    server.registerTool(
        "bulk_delete_expenses",
        {
            description:
                "Permanently deletes multiple expense records and all their attachments (DB rows + " +
                "physical files on disk) in a single atomic transaction. " +
                "'ids' is an array of 1–100 expense UUIDs. " +
                "IDs that do not exist are silently skipped and reported in 'not_found_ids' — " +
                "the remaining valid IDs are still deleted. This action is irreversible. " +
                "Returns { deleted_count, not_found_count, not_found_ids, attachments_removed }. " +
                "批量永久删除消费记录及其附件，使用单一事务；不存在的ID会被跳过并在结果中报告，不影响其余记录的删除。",
            inputSchema: BulkDeleteExpenseSchema.shape,
        },
        async (args) => {
            try {
                const { ids } = BulkDeleteExpenseSchema.parse(args)
                const result = bulkDeleteExpenses(db, ids)

                // Filesystem cleanup runs after the transaction commits.
                for (const filePath of result.attachmentPaths) {
                    deleteAttachmentFile(filePath)
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    deleted_count: result.deleted_ids.length,
                                    not_found_count: result.not_found_ids.length,
                                    not_found_ids: result.not_found_ids,
                                    attachments_removed: result.attachmentPaths.length,
                                },
                                null,
                                2,
                            ),
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
