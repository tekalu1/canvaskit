import type { Document } from "../core/document.js";
import type { Tokens, CanvasNode, ComponentTemplateNode } from "../core/schema.js";
import {
  resolveTokenRef,
  escapeHtml,
  stylesToClasses,
  layoutToClasses,
  strokeToClasses,
  effectsToClasses,
  gradientToClasses,
} from "./shared.js";
import type { Stroke, Effect, Gradient } from "../core/schema.js";
import { tokensToCssCustomProperties } from "./css-tokens.js";

/**
 * Render a component template node to HTML.
 */
function renderTemplate(template: ComponentTemplateNode, tokens: Tokens, indent: string): string {
  const styleClasses = stylesToClasses(template.styles as Record<string, unknown> | undefined, tokens);
  const classAttr = styleClasses ? ` class="${styleClasses}"` : "";
  const content = template.content ? escapeHtml(template.content) : "";

  if (template.type === "text") {
    return `${indent}<p${classAttr}>${content}</p>`;
  }

  const childrenHtml = template.children
    ? template.children.map((c) => renderTemplate(c, tokens, indent + "  ")).join("\n")
    : "";

  if (childrenHtml) {
    return `${indent}<div${classAttr}>\n${childrenHtml}\n${indent}</div>`;
  }

  return `${indent}<div${classAttr}>${content}</div>`;
}

/**
 * Render a single node to HTML.
 */
function renderNode(
  nodeId: string,
  nodes: Record<string, CanvasNode>,
  tokens: Tokens,
  components: Record<string, { template?: ComponentTemplateNode }>,
  indent: string,
  parentDirection?: string
): string {
  const node = nodes[nodeId];
  if (!node) return `${indent}<!-- missing node: ${nodeId} -->`;

  const styleClasses = stylesToClasses(node.styles as Record<string, unknown> | undefined, tokens);
  const nodeStroke = (node as { stroke?: Stroke }).stroke;
  const nodeEffects = (node as { effects?: Effect[] }).effects;
  const nodeGradient = (node as { gradient?: Gradient }).gradient;
  const vpClasses = [strokeToClasses(nodeStroke, tokens), effectsToClasses(nodeEffects), gradientToClasses(nodeGradient)].filter(Boolean).join(" ");
  const absClass = parentDirection === "none" ? "absolute" : "";
  const combinedStyleClasses = [styleClasses, vpClasses, absClass].filter(Boolean).join(" ");

  const dataAttr = ` data-node-id="${escapeHtml(nodeId)}"`;

  switch (node.type) {
    case "frame": {
      const layout = node.layout as { direction?: string; gap?: string; align?: string; justify?: string; wrap?: boolean } | undefined;
      const layoutClasses = layoutToClasses(layout, tokens);
      const clipClass = (node as { clip?: boolean }).clip ? "overflow-hidden" : "";
      const allClasses = [layoutClasses, clipClass, combinedStyleClasses].filter(Boolean).join(" ");
      const classAttr = allClasses ? ` class="${allClasses}"` : "";

      const childDir = layout?.direction;
      const childrenHtml = node.children
        .map((childId) => renderNode(childId, nodes, tokens, components, indent + "  ", childDir))
        .join("\n");

      if (childrenHtml) {
        return `${indent}<div${dataAttr}${classAttr}>\n${childrenHtml}\n${indent}</div>`;
      }
      return `${indent}<div${dataAttr}${classAttr}></div>`;
    }

    case "text": {
      const fontSize = (node.styles as Record<string, unknown> | undefined)?.fontSize;
      const fontWeight = (node.styles as Record<string, unknown> | undefined)?.fontWeight;

      // Use heading tags for large/bold text
      let tag = "p";
      if (fontSize) {
        const sizeStr = String(fontSize);
        const sizeNum = parseInt(sizeStr, 10);
        if (sizeNum >= 32 || fontWeight === "bold") tag = "h1";
        else if (sizeNum >= 24) tag = "h2";
        else if (sizeNum >= 20) tag = "h3";
      }

      const classAttr = combinedStyleClasses ? ` class="${combinedStyleClasses}"` : "";
      const content = escapeHtml(node.content);
      return `${indent}<${tag}${dataAttr}${classAttr}>${content}</${tag}>`;
    }

    case "image": {
      const classAttr = combinedStyleClasses ? ` class="${combinedStyleClasses}"` : "";
      const src = node.src ? escapeHtml(node.src) : "";
      const alt = node.alt ? escapeHtml(node.alt) : node.name;
      return `${indent}<img${dataAttr}${classAttr} src="${src}" alt="${alt}" />`;
    }

    case "icon": {
      const allIconClasses = ["inline-flex items-center justify-center", combinedStyleClasses].filter(Boolean).join(" ");
      // Strip "lucide:" namespace prefix if present
      const rawIcon = node.icon;
      const iconName = rawIcon.startsWith("lucide:") ? rawIcon.slice(7) : rawIcon;
      const escapedName = escapeHtml(iconName);
      return `${indent}<i${dataAttr} class="${allIconClasses}" data-lucide="${escapedName}" aria-label="${escapedName}" title="${escapedName}"></i>`;
    }

    case "component": {
      const compDef = components[node.componentRef];
      if (compDef?.template) {
        return renderTemplate(compDef.template, tokens, indent);
      }
      const classAttr = combinedStyleClasses ? ` class="${combinedStyleClasses}"` : "";
      return `${indent}<div${dataAttr}${classAttr} data-component="${escapeHtml(node.componentRef)}"></div>`;
    }

    case "vector": {
      const classAttr = combinedStyleClasses ? ` class="${combinedStyleClasses}"` : "";
      if (node.path) {
        const viewBox = node.viewBox ?? "0 0 24 24";
        return `${indent}<svg${dataAttr}${classAttr} viewBox="${viewBox}"><path d="${escapeHtml(node.path)}" /></svg>`;
      }
      return `${indent}<div${dataAttr}${classAttr}></div>`;
    }

    default:
      return `${indent}<!-- unknown node type -->`;
  }
}

