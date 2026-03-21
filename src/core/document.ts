import {
  CanvasDocument,
  CanvasDocumentSchema,
  Meta,
  Page,
} from "./schema.js";

export class Document {
  private doc: CanvasDocument;

  constructor(doc: CanvasDocument) {
    this.doc = doc;
  }

  static create(name: string, width: number = 1440): Document {
    const now = new Date().toISOString();
    const doc: CanvasDocument = {
      version: "1.0.0",
      meta: { name, created: now, modified: now },
      tokens: {
        colors: {},
        spacing: {},
        typography: {},
        borderRadius: {},
        shadows: {},
        breakpoints: {},
      },
      components: {},
      pages: {
        page1: {
          name: "Page 1",
          width,
          height: null,
          x: 0,
          y: 0,
          nodes: {
            root: {
              type: "frame",
              name: "Root",
              clip: false,
              layout: { direction: "column" },
              children: [],
            },
          },
        },
      },
    };
    return new Document(doc);
  }

  get data(): CanvasDocument {
    return this.doc;
  }

  get meta(): Meta {
    return this.doc.meta;
  }

  addPage(id: string, page: Page): void {
    this.doc.pages[id] = page;
    this.touch();
  }

  getPage(id: string): Page | undefined {
    return this.doc.pages[id];
  }

  listPages(): Array<{ id: string; name: string; nodeCount: number }> {
    return Object.entries(this.doc.pages).map(([id, page]) => ({
      id,
      name: page.name,
      nodeCount: Object.keys(page.nodes).length,
    }));
  }

  removePage(id: string): void {
    if (!this.doc.pages[id]) {
      throw new Error(`Page "${id}" not found`);
    }
    delete this.doc.pages[id];
    this.touch();
  }

  touch(): void {
    this.doc.meta.modified = new Date().toISOString();
  }

  validate(): { valid: boolean; errors?: string[] } {
    const result = CanvasDocumentSchema.safeParse(this.doc);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`
      ),
    };
  }

  toJSON(pretty: boolean = false): string {
    return JSON.stringify(this.doc, null, pretty ? 2 : undefined);
  }
}
