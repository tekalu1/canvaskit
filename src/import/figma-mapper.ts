/**
 * Maps Figma API structures to CanvasKit node/token format.
 */

import type {
  CanvasNode,
  Tokens,
  ComponentDefinition,
} from "../core/schema.js";

// ============================================================
// Figma API Types (subset we consume)
// ============================================================

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaGradientStop {
  color: FigmaColor;
  position: number;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  characters?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  constraints?: { vertical: string; horizontal: string };
  fills?: Array<{
    type: string;
    color?: FigmaColor;
    imageRef?: string;
    gradientHandlePositions?: Array<{ x: number; y: number }>;
    gradientStops?: FigmaGradientStop[];
  }>;
  strokes?: Array<{ type: string; color?: FigmaColor }>;
  strokeWeight?: number;
  cornerRadius?: number;
  layoutMode?: string; // "HORIZONTAL" | "VERTICAL" | "NONE"
  itemSpacing?: number;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
  };
  componentId?: string;
}

export interface FigmaFile {
  name: string;
  document: FigmaNode;
  components: Record<string, { key: string; name: string; description: string }>;
}

// ============================================================
// Color Conversion
// ============================================================

/**
 * Convert a Figma RGBA color to a hex string.
 */
export function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  if (color.a < 1) {
    const a = Math.round(color.a * 255);
    return `${hex}${a.toString(16).padStart(2, "0")}`;
  }
  return hex;
}

// ============================================================
// Token Extraction
// ============================================================

/**
 * Extract design tokens from a Figma file's color styles and spacing patterns.
 */
export function extractTokens(node: FigmaNode): Partial<Tokens> {
  const colors: Record<string, { value: string }> = {};
  const spacing: Record<string, { value: string }> = {};
  const seenColors = new Set<string>();
  const seenSpacing = new Set<string>();

  function walk(n: FigmaNode) {
    // Extract colors from fills
    if (n.fills) {
      for (const fill of n.fills) {
        if (fill.type === "SOLID" && fill.color) {
          const hex = figmaColorToHex(fill.color);
          if (!seenColors.has(hex)) {
            seenColors.add(hex);
            const key = `color-${seenColors.size}`;
            colors[key] = { value: hex };
          }
        }
      }
    }

    // Extract spacing from itemSpacing and padding
    if (n.itemSpacing !== undefined && n.itemSpacing > 0) {
      const val = `${n.itemSpacing}px`;
      if (!seenSpacing.has(val)) {
        seenSpacing.add(val);
        const key = `spacing-${seenSpacing.size}`;
        spacing[key] = { value: val };
      }
    }

    if (n.children) {
      for (const child of n.children) {
        walk(child);
      }
    }
  }

  walk(node);

  return {
    colors: Object.keys(colors).length > 0 ? colors : {},
    spacing: Object.keys(spacing).length > 0 ? spacing : {},
  };
}

// ============================================================
// Node Mapping
// ============================================================

let nodeCounter = 0;

function nextId(): string {
  nodeCounter++;
  return `fig-${nodeCounter.toString(36).padStart(4, "0")}`;
}

/**
 * Reset the ID counter (for testing).
 */
export function resetIdCounter(): void {
  nodeCounter = 0;
}

/**
 * Map a Figma node's layout mode to CanvasKit layout object.
 */
function mapLayout(node: FigmaNode) {
  if (!node.layoutMode || node.layoutMode === "NONE") return undefined;

  const layout: { direction: "row" | "column"; gap?: string; justify?: string; align?: string } = {
    direction: node.layoutMode === "HORIZONTAL" ? "row" : "column",
  };

  if (node.itemSpacing) {
    layout.gap = `${node.itemSpacing}px`;
  }

  if (node.primaryAxisAlignItems) {
    const alignMap: Record<string, string> = {
      MIN: "start",
      CENTER: "center",
      MAX: "end",
      SPACE_BETWEEN: "between",
    };
    layout.justify = alignMap[node.primaryAxisAlignItems] ?? "start";
  }

  if (node.counterAxisAlignItems) {
    const crossMap: Record<string, string> = {
      MIN: "start",
      CENTER: "center",
      MAX: "end",
      STRETCH: "stretch",
    };
    layout.align = crossMap[node.counterAxisAlignItems] ?? "start";
  }

  return layout;
}

