import path from "node:path"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { getExpenseById } from "../db/queries.js"
import { GetExpenseSchema } from "../types.js"
import type { Expense } from "../types.js"
import { getDataDir } from "../utils/paths.js"
import { toLocalDisplay } from "../utils/date.js"

const fmt = (e: Expense): Expense => ({
    ...e,
    date:       toLocalDisplay(e.date),
    created_at: toLocalDisplay(e.created_at),
    updated_at: toLocalDisplay(e.updated_at),
})

export function register(server: McpServer, db: Database.Database): void {
    server.registerTool(
        "get_expense",
        {
            description:
                "Retrieves the full record of a single expense by its UUID 'id', including all attached files. " +
                "Attachments are returned under the 'attachments' key — each entry contains 'id', " +
                "'original_filename', 'mime_type', 'remark', and 'file_path' resolved to an absolute OS path " +
                "ready to pass directly to the Telegram sendDocument API. " +
                "Returns an error if the expense id does not exist. Timestamps are returned in local time. " +
                "根据UUID获取单条消费记录完整详情，附件的 file_path 为绝对路径，时间以本地时区显示。",
            inputSchema: GetExpenseSchema.shape,
        },
        async (args) => {
            try {
                const { id } = GetExpenseSchema.parse(args)
                const expense = getExpenseById(db, id)

                if (!expense) {
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

                // Resolve attachment file_path to absolute at response time so the DB
                // stays portable (relative paths) while the AI gets a ready-to-use path.
                const dataDir = getDataDir()
                const enriched = {
                    ...fmt(expense),
                    attachments: expense.attachments.map((att) => ({
                        ...att,
                        file_path: path.join(dataDir, att.file_path),
                        created_at: toLocalDisplay(att.created_at),
                    })),
                }

                return {
                    content: [
                        { type: "text", text: JSON.stringify(enriched, null, 2) },
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
