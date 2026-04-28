import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// EXPENSE_DATA_DIR is the production deployment hook — set it to redirect all
// DB and attachment storage to a persistent volume outside the project tree.
function resolveDataDir(): string {
    const envDir = process.env.EXPENSE_DATA_DIR
    if (envDir) return path.resolve(envDir)
    // Default: <project_root>/data  (dist/utils → ../../data)
    return path.resolve(__dirname, "..", "..", "data")
}

// mkdirSync is intentionally called on every access — it is idempotent and
// guarantees the directory exists before any subsequent read or write operation.
export function getDataDir(): string {
    const dir = resolveDataDir()
    fs.mkdirSync(dir, { recursive: true })
    return dir
}

export function getDbPath(): string {
    return path.join(getDataDir(), "expenses.db")
}

export function getAttachmentsDir(): string {
    const dir = path.join(getDataDir(), "attachments")
    fs.mkdirSync(dir, { recursive: true })
    return dir
}