/**
 * Map Figma gradient fill to CanvasKit Gradient.
 */
function mapGradient(fill: FigmaNode["fills"] extends (infer T)[] | undefined ? T : never): { type: "linear" | "radial" | "conic"; angle?: number; colors: Array<{ color: string; position: number }> } | undefined {
  if (!fill.gradientStops || fill.gradientStops.length < 2) return undefined;

  const colors = fill.gradientStops.map((s: FigmaGradientStop) => ({
    color: figmaColorToHex(s.color),
    position: s.position,
  }));

  if (fill.type === "GRADIENT_LINEAR") {
    let angle = 180;
    if (fill.gradientHandlePositions && fill.gradientHandlePositions.length >= 2) {
      const [p0, p1] = fill.gradientHandlePositions;
      angle = Math.round(Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI) + 90);
    }
    return { type: "linear", angle, colors };
  }
  if (fill.type === "GRADIENT_RADIAL") {
    return { type: "radial", colors };
  }
  return undefined;
}

/**
 * Map a Figma node's visual properties to CanvasKit styles and visual primitives.
 */
function mapStyles(node: FigmaNode): {
  styles: Record<string, unknown>;
  stroke?: { color: string; width: string | number; style: "solid" | "dashed" | "dotted" };
  gradient?: { type: "linear" | "radial" | "conic"; angle?: number; colors: Array<{ color: string; position: number }> };
} {
  const styles: Record<string, unknown> = {};
  let stroke: { color: string; width: string | number; style: "solid" | "dashed" | "dotted" } | undefined;
  let gradient: { type: "linear" | "radial" | "conic"; angle?: number; colors: Array<{ color: string; position: number }> } | undefined;

  // Background color from fills
  if (node.fills && node.fills.length > 0) {
    // Check for gradient fill first
    const gradientFill = node.fills.find((f) => f.type === "GRADIENT_LINEAR" || f.type === "GRADIENT_RADIAL");
    if (gradientFill) {
      gradient = mapGradient(gradientFill);
    }

    const solidFill = node.fills.find((f) => f.type === "SOLID" && f.color);
    if (solidFill?.color && !gradient) {
      styles.backgroundColor = figmaColorToHex(solidFill.color);
    }
  }

  // Dimensions
  if (node.absoluteBoundingBox) {
    styles.width = `${node.absoluteBoundingBox.width}px`;
    styles.height = `${node.absoluteBoundingBox.height}px`;
  }

  // Corner radius
  if (node.cornerRadius) {
    styles.borderRadius = `${node.cornerRadius}px`;
  }

  // Padding
  if (node.paddingLeft || node.paddingRight || node.paddingTop || node.paddingBottom) {
    const pl = node.paddingLeft ?? 0;
    const pr = node.paddingRight ?? 0;
    const pt = node.paddingTop ?? 0;
    const pb = node.paddingBottom ?? 0;
    if (pl === pr && pt === pb && pl === pt) {
      styles.padding = `${pl}px`;
    } else {
      if (pl === pr && pl > 0) styles.paddingX = `${pl}px`;
      if (pt === pb && pt > 0) styles.paddingY = `${pt}px`;
    }
  }

  // Text styles
  if (node.style) {
    if (node.style.fontSize) styles.fontSize = `${node.style.fontSize}px`;
    if (node.style.fontWeight) styles.fontWeight = String(node.style.fontWeight);
    if (node.style.fontFamily) styles.fontFamily = node.style.fontFamily;
  }

  // Text color from fills (for text nodes)
  if (node.type === "TEXT" && node.fills && node.fills.length > 0) {
    const solidFill = node.fills.find((f) => f.type === "SOLID" && f.color);
    if (solidFill?.color) {
      styles.color = figmaColorToHex(solidFill.color);
    }
  }

  // Stroke → structured stroke
  if (node.strokes && node.strokes.length > 0) {
    const s = node.strokes[0];
    if (s.type === "SOLID" && s.color && node.strokeWeight) {
      stroke = {
        color: figmaColorToHex(s.color),
        width: `${node.strokeWeight}px`,
        style: "solid",
      };
    }
  }

  return { styles, stroke, gradient };
}

