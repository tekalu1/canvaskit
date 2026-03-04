import { describe, it, expect, beforeEach } from "vitest";
import { registerNodeTools } from "../../src/tools/node-tools.js";
import { Document } from "../../src/core/document.js";
import { expectSuccess, expectError, getImageContent } from "../helpers/mcp-test-client.js";
import type { BrowserPool } from "../../src/preview/browser-pool.js";

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

describe("node-tools (MCP)", () => {
  let server: MockMcpServer;
  let doc: Document;
  const autoSave = async () => {};

  beforeEach(() => {
    server = new MockMcpServer();
    doc = Document.create("Test Doc");

    registerNodeTools(server as any, () => doc, autoSave);
  });

  // ---------------------------------------------------------
  // Registration
  // ---------------------------------------------------------

  it("registers all node tools", () => {
    expect(server.hasTool("node:add")).toBe(true);
    expect(server.hasTool("node:update")).toBe(true);
    expect(server.hasTool("node:delete")).toBe(true);
    expect(server.hasTool("node:move")).toBe(true);
    expect(server.hasTool("node:list")).toBe(true);
    expect(server.hasTool("node:get")).toBe(true);
  });

  // ---------------------------------------------------------
  // node:add
  // ---------------------------------------------------------

  it("node:add returns created array with id and name", async () => {
    const result = await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        { type: "text", name: "Title", parentId: "root", content: "Hello" },
      ],
    });

    const data = expectSuccess(result) as any;
    expect(data.created).toBeDefined();
    expect(data.created.length).toBe(1);
    expect(data.created[0].name).toBe("Title");
    expect(data.created[0].id).toBeDefined();
  });

  it("node:add returns error for invalid page", async () => {
    const result = await server.callTool("node:add", {
      pageId: "nonexistent",
      nodes: [
        { type: "text", name: "Title", parentId: "root", content: "Hello" },
      ],
    });

    expect(result.isError).toBe(true);
  });

  it("node:add supports custom id", async () => {
    const result = await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        {
          id: "my-text",
          type: "text",
          name: "Custom",
          parentId: "root",
          content: "Test",
        },
      ],
    });

    const data = expectSuccess(result) as any;
    expect(data.created[0].id).toBe("my-text");
  });

  // ---------------------------------------------------------
  // node:update
  // ---------------------------------------------------------

  it("node:update returns updated id array", async () => {
    // Add a node first
    await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        {
          id: "n1",
          type: "text",
          name: "Original",
          parentId: "root",
          content: "Old",
        },
      ],
    });

    const result = await server.callTool("node:update", {
      pageId: "page1",
      updates: [{ id: "n1", name: "Updated", content: "New" }],
    });

    const data = expectSuccess(result) as any;
    expect(data.updated).toContain("n1");
  });

  it("node:update returns error for non-existent node", async () => {
    const result = await server.callTool("node:update", {
      pageId: "page1",
      updates: [{ id: "nonexistent", name: "Updated" }],
    });

    expect(result.isError).toBe(true);
  });

  it("node:update supports nodeName lookup", async () => {
    await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        { id: "n2", type: "text", name: "UniqueTitle", parentId: "root", content: "Old" },
      ],
    });

    const result = await server.callTool("node:update", {
      pageId: "page1",
      updates: [{ nodeName: "UniqueTitle", content: "New via name" }],
    });

    const data = expectSuccess(result) as any;
    expect(data.updated).toContain("n2");
  });

  it("node:update returns error when nodeName has no match", async () => {
    const result = await server.callTool("node:update", {
      pageId: "page1",
      updates: [{ nodeName: "Nonexistent", content: "X" }],
    });

    expect(result.isError).toBe(true);
  });

  // ---------------------------------------------------------
  // node:delete
  // ---------------------------------------------------------

  it("node:delete returns deleted id", async () => {
    await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        {
          id: "del-me",
          type: "text",
          name: "Delete Me",
          parentId: "root",
          content: "bye",
        },
      ],
    });

    const result = await server.callTool("node:delete", {
      pageId: "page1",
      nodeId: "del-me",
    });

    const data = expectSuccess(result) as any;
    expect(data.deleted).toBe("del-me");
  });

  // ---------------------------------------------------------
  // node:move
  // ---------------------------------------------------------

  it("node:move returns moved and newParent", async () => {
    // Create a container to move into
    await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        {
          id: "container",
          type: "frame",
          name: "Container",
          parentId: "root",
        },
        {
          id: "moveable",
          type: "text",
          name: "Moveable",
          parentId: "root",
          content: "Move me",
        },
      ],
    });

    const result = await server.callTool("node:move", {
      pageId: "page1",
      nodeId: "moveable",
      newParentId: "container",
    });

    const data = expectSuccess(result) as any;
    expect(data.moved).toBe("moveable");
    expect(data.newParent).toBe("container");
  });

  // ---------------------------------------------------------
  // node:list
  // ---------------------------------------------------------

  it("node:list returns nodes and count", async () => {
    const result = await server.callTool("node:list", {
      pageId: "page1",
    });

    const data = expectSuccess(result) as any;
    expect(data.nodes).toBeDefined();
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(typeof data.count).toBe("number");
    // At least root exists
    expect(data.count).toBeGreaterThanOrEqual(1);
  });

  it("node:list filters by type", async () => {
    await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        { id: "t1", type: "text", name: "T1", parentId: "root", content: "A" },
        { id: "f1", type: "frame", name: "F1", parentId: "root" },
      ],
    });

    const result = await server.callTool("node:list", {
      pageId: "page1",
      type: "text",
    });

    const data = expectSuccess(result) as any;
    expect(data.nodes.every((n: any) => n.type === "text")).toBe(true);
  });

  // ---------------------------------------------------------
  // node:get
  // ---------------------------------------------------------

  it("node:get returns node data", async () => {
    const result = await server.callTool("node:get", {
      pageId: "page1",
      nodeId: "root",
    });

    const data = expectSuccess(result) as any;
    expect(data.id).toBe("root");
    expect(data.type).toBe("frame");
    expect(data.name).toBe("Root");
  });

  it("node:get returns error for non-existent node", async () => {
    const result = await server.callTool("node:get", {
      pageId: "page1",
      nodeId: "nonexistent",
    });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------
// Screenshot integration tests
// ---------------------------------------------------------

describe("node-tools with BrowserPool", () => {
  let server: MockMcpServer;
  let doc: Document;
  const autoSave = async () => {};

  /** Mock BrowserPool that returns fixed base64 data. */
  function createMockPool(): BrowserPool {
    return {
      screenshot: async () => ({
        base64: "dGVzdC1pbWFnZQ==",
        mimeType: "image/png",
      }),
      acquire: async () => ({}),
      dispose: async () => {},
    } as unknown as BrowserPool;
  }

  beforeEach(() => {
    server = new MockMcpServer();
    doc = Document.create("Test Doc");
    registerNodeTools(server as any, () => doc, autoSave, createMockPool());
  });

  it("node:add includes image content", async () => {
    const result = await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        { type: "text", name: "Title", parentId: "root", content: "Hello" },
      ],
    });

    const data = expectSuccess(result) as any;
    expect(data.created).toBeDefined();

    const image = getImageContent(result);
    expect(image).toBeDefined();
    expect(image!.type).toBe("image");
    expect(image!.data).toBe("dGVzdC1pbWFnZQ==");
    expect(image!.mimeType).toBe("image/png");
  });

  it("node:update includes image content", async () => {
    await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        { id: "n1", type: "text", name: "Original", parentId: "root", content: "Old" },
      ],
    });

    const result = await server.callTool("node:update", {
      pageId: "page1",
      updates: [{ id: "n1", content: "New" }],
    });

    expectSuccess(result);
    expect(getImageContent(result)).toBeDefined();
  });

  it("node:delete includes image content", async () => {
    await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        { id: "del-me", type: "text", name: "Delete Me", parentId: "root", content: "bye" },
      ],
    });

    const result = await server.callTool("node:delete", {
      pageId: "page1",
      nodeId: "del-me",
    });

    expectSuccess(result);
    expect(getImageContent(result)).toBeDefined();
  });

  it("node:move includes image content", async () => {
    await server.callTool("node:add", {
      pageId: "page1",
      nodes: [
        { id: "container", type: "frame", name: "Container", parentId: "root" },
        { id: "moveable", type: "text", name: "Moveable", parentId: "root", content: "Move me" },
      ],
    });

    const result = await server.callTool("node:move", {
      pageId: "page1",
      nodeId: "moveable",
      newParentId: "container",
    });

    expectSuccess(result);
    expect(getImageContent(result)).toBeDefined();
  });

  it("node:list includes image content", async () => {
    const result = await server.callTool("node:list", {
      pageId: "page1",
    });

    expectSuccess(result);
    expect(getImageContent(result)).toBeDefined();
  });

  it("node:get includes image content", async () => {
    const result = await server.callTool("node:get", {
      pageId: "page1",
      nodeId: "root",
    });

    expectSuccess(result);
    expect(getImageContent(result)).toBeDefined();
  });

  it("gracefully degrades when screenshot fails", async () => {
    const failPool = {
      screenshot: async () => { throw new Error("browser crashed"); },
      acquire: async () => ({}),
      dispose: async () => {},
    } as unknown as BrowserPool;

    const failServer = new MockMcpServer();
    const failDoc = Document.create("Fail Test");
    registerNodeTools(failServer as any, () => failDoc, autoSave, failPool);

    const result = await failServer.callTool("node:list", {
      pageId: "page1",
    });

    const data = expectSuccess(result) as any;
    expect(data.nodes).toBeDefined();
    // No image block — graceful degradation
    expect(getImageContent(result)).toBeUndefined();
  });
});
