import { join } from "node:path";
import { CanvasManager } from "../../src/core/canvas.js";
import { NodeManager } from "../../src/core/node.js";
import { TokenManager } from "../../src/core/token.js";
import { ComponentRegistry } from "../../src/core/component.js";
import { exportToHtml } from "../../src/tools/export-tools.js";
import { createTempDir } from "../helpers/temp-dir.js";

/**
 * Integration tests for the MCP server tool chain.
 *
 * Instead of importing the McpServer class (which requires transport setup),
 * we exercise the same manager classes and functions that the MCP tool handlers use,
 * simulating the full tool chain end-to-end.
 */
describe("MCP Server Tool Chain Integration", () => {
  let tmpDir: { path: string; cleanup: () => Promise<void> };
  let canvasManager: CanvasManager;

  beforeEach(async () => {
    tmpDir = await createTempDir();
    canvasManager = new CanvasManager();
  });

  afterEach(async () => {
    await tmpDir.cleanup();
  });

  it("should chain canvas:create -> node:add -> export:html", async () => {
    const filePath = join(tmpDir.path, "export-chain.canvas.json");

    // canvas:create
    const doc = await canvasManager.create(filePath, "Export Chain");
    expect(doc.meta.name).toBe("Export Chain");

    // node:add
    const nm = new NodeManager(doc);
    nm.add("page1", [
      {
        type: "frame",
        name: "Hero",
        parentId: "root",
        layout: { direction: "column", gap: "16px" },
      },
    ]);
    const heroList = nm.list("page1", { parentId: "root", type: "frame" });
    const heroId = heroList.find((n) => n.name === "Hero")!.id;

    nm.add("page1", [
      {
        type: "text",
        name: "Heading",
        parentId: heroId,
        content: "Welcome",
        styles: { fontSize: "32px", fontWeight: "bold" },
      },
    ]);

    // export:html
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Welcome");
    expect(html).toContain("tailwindcss");
    expect(html).toContain("<h1");
  });

  it("should chain canvas:create -> token:set -> token:list", async () => {
    const filePath = join(tmpDir.path, "token-chain.canvas.json");

    // canvas:create
    const doc = await canvasManager.create(filePath, "Token Chain");

    // token:set
    const tm = new TokenManager(doc);
    const setResult = tm.set([
      { category: "colors", key: "primary", value: "#3B82F6", description: "Main brand" },
      { category: "colors", key: "secondary", value: "#6366F1" },
      { category: "spacing", key: "sm", value: "8px" },
    ]);
    expect(setResult.set).toBe(3);
    expect(setResult.total).toBe(3);

    // token:list
    const allTokens = tm.list();
    expect(Object.keys(allTokens.colors)).toHaveLength(2);
    expect(allTokens.colors.primary.value).toBe("#3B82F6");

    // token:list with category filter
    const colorsOnly = tm.list("colors");
    expect(Object.keys(colorsOnly.colors)).toHaveLength(2);
    expect(Object.keys(colorsOnly.spacing)).toHaveLength(0);
  });

  it("should chain canvas:create -> component:create -> component:list", async () => {
    const filePath = join(tmpDir.path, "component-chain.canvas.json");

    // canvas:create
    const doc = await canvasManager.create(filePath, "Component Chain");

    // component:create
    const cr = new ComponentRegistry(doc);
    cr.create("Badge", {
      description: "Status badge",
      variants: {
        status: {
          success: { backgroundColor: "green" },
          error: { backgroundColor: "red" },
        },
      },
      props: ["label", "status"],
      defaultProps: { label: "New", status: "success" },
    });

    cr.create("Avatar", {
      description: "User avatar",
      variants: {},
      props: ["src", "size"],
      defaultProps: { size: "md" },
    });

    // component:list
    const list = cr.list();
    expect(list).toHaveLength(2);

    const badge = list.find((c) => c.name === "Badge")!;
    expect(badge.description).toBe("Status badge");
    expect(badge.variantCount).toBe(1);
    expect(badge.propsCount).toBe(2);

    const avatar = list.find((c) => c.name === "Avatar")!;
    expect(avatar.propsCount).toBe(2);
  });

  it("should chain canvas:create -> node:add -> node:update -> node:get to verify changes", async () => {
    const filePath = join(tmpDir.path, "update-chain.canvas.json");

    // canvas:create
    const doc = await canvasManager.create(filePath, "Update Chain");

    // node:add
    const nm = new NodeManager(doc);
    const created = nm.add("page1", [
      {
        type: "text",
        name: "Label",
        parentId: "root",
        content: "Original",
        styles: { color: "#000000" },
      },
    ]);
    const labelId = created[0].id;

    // node:update
    nm.update("page1", [
      {
        id: labelId,
        name: "Updated Label",
        content: "Modified",
        styles: { color: "#FF0000", fontSize: "20px" },
      },
    ]);

    // node:get
    const node = nm.get("page1", labelId) as {
      name: string;
      content: string;
      styles: Record<string, unknown>;
    };
    expect(node.name).toBe("Updated Label");
    expect(node.content).toBe("Modified");
    expect(node.styles.color).toBe("#FF0000");
    expect(node.styles.fontSize).toBe("20px");
  });

  it("should chain canvas:create -> node:add -> node:move -> node:list to verify tree structure", async () => {
    const filePath = join(tmpDir.path, "move-chain.canvas.json");

    // canvas:create
    const doc = await canvasManager.create(filePath, "Move Chain");

    // node:add - create two frames and a text node in frame A
    const nm = new NodeManager(doc);
    const frames = nm.add("page1", [
      {
        type: "frame",
        name: "Frame A",
        parentId: "root",
        layout: { direction: "column" },
      },
      {
        type: "frame",
        name: "Frame B",
        parentId: "root",
        layout: { direction: "column" },
      },
    ]);
    const frameAId = frames[0].id;
    const frameBId = frames[1].id;

    const textNodes = nm.add("page1", [
      { type: "text", name: "Movable", parentId: frameAId, content: "I move" },
    ]);
    const movableId = textNodes[0].id;

    // Verify the node is in Frame A
    const frameAChildren = nm.list("page1", { parentId: frameAId });
    expect(frameAChildren.find((n) => n.id === movableId)).toBeDefined();

    // node:move - move to Frame B
    nm.move("page1", movableId, frameBId);

    // node:list - verify the node is now in Frame B, not Frame A
    const afterMoveA = nm.list("page1", { parentId: frameAId });
    expect(afterMoveA.find((n) => n.id === movableId)).toBeUndefined();

    const afterMoveB = nm.list("page1", { parentId: frameBId });
    expect(afterMoveB.find((n) => n.id === movableId)).toBeDefined();
  });

  it("should fail gracefully when calling tools without a document", async () => {
    // Simulates the getDocument() guard in the MCP server
    const freshManager = new CanvasManager();
    expect(freshManager.document).toBeNull();

    // Attempting to use managers without a document should throw
    // (In the MCP server, getDocument() would throw "No document loaded")
    expect(() => {
      new NodeManager(freshManager.document!).list("page1");
    }).toThrow();

    // Save without a document
    await expect(freshManager.save()).rejects.toThrow("No document is currently open");
  });
});
