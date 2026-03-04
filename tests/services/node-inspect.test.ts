import { describe, it, expect, vi } from "vitest";
import {
  collectNodeIds,
  inspectNodeLayout,
  tryInspect,
} from "../../src/services/node-inspect.js";
import {
  createTestDocument,
  createDocumentWithNodes,
} from "../helpers/create-test-document.js";

vi.mock("../../src/export/html.js", () => ({
  exportToHtml: vi.fn().mockReturnValue("<html><body></body></html>"),
}));

describe("services/node-inspect", () => {
  // -----------------------------------------------------------
  // collectNodeIds
  // -----------------------------------------------------------

  describe("collectNodeIds", () => {
    it("collects root and all descendants by default", () => {
      const doc = createDocumentWithNodes();
      const ids = collectNodeIds(doc, "page1");

      expect(ids).toEqual([
        { id: "root", name: "Root", type: "frame" },
        { id: "header", name: "Header", type: "frame" },
        { id: "content", name: "Content", type: "frame" },
        { id: "title", name: "Title", type: "text" },
        { id: "hero-image", name: "Hero Image", type: "image" },
      ]);
    });

    it("collects from a specific node", () => {
      const doc = createDocumentWithNodes();
      const ids = collectNodeIds(doc, "page1", "content");

      expect(ids).toEqual([
        { id: "content", name: "Content", type: "frame" },
        { id: "title", name: "Title", type: "text" },
        { id: "hero-image", name: "Hero Image", type: "image" },
      ]);
    });

    it("respects depth limit", () => {
      const doc = createDocumentWithNodes();
      const ids = collectNodeIds(doc, "page1", undefined, 0);

      // depth=0 means only the start node itself
      expect(ids).toEqual([
        { id: "root", name: "Root", type: "frame" },
      ]);
    });

    it("depth=1 collects start node and direct children", () => {
      const doc = createDocumentWithNodes();
      const ids = collectNodeIds(doc, "page1", undefined, 1);

      expect(ids).toEqual([
        { id: "root", name: "Root", type: "frame" },
        { id: "header", name: "Header", type: "frame" },
        { id: "content", name: "Content", type: "frame" },
      ]);
    });

    it("throws for missing page", () => {
      const doc = createTestDocument();
      expect(() => collectNodeIds(doc, "nonexistent")).toThrow(
        'Page "nonexistent" not found'
      );
    });

    it("throws for missing node", () => {
      const doc = createTestDocument();
      expect(() => collectNodeIds(doc, "page1", "missing")).toThrow(
        'Node "missing" not found on page "page1"'
      );
    });
  });

  // -----------------------------------------------------------
  // inspectNodeLayout
  // -----------------------------------------------------------

  describe("inspectNodeLayout", () => {
    function createMockPool(evaluateResult: unknown) {
      const mockPage = {
        setViewport: vi.fn().mockResolvedValue(undefined),
        setContent: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(evaluateResult),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockBrowser = {
        newPage: vi.fn().mockResolvedValue(mockPage),
      };
      const pool = {
        acquire: vi.fn().mockResolvedValue(mockBrowser),
        dispose: vi.fn().mockResolvedValue(undefined),
      } as any;
      return { pool, mockPage, mockBrowser };
    }

    it("returns layout data from browser evaluation", async () => {
      const doc = createTestDocument();
      const layoutData = [
        {
          nodeId: "root",
          name: "Root",
          type: "frame",
          dimensions: { width: 1440, height: 900 },
          position: { x: 0, y: 0 },
          overflow: { clipped: false, overflowX: "visible", overflowY: "visible" },
          flex: {
            display: "flex",
            flexDirection: "column",
            alignItems: "normal",
            justifyContent: "normal",
            flexWrap: "nowrap",
            gap: "normal",
          },
          padding: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
        },
      ];

      const { pool, mockPage } = createMockPool(layoutData);
      const result = await inspectNodeLayout(pool, doc, "page1");

      expect(result.pageId).toBe("page1");
      expect(result.nodes).toEqual(layoutData);
      expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1440, height: 900 });
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.any(String),
        { waitUntil: "networkidle0" }
      );
      expect(mockPage.evaluate).toHaveBeenCalledOnce();
      // evaluate receives a single IIFE string (not a separate args parameter)
      const evaluateCall = mockPage.evaluate.mock.calls[0];
      expect(evaluateCall).toHaveLength(1);
      expect(typeof evaluateCall[0]).toBe("string");
      expect(evaluateCall[0]).toContain('"id":"root"');
      expect(mockPage.close).toHaveBeenCalledOnce();
    });

    it("closes page even when evaluate throws", async () => {
      const doc = createTestDocument();
      const mockPage = {
        setViewport: vi.fn().mockResolvedValue(undefined),
        setContent: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockRejectedValue(new Error("eval failed")),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const pool = {
        acquire: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue(mockPage),
        }),
        dispose: vi.fn().mockResolvedValue(undefined),
      } as any;

      await expect(
        inspectNodeLayout(pool, doc, "page1")
      ).rejects.toThrow("eval failed");

      expect(mockPage.close).toHaveBeenCalledOnce();
    });

    it("passes depth to collectNodeIds", async () => {
      const doc = createDocumentWithNodes();
      const { pool, mockPage } = createMockPool([]);

      await inspectNodeLayout(pool, doc, "page1", undefined, 0);

      // With depth=0, only root is embedded in the IIFE string
      const evaluateArgs = mockPage.evaluate.mock.calls[0];
      const iifeString = evaluateArgs[0] as string;
      expect(iifeString).toContain('"id":"root"');
      // depth=0 should only include root, not children
      expect(iifeString).not.toContain('"id":"header"');
    });
  });

  // -----------------------------------------------------------
  // tryInspect
  // -----------------------------------------------------------

  describe("tryInspect", () => {
    it("returns null when pool is null", async () => {
      const doc = createTestDocument();
      const result = await tryInspect(null, doc, "page1");
      expect(result).toBeNull();
    });

    it("returns null when pool is undefined", async () => {
      const doc = createTestDocument();
      const result = await tryInspect(undefined, doc, "page1");
      expect(result).toBeNull();
    });

    it("returns null when inspection throws", async () => {
      const pool = {
        acquire: vi.fn().mockRejectedValue(new Error("browser crashed")),
        dispose: vi.fn().mockResolvedValue(undefined),
      } as any;

      const doc = createTestDocument();
      const result = await tryInspect(pool, doc, "page1");
      expect(result).toBeNull();
    });

    it("returns inspect result when pool is available", async () => {
      const layoutData = [
        {
          nodeId: "root",
          name: "Root",
          type: "frame",
          dimensions: { width: 1440, height: 0 },
          position: { x: 0, y: 0 },
          overflow: { clipped: false, overflowX: "visible", overflowY: "visible" },
          flex: { display: "flex", flexDirection: "column", alignItems: "normal", justifyContent: "normal", flexWrap: "nowrap", gap: "normal" },
          padding: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
        },
      ];

      const mockPage = {
        setViewport: vi.fn().mockResolvedValue(undefined),
        setContent: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(layoutData),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const pool = {
        acquire: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue(mockPage),
        }),
        dispose: vi.fn().mockResolvedValue(undefined),
      } as any;

      const doc = createTestDocument();
      const result = await tryInspect(pool, doc, "page1");

      expect(result).not.toBeNull();
      expect(result!.pageId).toBe("page1");
      expect(result!.nodes).toEqual(layoutData);
    });
  });
});
