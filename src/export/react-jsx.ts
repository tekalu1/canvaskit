import type { Document } from "../core/document.js";
import type {
  CanvasNode,
  ComponentTemplateNode,
  Tokens,
} from "../core/schema.js";
import {
  escapeHtml,
  stylesToClasses,
  textToSemanticTag,
  toComponentName,
  buildClassString,
  strokeToClasses,
  effectsToClasses,
  gradientToClasses,
} from "./shared.js";
import type { Stroke, Effect, Gradient } from "../core/schema.js";

export interface ReactJsxOptions {
  typescript?: boolean;
}

export interface ExportedFile {
  path: string;
  content: string;
}

export interface ReactJsxResult {
  files: ExportedFile[];
  entryComponent: string;
}

/**
 * Escape text content for JSX (handles {, } in addition to HTML entities).
 */
function escapeJsx(text: string): string {
  return escapeHtml(text)
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/**
 * Render a component template node to JSX markup.
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
  const classAttr = styleClasses ? ` className="${styleClasses}"` : "";
  const content = template.content ? escapeJsx(template.content) : "";

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
 * Render a single node to JSX markup.
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
  if (!node) return `${indent}{/* missing node: ${nodeId} */}`;

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
      const classAttr = allClasses ? ` className="${allClasses}"` : "";

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
      const classAttr = combinedStyleClasses ? ` className="${combinedStyleClasses}"` : "";
      const content = escapeJsx(node.content);
      return `${indent}<${tag}${classAttr}>${content}</${tag}>`;
    }

    case "image": {
      const classAttr = combinedStyleClasses ? ` className="${combinedStyleClasses}"` : "";
      const src = node.src ? escapeHtml(node.src) : "";
      const alt = node.alt ? escapeHtml(node.alt) : node.name;
      return `${indent}<img${classAttr} src="${src}" alt="${alt}" />`;
    }

    case "icon": {
      const classAttr = combinedStyleClasses ? ` className="${combinedStyleClasses}"` : "";
      return `${indent}<span${classAttr} data-icon="${escapeHtml(node.icon)}">${escapeJsx(node.icon)}</span>`;
    }

    case "component": {
      const compName = toComponentName(node.componentRef);
      componentRefs.add(node.componentRef);

      // Build props string from node.props
      const propsEntries = Object.entries(node.props ?? {});
      const propsStr = propsEntries
        .map(([k, v]) => {
          if (typeof v === "string") return ` ${k}="${escapeHtml(v)}"`;
          return ` ${k}={${JSON.stringify(v)}}`;
        })
        .join("");

      const compDef = components[node.componentRef];
      if (compDef?.template) {
        return `${indent}<${compName}${propsStr} />`;
      }
      return `${indent}<div data-component="${escapeHtml(node.componentRef)}"${propsStr}></div>`;
    }

    case "vector": {
      const classAttr = combinedStyleClasses ? ` className="${combinedStyleClasses}"` : "";
      if (node.path) {
        const viewBox = node.viewBox ?? "0 0 24 24";
        return `${indent}<svg${classAttr} viewBox="${viewBox}"><path d="${escapeHtml(node.path)}" /></svg>`;
      }
      return `${indent}<div${classAttr}></div>`;
    }

    default:
      return `${indent}{/* unknown node type */}`;
  }
}

/**
 * Generate a React component file for a component definition.
 */
function generateComponentFile(
  refName: string,
  compDef: { template?: ComponentTemplateNode; props?: string[] },
  tokens: Tokens,
  options: ReactJsxOptions
): string {
  const compName = toComponentName(refName);
  const lines: string[] = [];

  // Props interface for TypeScript
  if (options.typescript && compDef.props && compDef.props.length > 0) {
    lines.push(`interface ${compName}Props {`);
    for (const p of compDef.props) {
      lines.push(`  ${p}?: string`);
    }
    lines.push("}");
    lines.push("");
  }

  // Function component
  const propsType =
    options.typescript && compDef.props && compDef.props.length > 0
      ? `props: ${compName}Props`
      : "";

  lines.push(`export default function ${compName}(${propsType}) {`);
  lines.push("  return (");

  if (compDef.template) {
    lines.push(renderTemplate(compDef.template, tokens, "    "));
  } else {
    lines.push(
      `    <div data-component="${escapeHtml(refName)}"></div>`
    );
  }

  lines.push("  )");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Export a page (or subtree) from a Document as React JSX/TSX files.
 */
export function exportToReactJsx(
  doc: Document,
  pageId: string,
  nodeId?: string,
  options?: ReactJsxOptions
): ReactJsxResult {
  const opts: ReactJsxOptions = {
    typescript: true,
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
  const jsxContent = renderNode(
    startNodeId,
    page.nodes,
    tokens,
    components,
    "    ",
    componentRefs
  );

  const files: ExportedFile[] = [];
  const ext = opts.typescript ? "tsx" : "jsx";

  // Generate component files
  for (const ref of componentRefs) {
    const compDef = components[ref];
    if (compDef) {
      const compName = toComponentName(ref);
      const content = generateComponentFile(ref, compDef, tokens, opts);
      files.push({ path: `${compName}.${ext}`, content });
    }
  }

  // Generate entry component
  const pageName = toComponentName(page.name);
  const entryLines: string[] = [];

  // Import statements
  for (const ref of componentRefs) {
    const compName = toComponentName(ref);
    entryLines.push(`import ${compName} from './${compName}'`);
  }

  if (componentRefs.size > 0) {
    entryLines.push("");
  }

  entryLines.push(`export default function ${pageName}() {`);
  entryLines.push("  return (");
  entryLines.push(jsxContent);
  entryLines.push("  )");
  entryLines.push("}");
  entryLines.push("");

  files.push({
    path: `${pageName}.${ext}`,
    content: entryLines.join("\n"),
  });

  return { files, entryComponent: `${pageName}.${ext}` };
}
