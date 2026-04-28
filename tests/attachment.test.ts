import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { saveAttachment, deleteAttachmentFile, mimeToExt } from "../src/utils/attachment.js"

// ---------------------------------------------------------------------------
// mimeToExt
// ---------------------------------------------------------------------------
describe("mimeToExt", () => {
    it("maps common image types correctly", () => {
        expect(mimeToExt("image/jpeg")).toBe(".jpg")
        expect(mimeToExt("image/png")).toBe(".png")
        expect(mimeToExt("image/webp")).toBe(".webp")
        expect(mimeToExt("image/gif")).toBe(".gif")
    })

    it("maps document types correctly", () => {
        expect(mimeToExt("application/pdf")).toBe(".pdf")
        expect(mimeToExt("application/msword")).toBe(".doc")
        expect(mimeToExt("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(".docx")
        expect(mimeToExt("application/vnd.ms-excel")).toBe(".xls")
        expect(mimeToExt("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(".xlsx")
        expect(mimeToExt("text/plain")).toBe(".txt")
        expect(mimeToExt("text/csv")).toBe(".csv")
    })

    it("maps audio types correctly", () => {
        expect(mimeToExt("audio/mpeg")).toBe(".mp3")
        expect(mimeToExt("audio/ogg")).toBe(".ogg")
        expect(mimeToExt("audio/opus")).toBe(".opus")
        expect(mimeToExt("audio/wav")).toBe(".wav")
        expect(mimeToExt("audio/mp4")).toBe(".m4a")
    })

    it("maps video types correctly", () => {
        expect(mimeToExt("video/mp4")).toBe(".mp4")
        expect(mimeToExt("video/quicktime")).toBe(".mov")
        expect(mimeToExt("video/webm")).toBe(".webm")
    })

    it("maps archive types correctly", () => {
        expect(mimeToExt("application/zip")).toBe(".zip")
        expect(mimeToExt("application/gzip")).toBe(".gz")
    })

    it("returns .bin for unknown MIME types instead of a misleading extension", () => {
        expect(mimeToExt("application/octet-stream")).toBe(".bin")
        expect(mimeToExt("application/x-unknown-type")).toBe(".bin")
        expect(mimeToExt("")).toBe(".bin")
    })
})

// ---------------------------------------------------------------------------
// saveAttachment & deleteAttachmentFile
// Redirect EXPENSE_DATA_DIR to a temp directory so tests don't touch the
// real data folder and clean up after themselves automatically.
// ---------------------------------------------------------------------------
describe("saveAttachment", () => {
    let tmpDir: string
    let sourceFile: string
    const originalDataDir = process.env.EXPENSE_DATA_DIR

    beforeEach(() => {
        // Create isolated temp workspace for each test
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"))
        process.env.EXPENSE_DATA_DIR = tmpDir

        // Create a dummy source file to copy
        sourceFile = path.join(tmpDir, "source.jpg")
        fs.writeFileSync(sourceFile, "fake-image-data")
    })

    afterEach(() => {
        // Restore env and clean up temp dir
        if (originalDataDir === undefined) {
            delete process.env.EXPENSE_DATA_DIR
        } else {
            process.env.EXPENSE_DATA_DIR = originalDataDir
        }
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it("copies the source file and returns a relative file_path", () => {
        const result = saveAttachment(sourceFile, "receipt.jpg", "image/jpeg")

        expect(result.filePath).toMatch(/^attachments\//)
        expect(result.filePath.endsWith(".jpg")).toBe(true)
        // Original source file must still exist (copy, not move)
        expect(fs.existsSync(sourceFile)).toBe(true)
    })

    it("the copied file exists at the resolved absolute path", () => {
        const result = saveAttachment(sourceFile, "receipt.jpg", "image/jpeg")
        const absolutePath = path.join(tmpDir, result.filePath)
        expect(fs.existsSync(absolutePath)).toBe(true)
    })

    it("infers the extension from originalFilename when provided", () => {
        const result = saveAttachment(sourceFile, "invoice.pdf", "image/jpeg")
        expect(result.filePath.endsWith(".pdf")).toBe(true)
    })

    it("falls back to mimeToExt when filename has no extension", () => {
        const noExtSource = path.join(tmpDir, "noext")
        fs.writeFileSync(noExtSource, "data")

        const result = saveAttachment(noExtSource, "receipt", "application/pdf")
        expect(result.filePath.endsWith(".pdf")).toBe(true)
    })

    it("uses .tmp when no filename extension and no mimeType provided", () => {
        const noExtSource = path.join(tmpDir, "noext")
        fs.writeFileSync(noExtSource, "data")

        const result = saveAttachment(noExtSource, "noname")
        expect(result.filePath.endsWith(".tmp")).toBe(true)
    })

    it("throws when the source file does not exist", () => {
        expect(() => saveAttachment("/nonexistent/path/file.jpg")).toThrow("File not found")
    })

    it("returns the correct originalFilename", () => {
        const result = saveAttachment(sourceFile, "my-receipt.jpg")
        expect(result.originalFilename).toBe("my-receipt.jpg")
    })

    it("uses basename of sourceFilePath as originalFilename when not provided", () => {
        const result = saveAttachment(sourceFile)
        expect(result.originalFilename).toBe("source.jpg")
    })
})

// ---------------------------------------------------------------------------
// deleteAttachmentFile
// ---------------------------------------------------------------------------
describe("deleteAttachmentFile", () => {
    let tmpDir: string
    const originalDataDir = process.env.EXPENSE_DATA_DIR

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-del-test-"))
        process.env.EXPENSE_DATA_DIR = tmpDir
        fs.mkdirSync(path.join(tmpDir, "attachments"), { recursive: true })
    })

    afterEach(() => {
        if (originalDataDir === undefined) {
            delete process.env.EXPENSE_DATA_DIR
        } else {
            process.env.EXPENSE_DATA_DIR = originalDataDir
        }
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it("deletes an existing file successfully", () => {
        const filePath = path.join(tmpDir, "attachments", "to-delete.jpg")
        fs.writeFileSync(filePath, "content")

        deleteAttachmentFile("attachments/to-delete.jpg")
        expect(fs.existsSync(filePath)).toBe(false)
    })

    it("does not throw when the file is already gone (silent no-op)", () => {
        // File never created — should not throw
        expect(() => deleteAttachmentFile("attachments/ghost.jpg")).not.toThrow()
    })
})
