import { describe, it, expect } from "vitest";
import {
  resolveScreenshotScope,
  okWithScreenshot,
} from "../../src/tools/node-screenshot.js";

describe("node-screenshot", () => {
  // -----------------------------------------------------------
  // resolveScreenshotScope
  // -----------------------------------------------------------

  describe("resolveScreenshotScope", () => {
    it("node:add — uses first node's parentId", () => {
      const scope = resolveScreenshotScope("node:add", {
        pageId: "p1",
        nodes: [{ parentId: "frame1" }, { parentId: "frame2" }],
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: "frame1" });
    });

    it("node:add — root parent maps to page-level (no nodeId)", () => {
      const scope = resolveScreenshotScope("node:add", {
        pageId: "p1",
        nodes: [{ parentId: "root" }],
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: undefined });
    });

    it("node:add — empty nodes array returns pageId only", () => {
      const scope = resolveScreenshotScope("node:add", {
        pageId: "p1",
        nodes: [],
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: undefined });
    });

    it("node:update — uses first update's id", () => {
      const scope = resolveScreenshotScope("node:update", {
        pageId: "p1",
        updates: [{ id: "n1" }, { id: "n2" }],
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: "n1" });
    });

    it("node:update — root id maps to page-level", () => {
      const scope = resolveScreenshotScope("node:update", {
        pageId: "p1",
        updates: [{ id: "root" }],
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: undefined });
    });

    it("node:delete — always page-level", () => {
      const scope = resolveScreenshotScope("node:delete", {
        pageId: "p1",
        nodeId: "n1",
      });
      expect(scope).toEqual({ pageId: "p1" });
    });

    it("node:move — uses newParentId", () => {
      const scope = resolveScreenshotScope("node:move", {
        pageId: "p1",
        nodeId: "n1",
        newParentId: "container",
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: "container" });
    });

    it("node:move — root newParentId maps to page-level", () => {
      const scope = resolveScreenshotScope("node:move", {
        pageId: "p1",
        nodeId: "n1",
        newParentId: "root",
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: undefined });
    });

    it("node:list — uses parentId if provided", () => {
      const scope = resolveScreenshotScope("node:list", {
        pageId: "p1",
        parentId: "frame1",
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: "frame1" });
    });

    it("node:list — no parentId maps to page-level", () => {
      const scope = resolveScreenshotScope("node:list", {
        pageId: "p1",
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: undefined });
    });

    it("node:get — uses nodeId", () => {
      const scope = resolveScreenshotScope("node:get", {
        pageId: "p1",
        nodeId: "n1",
      });
      expect(scope).toEqual({ pageId: "p1", nodeId: "n1" });
    });

    it("unknown tool — returns pageId only", () => {
      const scope = resolveScreenshotScope("node:unknown", {
        pageId: "p1",
      });
      expect(scope).toEqual({ pageId: "p1" });
    });
  });

  // -----------------------------------------------------------
  // okWithScreenshot
  // -----------------------------------------------------------

  describe("okWithScreenshot", () => {
    it("returns text-only content when screenshot is null", () => {
      const result = okWithScreenshot({ foo: "bar" }, null);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(JSON.parse(result.content[0].text!)).toEqual({ foo: "bar" });
    });

    it("returns text + image content when screenshot is provided", () => {
      const screenshot = { base64: "AAAA", mimeType: "image/png" };
      const result = okWithScreenshot({ count: 1 }, screenshot);

      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe("text");
      expect(JSON.parse(result.content[0].text!)).toEqual({ count: 1 });
      expect(result.content[1]).toEqual({
        type: "image",
        data: "AAAA",
        mimeType: "image/png",
      });
    });

    it("serializes data with pretty-print", () => {
      const result = okWithScreenshot({ a: 1 }, null);
      expect(result.content[0].text).toBe(JSON.stringify({ a: 1 }, null, 2));
    });
  });
});
