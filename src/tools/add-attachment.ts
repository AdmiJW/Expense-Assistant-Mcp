import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { insertAttachment } from "../db/queries.js"
import { AddAttachmentSchema } from "../types.js"
import { saveAttachment } from "../utils/attachment.js"

export function register(server: McpServer, db: Database.Database): void {
    server.registerTool(
        "add_attachment",
        {
            description:
                "Copies a file from the host filesystem into the MCP data store and links it to an expense. " +
                "'file_path' must be an absolute OS path to the source file (e.g. a file the Telegram bot has already downloaded to disk). " +
                "The MCP copies the file to its own attachments directory — the original is not moved or deleted. " +
                "'original_filename' is the display name stored for reference. " +
                "'mime_type' defaults to application/octet-stream; provide the correct MIME type when known (e.g. image/jpeg, application/pdf). " +
                "The expense identified by 'expense_id' must already exist. " +
                "Returns the new ExpenseAttachment record including its generated 'id' and stored 'file_path'. " +
                "将文件从宿主文件系统复制到MCP存储并关联到消费记录，file_path 须为绝对路径。",
            inputSchema: AddAttachmentSchema.shape,
        },
        async (args) => {
            try {
                const data = AddAttachmentSchema.parse(args)

                // Verify expense exists
                const expense = db
                    .prepare("SELECT id FROM expenses WHERE id = ?")
                    .get(data.expense_id)
                if (!expense) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `未找到ID为 ${data.expense_id} 的消费记录。Cannot attach attachment to non-existent expense.`,
                            },
                        ],
                        isError: true,
                    }
                }

                const { filePath, originalFilename: actualOriginalFilename } =
                    saveAttachment(
                        data.file_path,
                        data.original_filename,
                        data.mime_type,
                    )
                const attachment = insertAttachment(db, {
                    expense_id: data.expense_id,
                    file_path: filePath,
                    original_filename:
                        data.original_filename || actualOriginalFilename,
                    mime_type: data.mime_type,
                    remark: data.remark,
                })

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(attachment, null, 2),
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
