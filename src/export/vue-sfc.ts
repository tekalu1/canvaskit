import type { Document } from "../core/document.js";
import type {
  CanvasNode,
  ComponentTemplateNode,
  Tokens,
} from "../core/schema.js";
import {
  escapeHtml,
  stylesToClasses,
  layoutToClasses,
  textToSemanticTag,
  toComponentName,
  buildClassString,
  strokeToClasses,
  effectsToClasses,
  gradientToClasses,
} from "./shared.js";
import type { Stroke, Effect, Gradient } from "../core/schema.js";

export interface VueSfcOptions {
  composition?: boolean;
  typescript?: boolean;
  scoped?: boolean;
}

export interface ExportedFile {
  path: string;
  content: string;
}

export interface VueSfcResult {
  files: ExportedFile[];
  entryComponent: string;
}

/**
 * Render a component template node to Vue template markup.
 */
function renderTemplate(
  template: ComponentTemplateNode,
  tokens: Tokens,
  indent: string
): string {
  const styleClasses = stylesToClasses(
    template.styles as Record<string, unknown> | undefined,
    tokens
  );
  const classAttr = styleClasses ? ` class="${styleClasses}"` : "";
  const content = template.content ? escapeHtml(template.content) : "";

  if (template.type === "text") {
    return `${indent}<p${classAttr}>${content}</p>`;
  }

  const childrenMarkup = template.children
    ? template.children
        .map((c) => renderTemplate(c, tokens, indent + "  "))
        .join("\n")
    : "";

  if (childrenMarkup) {
    return `${indent}<div${classAttr}>\n${childrenMarkup}\n${indent}</div>`;
  }

  return `${indent}<div${classAttr}>${content}</div>`;
}

/**
 * Render a single node to Vue template markup.
 * Collects component references for imports.
 */
function renderNode(
  nodeId: string,
  nodes: Record<string, CanvasNode>,
  tokens: Tokens,
  components: Record<string, { template?: ComponentTemplateNode }>,
  indent: string,
  componentRefs: Set<string>,
  parentDirection?: string
): string {
  const node = nodes[nodeId];
  if (!node) return `${indent}<!-- missing node: ${nodeId} -->`;

  const styleClasses = stylesToClasses(
    node.styles as Record<string, unknown> | undefined,
    tokens
  );
  const nodeStroke = (node as { stroke?: Stroke }).stroke;
  const nodeEffects = (node as { effects?: Effect[] }).effects;
  const nodeGradient = (node as { gradient?: Gradient }).gradient;
  const vpClasses = [strokeToClasses(nodeStroke, tokens), effectsToClasses(nodeEffects), gradientToClasses(nodeGradient)].filter(Boolean).join(" ");
  const absClass = parentDirection === "none" ? "absolute" : "";
  const combinedStyleClasses = [styleClasses, vpClasses, absClass].filter(Boolean).join(" ");

  switch (node.type) {
    case "frame": {
      const layout = node.layout as
        | {
            direction?: string;
            gap?: string;
            align?: string;
            justify?: string;
            wrap?: boolean;
          }
        | undefined;
      const baseClasses = buildClassString(
        layout,
        node.styles as Record<string, unknown> | undefined,
        tokens
      );
      const clipClass = (node as { clip?: boolean }).clip ? "overflow-hidden" : "";
      const allClasses = [baseClasses, clipClass, vpClasses, absClass].filter(Boolean).join(" ");
      const classAttr = allClasses ? ` class="${allClasses}"` : "";

      const childDir = layout?.direction;
      const childrenMarkup = node.children
        .map((childId) =>
          renderNode(childId, nodes, tokens, components, indent + "  ", componentRefs, childDir)
        )
        .join("\n");

      if (childrenMarkup) {
        return `${indent}<div${classAttr}>\n${childrenMarkup}\n${indent}</div>`;
      }
      return `${indent}<div${classAttr}></div>`;
    }

    case "text": {
      const tag = textToSemanticTag(
        node.styles as Record<string, unknown> | undefined
      );
      const classAttr = combinedStyleClasses ? ` class="${combinedStyleClasses}"` : "";
      const content = escapeHtml(node.content);
      return `${indent}<${tag}${classAttr}>${content}</${tag}>`;
    }

    case "image": {
      const classAttr = combinedStyleClasses ? ` class="${combinedStyleClasses}"` : "";
      const src = node.src ? escapeHtml(node.src) : "";
      const alt = node.alt ? escapeHtml(node.alt) : node.name;
      return `${indent}<img${classAttr} src="${src}" alt="${alt}" />`;
    }

    case "icon": {
      const classAttr = combinedStyleClasses ? ` class="${combinedStyleClasses}"` : "";
      return `${indent}<span${classAttr} data-icon="${escapeHtml(node.icon)}">${escapeHtml(node.icon)}</span>`;
    }

    case "component": {
      const compName = toComponentName(node.componentRef);
      componentRefs.add(node.componentRef);

      // Build props string from node.props
      const propsEntries = Object.entries(node.props ?? {});
      const propsStr = propsEntries
        .map(([k, v]) => {
          if (typeof v === "string") return ` ${k}="${escapeHtml(v)}"`;
          return ` :${k}="${String(v)}"`;
        })
        .join("");

      const compDef = components[node.componentRef];
      if (compDef?.template) {
        return `${indent}<${compName}${propsStr} />`;
      }
      return `${indent}<div data-component="${escapeHtml(node.componentRef)}"${propsStr}></div>`;
    }

    case "vector": {
      const classAttr = combinedStyleClasses ? ` class="${combinedStyleClasses}"` : "";
      if (node.path) {
        const viewBox = node.viewBox ?? "0 0 24 24";
        return `${indent}<svg${classAttr} viewBox="${viewBox}"><path d="${escapeHtml(node.path)}" /></svg>`;
      }
      return `${indent}<div${classAttr}></div>`;
    }

    default:
      return `${indent}<!-- unknown node type -->`;
  }
}

