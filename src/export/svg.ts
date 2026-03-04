/**
 * SVG exporter — renders a canvas node (or subtree) as an SVG string.
 */

import type { Document } from "../core/document.js";
import type { CanvasNode, Tokens, Stroke, Effect, Gradient } from "../core/schema.js";
import { resolveTokenRef, escapeHtml, gradientToCss } from "./shared.js";

export interface SvgExportResult {
  svg: string;
  width: number;
  height: number;
}

/**
 * Parse a CSS dimension string (e.g. "400px", "100%") to a number.
 * Returns the numeric value or a default.
 */
function parseDim(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

/**
 * Resolve a style value through tokens.
 */
function resolve(val: unknown, tokens: Tokens): string {
  if (typeof val === "string") return resolveTokenRef(val, tokens);
  return String(val ?? "");
}

/**
 * Render a single node to SVG elements.
 */
function renderNode(
  nodeId: string,
  nodes: Record<string, CanvasNode>,
  tokens: Tokens,
  x: number,
  y: number
): string {
  const node = nodes[nodeId];
  if (!node) return `<!-- missing node: ${nodeId} -->`;

  const styles = (node.styles ?? {}) as Record<string, unknown>;
  const w = parseDim(styles.width, 100);
  const h = parseDim(styles.height, 40);

  switch (node.type) {
    case "frame": {
      const bg = styles.backgroundColor
        ? resolve(styles.backgroundColor, tokens)
        : "none";
      const radius = styles.borderRadius
        ? parseDim(resolve(styles.borderRadius, tokens), 0)
        : 0;

      const nodeStroke = (node as { stroke?: Stroke }).stroke;
      const nodeGradient = (node as { gradient?: Gradient }).gradient;
      const nodeEffects = (node as { effects?: Effect[] }).effects;

      const parts: string[] = [];

      // SVG defs for gradient
      if (nodeGradient) {
        const gradId = `grad-${nodeId}`;
        if (nodeGradient.type === "linear") {
          const angle = nodeGradient.angle ?? 180;
          const rad = (angle * Math.PI) / 180;
          const x1 = 50 - Math.sin(rad) * 50;
          const y1 = 50 + Math.cos(rad) * 50;
          const x2 = 50 + Math.sin(rad) * 50;
          const y2 = 50 - Math.cos(rad) * 50;
          parts.push(`  <defs><linearGradient id="${gradId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">`);
          for (const stop of nodeGradient.colors) {
            parts.push(`    <stop offset="${Math.round(stop.position * 100)}%" stop-color="${escapeHtml(stop.color)}" />`);
          }
          parts.push(`  </linearGradient></defs>`);
        } else if (nodeGradient.type === "radial") {
          parts.push(`  <defs><radialGradient id="${gradId}">`);
          for (const stop of nodeGradient.colors) {
            parts.push(`    <stop offset="${Math.round(stop.position * 100)}%" stop-color="${escapeHtml(stop.color)}" />`);
          }
          parts.push(`  </radialGradient></defs>`);
        }
      }

      // SVG filter for effects (shadow/blur)
      if (nodeEffects && nodeEffects.length > 0) {
        const filterId = `filter-${nodeId}`;
        const filterParts: string[] = [];
        for (const effect of nodeEffects) {
          if (effect.type === "shadow") {
            const dx = parseDim(effect.offsetX, 0);
            const dy = parseDim(effect.offsetY, 4);
            const blur = parseDim(effect.blur, 6);
            filterParts.push(`    <feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${blur / 2}" flood-color="${escapeHtml(effect.color)}" />`);
          } else if (effect.type === "blur") {
            const r = parseDim(effect.radius, 0);
            filterParts.push(`    <feGaussianBlur stdDeviation="${r / 2}" />`);
          }
        }
        if (filterParts.length > 0) {
          parts.push(`  <defs><filter id="${filterId}">`);
          parts.push(...filterParts);
          parts.push(`  </filter></defs>`);
        }
      }

      // Background rect
      const fillAttr = nodeGradient ? `url(#grad-${nodeId})` : bg !== "none" ? escapeHtml(bg) : "none";
      const strokeAttr = nodeStroke ? ` stroke="${escapeHtml(nodeStroke.color)}" stroke-width="${nodeStroke.width}"` : "";
      const filterAttr = nodeEffects && nodeEffects.length > 0 ? ` filter="url(#filter-${nodeId})"` : "";
      if (fillAttr !== "none" || strokeAttr || filterAttr) {
        parts.push(
          `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fillAttr}"${radius ? ` rx="${radius}"` : ""}${strokeAttr}${filterAttr} />`
        );
      }

      // Render children stacked vertically (simple layout)
      let childY = y;
      const gap = node.layout?.gap ? parseDim(resolve(node.layout.gap, tokens), 0) : 0;
      const isRow = node.layout?.direction === "row";
      let childX = x;

      if (node.children) {
        for (const childId of node.children) {
          const childNode = nodes[childId];
          if (!childNode) continue;
          const childStyles = (childNode.styles ?? {}) as Record<string, unknown>;
          const cw = parseDim(childStyles.width, w);
          const ch = parseDim(childStyles.height, 30);

          parts.push(renderNode(childId, nodes, tokens, childX, childY));

          if (isRow) {
            childX += cw + gap;
          } else {
            childY += ch + gap;
          }
        }
      }

      return parts.join("\n");
    }

    case "text": {
      const fontSize = parseDim(styles.fontSize, 16);
      const color = styles.color
        ? resolve(styles.color, tokens)
        : "#000000";
      const content = escapeHtml(node.content);
      return `  <text x="${x}" y="${y + fontSize}" font-size="${fontSize}" fill="${escapeHtml(color)}">${content}</text>`;
    }

    case "image": {
      const src = node.src ?? "";
      return `  <image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeHtml(src)}" />`;
    }

    case "icon": {
      const color = styles.color
        ? resolve(styles.color, tokens)
        : "#000000";
      const iconSize = parseDim(styles.width, 24);
      return `  <text x="${x}" y="${y + iconSize}" font-size="${iconSize}" fill="${escapeHtml(color)}" data-icon="${escapeHtml(node.icon)}">${escapeHtml(node.icon)}</text>`;
    }

    case "vector": {
      if (node.path) {
        const fill = styles.color
          ? resolve(styles.color, tokens)
          : "currentColor";
        return `  <g transform="translate(${x},${y})"><path d="${escapeHtml(node.path)}" fill="${escapeHtml(fill)}" /></g>`;
      }
      return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ccc" />`;
    }

    case "component": {
      return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f0f0f0" stroke="#999" data-component="${escapeHtml(node.componentRef)}" />`;
    }

    default:
      return `  <!-- unknown node type: ${nodeId} -->`;
  }
}

/**
 * Export a page (or subtree) as an SVG string.
 */
export function exportToSvg(
  doc: Document,
  pageId: string,
  nodeId?: string
): SvgExportResult {
  const page = doc.data.pages[pageId];
  if (!page) throw new Error(`Page "${pageId}" not found`);

  const tokens = doc.data.tokens;
  const startNodeId = nodeId ?? "root";

  if (!page.nodes[startNodeId]) {
    throw new Error(`Node "${startNodeId}" not found on page "${pageId}"`);
  }

  const startNode = page.nodes[startNodeId]!;
  const styles = (startNode.styles ?? {}) as Record<string, unknown>;
  const width = parseDim(styles.width, page.width);
  const height = parseDim(styles.height, 800);

  const content = renderNode(startNodeId, page.nodes, tokens, 0, 0);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${content}
</svg>`;

  return { svg, width, height };
}
