import { CanvasManager } from "../../src/core/canvas.js";
import { Document } from "../../src/core/document.js";
import { buildRawDocument } from "../helpers/create-test-document.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

describe("CanvasManager", () => {
  let manager: CanvasManager;

  beforeEach(() => {
    manager = new CanvasManager();
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  // ============================================================
  // create()
  // ============================================================

  describe("create()", () => {
    it("creates a document and writes it to disk", async () => {
      const doc = await manager.create("/tmp/project.canvas.json");
      expect(doc).toBeInstanceOf(Document);
      expect(mockMkdir).toHaveBeenCalledWith("/tmp", { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/tmp/project.canvas.json",
        expect.any(String),
        "utf-8"
      );
    });

    it("derives name from path when no name is given", async () => {
      const doc = await manager.create("/some/dir/my-site.canvas.json");
      expect(doc.meta.name).toBe("my-site");
    });

    it("uses custom name when provided", async () => {
      const doc = await manager.create("/tmp/test.canvas.json", "Custom Name");
      expect(doc.meta.name).toBe("Custom Name");
    });

    it("uses custom width when provided", async () => {
      const doc = await manager.create("/tmp/test.canvas.json", "Mobile", 375);
      const page = doc.getPage("page1");
      expect(page!.width).toBe(375);
    });

    it("merges tokens into the document", async () => {
      const doc = await manager.create("/tmp/test.canvas.json", "Tokens", undefined, {
        colors: { primary: { value: "#ff0000" } },
      });
      expect(doc.data.tokens.colors["primary"]).toEqual({ value: "#ff0000" });
    });

    it("creates parent directories with mkdir recursive", async () => {
      await manager.create("/deep/nested/path/file.canvas.json");
      expect(mockMkdir).toHaveBeenCalledWith("/deep/nested/path", { recursive: true });
    });

    it("sets currentDoc and currentPath after creation", async () => {
      const doc = await manager.create("/tmp/test.canvas.json");
      expect(manager.document).toBe(doc);
      expect(manager.filePath).toBe("/tmp/test.canvas.json");
    });
  });

  // ============================================================
  // open()
  // ============================================================

  describe("open()", () => {
    it("reads and parses a valid file", async () => {
      const raw = buildRawDocument();
      mockReadFile.mockResolvedValue(JSON.stringify(raw));

      const doc = await manager.open("/tmp/existing.canvas.json");
      expect(doc).toBeInstanceOf(Document);
      expect(doc.meta.name).toBe("Raw Doc");
      expect(manager.document).toBe(doc);
      expect(manager.filePath).toBe("/tmp/existing.canvas.json");
    });

    it("throws for invalid JSON", async () => {
      mockReadFile.mockResolvedValue("not-json{{{");
      await expect(manager.open("/tmp/bad.json")).rejects.toThrow();
    });

    it("throws for schema-invalid document", async () => {
      const invalid = { version: "1.0.0", meta: { name: 123 }, pages: {} };
      mockReadFile.mockResolvedValue(JSON.stringify(invalid));
      await expect(manager.open("/tmp/invalid.canvas.json")).rejects.toThrow();
    });
  });

  // ============================================================
  // save()
  // ============================================================

  describe("save()", () => {
    it("writes the current document to its path", async () => {
      await manager.create("/tmp/project.canvas.json");
      vi.clearAllMocks();
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await manager.save();
      expect(result.path).toBe("/tmp/project.canvas.json");
      expect(result.size).toBeGreaterThan(0);
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/tmp/project.canvas.json",
        expect.any(String),
        "utf-8"
      );
    });

    it("updates currentPath when saving to a different path", async () => {
      await manager.create("/tmp/original.canvas.json");
      vi.clearAllMocks();
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await manager.save("/tmp/copy.canvas.json");
      expect(result.path).toBe("/tmp/copy.canvas.json");
      expect(manager.filePath).toBe("/tmp/copy.canvas.json");
    });

    it("throws when no document is loaded", async () => {
      await expect(manager.save()).rejects.toThrow("No document is currently open");
    });

    it("throws when no path is available", async () => {
      // Construct a manager with a doc but no path by using the constructor directly
      const rawManager = new CanvasManager();
      // Access private field to set a doc without a path
      (rawManager as unknown as { currentDoc: Document }).currentDoc = Document.create("Orphan");
      await expect(rawManager.save()).rejects.toThrow("No file path specified");
    });

    it("throws on save when document is invalid and does not write", async () => {
      const doc = await manager.create("/tmp/project.canvas.json");
      vi.clearAllMocks();
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      // Corrupt the document by setting meta.name to a number
      (doc.meta as unknown as Record<string, unknown>).name = 123;

      await expect(manager.save()).rejects.toThrow("Document validation failed");
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("creates parent directories when saving", async () => {
      await manager.create("/tmp/original.canvas.json");
      vi.clearAllMocks();
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await manager.save("/new/deep/dir/out.canvas.json");
      expect(mockMkdir).toHaveBeenCalledWith("/new/deep/dir", { recursive: true });
    });
  });

  // ============================================================
  // Getters
  // ============================================================

  describe("document getter", () => {
    it("returns null when no document is loaded", () => {
      expect(manager.document).toBeNull();
    });

    it("returns the current document after create", async () => {
      const doc = await manager.create("/tmp/test.canvas.json");
      expect(manager.document).toBe(doc);
    });
  });

  describe("filePath getter", () => {
    it("returns null when no document is loaded", () => {
      expect(manager.filePath).toBeNull();
    });

    it("returns the current path after open", async () => {
      const raw = buildRawDocument();
      mockReadFile.mockResolvedValue(JSON.stringify(raw));

      await manager.open("/tmp/opened.canvas.json");
      expect(manager.filePath).toBe("/tmp/opened.canvas.json");
    });
  });
});
