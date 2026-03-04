/**
 * Transport-independent layout inspection service for node operations.
 *
 * Renders a canvas page to HTML, opens it in a headless browser, and
 * extracts computed layout information (dimensions, position, overflow,
 * flex properties) for each node via `getBoundingClientRect()` and
 * `getComputedStyle()`.
 *
 * Shared by both MCP tools and CLI commands.
 */

import type { BrowserPool } from "../preview/browser-pool.js";
import type { Document } from "../core/document.js";
import { exportToHtml } from "../export/html.js";

export interface NodeLayoutInfo {
  nodeId: string;
  name: string;
  type: string;
  dimensions: { width: number; height: number };
  position: { x: number; y: number };
  overflow: { clipped: boolean; overflowX: string; overflowY: string };
  flex: {
    display: string;
    flexDirection: string;
    alignItems: string;
    justifyContent: string;
    flexWrap: string;
    gap: string;
  };
  padding: { top: string; right: string; bottom: string; left: string };
}

export interface InspectResult {
  pageId: string;
  nodes: NodeLayoutInfo[];
}

/**
 * Collect node IDs and metadata from the document for the target scope.
 */
function collectNodeIds(
  doc: Document,
  pageId: string,
  nodeId?: string,
  depth?: number
): Array<{ id: string; name: string; type: string }> {
  const page = doc.data.pages[pageId];
  if (!page) throw new Error(`Page "${pageId}" not found`);

  const startId = nodeId ?? "root";
  const startNode = page.nodes[startId];
  if (!startNode) throw new Error(`Node "${startId}" not found on page "${pageId}"`);

  const result: Array<{ id: string; name: string; type: string }> = [];

  function walk(id: string, currentDepth: number): void {
    const node = page.nodes[id];
    if (!node) return;

    result.push({ id, name: node.name, type: node.type });

    if (depth !== undefined && currentDepth >= depth) return;

    if (node.type === "frame" && node.children) {
      for (const childId of node.children) {
        walk(childId, currentDepth + 1);
      }
    }
  }

  walk(startId, 0);
  return result;
}

/**
 * JavaScript to execute inside the browser page to extract layout info.
 * Receives an array of {id, name, type} and returns NodeLayoutInfo[].
 */
const EXTRACT_LAYOUT_JS = `
(nodeEntries) => {
  return nodeEntries.map(({ id, name, type }) => {
    const el = document.querySelector('[data-node-id="' + id + '"]');
    if (!el) {
      return {
        nodeId: id,
        name,
        type,
        dimensions: { width: 0, height: 0 },
        position: { x: 0, y: 0 },
        overflow: { clipped: false, overflowX: 'visible', overflowY: 'visible' },
        flex: { display: '', flexDirection: '', alignItems: '', justifyContent: '', flexWrap: '', gap: '' },
        padding: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      };
    }

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    const overflowX = style.overflowX;
    const overflowY = style.overflowY;
    const clipped = (overflowX === 'hidden' || overflowX === 'clip' ||
                     overflowY === 'hidden' || overflowY === 'clip') &&
                    (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);

    return {
      nodeId: id,
      name,
      type,
      dimensions: {
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      },
      position: {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
      },
      overflow: {
        clipped,
        overflowX,
        overflowY,
      },
      flex: {
        display: style.display,
        flexDirection: style.flexDirection,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
        flexWrap: style.flexWrap,
        gap: style.gap,
      },
      padding: {
        top: style.paddingTop,
        right: style.paddingRight,
        bottom: style.paddingBottom,
        left: style.paddingLeft,
      },
    };
  });
}
`;

/**
 * Inspect computed layout for nodes on a canvas page.
 *
 * Renders the page to HTML, opens it in a headless browser, and extracts
 * computed layout data for the specified scope.
 */
export async function inspectNodeLayout(
  pool: BrowserPool,
  doc: Document,
  pageId: string,
  nodeId?: string,
  depth?: number
): Promise<InspectResult> {
  const nodeEntries = collectNodeIds(doc, pageId, nodeId, depth);
  const html = exportToHtml(doc, pageId, nodeId);

  const browser = await pool.acquire();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1440, height: 900 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const layoutData: NodeLayoutInfo[] = await page.evaluate(
      `(${EXTRACT_LAYOUT_JS})(${JSON.stringify(nodeEntries)})`
    );

    return { pageId, nodes: layoutData };
  } finally {
    await page.close();
  }
}

/**
 * Inspect layout if pool is available, otherwise return null.
 */
export async function tryInspect(
  pool: BrowserPool | null | undefined,
  doc: Document,
  pageId: string,
  nodeId?: string,
  depth?: number
): Promise<InspectResult | null> {
  if (!pool) return null;
  try {
    return await inspectNodeLayout(pool, doc, pageId, nodeId, depth);
  } catch {
    return null;
  }
}

// Re-export for convenience
export { collectNodeIds };
