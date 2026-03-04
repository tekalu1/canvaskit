import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:crypto", () => ({
  randomUUID: () => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
}));

import { NodeManager } from "../../src/core/node.js";
import {
  createTestDocument,
  createDocumentWithNodes,
} from "../helpers/create-test-document.js";
import type { Document } from "../../src/core/document.js";

describe("NodeManager", () => {
  let doc: Document;
  let nodes: NodeManager;

  beforeEach(() => {
    doc = createDocumentWithNodes();
    nodes = new NodeManager(doc);
  });

  // ----------------------------------------------------------------
  // add()
  // ----------------------------------------------------------------
  describe("add()", () => {
    it("should add a frame node to a frame parent", () => {
      const result = nodes.add("page1", [
        { type: "frame", name: "Sidebar", parentId: "root" },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Sidebar");
      expect(result[0].id).toBe("aaaaaaaa"); // first 8 chars of mock UUID
    });

    it("should add a text node", () => {
      const result = nodes.add("page1", [
        {
          type: "text",
          name: "Paragraph",
          parentId: "header",
          content: "Some text",
        },
      ]);

      expect(result[0].name).toBe("Paragraph");
      const node = nodes.get("page1", result[0].id);
      expect(node).toBeDefined();
      expect(node!.type).toBe("text");
      expect((node as { content: string }).content).toBe("Some text");
    });

    it("should add an image node", () => {
      const result = nodes.add("page1", [
        {
          type: "image",
          name: "Logo",
          parentId: "header",
          src: "logo.png",
          alt: "Logo image",
        },
      ]);

      const node = nodes.get("page1", result[0].id);
      expect(node!.type).toBe("image");
      expect((node as { src?: string }).src).toBe("logo.png");
      expect((node as { alt?: string }).alt).toBe("Logo image");
    });

    it("should add an icon node", () => {
      const result = nodes.add("page1", [
        {
          type: "icon",
          name: "Menu Icon",
          parentId: "header",
          icon: "lucide:menu",
        },
      ]);

      const node = nodes.get("page1", result[0].id);
      expect(node!.type).toBe("icon");
      expect((node as { icon: string }).icon).toBe("lucide:menu");
    });

    it("should add a component node", () => {
      const result = nodes.add("page1", [
        {
          type: "component",
          name: "Button",
          parentId: "header",
          componentRef: "PrimaryButton",
          props: { label: "Click me" },
        },
      ]);

      const node = nodes.get("page1", result[0].id);
      expect(node!.type).toBe("component");
      expect((node as { componentRef: string }).componentRef).toBe(
        "PrimaryButton"
      );
      expect((node as { props: object }).props).toEqual({ label: "Click me" });
      expect((node as { overrides: object }).overrides).toEqual({});
    });

    it("should add a vector node", () => {
      const result = nodes.add("page1", [
        { type: "vector", name: "Divider", parentId: "header" },
      ]);

      const node = nodes.get("page1", result[0].id);
      expect(node!.type).toBe("vector");
    });

    it("should use provided id instead of generating one", () => {
      const result = nodes.add("page1", [
        { id: "custom-id", type: "text", name: "Custom", parentId: "header" },
      ]);

      expect(result[0].id).toBe("custom-id");
      expect(nodes.get("page1", "custom-id")).toBeDefined();
    });

    it("should auto-generate id when none provided", () => {
      const result = nodes.add("page1", [
        { type: "text", name: "Auto", parentId: "header" },
      ]);

      expect(result[0].id).toBe("aaaaaaaa");
    });

    it("should append child to parent's children array", () => {
      nodes.add("page1", [
        { id: "new-child", type: "text", name: "New", parentId: "content" },
      ]);

      const parent = nodes.get("page1", "content") as {
        children: string[];
      };
      expect(parent.children).toContain("new-child");
      expect(parent.children[parent.children.length - 1]).toBe("new-child");
    });

    it("should insert at specific index with insertIndex", () => {
      nodes.add("page1", [
        {
          id: "inserted",
          type: "text",
          name: "Inserted",
          parentId: "content",
          insertIndex: 0,
        },
      ]);

      const parent = nodes.get("page1", "content") as {
        children: string[];
      };
      expect(parent.children[0]).toBe("inserted");
    });

    it("should insert at specific index between existing children", () => {
      nodes.add("page1", [
        {
          id: "middle",
          type: "text",
          name: "Middle",
          parentId: "content",
          insertIndex: 1,
        },
      ]);

      const parent = nodes.get("page1", "content") as {
        children: string[];
      };
      expect(parent.children[1]).toBe("middle");
      expect(parent.children).toEqual(["title", "middle", "hero-image"]);
    });

    it("should apply default layout direction for frames", () => {
      nodes.add("page1", [
        { id: "f1", type: "frame", name: "Frame1", parentId: "root" },
      ]);

      const node = nodes.get("page1", "f1") as { layout: { direction: string } };
      expect(node.layout.direction).toBe("column");
    });

    it("should use provided layout for frames", () => {
      nodes.add("page1", [
        {
          id: "f2",
          type: "frame",
          name: "Frame2",
          parentId: "root",
          layout: { direction: "row", gap: "8px" },
        },
      ]);

      const node = nodes.get("page1", "f2") as { layout: object };
      expect(node.layout).toEqual({ direction: "row", gap: "8px" });
    });

    it("should default text content to empty string", () => {
      nodes.add("page1", [
        { id: "empty-text", type: "text", name: "Empty", parentId: "header" },
      ]);

      const node = nodes.get("page1", "empty-text") as { content: string };
      expect(node.content).toBe("");
    });

    it("should default icon to empty string", () => {
      nodes.add("page1", [
        { id: "empty-icon", type: "icon", name: "Icon", parentId: "header" },
      ]);

      const node = nodes.get("page1", "empty-icon") as { icon: string };
      expect(node.icon).toBe("");
    });

    it("should throw when componentRef is not provided for component node", () => {
      expect(() =>
        nodes.add("page1", [
          {
            id: "empty-comp",
            type: "component",
            name: "Comp",
            parentId: "header",
          },
        ])
      ).toThrow('componentRef is required for component node "Comp"');
    });

    it("should throw when componentRef is empty string for component node", () => {
      expect(() =>
        nodes.add("page1", [
          {
            id: "empty-comp",
            type: "component",
            name: "Comp",
            parentId: "header",
            componentRef: "",
          },
        ])
      ).toThrow('componentRef is required for component node "Comp"');
    });

    it("should default frame children to empty array", () => {
      nodes.add("page1", [
        { id: "empty-frame", type: "frame", name: "Frame", parentId: "root" },
      ]);

      const node = nodes.get("page1", "empty-frame") as {
        children: string[];
      };
      expect(node.children).toEqual([]);
    });

    it("should add multiple nodes in a single call", () => {
      const result = nodes.add("page1", [
        { id: "n1", type: "text", name: "Node1", parentId: "header" },
        { id: "n2", type: "text", name: "Node2", parentId: "header" },
        { id: "n3", type: "text", name: "Node3", parentId: "header" },
      ]);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toEqual(["n1", "n2", "n3"]);
    });

    it("should apply styles when provided", () => {
      nodes.add("page1", [
        {
          id: "styled",
          type: "text",
          name: "Styled",
          parentId: "header",
          styles: { color: "red", fontSize: "14px" },
        },
      ]);

      const node = nodes.get("page1", "styled");
      expect(node!.styles).toEqual({ color: "red", fontSize: "14px" });
    });

    it("should call doc.touch() after adding", () => {
      const spy = vi.spyOn(doc, "touch");
      nodes.add("page1", [
        { id: "t1", type: "text", name: "Touch", parentId: "header" },
      ]);
      expect(spy).toHaveBeenCalled();
    });

    it("should throw when page does not exist", () => {
      expect(() =>
        nodes.add("nonexistent", [
          { type: "text", name: "X", parentId: "root" },
        ])
      ).toThrow('Page "nonexistent" not found');
    });

    it("should throw when parent does not exist", () => {
      expect(() =>
        nodes.add("page1", [
          { type: "text", name: "X", parentId: "no-such-parent" },
        ])
      ).toThrow('Parent node "no-such-parent" not found on page "page1"');
    });

    it("should throw when parent is not a frame", () => {
      expect(() =>
        nodes.add("page1", [
          { type: "text", name: "X", parentId: "title" },
        ])
      ).toThrow('Parent node "title" is not a frame');
    });

    it("should throw for duplicate node id", () => {
      expect(() =>
        nodes.add("page1", [
          { id: "title", type: "text", name: "Dup", parentId: "header" },
        ])
      ).toThrow('Node "title" already exists on page "page1"');
    });

    it("should throw for duplicate id of root", () => {
      expect(() =>
        nodes.add("page1", [
          { id: "root", type: "frame", name: "Dup Root", parentId: "root" },
        ])
      ).toThrow('Node "root" already exists on page "page1"');
    });

    describe("parentName resolution", () => {
      it("resolves parent by name", () => {
        const doc = createTestDocument();
        const nm = new NodeManager(doc);

        // First add a frame with parentId
        nm.add("page1", [
          { id: "container1", type: "frame", name: "Container", parentId: "root" },
        ]);

        // Now add a child using parentName
        const result = nm.add("page1", [
          { id: "child1", type: "text", name: "Child", parentName: "Container", content: "Hello" },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Child");

        // Verify it's actually a child of Container
        const page = doc.data.pages["page1"]!;
        const container = page.nodes["container1"] as any;
        expect(container.children).toContain("child1");
      });

      it("throws when no node matches parentName", () => {
        const doc = createTestDocument();
        const nm = new NodeManager(doc);

        expect(() => {
          nm.add("page1", [
            { type: "text", name: "Child", parentName: "Nonexistent", content: "Hello" },
          ]);
        }).toThrow('No node named "Nonexistent" found');
      });

      it("throws when multiple nodes match parentName", () => {
        const doc = createTestDocument();
        const nm = new NodeManager(doc);

        // Add two nodes with the same name
        nm.add("page1", [
          { id: "dup1", type: "frame", name: "Duplicate", parentId: "root" },
          { id: "dup2", type: "frame", name: "Duplicate", parentId: "root" },
        ]);

        expect(() => {
          nm.add("page1", [
            { id: "child2", type: "text", name: "Child", parentName: "Duplicate", content: "Hello" },
          ]);
        }).toThrow('Multiple nodes named "Duplicate" found');
      });

      it("resolves parentName within same batch", () => {
        const doc = createTestDocument();
        const nm = new NodeManager(doc);

        const result = nm.add("page1", [
          { id: "new-frame", type: "frame", name: "NewFrame", parentId: "root" },
          { id: "frame-child", type: "text", name: "FrameChild", parentName: "NewFrame", content: "Inside" },
        ]);

        expect(result).toHaveLength(2);

        // Verify child is under the new frame
        const page = doc.data.pages["page1"]!;
        const frame = page.nodes["new-frame"] as any;
        expect(frame.children).toContain("frame-child");
      });

      it("throws when neither parentId nor parentName is provided", () => {
        const doc = createTestDocument();
        const nm = new NodeManager(doc);

        expect(() => {
          nm.add("page1", [
            { type: "text", name: "Orphan", content: "Hello" } as any,
          ]);
        }).toThrow("Either parentId or parentName must be provided");
      });

      it("prefers parentId when both parentId and parentName are provided", () => {
        const doc = createTestDocument();
        const nm = new NodeManager(doc);

        // parentId takes precedence
        const result = nm.add("page1", [
          { type: "text", name: "Child", parentId: "root", parentName: "Root", content: "Hello" },
        ]);

        expect(result).toHaveLength(1);
        const page = doc.data.pages["page1"]!;
        expect((page.nodes["root"] as any).children).toContain(result[0].id);
      });
    });
  });

  // ----------------------------------------------------------------
  // update()
  // ----------------------------------------------------------------
  describe("update()", () => {
    it("should update node name", () => {
      const updated = nodes.update("page1", [
        { id: "title", name: "New Title" },
      ]);

      expect(updated).toEqual(["title"]);
      expect(nodes.get("page1", "title")!.name).toBe("New Title");
    });

    it("should update text content", () => {
      nodes.update("page1", [{ id: "title", content: "Updated text" }]);

      const node = nodes.get("page1", "title") as { content: string };
      expect(node.content).toBe("Updated text");
    });

    it("should shallow-merge styles", () => {
      nodes.update("page1", [
        { id: "title", styles: { color: "blue" } },
      ]);

      const node = nodes.get("page1", "title");
      expect(node!.styles).toEqual({
        fontSize: "32px",
        fontWeight: "bold",
        color: "blue",
      });
    });

    it("should overwrite existing style properties on merge", () => {
      nodes.update("page1", [
        { id: "title", styles: { fontSize: "48px" } },
      ]);

      const node = nodes.get("page1", "title");
      expect(node!.styles).toEqual({
        fontSize: "48px",
        fontWeight: "bold",
      });
    });

    it("should shallow-merge layout for frame nodes", () => {
      nodes.update("page1", [
        { id: "content", layout: { gap: "32px", align: "center" } },
      ]);

      const node = nodes.get("page1", "content") as {
        layout: Record<string, unknown>;
      };
      expect(node.layout).toEqual({
        direction: "column",
        gap: "32px",
        align: "center",
      });
    });

    it("should not apply layout to non-frame nodes", () => {
      // title is text; layout should be ignored
      nodes.update("page1", [
        { id: "title", layout: { direction: "row" } },
      ]);

      const node = nodes.get("page1", "title");
      expect("layout" in node!).toBe(false);
    });

    it("should shallow-merge props for component nodes", () => {
      nodes.add("page1", [
        {
          id: "btn",
          type: "component",
          name: "Btn",
          parentId: "header",
          componentRef: "Button",
          props: { label: "OK", size: "md" },
        },
      ]);

      nodes.update("page1", [
        { id: "btn", props: { label: "Save", variant: "primary" } },
      ]);

      const node = nodes.get("page1", "btn") as {
        props: Record<string, unknown>;
      };
      expect(node.props).toEqual({
        label: "Save",
        size: "md",
        variant: "primary",
      });
    });

    it("should shallow-merge overrides for component nodes", () => {
      nodes.add("page1", [
        {
          id: "btn2",
          type: "component",
          name: "Btn2",
          parentId: "header",
          componentRef: "Button",
        },
      ]);

      nodes.update("page1", [
        { id: "btn2", overrides: { color: "red" } },
      ]);

      const node = nodes.get("page1", "btn2") as {
        overrides: Record<string, unknown>;
      };
      expect(node.overrides).toEqual({ color: "red" });
    });

    it("should not apply props to non-component nodes", () => {
      nodes.update("page1", [
        { id: "title", props: { foo: "bar" } },
      ]);

      const node = nodes.get("page1", "title");
      expect("props" in node!).toBe(false);
    });

    it("should update multiple nodes in one call", () => {
      const updated = nodes.update("page1", [
        { id: "title", name: "Updated Title" },
        { id: "hero-image", name: "Updated Image" },
      ]);

      expect(updated).toEqual(["title", "hero-image"]);
      expect(nodes.get("page1", "title")!.name).toBe("Updated Title");
      expect(nodes.get("page1", "hero-image")!.name).toBe("Updated Image");
    });

    it("should call doc.touch() after updating", () => {
      const spy = vi.spyOn(doc, "touch");
      nodes.update("page1", [{ id: "title", name: "Touched" }]);
      expect(spy).toHaveBeenCalled();
    });

    it("should throw when page does not exist", () => {
      expect(() =>
        nodes.update("nonexistent", [{ id: "title", name: "X" }])
      ).toThrow('Page "nonexistent" not found');
    });

    it("should throw when node does not exist", () => {
      expect(() =>
        nodes.update("page1", [{ id: "no-such-node", name: "X" }])
      ).toThrow('Node "no-such-node" not found on page "page1"');
    });

    describe("nodeName resolution", () => {
      it("should update by nodeName", () => {
        const updated = nodes.update("page1", [
          { nodeName: "Title", content: "Updated via name" },
        ]);

        expect(updated).toEqual(["title"]);
        const node = nodes.get("page1", "title") as { content: string };
        expect(node.content).toBe("Updated via name");
      });

      it("should throw when no node matches nodeName", () => {
        expect(() =>
          nodes.update("page1", [{ nodeName: "Nonexistent", content: "X" }])
        ).toThrow('No node named "Nonexistent" found on page "page1"');
      });

      it("should throw when multiple nodes match nodeName", () => {
        // Add two nodes with the same name
        nodes.add("page1", [
          { id: "dup-a", type: "text", name: "Duplicate", parentId: "header", content: "A" },
          { id: "dup-b", type: "text", name: "Duplicate", parentId: "header", content: "B" },
        ]);

        expect(() =>
          nodes.update("page1", [{ nodeName: "Duplicate", content: "X" }])
        ).toThrow(/Multiple nodes named "Duplicate" found/);
      });

      it("should use id when both id and nodeName are provided", () => {
        const updated = nodes.update("page1", [
          { id: "title", nodeName: "Hero Image", content: "Used id" },
        ]);

        expect(updated).toEqual(["title"]);
        const node = nodes.get("page1", "title") as { content: string };
        expect(node.content).toBe("Used id");
      });

      it("should throw when neither id nor nodeName is provided", () => {
        expect(() =>
          nodes.update("page1", [{ name: "X" } as any])
        ).toThrow("Either id or nodeName is required for update");
      });
    });

    it("should initialize styles from undefined when merging", () => {
      // vector node has no initial styles (undefined)
      nodes.add("page1", [
        { id: "vec", type: "vector", name: "Vec", parentId: "header" },
      ]);

      nodes.update("page1", [{ id: "vec", styles: { stroke: "black" } }]);

      const node = nodes.get("page1", "vec");
      expect(node!.styles).toEqual({ stroke: "black" });
    });
  });

  // ----------------------------------------------------------------
  // delete()
  // ----------------------------------------------------------------
  describe("delete()", () => {
    it("should delete a leaf node", () => {
      nodes.delete("page1", "title");
      expect(nodes.get("page1", "title")).toBeUndefined();
    });

    it("should remove deleted node from parent's children", () => {
      nodes.delete("page1", "title");

      const parent = nodes.get("page1", "content") as {
        children: string[];
      };
      expect(parent.children).not.toContain("title");
    });

    it("should recursively delete children of a frame", () => {
      nodes.delete("page1", "content");

      expect(nodes.get("page1", "content")).toBeUndefined();
      expect(nodes.get("page1", "title")).toBeUndefined();
      expect(nodes.get("page1", "hero-image")).toBeUndefined();
    });

    it("should remove frame from its parent after recursive delete", () => {
      nodes.delete("page1", "content");

      const root = nodes.get("page1", "root") as { children: string[] };
      expect(root.children).not.toContain("content");
    });

    it("should call doc.touch() after deleting", () => {
      const spy = vi.spyOn(doc, "touch");
      nodes.delete("page1", "title");
      expect(spy).toHaveBeenCalled();
    });

    it("should throw when page does not exist", () => {
      expect(() => nodes.delete("nonexistent", "title")).toThrow(
        'Page "nonexistent" not found'
      );
    });

    it("should throw when node does not exist", () => {
      expect(() => nodes.delete("page1", "no-such-node")).toThrow(
        'Node "no-such-node" not found on page "page1"'
      );
    });

    it("should handle deleting a frame with no children", () => {
      nodes.delete("page1", "header");

      expect(nodes.get("page1", "header")).toBeUndefined();
      const root = nodes.get("page1", "root") as { children: string[] };
      expect(root.children).not.toContain("header");
    });
  });

  // ----------------------------------------------------------------
  // move()
  // ----------------------------------------------------------------
  describe("move()", () => {
    it("should move a node to a different parent", () => {
      nodes.move("page1", "title", "header");

      const oldParent = nodes.get("page1", "content") as {
        children: string[];
      };
      expect(oldParent.children).not.toContain("title");

      const newParent = nodes.get("page1", "header") as {
        children: string[];
      };
      expect(newParent.children).toContain("title");
    });

    it("should move a node to a specific index in new parent", () => {
      // First add a child to header
      nodes.add("page1", [
        { id: "nav", type: "text", name: "Nav", parentId: "header" },
      ]);

      nodes.move("page1", "title", "header", 0);

      const parent = nodes.get("page1", "header") as {
        children: string[];
      };
      expect(parent.children[0]).toBe("title");
      expect(parent.children[1]).toBe("nav");
    });

    it("should append to end when index not specified", () => {
      nodes.add("page1", [
        { id: "nav2", type: "text", name: "Nav2", parentId: "header" },
      ]);

      nodes.move("page1", "title", "header");

      const parent = nodes.get("page1", "header") as {
        children: string[];
      };
      expect(parent.children[parent.children.length - 1]).toBe("title");
    });

    it("should remove node from old parent's children array", () => {
      nodes.move("page1", "title", "header");

      const oldParent = nodes.get("page1", "content") as {
        children: string[];
      };
      expect(oldParent.children).toEqual(["hero-image"]);
    });

    it("should call doc.touch() after moving", () => {
      const spy = vi.spyOn(doc, "touch");
      nodes.move("page1", "title", "header");
      expect(spy).toHaveBeenCalled();
    });

    it("should throw when page does not exist", () => {
      expect(() =>
        nodes.move("nonexistent", "title", "header")
      ).toThrow('Page "nonexistent" not found');
    });

    it("should throw when node does not exist", () => {
      expect(() =>
        nodes.move("page1", "no-such-node", "header")
      ).toThrow('Node "no-such-node" not found on page "page1"');
    });

    it("should throw when target parent is not a frame", () => {
      expect(() =>
        nodes.move("page1", "hero-image", "title")
      ).toThrow('Target parent "title" is not a frame on page "page1"');
    });

    it("should throw when target parent does not exist", () => {
      expect(() =>
        nodes.move("page1", "title", "no-such-parent")
      ).toThrow(
        'Target parent "no-such-parent" is not a frame on page "page1"'
      );
    });
  });

  // ----------------------------------------------------------------
  // get()
  // ----------------------------------------------------------------
  describe("get()", () => {
    it("should return an existing node", () => {
      const node = nodes.get("page1", "title");
      expect(node).toBeDefined();
      expect(node!.name).toBe("Title");
      expect(node!.type).toBe("text");
    });

    it("should return undefined for nonexistent node", () => {
      expect(nodes.get("page1", "no-such")).toBeUndefined();
    });

    it("should return undefined for nonexistent page", () => {
      expect(nodes.get("nonexistent", "title")).toBeUndefined();
    });

    it("should return the root node", () => {
      const root = nodes.get("page1", "root");
      expect(root).toBeDefined();
      expect(root!.type).toBe("frame");
      expect(root!.name).toBe("Root");
    });
  });

  // ----------------------------------------------------------------
  // list()
  // ----------------------------------------------------------------
  describe("list()", () => {
    it("should list all nodes when called without options", () => {
      const result = nodes.list("page1");
      // root, header, content, title, hero-image
      expect(result.length).toBe(5);
    });

    it("should include root when listing without parentId", () => {
      const result = nodes.list("page1");
      expect(result.some((r) => r.id === "root")).toBe(true);
    });

    it("should filter by type", () => {
      const textNodes = nodes.list("page1", { type: "text" });
      expect(textNodes.every((n) => n.type === "text")).toBe(true);
      expect(textNodes.length).toBe(1);
      expect(textNodes[0].id).toBe("title");
    });

    it("should filter by search term (case-insensitive)", () => {
      const result = nodes.list("page1", { search: "hero" });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("hero-image");
    });

    it("should filter by search term case-insensitively", () => {
      const result = nodes.list("page1", { search: "TITLE" });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("title");
    });

    it("should combine type and search filters", () => {
      const result = nodes.list("page1", { type: "frame", search: "content" });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("content");
    });

    it("should list only children of a given parentId", () => {
      const result = nodes.list("page1", { parentId: "content" });
      expect(result.map((r) => r.id).sort()).toEqual(
        ["hero-image", "title"].sort()
      );
    });

    it("should return correct parentId for each node", () => {
      const result = nodes.list("page1");
      const titleEntry = result.find((r) => r.id === "title");
      expect(titleEntry!.parentId).toBe("content");
    });

    it("should return correct childCount for frame nodes", () => {
      const result = nodes.list("page1");
      const content = result.find((r) => r.id === "content");
      expect(content!.childCount).toBe(2);
    });

    it("should return childCount 0 for non-frame nodes", () => {
      const result = nodes.list("page1");
      const title = result.find((r) => r.id === "title");
      expect(title!.childCount).toBe(0);
    });

    it("should respect depth limit", () => {
      // Use parentId to test depth limit properly (orphan sweep only runs without parentId)
      const result = nodes.list("page1", { parentId: "root", depth: 1 });
      // depth 1 from root's children: header (depth 1), content (depth 1)
      // title and hero-image are children of content at depth 2, excluded
      const ids = result.map((r) => r.id);
      expect(ids).toContain("header");
      expect(ids).toContain("content");
      expect(ids).not.toContain("title");
      expect(ids).not.toContain("hero-image");
    });

    it("should include orphan nodes not reachable from root", () => {
      // Manually add an orphan node
      const page = doc.data.pages["page1"]!;
      page.nodes["orphan"] = {
        type: "text",
        name: "Orphan",
        content: "Lost node",
      } as any;

      const result = nodes.list("page1");
      expect(result.some((r) => r.id === "orphan")).toBe(true);
    });

    it("should return orphan with null parentId", () => {
      const page = doc.data.pages["page1"]!;
      page.nodes["orphan2"] = {
        type: "text",
        name: "Orphan2",
        content: "Lost",
      } as any;

      const result = nodes.list("page1");
      const orphan = result.find((r) => r.id === "orphan2");
      expect(orphan!.parentId).toBeNull();
    });

    it("should throw when page does not exist", () => {
      expect(() => nodes.list("nonexistent")).toThrow(
        'Page "nonexistent" not found'
      );
    });

    it("should return empty when parentId points to non-frame node", () => {
      const result = nodes.list("page1", { parentId: "title" });
      expect(result).toEqual([]);
    });

    it("should return all frame nodes with type filter", () => {
      const result = nodes.list("page1", { type: "frame" });
      expect(result.length).toBe(3); // root, header, content
    });

    it("should return empty for search with no matches", () => {
      const result = nodes.list("page1", { search: "zzzznonexistent" });
      expect(result).toEqual([]);
    });
  });
});
