import { randomUUID } from "node:crypto";
import type {
  CanvasNode,
  NodeTypeEnum,
  Layout,
  Stroke,
  Effect,
  Gradient,
} from "./schema.js";
import { Document } from "./document.js";

function generateId(): string {
  return randomUUID().slice(0, 8);
}

export class NodeManager {
  constructor(private doc: Document) {}

  add(
    pageId: string,
    nodes: Array<{
      id?: string;
      type: NodeTypeEnum;
      name: string;
      parentId?: string;
      parentName?: string;
      insertIndex?: number;
      content?: string;
      componentRef?: string;
      props?: object;
      layout?: Layout;
      styles?: Record<string, unknown>;
      children?: string[];
      clip?: boolean;
      stroke?: Stroke;
      effects?: Effect[];
      gradient?: Gradient;
      icon?: string;
      src?: string;
      alt?: string;
    }>
  ): Array<{ id: string; name: string }> {
    const page = this.doc.data.pages[pageId];
    if (!page) throw new Error(`Page "${pageId}" not found`);

    const results: Array<{ id: string; name: string }> = [];

    for (const input of nodes) {
      const id = input.id ?? generateId();
      if (page.nodes[id]) {
        throw new Error(`Node "${id}" already exists on page "${pageId}"`);
      }

      // Resolve parentName to parentId if needed
      let resolvedParentId = input.parentId;
      if (!resolvedParentId && input.parentName) {
        const matches: string[] = [];
        for (const [nodeId, node] of Object.entries(page.nodes)) {
          if (node.name === input.parentName) {
            matches.push(nodeId);
          }
        }
        if (matches.length === 0) {
          throw new Error(`No node named "${input.parentName}" found on page "${pageId}"`);
        }
        if (matches.length > 1) {
          throw new Error(`Multiple nodes named "${input.parentName}" found on page "${pageId}" (IDs: ${matches.join(", ")}). Use parentId instead.`);
        }
        resolvedParentId = matches[0];
      } else if (!resolvedParentId) {
        throw new Error(`Either parentId or parentName must be provided`);
      }

      const parent = page.nodes[resolvedParentId];
      if (!parent) {
        throw new Error(`Parent node "${resolvedParentId}" not found on page "${pageId}"`);
      }
      if (parent.type !== "frame") {
        throw new Error(`Parent node "${resolvedParentId}" is not a frame`);
      }

      let node: CanvasNode;
      switch (input.type) {
        case "frame":
          node = {
            type: "frame",
            name: input.name,
            layout: input.layout ?? { direction: "column" },
            children: input.children ?? [],
            clip: input.clip ?? false,
            styles: input.styles,
            stroke: input.stroke,
            effects: input.effects,
            gradient: input.gradient,
          };
          break;
        case "text":
          node = {
            type: "text",
            name: input.name,
            content: input.content ?? "",
            styles: input.styles,
            stroke: input.stroke,
            effects: input.effects,
            gradient: input.gradient,
          };
          break;
        case "image":
          node = {
            type: "image",
            name: input.name,
            src: input.src,
            alt: input.alt,
            styles: input.styles,
            stroke: input.stroke,
            effects: input.effects,
            gradient: input.gradient,
          };
          break;
        case "icon":
          node = {
            type: "icon",
            name: input.name,
            icon: input.icon ?? "",
            styles: input.styles,
            stroke: input.stroke,
            effects: input.effects,
            gradient: input.gradient,
          };
          break;
        case "component":
          if (!input.componentRef) {
            throw new Error(`componentRef is required for component node "${input.name}"`);
          }
          node = {
            type: "component",
            name: input.name,
            componentRef: input.componentRef,
            props: (input.props as Record<string, unknown>) ?? {},
            overrides: {},
            styles: input.styles,
            stroke: input.stroke,
            effects: input.effects,
            gradient: input.gradient,
          };
          break;
        case "vector":
          node = {
            type: "vector",
            name: input.name,
            styles: input.styles,
            stroke: input.stroke,
            effects: input.effects,
            gradient: input.gradient,
          };
          break;
      }

      page.nodes[id] = node;

      if (input.insertIndex !== undefined && input.insertIndex >= 0) {
        parent.children.splice(input.insertIndex, 0, id);
      } else {
        parent.children.push(id);
      }

      results.push({ id, name: input.name });
    }

    this.doc.touch();
    return results;
  }

