import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { deleteAttachment } from "../db/queries.js"
import { RemoveAttachmentSchema } from "../types.js"
import { deleteAttachmentFile } from "../utils/attachment.js"

export function register(server: McpServer, db: Database.Database): void {
    server.registerTool(
        "remove_attachment",
        {
            description:
                "Deletes a single attachment by its UUID 'id' — removes both the database record and the " +
                "physical file from disk. Does not affect the parent expense or its other attachments. " +
                "Returns a confirmation string, or an error if the attachment id does not exist. " +
                "删除单条附件记录及其磁盘文件，不影响父消费记录。",
            inputSchema: RemoveAttachmentSchema.shape,
        },
        async (args) => {
            try {
                const { id } = RemoveAttachmentSchema.parse(args)
                const result = deleteAttachment(db, id)

                if (!result.deleted) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `未找到ID为 ${id} 的附件。Attachment not found.`,
                            },
                        ],
                        isError: true,
                    }
                }

                if (result.deleted && result.file_path) {
                    deleteAttachmentFile(result.file_path)
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: `已删除 / Deleted attachment ${id}`,
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
