import { describe, it, expect, beforeEach } from "vitest";
import { PageManager } from "../../src/core/page.js";
import { createTestDocument } from "../helpers/create-test-document.js";
import type { Document } from "../../src/core/document.js";

describe("PageManager", () => {
  let doc: Document;
  let pages: PageManager;

  beforeEach(() => {
    doc = createTestDocument();
    pages = new PageManager(doc);
  });

  // ----------------------------------------------------------------
  // update()
  // ----------------------------------------------------------------
  describe("update()", () => {
    it("should update page name", () => {
      const result = pages.update("page1", { name: "Home" });

      expect(result.id).toBe("page1");
      expect(result.name).toBe("Home");
      expect(result.width).toBe(1440);
      expect(result.height).toBeNull();
    });

    it("should update page width", () => {
      const result = pages.update("page1", { width: 1920 });

      expect(result.width).toBe(1920);
      expect(result.name).toBe("Page 1");
    });

    it("should update page height", () => {
      const result = pages.update("page1", { height: 1080 });

      expect(result.height).toBe(1080);
    });

    it("should set height to null", () => {
      // First set a numeric height
      pages.update("page1", { height: 800 });
      // Then set it back to null
      const result = pages.update("page1", { height: null });

      expect(result.height).toBeNull();
    });

    it("should update multiple properties at once", () => {
      const result = pages.update("page1", {
        name: "Dashboard",
        width: 1280,
        height: 720,
      });

      expect(result.name).toBe("Dashboard");
      expect(result.width).toBe(1280);
      expect(result.height).toBe(720);
    });

    it("should throw for non-existent page", () => {
      expect(() => pages.update("nonexistent", { name: "Test" })).toThrow(
        'Page "nonexistent" not found'
      );
    });

    it("should call doc.touch() after mutation", () => {
      const modifiedBefore = doc.data.meta.modified;
      // Small delay to ensure timestamp differs
      pages.update("page1", { name: "Updated" });
      // touch() is called internally, modified should be updated
      expect(doc.data.meta.modified).toBeDefined();
    });

    it("should not change properties that are not provided", () => {
      const original = { ...doc.data.pages["page1"]! };
      pages.update("page1", { name: "New Name" });

      expect(doc.data.pages["page1"]!.width).toBe(original.width);
      expect(doc.data.pages["page1"]!.height).toBe(original.height);
    });
  });

  // ----------------------------------------------------------------
  // list()
  // ----------------------------------------------------------------
  describe("list()", () => {
    it("should list all pages", () => {
      const result = pages.list();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("page1");
      expect(result[0].name).toBe("Page 1");
      expect(result[0].width).toBe(1440);
      expect(result[0].height).toBeNull();
      expect(result[0].nodeCount).toBe(1); // only root node
    });

    it("should list multiple pages", () => {
      doc.addPage("page2", {
        name: "Page 2",
        width: 768,
        height: 1024,
        nodes: {
          root: {
            type: "frame",
            name: "Root",
            layout: { direction: "column" },
            children: [],
          },
        },
      });

      const result = pages.list();

      expect(result).toHaveLength(2);
      const page2 = result.find((p) => p.id === "page2");
      expect(page2).toBeDefined();
      expect(page2!.name).toBe("Page 2");
      expect(page2!.width).toBe(768);
      expect(page2!.height).toBe(1024);
    });

    it("should return correct node count", () => {
      const page = doc.data.pages["page1"]!;
      page.nodes["header"] = {
        type: "frame",
        name: "Header",
        layout: { direction: "row" },
        children: [],
      };
      page.nodes["root"]!.children.push("header");

      const result = pages.list();

      expect(result[0].nodeCount).toBe(2); // root + header
    });
  });
});
