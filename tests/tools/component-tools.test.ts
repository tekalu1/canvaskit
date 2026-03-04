import { describe, it, expect, beforeEach } from "vitest";
import { registerComponentTools } from "../../src/tools/component-tools.js";
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

describe("component-tools (MCP)", () => {
  let server: MockMcpServer;
  let doc: Document;
  const autoSave = async () => {};

  beforeEach(() => {
    server = new MockMcpServer();
    doc = Document.create("Test Doc");

    registerComponentTools(server as any, () => doc, autoSave);
  });

  // ---------------------------------------------------------
  // Registration
  // ---------------------------------------------------------

  it("registers all component tools", () => {
    expect(server.hasTool("component:create")).toBe(true);
    expect(server.hasTool("component:list")).toBe(true);
  });

  // ---------------------------------------------------------
  // component:create
  // ---------------------------------------------------------

  it("component:create returns created component name", async () => {
    const result = await server.callTool("component:create", {
      name: "Button",
      description: "A button component",
      props: ["label", "variant"],
    });

    const data = expectSuccess(result) as any;
    expect(data.created).toBe("Button");
  });

  it("component:create with template stores component definition", async () => {
    await server.callTool("component:create", {
      name: "Card",
      template: {
        type: "frame",
        styles: { padding: "16px" },
        children: [{ type: "text", content: "Title" }],
      },
    });

    // Verify it was stored by listing
    const listResult = await server.callTool("component:list", {});
    const listData = expectSuccess(listResult) as any;
    const card = listData.components.find((c: any) => c.name === "Card");
    expect(card).toBeDefined();
  });

  // ---------------------------------------------------------
  // component:list
  // ---------------------------------------------------------

  it("component:list returns empty array when no components", async () => {
    const result = await server.callTool("component:list", {});
    const data = expectSuccess(result) as any;

    expect(data.components).toBeDefined();
    expect(Array.isArray(data.components)).toBe(true);
    expect(data.components.length).toBe(0);
  });

  it("component:list returns component details after creation", async () => {
    await server.callTool("component:create", {
      name: "Button",
      description: "A button",
      variants: { primary: { bg: "blue" }, secondary: { bg: "gray" } },
      props: ["label"],
    });

    await server.callTool("component:create", {
      name: "Input",
      description: "An input",
    });

    const result = await server.callTool("component:list", {});
    const data = expectSuccess(result) as any;

    expect(data.components.length).toBe(2);

    const button = data.components.find((c: any) => c.name === "Button");
    expect(button).toBeDefined();
    expect(button.description).toBe("A button");
    expect(button.variantCount).toBe(2);
    expect(button.propsCount).toBe(1);

    const input = data.components.find((c: any) => c.name === "Input");
    expect(input).toBeDefined();
    expect(input.description).toBe("An input");
  });

  it("component:create overwrites existing component with same name", async () => {
    await server.callTool("component:create", {
      name: "Button",
      description: "V1",
    });

    await server.callTool("component:create", {
      name: "Button",
      description: "V2",
    });

    const result = await server.callTool("component:list", {});
    const data = expectSuccess(result) as any;

    expect(data.components.length).toBe(1);
    expect(data.components[0].description).toBe("V2");
  });
});