  update(
    pageId: string,
    updates: Array<{
      id?: string;
      nodeName?: string;
      name?: string;
      content?: string;
      styles?: Record<string, unknown>;
      layout?: object;
      clip?: boolean;
      stroke?: Stroke;
      effects?: Effect[];
      gradient?: Gradient;
      props?: object;
      overrides?: object;
      icon?: string;
      src?: string;
      alt?: string;
      componentRef?: string;
    }>
  ): string[] {
    const page = this.doc.data.pages[pageId];
    if (!page) throw new Error(`Page "${pageId}" not found`);

    const updated: string[] = [];

    for (const u of updates) {
      // Resolve nodeName to id if needed
      let resolvedId = u.id;
      if (!resolvedId && u.nodeName) {
        const matches: string[] = [];
        for (const [nodeId, node] of Object.entries(page.nodes)) {
          if (node.name === u.nodeName) matches.push(nodeId);
        }
        if (matches.length === 0) {
          throw new Error(`No node named "${u.nodeName}" found on page "${pageId}"`);
        }
        if (matches.length > 1) {
          throw new Error(`Multiple nodes named "${u.nodeName}" found: ${matches.join(", ")}. Use id instead.`);
        }
        resolvedId = matches[0];
      }
      if (!resolvedId) {
        throw new Error("Either id or nodeName is required for update");
      }

      const node = page.nodes[resolvedId];
      if (!node) throw new Error(`Node "${resolvedId}" not found on page "${pageId}"`);

      if (u.name !== undefined) {
        node.name = u.name;
      }

      if (u.content !== undefined && "content" in node) {
        (node as { content: string }).content = u.content;
      }

      if (u.styles !== undefined) {
        node.styles = { ...(node.styles ?? {}), ...u.styles };
      }

      if (u.layout !== undefined && node.type === "frame") {
        (node as { layout: object }).layout = {
          ...((node as { layout?: object }).layout ?? {}),
          ...u.layout,
        };
      }

      if (u.clip !== undefined && node.type === "frame") {
        (node as { clip: boolean }).clip = u.clip;
      }

      if (u.stroke !== undefined) {
        (node as { stroke?: Stroke }).stroke = u.stroke;
      }

      if (u.effects !== undefined) {
        (node as { effects?: Effect[] }).effects = u.effects;
      }

      if (u.gradient !== undefined) {
        (node as { gradient?: Gradient }).gradient = u.gradient;
      }

      if (u.props !== undefined && node.type === "component") {
        const comp = node as { props: Record<string, unknown> };
        comp.props = { ...comp.props, ...(u.props as Record<string, unknown>) };
      }

      if (u.overrides !== undefined && node.type === "component") {
        const comp = node as { overrides: Record<string, unknown> };
        comp.overrides = { ...comp.overrides, ...(u.overrides as Record<string, unknown>) };
      }

      if (u.icon !== undefined && node.type === "icon") {
        (node as { icon: string }).icon = u.icon;
      }

      if (u.src !== undefined && node.type === "image") {
        (node as { src?: string }).src = u.src;
      }

      if (u.alt !== undefined && node.type === "image") {
        (node as { alt?: string }).alt = u.alt;
      }

      if (u.componentRef !== undefined && node.type === "component") {
        (node as { componentRef: string }).componentRef = u.componentRef;
      }

      updated.push(resolvedId);
    }

    this.doc.touch();
    return updated;
  }

  delete(pageId: string, nodeId: string): void {
    const page = this.doc.data.pages[pageId];
    if (!page) throw new Error(`Page "${pageId}" not found`);

    const node = page.nodes[nodeId];
    if (!node) throw new Error(`Node "${nodeId}" not found on page "${pageId}"`);

    // Recursively delete children if this is a frame
    if (node.type === "frame" && node.children.length > 0) {
      for (const childId of [...node.children]) {
        this.delete(pageId, childId);
      }
    }

    // Remove from parent's children array
    for (const n of Object.values(page.nodes)) {
      if (n.type === "frame" && n.children.includes(nodeId)) {
        n.children = n.children.filter((c) => c !== nodeId);
        break;
      }
    }

    delete page.nodes[nodeId];
    this.doc.touch();
  }

