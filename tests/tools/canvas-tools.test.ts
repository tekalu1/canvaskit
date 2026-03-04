import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerCanvasTools } from "../../src/tools/canvas-tools.js";
import { CanvasManager } from "../../src/core/canvas.js";
import { Document } from "../../src/core/document.js";
import { createTempDir } from "../helpers/temp-dir.js";
import { parseToolResult, expectSuccess, expectError } from "../helpers/mcp-test-client.js";
import { join } from "node:path";

// ---------------------------------------------------------
// Mock MCP Server
// ---------------------------------------------------------
class MockMcpServer {
  private tools = new Map<string, { handler: Function }>();

  tool(name: string, _description: string, _schema: any, handler: Function) {
    this.tools.set(name, { handler });
  }

  async callTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not registered`);
    return tool.handler(args);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}

describe("canvas-tools (MCP)", () => {
  let server: MockMcpServer;
  let canvasManager: CanvasManager;
  let currentDoc: Document;
  let tempDir: { path: string; cleanup: () => Promise<void> };

  beforeEach(async () => {
    tempDir = await createTempDir();
    server = new MockMcpServer();
    canvasManager = new CanvasManager();
    currentDoc = Document.create("Test Doc");

    registerCanvasTools(
      server as any,
      canvasManager,
      () => currentDoc
    );
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  // ---------------------------------------------------------
  // Registration
  // ---------------------------------------------------------

  it("registers all canvas tools", () => {
    expect(server.hasTool("canvas:create")).toBe(true);
    expect(server.hasTool("canvas:open")).toBe(true);
    expect(server.hasTool("canvas:save")).toBe(true);
    expect(server.hasTool("canvas:list_pages")).toBe(true);
  });

  // ---------------------------------------------------------
  // canvas:create
  // ---------------------------------------------------------

  it("canvas:create returns path, pageId, and name", async () => {
    const filePath = join(tempDir.path, "test.canvas.json");
    const result = await server.callTool("canvas:create", {
      path: filePath,
      name: "My Canvas",
    });

    const data = expectSuccess(result) as any;
    expect(data.path).toBe(filePath);
    expect(data.pageId).toBe("page1");
    expect(data.name).toBe("My Canvas");
  });

  it("canvas:create auto-generates name from path when not provided", async () => {
    const filePath = join(tempDir.path, "dashboard.canvas.json");
    const result = await server.callTool("canvas:create", {
      path: filePath,
    });

    const data = expectSuccess(result) as any;
    expect(data.name).toBe("dashboard");
  });

  // ---------------------------------------------------------
  // canvas:open
  // ---------------------------------------------------------

  it("canvas:open returns meta, pages, tokenCount, nodeCount", async () => {
    // First create a file to open
    const filePath = join(tempDir.path, "open-test.canvas.json");
    await canvasManager.create(filePath, "Open Test");

    const result = await server.callTool("canvas:open", { path: filePath });
    const data = expectSuccess(result) as any;

    expect(data.meta).toBeDefined();
    expect(data.meta.name).toBe("Open Test");
    expect(data.pages).toContain("page1");
    expect(typeof data.tokenCount).toBe("number");
    expect(typeof data.nodeCount).toBe("number");
  });

  it("canvas:open returns error for non-existent file", async () => {
    const result = await server.callTool("canvas:open", {
      path: join(tempDir.path, "nonexistent.canvas.json"),
    });

    expect(result.isError).toBe(true);
  });

  // ---------------------------------------------------------
  // canvas:save
  // ---------------------------------------------------------

  it("canvas:save returns path, size, and modified timestamp", async () => {
    const filePath = join(tempDir.path, "save-test.canvas.json");
    await canvasManager.create(filePath, "Save Test");

    // Update currentDoc to point to the manager's document
    currentDoc = canvasManager.document!;

    const result = await server.callTool("canvas:save", {});
    const data = expectSuccess(result) as any;

    expect(data.path).toBe(filePath);
    expect(typeof data.size).toBe("number");
    expect(data.size).toBeGreaterThan(0);
    expect(data.modified).toBeDefined();
  });

  it("canvas:save returns error when no document is open", async () => {
    // Use a fresh manager with no document
    const freshManager = new CanvasManager();
    const freshServer = new MockMcpServer();
    registerCanvasTools(freshServer as any, freshManager, () => currentDoc);

    const result = await freshServer.callTool("canvas:save", {});
    expect(result.isError).toBe(true);
  });

  // ---------------------------------------------------------
  // canvas:list_pages
  // ---------------------------------------------------------

  it("canvas:list_pages returns pages array", async () => {
    const result = await server.callTool("canvas:list_pages", {});
    const data = expectSuccess(result) as any;

    expect(data.pages).toBeDefined();
    expect(Array.isArray(data.pages)).toBe(true);
    expect(data.pages.length).toBeGreaterThan(0);
    expect(data.pages[0]).toHaveProperty("id");
    expect(data.pages[0]).toHaveProperty("name");
    expect(data.pages[0]).toHaveProperty("nodeCount");
  });

  it("canvas:list_pages includes all pages after adding one", async () => {
    currentDoc.addPage("page2", {
      name: "Page 2",
      width: 1440,
      height: null,
      nodes: {
        root: {
          type: "frame",
          name: "Root",
          layout: { direction: "column" },
          children: [],
        },
      },
    });

    const result = await server.callTool("canvas:list_pages", {});
    const data = expectSuccess(result) as any;
    const pageIds = data.pages.map((p: any) => p.id);
    expect(pageIds).toContain("page1");
    expect(pageIds).toContain("page2");
  });
});