/**
 * Generate a Vue SFC for a component definition.
 */
function generateComponentFile(
  refName: string,
  compDef: { template?: ComponentTemplateNode; props?: string[] },
  tokens: Tokens,
  options: VueSfcOptions
): string {
  const parts: string[] = [];

  // <template>
  parts.push("<template>");
  if (compDef.template) {
    parts.push(renderTemplate(compDef.template, tokens, "  "));
  } else {
    parts.push(`  <div data-component="${escapeHtml(refName)}"></div>`);
  }
  parts.push("</template>");

  // <script setup>
  const lang = options.typescript ? ' lang="ts"' : "";
  if (compDef.props && compDef.props.length > 0) {
    parts.push("");
    parts.push(`<script setup${lang}>`);
    if (options.typescript) {
      const propsInterface = compDef.props
        .map((p) => `  ${p}?: string`)
        .join("\n");
      parts.push(`defineProps<{\n${propsInterface}\n}>()`);
    } else {
      parts.push(
        `defineProps(${JSON.stringify(compDef.props)})`
      );
    }
    parts.push("</script>");
  }

  parts.push("");
  return parts.join("\n");
}

/**
 * Export a page (or subtree) from a Document as Vue SFC files.
 */
export function exportToVueSfc(
  doc: Document,
  pageId: string,
  nodeId?: string,
  options?: VueSfcOptions
): VueSfcResult {
  const opts: VueSfcOptions = {
    composition: true,
    typescript: true,
    scoped: false,
    ...options,
  };

  const page = doc.data.pages[pageId];
  if (!page) throw new Error(`Page "${pageId}" not found`);

  const tokens = doc.data.tokens;
  const components = doc.data.components as Record<
    string,
    { template?: ComponentTemplateNode; props?: string[] }
  >;
  const startNodeId = nodeId ?? "root";

  if (!page.nodes[startNodeId]) {
    throw new Error(`Node "${startNodeId}" not found on page "${pageId}"`);
  }

  const componentRefs = new Set<string>();
  const templateContent = renderNode(
    startNodeId,
    page.nodes,
    tokens,
    components,
    "  ",
    componentRefs
  );

  const files: ExportedFile[] = [];

  // Generate component files
  for (const ref of componentRefs) {
    const compDef = components[ref];
    if (compDef) {
      const compName = toComponentName(ref);
      const content = generateComponentFile(ref, compDef, tokens, opts);
      files.push({ path: `${compName}.vue`, content });
    }
  }

  // Generate entry component
  const pageName = toComponentName(page.name);
  const entryParts: string[] = [];

  entryParts.push("<template>");
  entryParts.push(templateContent);
  entryParts.push("</template>");

  if (componentRefs.size > 0) {
    const lang = opts.typescript ? ' lang="ts"' : "";
    entryParts.push("");
    entryParts.push(`<script setup${lang}>`);
    for (const ref of componentRefs) {
      const compName = toComponentName(ref);
      entryParts.push(`import ${compName} from './${compName}.vue'`);
    }
    entryParts.push("</script>");
  }

  entryParts.push("");

  files.push({ path: `${pageName}.vue`, content: entryParts.join("\n") });

  return { files, entryComponent: `${pageName}.vue` };
}
