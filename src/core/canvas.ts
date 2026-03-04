import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { CanvasDocumentSchema } from "./schema.js";
import { Document } from "./document.js";

export class CanvasManager {
  private currentDoc: Document | null = null;
  private currentPath: string | null = null;

  async create(
    path: string,
    name?: string,
    width?: number,
    tokens?: object
  ): Promise<Document> {
    const docName = name ?? path.replace(/^.*[\\/]/, "").replace(/\.canvas\.json$/, "");
    const doc = Document.create(docName, width);

    if (tokens) {
      Object.assign(doc.data.tokens, tokens);
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, doc.toJSON(true), "utf-8");

    this.currentDoc = doc;
    this.currentPath = path;
    return doc;
  }

  async open(path: string): Promise<Document> {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw);
    const validated = CanvasDocumentSchema.parse(parsed);
    const doc = new Document(validated);

    this.currentDoc = doc;
    this.currentPath = path;
    return doc;
  }

  async save(
    path?: string,
    pretty: boolean = true
  ): Promise<{ path: string; size: number }> {
    if (!this.currentDoc) {
      throw new Error("No document is currently open");
    }

    const savePath = path ?? this.currentPath;
    if (!savePath) {
      throw new Error("No file path specified");
    }

    const validation = this.currentDoc.validate();
    if (!validation.valid) {
      throw new Error(
        `Document validation failed: ${validation.errors!.join("; ")}`
      );
    }

    const json = this.currentDoc.toJSON(pretty);
    await mkdir(dirname(savePath), { recursive: true });
    await writeFile(savePath, json, "utf-8");

    if (path) {
      this.currentPath = path;
    }

    return { path: savePath, size: Buffer.byteLength(json, "utf-8") };
  }

  /**
   * Set the current document directly (e.g. after import).
   */
  setDocument(doc: Document, path?: string | null): void {
    this.currentDoc = doc;
    this.currentPath = path ?? null;
  }

  get document(): Document | null {
    return this.currentDoc;
  }

  get filePath(): string | null {
    return this.currentPath;
  }
}
