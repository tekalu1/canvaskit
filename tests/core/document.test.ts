import { Document } from "../../src/core/document.js";
import { createTestDocument, createDocumentWithNodes } from "../helpers/create-test-document.js";
import type { Page } from "../../src/core/schema.js";

describe("Document", () => {
  // ============================================================
  // Document.create()
  // ============================================================

  describe("create()", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("creates a document with the given name", () => {
      const doc = Document.create("My Project");
      expect(doc.meta.name).toBe("My Project");
    });

    it("defaults width to 1440", () => {
      const doc = Document.create("Default Width");
      const page = doc.getPage("page1");
      expect(page).toBeDefined();
      expect(page!.width).toBe(1440);
    });

    it("accepts a custom width", () => {
      const doc = Document.create("Mobile", 375);
      const page = doc.getPage("page1");
      expect(page!.width).toBe(375);
    });

    it("sets created and modified timestamps", () => {
      const doc = Document.create("Timestamps");
      expect(doc.meta.created).toBe("2025-06-01T12:00:00.000Z");
      expect(doc.meta.modified).toBe("2025-06-01T12:00:00.000Z");
    });

    it("creates a default page1 with a root frame node", () => {
      const doc = Document.create("WithPage");
      const page = doc.getPage("page1");
      expect(page).toBeDefined();
      expect(page!.name).toBe("Page 1");
      expect(page!.nodes["root"]).toBeDefined();
      expect(page!.nodes["root"]!.type).toBe("frame");
    });

    it("initializes empty token categories", () => {
      const doc = Document.create("Tokens");
      const tokens = doc.data.tokens;
      expect(tokens.colors).toEqual({});
      expect(tokens.spacing).toEqual({});
      expect(tokens.typography).toEqual({});
      expect(tokens.borderRadius).toEqual({});
      expect(tokens.shadows).toEqual({});
      expect(tokens.breakpoints).toEqual({});
    });
  });

  // ============================================================
  // data & meta getters
  // ============================================================

  describe("data getter", () => {
    it("returns the full CanvasDocument object", () => {
      const doc = createTestDocument();
      const data = doc.data;
      expect(data).toHaveProperty("version", "1.0.0");
      expect(data).toHaveProperty("meta");
      expect(data).toHaveProperty("tokens");
      expect(data).toHaveProperty("pages");
      expect(data).toHaveProperty("components");
    });
  });

  describe("meta getter", () => {
    it("returns the meta object", () => {
      const doc = createTestDocument("Meta Test");
      expect(doc.meta.name).toBe("Meta Test");
      expect(doc.meta).toHaveProperty("created");
      expect(doc.meta).toHaveProperty("modified");
    });
  });

  // ============================================================
  // addPage()
  // ============================================================

  describe("addPage()", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("adds a page to the document", () => {
      const doc = createTestDocument();
      const newPage: Page = {
        name: "About",
        width: 1440,
        height: null,
        nodes: {
          root: { type: "frame", name: "Root", children: [], layout: { direction: "column" } },
        },
      };
      doc.addPage("about", newPage);
      expect(doc.getPage("about")).toBe(newPage);
    });

    it("updates the modified timestamp", () => {
      const doc = createTestDocument();
      const before = doc.meta.modified;

      vi.advanceTimersByTime(5000);

      const newPage: Page = {
        name: "Contact",
        width: 1440,
        height: null,
        nodes: {},
      };
      doc.addPage("contact", newPage);
      expect(doc.meta.modified).not.toBe(before);
    });
  });

  // ============================================================
  // getPage()
  // ============================================================

  describe("getPage()", () => {
    it("returns the page for a valid id", () => {
      const doc = createTestDocument();
      const page = doc.getPage("page1");
      expect(page).toBeDefined();
      expect(page!.name).toBe("Page 1");
    });

    it("returns undefined for a missing id", () => {
      const doc = createTestDocument();
      expect(doc.getPage("nonexistent")).toBeUndefined();
    });
  });

  // ============================================================
  // listPages()
  // ============================================================

  describe("listPages()", () => {
    it("returns summary of all pages", () => {
      const doc = createTestDocument();
      const pages = doc.listPages();
      expect(pages).toHaveLength(1);
      expect(pages[0]).toEqual({
        id: "page1",
        name: "Page 1",
        nodeCount: 1,
      });
    });

    it("reflects nodeCount from a richer document", () => {
      const doc = createDocumentWithNodes();
      const pages = doc.listPages();
      expect(pages[0]!.nodeCount).toBeGreaterThan(1);
    });
  });

  // ============================================================
  // removePage()
  // ============================================================

  describe("removePage()", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("removes an existing page", () => {
      const doc = createTestDocument();
      doc.addPage("extra", {
        name: "Extra",
        width: 1440,
        height: null,
        nodes: {},
      });
      doc.removePage("extra");
      expect(doc.getPage("extra")).toBeUndefined();
    });

    it("throws when removing a non-existent page", () => {
      const doc = createTestDocument();
      expect(() => doc.removePage("missing")).toThrow('Page "missing" not found');
    });
  });

  // ============================================================
  // touch()
  // ============================================================

  describe("touch()", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("updates modified timestamp", () => {
      const doc = createTestDocument();
      const original = doc.meta.modified;

      vi.advanceTimersByTime(10000);
      doc.touch();

      expect(doc.meta.modified).not.toBe(original);
      expect(doc.meta.modified).toBe("2025-06-01T12:00:10.000Z");
    });
  });

  // ============================================================
  // validate()
  // ============================================================

  describe("validate()", () => {
    it("returns valid for a correct document", () => {
      const doc = createTestDocument();
      const result = doc.validate();
      expect(result).toEqual({ valid: true });
    });

    it("returns errors for an invalid document", () => {
      const doc = createTestDocument();
      // Corrupt the meta to break validation
      (doc.data.meta as Record<string, unknown>).name = 123 as unknown;
      const result = doc.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // toJSON()
  // ============================================================

  describe("toJSON()", () => {
    it("returns compact JSON by default", () => {
      const doc = createTestDocument();
      const json = doc.toJSON();
      expect(json).not.toContain("\n");
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("returns pretty-printed JSON when pretty=true", () => {
      const doc = createTestDocument();
      const json = doc.toJSON(true);
      expect(json).toContain("\n");
      expect(json).toContain("  ");
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("round-trips back to equivalent data", () => {
      const doc = createTestDocument();
      const json = doc.toJSON();
      const parsed = JSON.parse(json);
      expect(parsed.meta.name).toBe("Test Document");
      expect(parsed.version).toBe("1.0.0");
    });
  });
});
