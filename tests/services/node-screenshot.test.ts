import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveScreenshotScope,
  captureNodeScreenshot,
  tryScreenshot,
  saveScreenshot,
} from "../../src/services/node-screenshot.js";

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/export/html.js", () => ({
  exportToHtml: vi.fn().mockReturnValue("<html></html>"),
}));

describe("services/node-screenshot", () => {
  // -----------------------------------------------------------
  // resolveScreenshotScope — same logic as tools/ version
  // -----------------------------------------------------------

  describe("resolveScreenshotScope", () => {
    it("node:add — uses first node's parentId", () => {
      const scope = resolveScreenshotScope("node:add", {
        pageId: "p1",
        nodes: [{ parentId: "frame1" }],
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: "frame1" });
    });

    it("node:delete — always page-level", () => {
      const scope = resolveScreenshotScope("node:delete", {
        pageId: "p1",
        nodeId: "n1",
      });
      expect(scope).toEqual({ pageId: "p1" });
    });

    it("unknown tool — returns pageId only", () => {
      const scope = resolveScreenshotScope("node:unknown", {
        pageId: "p1",
      });
      expect(scope).toEqual({ pageId: "p1" });
    });
  });

  // -----------------------------------------------------------
  // tryScreenshot
  // -----------------------------------------------------------

  describe("tryScreenshot", () => {
    const mockDoc = {} as any;

    it("returns screenshot data when pool is available", async () => {
      const mockPool = {
        screenshot: vi.fn().mockResolvedValue({
          base64: "AAAA",
          mimeType: "image/png",
        }),
      } as any;

      const result = await tryScreenshot(mockPool, mockDoc, "node:list", {
        pageId: "p1",
      });

      expect(result).toEqual({ base64: "AAAA", mimeType: "image/png" });
      expect(mockPool.screenshot).toHaveBeenCalledOnce();
    });

    it("returns null when pool is null", async () => {
      const result = await tryScreenshot(null, mockDoc, "node:list", {
        pageId: "p1",
      });
      expect(result).toBeNull();
    });

    it("returns null when pool is undefined", async () => {
      const result = await tryScreenshot(undefined, mockDoc, "node:list", {
        pageId: "p1",
      });
      expect(result).toBeNull();
    });

    it("returns null when pool.screenshot throws", async () => {
      const mockPool = {
        screenshot: vi.fn().mockRejectedValue(new Error("browser crashed")),
      } as any;

      const result = await tryScreenshot(mockPool, mockDoc, "node:get", {
        pageId: "p1",
        nodeId: "n1",
      });
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------
  // saveScreenshot
  // -----------------------------------------------------------

  describe("saveScreenshot", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("writes base64 data as binary file", async () => {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const data = { base64: "AQID", mimeType: "image/png" };

      await saveScreenshot(data, "/tmp/out/test.png");

      expect(mkdir).toHaveBeenCalledWith("/tmp/out", { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(
        "/tmp/out/test.png",
        Buffer.from("AQID", "base64")
      );
    });

    it("creates nested directories", async () => {
      const { mkdir } = await import("node:fs/promises");
      const data = { base64: "AA==", mimeType: "image/png" };

      await saveScreenshot(data, "/a/b/c/screenshot.png");

      expect(mkdir).toHaveBeenCalledWith("/a/b/c", { recursive: true });
    });
  });
});
