import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { CanvasManager } from "../../src/core/canvas.js";
import { NodeManager } from "../../src/core/node.js";
import { TokenManager } from "../../src/core/token.js";
import { ComponentRegistry } from "../../src/core/component.js";
import { createTempDir } from "../helpers/temp-dir.js";

describe("Document Lifecycle Integration", () => {
  let tmpDir: { path: string; cleanup: () => Promise<void> };

  beforeEach(async () => {
    tmpDir = await createTempDir();
  });

  afterEach(async () => {
    await tmpDir.cleanup();
  });

  it("should create document, add nodes and tokens, save, re-open, and verify all data", async () => {
    const filePath = join(tmpDir.path, "lifecycle.canvas.json");

    // Create
    const manager = new CanvasManager();
    const doc = await manager.create(filePath, "Lifecycle Test");

    // Add nodes
    const nm = new NodeManager(doc);
    nm.add("page1", [
      { type: "frame", name: "Header", parentId: "root", layout: { direction: "row" } },
    ]);
    const headerNodes = nm.list("page1", { parentId: "root" });
    const headerId = headerNodes.find((n) => n.name === "Header")!.id;

    nm.add("page1", [
      { type: "text", name: "Title", parentId: headerId, content: "Hello World" },
    ]);

    // Add tokens
    const tm = new TokenManager(doc);
    tm.set([
      { category: "colors", key: "primary", value: "#3B82F6" },
      { category: "spacing", key: "md", value: "16px" },
    ]);

    // Save
    await manager.save();

    // Re-open with a fresh manager
    const manager2 = new CanvasManager();
    const doc2 = await manager2.open(filePath);

    // Verify meta
    expect(doc2.meta.name).toBe("Lifecycle Test");

    // Verify nodes
    const nm2 = new NodeManager(doc2);
    const allNodes = nm2.list("page1");
    const titleNode = allNodes.find((n) => n.name === "Title");
    expect(titleNode).toBeDefined();
    expect(titleNode!.type).toBe("text");

    const fetchedTitle = nm2.get("page1", titleNode!.id);
    expect(fetchedTitle).toBeDefined();
    expect((fetchedTitle as { content: string }).content).toBe("Hello World");

    // Verify tokens
    const tm2 = new TokenManager(doc2);
    const primary = tm2.get("colors", "primary") as { value: string };
    expect(primary.value).toBe("#3B82F6");

    const spacing = tm2.get("spacing", "md") as { value: string };
    expect(spacing.value).toBe("16px");
  });

  it("should create a component, instantiate it as a node, and verify after re-open", async () => {
    const filePath = join(tmpDir.path, "component.canvas.json");

    const manager = new CanvasManager();
    const doc = await manager.create(filePath, "Component Test");

    // Create component
    const cr = new ComponentRegistry(doc);
    cr.create("Button", {
      description: "Primary button",
      variants: { size: { sm: { padding: "4px" }, md: { padding: "8px" } } },
      props: ["text", "variant"],
      defaultProps: { text: "Click me", variant: "primary" },
      template: {
        type: "frame",
        styles: { backgroundColor: "#3B82F6" },
        children: [{ type: "text", content: "Click me" }],
      },
    });

    // Add a component instance node
    const nm = new NodeManager(doc);
    nm.add("page1", [
      {
        type: "component",
        name: "CTA Button",
        parentId: "root",
        componentRef: "Button",
        props: { text: "Get Started" },
      },
    ]);

    await manager.save();

    // Re-open
    const manager2 = new CanvasManager();
    const doc2 = await manager2.open(filePath);

    // Verify component definition
    const cr2 = new ComponentRegistry(doc2);
    const btn = cr2.get("Button");
    expect(btn).toBeDefined();
    expect(btn!.description).toBe("Primary button");
    expect(btn!.props).toContain("text");

    // Verify component instance node
    const nm2 = new NodeManager(doc2);
    const nodes = nm2.list("page1", { type: "component" });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe("CTA Button");

    const instanceNode = nm2.get("page1", nodes[0].id) as {
      componentRef: string;
      props: Record<string, unknown>;
    };
    expect(instanceNode.componentRef).toBe("Button");
    expect(instanceNode.props.text).toBe("Get Started");
  });

  it("should update modified timestamp on save after modification", async () => {
    const filePath = join(tmpDir.path, "timestamp.canvas.json");

    const manager = new CanvasManager();
    const doc = await manager.create(filePath, "Timestamp Test");
    const createdTime = doc.meta.modified;

    // Wait a tick to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 10));

    // Modify
    const nm = new NodeManager(doc);
    nm.add("page1", [
      { type: "text", name: "Note", parentId: "root", content: "Added later" },
    ]);

    await manager.save();

    // Re-open
    const manager2 = new CanvasManager();
    const doc2 = await manager2.open(filePath);

    expect(doc2.meta.modified).not.toBe(createdTime);
    expect(new Date(doc2.meta.modified).getTime()).toBeGreaterThan(
      new Date(createdTime).getTime()
    );
  });

  it("should add a new page, add nodes to it, and verify via listPages", async () => {
    const filePath = join(tmpDir.path, "multipage.canvas.json");

    const manager = new CanvasManager();
    const doc = await manager.create(filePath, "MultiPage");

    // Add a second page
    doc.addPage("page2", {
      name: "About",
      width: 1024,
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

    // Add nodes to page2
    const nm = new NodeManager(doc);
    nm.add("page2", [
      { type: "text", name: "About Title", parentId: "root", content: "About Us" },
    ]);

    await manager.save();

    // Re-open and verify
    const manager2 = new CanvasManager();
    const doc2 = await manager2.open(filePath);
    const pages = doc2.listPages();
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.name)).toContain("About");

    const nm2 = new NodeManager(doc2);
    const aboutNodes = nm2.list("page2");
    const aboutTitle = aboutNodes.find((n) => n.name === "About Title");
    expect(aboutTitle).toBeDefined();
  });

  it("should cascade-delete a frame and its children", async () => {
    const filePath = join(tmpDir.path, "cascade.canvas.json");

    const manager = new CanvasManager();
    const doc = await manager.create(filePath, "Cascade Delete");

    const nm = new NodeManager(doc);

    // Build a nested structure: root -> container -> child1, child2
    nm.add("page1", [
      {
        type: "frame",
        name: "Container",
        parentId: "root",
        layout: { direction: "column" },
      },
    ]);
    const containerList = nm.list("page1", { parentId: "root", type: "frame" });
    const containerId = containerList.find((n) => n.name === "Container")!.id;

    nm.add("page1", [
      { type: "text", name: "Child 1", parentId: containerId, content: "First" },
      { type: "text", name: "Child 2", parentId: containerId, content: "Second" },
    ]);

    // Verify children exist
    const beforeDelete = nm.list("page1");
    expect(beforeDelete.find((n) => n.name === "Child 1")).toBeDefined();
    expect(beforeDelete.find((n) => n.name === "Child 2")).toBeDefined();

    // Delete the container (should cascade)
    nm.delete("page1", containerId);

    // Verify children are gone
    const afterDelete = nm.list("page1");
    expect(afterDelete.find((n) => n.name === "Container")).toBeUndefined();
    expect(afterDelete.find((n) => n.name === "Child 1")).toBeUndefined();
    expect(afterDelete.find((n) => n.name === "Child 2")).toBeUndefined();

    // Root should still exist
    expect(afterDelete.find((n) => n.name === "Root")).toBeDefined();
  });

  it("should resolve a chained token reference", async () => {
    const filePath = join(tmpDir.path, "token-chain.canvas.json");

    const manager = new CanvasManager();
    const doc = await manager.create(filePath, "Token Chain");

    const tm = new TokenManager(doc);

    // Set up chain: brand -> primary -> blue -> #3B82F6
    tm.set([
      { category: "colors", key: "blue", value: "#3B82F6" },
      { category: "colors", key: "primary", value: "{colors.blue}" },
      { category: "colors", key: "brand", value: "{colors.primary}" },
    ]);

    // Resolve the chain
    const resolved = tm.resolve("{colors.brand}");
    expect(resolved).toBe("#3B82F6");

    // Also resolve intermediate
    const resolvedPrimary = tm.resolve("{colors.primary}");
    expect(resolvedPrimary).toBe("#3B82F6");

    // Direct reference
    const resolvedBlue = tm.resolve("{colors.blue}");
    expect(resolvedBlue).toBe("#3B82F6");

    // Save and re-open to verify persistence
    await manager.save();
    const manager2 = new CanvasManager();
    const doc2 = await manager2.open(filePath);
    const tm2 = new TokenManager(doc2);
    expect(tm2.resolve("{colors.brand}")).toBe("#3B82F6");
  });

  it("should handle multi-page documents with different node trees", async () => {
    const filePath = join(tmpDir.path, "multi-tree.canvas.json");

    const manager = new CanvasManager();
    const doc = await manager.create(filePath, "Multi Tree");

    // Add nodes to page1
    const nm = new NodeManager(doc);
    nm.add("page1", [
      { type: "text", name: "Home Heading", parentId: "root", content: "Welcome" },
    ]);

    // Add page2 with its own tree
    doc.addPage("page2", {
      name: "Dashboard",
      width: 1280,
      height: null,
      nodes: {
        root: {
          type: "frame",
          name: "Root",
          layout: { direction: "row" },
          children: [],
        },
      },
    });

    nm.add("page2", [
      {
        type: "frame",
        name: "Sidebar",
        parentId: "root",
        layout: { direction: "column" },
      },
    ]);

    // Add page3
    doc.addPage("page3", {
      name: "Settings",
      width: 800,
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

    nm.add("page3", [
      { type: "text", name: "Settings Title", parentId: "root", content: "Settings" },
      { type: "icon", name: "Gear Icon", parentId: "root", icon: "lucide:settings" },
    ]);

    await manager.save();

    // Re-open
    const manager2 = new CanvasManager();
    const doc2 = await manager2.open(filePath);
    const pages = doc2.listPages();

    expect(pages).toHaveLength(3);
    expect(pages.map((p) => p.name).sort()).toEqual(["Dashboard", "Page 1", "Settings"]);

    const nm2 = new NodeManager(doc2);

    // Verify page1 nodes
    const p1Nodes = nm2.list("page1", { type: "text" });
    expect(p1Nodes.find((n) => n.name === "Home Heading")).toBeDefined();

    // Verify page2 nodes
    const p2Nodes = nm2.list("page2", { type: "frame" });
    expect(p2Nodes.find((n) => n.name === "Sidebar")).toBeDefined();

    // Verify page3 nodes
    const p3Nodes = nm2.list("page3");
    expect(p3Nodes.find((n) => n.name === "Settings Title")).toBeDefined();
    expect(p3Nodes.find((n) => n.name === "Gear Icon")).toBeDefined();
  });

  it("should save with pretty=false, re-open, and verify data is intact", async () => {
    const filePath = join(tmpDir.path, "compact.canvas.json");

    const manager = new CanvasManager();
    const doc = await manager.create(filePath, "Compact Test");

    // Add some data
    const nm = new NodeManager(doc);
    nm.add("page1", [
      { type: "text", name: "Title", parentId: "root", content: "Compact" },
    ]);

    const tm = new TokenManager(doc);
    tm.set([{ category: "colors", key: "red", value: "#EF4444" }]);

    // Save without pretty-print
    await manager.save(undefined, false);

    // Verify the file is compact (no indentation)
    const rawContent = await readFile(filePath, "utf-8");
    expect(rawContent).not.toContain("\n  ");
    // It should still be valid JSON
    expect(() => JSON.parse(rawContent)).not.toThrow();

    // Re-open and verify data integrity
    const manager2 = new CanvasManager();
    const doc2 = await manager2.open(filePath);

    expect(doc2.meta.name).toBe("Compact Test");

    const nm2 = new NodeManager(doc2);
    const nodes = nm2.list("page1", { type: "text" });
    expect(nodes.find((n) => n.name === "Title")).toBeDefined();

    const tm2 = new TokenManager(doc2);
    const red = tm2.get("colors", "red") as { value: string };
    expect(red.value).toBe("#EF4444");
  });
});
