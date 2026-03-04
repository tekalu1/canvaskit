import { describe, it, expect } from "vitest";
import { takeScreenshot } from "../../src/preview/screenshot.js";
import {
  createDocumentWithNodes,
  createTestDocument,
} from "../helpers/create-test-document.js";

describe("takeScreenshot", () => {
  // -------------------------------------------------------
  // Basic screenshot
  // -------------------------------------------------------

  it("takes a PNG screenshot by default", async () => {
    const doc = createDocumentWithNodes();
    const result = await takeScreenshot(doc, "page1");

    expect(result.format).toBe("png");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  }, 30000);

  it("returns base64 encoded string", async () => {
    const doc = createDocumentWithNodes();
    const result = await takeScreenshot(doc, "page1");

    expect(result.base64).toBeTruthy();
    // Verify the base64 decodes back to the same buffer
    const decoded = Buffer.from(result.base64, "base64");
    expect(decoded.length).toBe(result.buffer.length);
  }, 30000);

  // -------------------------------------------------------
  // JPEG format
  // -------------------------------------------------------

  it("takes a JPEG screenshot when specified", async () => {
    const doc = createDocumentWithNodes();
    const result = await takeScreenshot(doc, "page1", undefined, {
      format: "jpeg",
    });

    expect(result.format).toBe("jpeg");
    expect(result.buffer.length).toBeGreaterThan(0);
  }, 30000);

  // -------------------------------------------------------
  // Custom viewport
  // -------------------------------------------------------

  it("uses custom viewport dimensions", async () => {
    const doc = createDocumentWithNodes();
    const result = await takeScreenshot(doc, "page1", undefined, {
      width: 800,
      height: 600,
    });

    expect(result.buffer.length).toBeGreaterThan(0);
    // Width should match viewport
    expect(result.width).toBe(800);
  }, 30000);

  // -------------------------------------------------------
  // Subtree screenshot
  // -------------------------------------------------------

  it("takes screenshot of a specific subtree", async () => {
    const doc = createDocumentWithNodes();
    const result = await takeScreenshot(doc, "page1", "content");

    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.format).toBe("png");
  }, 30000);

  // -------------------------------------------------------
  // Error cases
  // -------------------------------------------------------

  it("throws for missing page", async () => {
    const doc = createTestDocument();
    await expect(
      takeScreenshot(doc, "nonexistent")
    ).rejects.toThrow('Page "nonexistent" not found');
  }, 30000);

  it("throws for missing node", async () => {
    const doc = createTestDocument();
    await expect(
      takeScreenshot(doc, "page1", "missing-node")
    ).rejects.toThrow('Node "missing-node" not found');
  }, 30000);

  // -------------------------------------------------------
  // PNG header validation
  // -------------------------------------------------------

  it("PNG buffer starts with PNG signature", async () => {
    const doc = createDocumentWithNodes();
    const result = await takeScreenshot(doc, "page1");

    // PNG files start with magic bytes: 137 80 78 71 13 10 26 10
    expect(result.buffer[0]).toBe(137);
    expect(result.buffer[1]).toBe(80); // P
    expect(result.buffer[2]).toBe(78); // N
    expect(result.buffer[3]).toBe(71); // G
  }, 30000);

  // -------------------------------------------------------
  // JPEG header validation
  // -------------------------------------------------------

  it("JPEG buffer starts with JPEG signature", async () => {
    const doc = createDocumentWithNodes();
    const result = await takeScreenshot(doc, "page1", undefined, {
      format: "jpeg",
    });

    // JPEG files start with FF D8
    expect(result.buffer[0]).toBe(0xff);
    expect(result.buffer[1]).toBe(0xd8);
  }, 30000);
});
