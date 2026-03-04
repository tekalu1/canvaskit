// Lightweight .canvas.json parser — no dependency on core ESM modules.
// Uses JSON.parse directly.

// --- Type Definitions ---

export interface CanvasDocument {
  version: string;
  meta: {
    name: string;
    created: string;
    modified: string;
  };
  tokens: TokenMap;
  components: Record<string, ComponentDef>;
  pages: Record<string, Page>;
}

export interface TokenMap {
  colors?: Record<string, TokenValue>;
  spacing?: Record<string, TokenValue>;
  typography?: Record<string, TypographyToken>;
  borderRadius?: Record<string, TokenValue>;
  shadows?: Record<string, TokenValue>;
  breakpoints?: Record<string, TokenValue>;
  [category: string]: Record<string, TokenValue | TypographyToken> | undefined;
}

export interface TokenValue {
  value: string;
}

export interface TypographyToken {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  [key: string]: string | undefined;
}

export interface ComponentDef {
  name?: string;
  props?: Record<string, unknown>;
  root?: string;
  nodes?: Record<string, CanvasNode>;
}

export interface Page {
  name: string;
  width: number | null;
  height: number | null;
  nodes: Record<string, CanvasNode>;
}

// --- Node Types ---

export interface BaseNode {
  type: string;
  name?: string;
  styles?: Record<string, string>;
}

export interface FrameNode extends BaseNode {
  type: "frame";
  layout?: {
    direction?: string;
    align?: string;
    justify?: string;
    gap?: string;
    wrap?: string;
  };
  children?: string[];
}

export interface TextNode extends BaseNode {
  type: "text";
  content?: string;
}

export interface ImageNode extends BaseNode {
  type: "image";
  src?: string;
}

export interface IconNode extends BaseNode {
  type: "icon";
  icon?: string;
}

export interface ComponentNode extends BaseNode {
  type: "component";
  componentId?: string;
  overrides?: Record<string, unknown>;
}

export interface VectorNode extends BaseNode {
  type: "vector";
  path?: string;
}

export type CanvasNode =
  | FrameNode
  | TextNode
  | ImageNode
  | IconNode
  | ComponentNode
  | VectorNode;

// --- Parser ---

export function parseCanvasDocument(text: string): CanvasDocument | null {
  try {
    const obj = JSON.parse(text);
    if (
      typeof obj !== "object" ||
      obj === null ||
      typeof obj.version !== "string" ||
      typeof obj.meta !== "object" ||
      typeof obj.pages !== "object"
    ) {
      return null;
    }
    return obj as CanvasDocument;
  } catch {
    return null;
  }
}

/**
 * Returns node IDs that are not referenced as children of any frame.
 * These are the "root-level" nodes of a page.
 */
export function findRootNodes(page: Page): string[] {
  const childSet = new Set<string>();
  for (const node of Object.values(page.nodes)) {
    if (node.type === "frame" && (node as FrameNode).children) {
      for (const childId of (node as FrameNode).children!) {
        childSet.add(childId);
      }
    }
  }
  return Object.keys(page.nodes).filter((id) => !childSet.has(id));
}

/**
 * Resolve a token reference like "{colors.primary}" to its hex value.
 * Handles recursive references with cycle detection.
 */
export function resolveTokenColor(
  ref: string,
  tokens: TokenMap,
  visited: Set<string> = new Set(),
): string | null {
  if (visited.has(ref)) return null; // cycle
  visited.add(ref);

  const colors = tokens.colors;
  if (!colors) return null;

  const entry = colors[ref];
  if (!entry || !("value" in entry)) return null;

  const value = entry.value;
  // If it references another token, resolve recursively
  const tokenMatch = value.match(/^\{colors\.([^}]+)\}$/);
  if (tokenMatch) {
    return resolveTokenColor(tokenMatch[1], tokens, visited);
  }

  // Return value if it looks like a hex color
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
    return value;
  }

  return null;
}
