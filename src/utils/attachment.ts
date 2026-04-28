import fs from "node:fs"
import path from "node:path"
import { v4 as uuidv4 } from "uuid"
import { getAttachmentsDir, getDataDir } from "./paths.js"

// We copy rather than move: the source file belongs to the caller (e.g. a Telegram
// bot's temp download); the MCP owns only its internal copy in the attachments dir.
export function saveAttachment(
    sourceFilePath: string,
    originalFilename?: string,
    mimeType?: string,
): { filePath: string; savedFilename: string; originalFilename: string } {
    if (!fs.existsSync(sourceFilePath)) {
        throw new Error(`File not found at path: ${sourceFilePath}`)
    }

    const determinedOriginalName =
        originalFilename || path.basename(sourceFilePath)
    const ext =
        path.extname(determinedOriginalName) ||
        (mimeType ? mimeToExt(mimeType) : ".tmp")
    const savedFilename = `${uuidv4()}${ext}`
    const absolutePath = path.join(getAttachmentsDir(), savedFilename)

    fs.copyFileSync(sourceFilePath, absolutePath)

    // Store a relative path (relative to getDataDir()) so the entire data dir
    // can be relocated via EXPENSE_DATA_DIR without breaking stored references.
    const filePath = `attachments/${savedFilename}`
    return { filePath, savedFilename, originalFilename: determinedOriginalName }
}

// Swallowing ENOENT is intentional: if the file was manually removed from disk,
// the DB record delete should still succeed without surfacing a filesystem error.
export function deleteAttachmentFile(relativeFilePath: string): void {
    const absolutePath = path.join(getDataDir(), relativeFilePath)
    try {
        fs.unlinkSync(absolutePath)
    } catch {
        // File may already be gone — ignore
    }
}

// Exported so it can be unit-tested independently.
export function mimeToExt(mime: string): string {
    const map: Record<string, string> = {
        // Images
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/heic": ".heic",
        "image/heif": ".heif",
        "image/bmp": ".bmp",
        "image/tiff": ".tiff",
        "image/svg+xml": ".svg",
        // Documents
        "application/pdf": ".pdf",
        "application/msword": ".doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/vnd.ms-excel": ".xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "application/vnd.ms-powerpoint": ".ppt",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
        "text/plain": ".txt",
        "text/csv": ".csv",
        "application/json": ".json",
        "application/xml": ".xml",
        "text/xml": ".xml",
        // Audio (covers Telegram voice notes and music files)
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mp4": ".m4a",
        "audio/aac": ".aac",
        "audio/opus": ".opus",
        "audio/flac": ".flac",
        // Video
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/x-msvideo": ".avi",
        "video/webm": ".webm",
        "video/x-matroska": ".mkv",
        // Archives
        "application/zip": ".zip",
        "application/x-tar": ".tar",
        "application/gzip": ".gz",
        "application/x-rar-compressed": ".rar",
        "application/x-7z-compressed": ".7z",
    }
    // Fall back to .bin — a neutral extension that won't mislead file openers
    // the way the old .jpg default would for PDFs, audio, etc.
    return map[mime] ?? ".bin"
}
