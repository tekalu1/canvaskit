import { randomUUID } from "node:crypto";

function generateId(): string {
  return randomUUID().slice(0, 8);
}

export interface TreeNode {
  type: string;
  name: string;
  children?: TreeNode[];
  content?: string;
  icon?: string;
  src?: string;
  alt?: string;
  componentRef?: string;
  componentId?: string;
  props?: object;
  layout?: object;
  clip?: boolean;
  styles?: Record<string, unknown>;
  stroke?: object;
  effects?: object[];
  gradient?: object;
}

export interface FlatNode {
  id: string;
  type: string;
  name: string;
  parentId: string;
  children?: string[];
  content?: string;
  icon?: string;
  src?: string;
  alt?: string;
  componentRef?: string;
  componentId?: string;
  props?: object;
  layout?: object;
  clip?: boolean;
  styles?: Record<string, unknown>;
  stroke?: object;
  effects?: object[];
  gradient?: object;
}

export function flattenTree(input: TreeNode | TreeNode[], defaultParentId: string): FlatNode[] {
  const result: FlatNode[] = [];
  const trees = Array.isArray(input) ? input : [input];

  function walk(node: TreeNode, parentId: string): void {
    const id = generateId();

    const flat: FlatNode = {
      id,
      type: node.type,
      name: node.name,
      parentId,
      content: node.content,
      icon: node.icon,
      src: node.src,
      alt: node.alt,
      componentRef: node.componentRef ?? node.componentId,
      props: node.props,
      layout: node.layout,
      clip: node.clip,
      styles: node.styles,
      stroke: node.stroke,
      effects: node.effects,
      gradient: node.gradient,
    };

    // For frames, include children array
    if (node.type === "frame") {
      flat.children = [];
    }

    result.push(flat);

    // Recursively process children (depth-first)
    if (node.children) {
      for (const child of node.children) {
        walk(child, id);
      }
    }
  }

  for (const tree of trees) {
    walk(tree, defaultParentId);
  }

  return result;
}
