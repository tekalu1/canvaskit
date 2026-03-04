import { describe, it, expect, beforeEach } from "vitest";
import { registerTokenTools } from "../../src/tools/token-tools.js";
import { Document } from "../../src/core/document.js";
import { expectSuccess, expectError } from "../helpers/mcp-test-client.js";

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

describe("token-tools (MCP)", () => {
  let server: MockMcpServer;
  let doc: Document;
  const autoSave = async () => {};

  beforeEach(() => {
    server = new MockMcpServer();
    doc = Document.create("Test Doc");

    registerTokenTools(server as any, () => doc, autoSave);
  });

  // ---------------------------------------------------------
  // Registration
  // ---------------------------------------------------------

  it("registers all token tools", () => {
    expect(server.hasTool("token:set")).toBe(true);
    expect(server.hasTool("token:get")).toBe(true);
    expect(server.hasTool("token:list")).toBe(true);
  });

  // ---------------------------------------------------------
  // token:set
  // ---------------------------------------------------------

  it("token:set returns set count and total", async () => {
    const result = await server.callTool("token:set", {
      tokens: [
        { category: "colors", key: "primary", value: "#3b82f6" },
        { category: "colors", key: "secondary", value: "#10b981" },
      ],
    });

    const data = expectSuccess(result) as any;
    expect(data.set).toBe(2);
    expect(data.total).toBe(2);
  });

  it("token:set accumulates total across calls", async () => {
    await server.callTool("token:set", {
      tokens: [{ category: "colors", key: "primary", value: "#3b82f6" }],
    });

    const result = await server.callTool("token:set", {
      tokens: [{ category: "spacing", key: "sm", value: "4px" }],
    });

    const data = expectSuccess(result) as any;
    expect(data.set).toBe(1);
    expect(data.total).toBe(2);
  });

  // ---------------------------------------------------------
  // token:get
  // ---------------------------------------------------------

  it("token:get returns category, key, and value", async () => {
    await server.callTool("token:set", {
      tokens: [{ category: "colors", key: "primary", value: "#3b82f6" }],
    });

    const result = await server.callTool("token:get", {
      category: "colors",
      key: "primary",
    });

    const data = expectSuccess(result) as any;
    expect(data.category).toBe("colors");
    expect(data.key).toBe("primary");
    expect(data.value).toBeDefined();
  });

  it("token:get returns error for missing token", async () => {
    const result = await server.callTool("token:get", {
      category: "colors",
      key: "nonexistent",
    });

    expect(result.isError).toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toContain("not found");
  });

  // ---------------------------------------------------------
  // token:list
  // ---------------------------------------------------------

  it("token:list returns all tokens", async () => {
    await server.callTool("token:set", {
      tokens: [
        { category: "colors", key: "primary", value: "#3b82f6" },
        { category: "spacing", key: "sm", value: "4px" },
      ],
    });

    const result = await server.callTool("token:list", {});
    const data = expectSuccess(result) as any;

    expect(data.colors).toBeDefined();
    expect(data.spacing).toBeDefined();
    expect(Object.keys(data.colors)).toContain("primary");
    expect(Object.keys(data.spacing)).toContain("sm");
  });

  it("token:list filters by category", async () => {
    await server.callTool("token:set", {
      tokens: [
        { category: "colors", key: "primary", value: "#3b82f6" },
        { category: "spacing", key: "sm", value: "4px" },
      ],
    });

    const result = await server.callTool("token:list", {
      category: "colors",
    });
    const data = expectSuccess(result) as any;

    expect(Object.keys(data.colors)).toContain("primary");
    // When filtered, other categories should be empty
    expect(Object.keys(data.spacing)).toHaveLength(0);
  });
});