/**
 * Map a single Figma node to a CanvasKit node.
 * Returns the mapped node and its generated ID.
 */
export function mapFigmaNode(
  figmaNode: FigmaNode,
  nodes: Record<string, CanvasNode>,
  componentMap: Record<string, string>
): string {
  const id = nextId();
  const { styles, stroke, gradient } = mapStyles(figmaNode);

  switch (figmaNode.type) {
    case "TEXT": {
      nodes[id] = {
        type: "text",
        name: figmaNode.name,
        content: figmaNode.characters ?? "",
        styles,
        stroke,
        gradient,
      };
      return id;
    }

    case "VECTOR":
    case "BOOLEAN_OPERATION":
    case "LINE":
    case "STAR":
    case "ELLIPSE":
    case "REGULAR_POLYGON": {
      nodes[id] = {
        type: "vector",
        name: figmaNode.name,
        path: "",
        viewBox: figmaNode.absoluteBoundingBox
          ? `0 0 ${figmaNode.absoluteBoundingBox.width} ${figmaNode.absoluteBoundingBox.height}`
          : "0 0 24 24",
        styles,
        stroke,
        gradient,
      };
      return id;
    }

    case "RECTANGLE": {
      // Check if it has an image fill
      const imageFill = figmaNode.fills?.find((f) => f.type === "IMAGE");
      if (imageFill) {
        nodes[id] = {
          type: "image",
          name: figmaNode.name,
          src: imageFill.imageRef ?? "",
          alt: figmaNode.name,
          styles,
          stroke,
          gradient,
        };
        return id;
      }

      // Otherwise treat as a frame
      nodes[id] = {
        type: "frame",
        name: figmaNode.name,
        clip: false,
        layout: mapLayout(figmaNode),
        children: [],
        styles,
        stroke,
        gradient,
      };
      return id;
    }

    case "INSTANCE": {
      // Component instance
      const compRef = figmaNode.componentId
        ? componentMap[figmaNode.componentId] ?? figmaNode.name
        : figmaNode.name;
      nodes[id] = {
        type: "component",
        name: figmaNode.name,
        componentRef: compRef,
        props: {},
        overrides: {},
        styles,
        stroke,
        gradient,
      };
      return id;
    }

    case "COMPONENT":
    case "FRAME":
    case "GROUP":
    case "SECTION":
    case "CANVAS":
    default: {
      // Map children recursively
      const childIds: string[] = [];
      if (figmaNode.children) {
        for (const child of figmaNode.children) {
          const childId = mapFigmaNode(child, nodes, componentMap);
          childIds.push(childId);
        }
      }

      nodes[id] = {
        type: "frame",
        name: figmaNode.name,
        clip: false,
        layout: mapLayout(figmaNode),
        children: childIds,
        styles,
        stroke,
        gradient,
      };
      return id;
    }
  }
}

/**
 * Map Figma component definitions to CanvasKit component definitions.
 */
export function mapFigmaComponents(
  figmaComponents: Record<string, { key: string; name: string; description: string }>
): Record<string, ComponentDefinition> {
  const components: Record<string, ComponentDefinition> = {};

  for (const [, comp] of Object.entries(figmaComponents)) {
    components[comp.name] = {
      description: comp.description || undefined,
      variants: {},
      props: [],
      defaultProps: {},
    };
  }

  return components;
}

/**
 * Build a component ID → name mapping for instance resolution.
 */
export function buildComponentMap(
  figmaComponents: Record<string, { key: string; name: string; description: string }>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [id, comp] of Object.entries(figmaComponents)) {
    map[id] = comp.name;
  }
  return map;
}