/**
 * Check if a page has any icon nodes (recursively).
 */
function hasIconNodes(nodes: Record<string, CanvasNode>, startId: string): boolean {
  const node = nodes[startId];
  if (!node) return false;
  if (node.type === "icon") return true;
  if (node.type === "frame") {
    return node.children.some((childId) => hasIconNodes(nodes, childId));
  }
  return false;
}

/**
 * Export a page (or a specific subtree) from a Document as an HTML string with Tailwind classes.
 */
export function exportToHtml(doc: Document, pageId: string, nodeId?: string): string {
  const page = doc.data.pages[pageId];
  if (!page) throw new Error(`Page "${pageId}" not found`);

  const tokens = doc.data.tokens;
  const components = doc.data.components as Record<string, { template?: ComponentTemplateNode }>;
  const startNodeId = nodeId ?? "root";

  if (!page.nodes[startNodeId]) {
    throw new Error(`Node "${startNodeId}" not found on page "${pageId}"`);
  }

  const bodyContent = renderNode(startNodeId, page.nodes, tokens, components, "    ");
  const usesIcons = hasIconNodes(page.nodes, startNodeId);
  const cssProps = tokensToCssCustomProperties(tokens);
  // Only include the <style> block if tokens produce any custom properties
  const hasCustomProps = cssProps !== ":root {\n}";
  const styleBlock = hasCustomProps
    ? `\n  <style>\n${cssProps.split("\n").map(l => `    ${l}`).join("\n")}\n  </style>`
    : "";

  const lucideHeadScript = usesIcons
    ? `\n  <script src="https://unpkg.com/lucide@latest"></script>`
    : "";
  const lucideInitScript = usesIcons
    ? `\n  <script>lucide.createIcons();</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.name)}</title>
  <script src="https://cdn.tailwindcss.com"></script>${lucideHeadScript}${styleBlock}
</head>
<body>
${bodyContent}${lucideInitScript}
</body>
</html>`;
}