  move(
    pageId: string,
    nodeId: string,
    newParentId: string,
    index?: number
  ): void {
    const page = this.doc.data.pages[pageId];
    if (!page) throw new Error(`Page "${pageId}" not found`);

    if (!page.nodes[nodeId]) {
      throw new Error(`Node "${nodeId}" not found on page "${pageId}"`);
    }

    const newParent = page.nodes[newParentId];
    if (!newParent || newParent.type !== "frame") {
      throw new Error(`Target parent "${newParentId}" is not a frame on page "${pageId}"`);
    }

    // Remove from current parent
    for (const n of Object.values(page.nodes)) {
      if (n.type === "frame" && n.children.includes(nodeId)) {
        n.children = n.children.filter((c) => c !== nodeId);
        break;
      }
    }

    // Add to new parent
    if (index !== undefined && index >= 0) {
      newParent.children.splice(index, 0, nodeId);
    } else {
      newParent.children.push(nodeId);
    }

    this.doc.touch();
  }

  get(pageId: string, nodeId: string): CanvasNode | undefined {
    const page = this.doc.data.pages[pageId];
    if (!page) return undefined;
    return page.nodes[nodeId];
  }

  list(
    pageId: string,
    options?: {
      parentId?: string;
      type?: string;
      search?: string;
      depth?: number;
    }
  ): Array<{
    id: string;
    type: string;
    name: string;
    parentId: string | null;
    childCount: number;
  }> {
    const page = this.doc.data.pages[pageId];
    if (!page) throw new Error(`Page "${pageId}" not found`);

    // Build a parent lookup: nodeId -> parentId
    const parentMap = new Map<string, string | null>();
    for (const [id, node] of Object.entries(page.nodes)) {
      if (!parentMap.has(id)) parentMap.set(id, null);
      if (node.type === "frame") {
        for (const childId of node.children) {
          parentMap.set(childId, id);
        }
      }
    }

    const results: Array<{
      id: string;
      type: string;
      name: string;
      parentId: string | null;
      childCount: number;
    }> = [];

    const maxDepth = options?.depth ?? Infinity;

    const traverse = (nodeId: string, currentDepth: number): void => {
      if (currentDepth > maxDepth) return;

      const node = page.nodes[nodeId];
      if (!node) return;

      const matchesType = !options?.type || node.type === options.type;
      const matchesSearch =
        !options?.search ||
        node.name.toLowerCase().includes(options.search.toLowerCase());

      if (matchesType && matchesSearch) {
        results.push({
          id: nodeId,
          type: node.type,
          name: node.name,
          parentId: parentMap.get(nodeId) ?? null,
          childCount: node.type === "frame" ? node.children.length : 0,
        });
      }

      if (node.type === "frame") {
        for (const childId of node.children) {
          traverse(childId, currentDepth + 1);
        }
      }
    };

    const startId = options?.parentId ?? "root";
    if (options?.parentId) {
      // Traverse children of the given parent
      const startNode = page.nodes[startId];
      if (startNode && startNode.type === "frame") {
        for (const childId of startNode.children) {
          traverse(childId, 1);
        }
      }
    } else {
      // Traverse from root, include root itself
      traverse(startId, 0);
      // Also include any orphaned nodes not reachable from root
      for (const id of Object.keys(page.nodes)) {
        if (id !== startId && !results.some((r) => r.id === id)) {
          const node = page.nodes[id];
          const matchesType = !options?.type || node.type === options.type;
          const matchesSearch =
            !options?.search ||
            node.name.toLowerCase().includes(options.search.toLowerCase());
          if (matchesType && matchesSearch) {
            results.push({
              id,
              type: node.type,
              name: node.name,
              parentId: parentMap.get(id) ?? null,
              childCount: node.type === "frame" ? node.children.length : 0,
            });
          }
        }
      }
    }

    return results;
  }
}
