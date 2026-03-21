import express from "express";
import { watch } from "chokidar";
import { writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Document } from "../core/document.js";
import { NodeManager } from "../core/node.js";
import { exportToHtml, exportToHtmlMultiPage } from "../tools/export-tools.js";
import { PageManager } from "../core/page.js";
import { getSelectionOverlayScript } from "./selection-overlay.js";
import { getEditorUiScript } from "./editor-ui.js";
import { getCanvasNavigationScript } from "./canvas-navigation.js";

export interface PreviewServerOptions {
  port?: number;
  watchPath?: string;
  savePath?: string;
  onReload?: () => Document | Promise<Document>;
  /** Enable Figma-like editor UI (Phase 4). Default: true. */
  editorUi?: boolean;
}

export interface PreviewServerInfo {
  url: string;
  port: number;
  server: Server;
  stop: () => Promise<void>;
}

// --- Undo/Redo snapshot stack ---

interface UndoStack {
  undoSnapshots: string[];
  redoSnapshots: string[];
  maxSize: number;
}

function createUndoStack(maxSize = 50): UndoStack {
  return { undoSnapshots: [], redoSnapshots: [], maxSize };
}

function pushUndo(stack: UndoStack, snapshot: string): void {
  stack.undoSnapshots.push(snapshot);
  if (stack.undoSnapshots.length > stack.maxSize) {
    stack.undoSnapshots.shift();
  }
  // Clear redo on new action
  stack.redoSnapshots.length = 0;
}

/**
 * Inject a hot-reload SSE client script into HTML.
 */
function injectHotReload(html: string, port: number): string {
  const script = `
<script>
(function() {
  var es = new EventSource('http://127.0.0.1:${port}/__canvaskit_sse');
  es.onmessage = function(e) {
    if (e.data === 'reload') window.location.reload();
  };
  es.onerror = function() {
    es.close();
    setTimeout(function() { window.location.reload(); }, 2000);
  };
})();
</script>`;
  return html.replace("</body>", `${script}\n</body>`);
}

/**
 * Start a local preview server for a canvas page.
 *
 * When `pageId` is provided, renders a single page.
 * When `pageId` is omitted or undefined, renders all pages in multi-artboard mode.
 *
 * Returns server info including a `stop()` function to shut down.
 */
export async function startPreviewServer(
  doc: Document,
  pageId?: string,
  nodeId?: string,
  options?: PreviewServerOptions
): Promise<PreviewServerInfo> {
  const port = options?.port ?? 3456;
  const enableEditorUi = options?.editorUi !== false;
  const isMultiPage = !pageId;
  const app = express();

  let currentDoc = doc;
  let sseClients: express.Response[] = [];
  const undoStack = createUndoStack();

  // JSON body parser for REST API
  app.use("/__canvaskit_api", express.json());

  // CORS for API endpoints
  app.use("/__canvaskit_api", (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // --- Helper: save & reload ---
  async function saveAndReload(): Promise<void> {
    if (options?.savePath) {
      await writeFile(options.savePath, currentDoc.toJSON(true), "utf-8");
    }
    for (const client of sseClients) {
      client.write("data: reload\n\n");
    }
  }

  function snapshotForUndo(): string {
    return currentDoc.toJSON(false);
  }

  // SSE endpoint for hot reload
  app.get("/__canvaskit_sse", (_req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("data: connected\n\n");
    sseClients.push(res);

    _req.on("close", () => {
      sseClients = sseClients.filter((c) => c !== res);
    });
  });

  // actualPort is resolved after listen; used by SSE inject and health check
  let actualPort = port;

  // Main page endpoint
  app.get("/", (_req, res) => {
    try {
      const html = isMultiPage
        ? exportToHtmlMultiPage(currentDoc)
        : exportToHtml(currentDoc, pageId!, nodeId);
      const withReload = injectHotReload(html, actualPort);
      // Inject order: navigation (wraps DOM) → overlay → editor UI
      const withNav = enableEditorUi
        ? withReload.replace("</body>", `${getCanvasNavigationScript()}\n</body>`)
        : withReload;
      const withOverlay = withNav.replace("</body>", `${getSelectionOverlayScript()}\n</body>`);
      const final = enableEditorUi
        ? withOverlay.replace("</body>", `${getEditorUiScript(actualPort)}\n</body>`)
        : withOverlay;
      res.type("html").send(final);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).send(`<pre>Error: ${message}</pre>`);
    }
  });

  // Health check
  app.get("/__canvaskit_health", (_req, res) => {
    res.json({ status: "ok", pageId: pageId ?? null, isMultiPage, port: actualPort });
  });

  // -------------------------------------------------------
  // Helper: resolve effective pageId for node operations
  // -------------------------------------------------------
  function resolvePageId(bodyPageId?: string): string {
    if (bodyPageId) return bodyPageId;
    if (pageId) return pageId;
    // Multi-page mode: use first page as default
    const pageIds = Object.keys(currentDoc.data.pages);
    if (pageIds.length === 0) throw new Error('No pages in document');
    return pageIds[0]!;
  }

  // -------------------------------------------------------
  // Phase 3: Page management REST API
  // -------------------------------------------------------

  // List pages
  app.get("/__canvaskit_api/pages", (_req, res) => {
    try {
      const pm = new PageManager(currentDoc);
      const pages = pm.list();
      res.json({ ok: true, pages });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // Add page
  app.post("/__canvaskit_api/page/add", async (req, res) => {
    try {
      const { id, name, width, height, x, y } = req.body as {
        id?: string;
        name?: string;
        width?: number;
        height?: number | null;
        x?: number;
        y?: number;
      };

      const snapshot = snapshotForUndo();

      // Generate a unique page ID
      const { randomUUID } = await import('node:crypto');
      const newId = id ?? `page-${randomUUID().slice(0, 8)}`;

      // Auto-placement: find max x+width of existing pages, add 100px gap
      let autoX = 0;
      if (x === undefined) {
        for (const p of Object.values(currentDoc.data.pages)) {
          const right = p.x + p.width;
          if (right > autoX) autoX = right;
        }
        if (Object.keys(currentDoc.data.pages).length > 0) {
          autoX += 100;
        }
      }

      const newPage = {
        name: name ?? 'New Page',
        width: width ?? 1440,
        height: height ?? null,
        x: x ?? autoX,
        y: y ?? 0,
        nodes: {
          root: {
            type: 'frame' as const,
            name: 'Root',
            clip: false,
            layout: { direction: 'column' as const },
            children: [] as string[],
          },
        },
      };

      currentDoc.addPage(newId, newPage);
      pushUndo(undoStack, snapshot);
      await saveAndReload();
      res.json({ ok: true, page: { id: newId, ...newPage } });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // Update page properties
  app.post("/__canvaskit_api/page/update", async (req, res) => {
    try {
      const { pageId: targetPageId, name, width, height, x, y } = req.body as {
        pageId: string;
        name?: string;
        width?: number;
        height?: number | null;
        x?: number;
        y?: number;
      };
      if (!targetPageId) {
        res.status(400).json({ error: "Missing 'pageId'" });
        return;
      }

      const snapshot = snapshotForUndo();
      const pm = new PageManager(currentDoc);
      const result = pm.update(targetPageId, { name, width, height, x, y });
      pushUndo(undoStack, snapshot);
      await saveAndReload();
      res.json({ ok: true, page: result });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // Delete page
  app.post("/__canvaskit_api/page/delete", async (req, res) => {
    try {
      const { pageId: targetPageId } = req.body as { pageId: string };
      if (!targetPageId) {
        res.status(400).json({ error: "Missing 'pageId'" });
        return;
      }

      const snapshot = snapshotForUndo();
      currentDoc.removePage(targetPageId);
      pushUndo(undoStack, snapshot);
      await saveAndReload();
      res.json({ ok: true, deleted: targetPageId });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // -------------------------------------------------------
  // Phase 4A: REST API for mutations
  // -------------------------------------------------------

  // Update nodes
  app.post("/__canvaskit_api/node/update", async (req, res) => {
    try {
      const { updates, pageId: bodyPageId } = req.body as {
        updates: Array<{
          id?: string;
          nodeName?: string;
          name?: string;
          content?: string;
          styles?: Record<string, unknown>;
          layout?: Record<string, unknown>;
        }>;
        pageId?: string;
      };
      if (!updates || !Array.isArray(updates)) {
        res.status(400).json({ error: "Missing 'updates' array" });
        return;
      }

      const effectivePageId = resolvePageId(bodyPageId);
      const snapshot = snapshotForUndo();
      const nm = new NodeManager(currentDoc);
      const ids = nm.update(effectivePageId, updates);
      pushUndo(undoStack, snapshot);
      await saveAndReload();
      res.json({ ok: true, updated: ids });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // Add nodes
  app.post("/__canvaskit_api/node/add", async (req, res) => {
    try {
      const { nodes, pageId: bodyPageId } = req.body as {
        nodes: Array<{
          type: string;
          name: string;
          parentId?: string;
          parentName?: string;
          content?: string;
          styles?: Record<string, unknown>;
          layout?: Record<string, unknown>;
        }>;
        pageId?: string;
      };
      if (!nodes || !Array.isArray(nodes)) {
        res.status(400).json({ error: "Missing 'nodes' array" });
        return;
      }

      const effectivePageId = resolvePageId(bodyPageId);
      const snapshot = snapshotForUndo();
      const nm = new NodeManager(currentDoc);
      const added = nm.add(effectivePageId, nodes as Parameters<NodeManager["add"]>[1]);
      pushUndo(undoStack, snapshot);
      await saveAndReload();
      res.json({ ok: true, added });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // Delete node
  app.post("/__canvaskit_api/node/delete", async (req, res) => {
    try {
      const { nodeId: delNodeId, pageId: bodyPageId } = req.body as {
        nodeId: string;
        pageId?: string;
      };
      if (!delNodeId) {
        res.status(400).json({ error: "Missing 'nodeId'" });
        return;
      }

      const effectivePageId = resolvePageId(bodyPageId);
      const snapshot = snapshotForUndo();
      const nm = new NodeManager(currentDoc);
      nm.delete(effectivePageId, delNodeId);
      pushUndo(undoStack, snapshot);
      await saveAndReload();
      res.json({ ok: true, deleted: delNodeId });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // Move node
  app.post("/__canvaskit_api/node/move", async (req, res) => {
    try {
      const { nodeId: moveNodeId, newParentId, index, pageId: bodyPageId } = req.body as {
        nodeId: string;
        newParentId: string;
        index?: number;
        pageId?: string;
      };
      if (!moveNodeId || !newParentId) {
        res.status(400).json({ error: "Missing 'nodeId' or 'newParentId'" });
        return;
      }

      const effectivePageId = resolvePageId(bodyPageId);
      const snapshot = snapshotForUndo();
      const nm = new NodeManager(currentDoc);
      nm.move(effectivePageId, moveNodeId, newParentId, index);
      pushUndo(undoStack, snapshot);
      await saveAndReload();
      res.json({ ok: true, moved: moveNodeId });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // Get node info
  app.get("/__canvaskit_api/node/:nodeId", (req, res) => {
    try {
      const effectivePageId = resolvePageId(req.query.pageId as string | undefined);
      const nm = new NodeManager(currentDoc);
      const node = nm.get(effectivePageId, req.params.nodeId);
      if (!node) {
        res.status(404).json({ error: "Node not found" });
        return;
      }
      res.json({ ok: true, node });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // List nodes
  app.get("/__canvaskit_api/nodes", (req, res) => {
    try {
      const effectivePageId = resolvePageId(req.query.pageId as string | undefined);
      const nm = new NodeManager(currentDoc);
      const nodes = nm.list(effectivePageId);
      res.json({ ok: true, nodes });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });

  // -------------------------------------------------------
  // Phase 4D: Undo / Redo
  // -------------------------------------------------------

  app.post("/__canvaskit_api/undo", async (req, res) => {
    try {
      if (undoStack.undoSnapshots.length === 0) {
        res.json({ ok: false, message: "Nothing to undo" });
        return;
      }
      // Save current state for redo
      undoStack.redoSnapshots.push(snapshotForUndo());
      // Restore previous state
      const snapshot = undoStack.undoSnapshots.pop()!;
      const { Document } = await import("../core/document.js");
      const { CanvasDocumentSchema } = await import("../core/schema.js");
      const parsed = CanvasDocumentSchema.parse(JSON.parse(snapshot));
      currentDoc = new Document(parsed);
      await saveAndReload();
      res.json({ ok: true, remaining: undoStack.undoSnapshots.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  app.post("/__canvaskit_api/redo", async (req, res) => {
    try {
      if (undoStack.redoSnapshots.length === 0) {
        res.json({ ok: false, message: "Nothing to redo" });
        return;
      }
      // Save current state for undo
      undoStack.undoSnapshots.push(snapshotForUndo());
      // Restore redo state
      const snapshot = undoStack.redoSnapshots.pop()!;
      const { Document } = await import("../core/document.js");
      const { CanvasDocumentSchema } = await import("../core/schema.js");
      const parsed = CanvasDocumentSchema.parse(JSON.parse(snapshot));
      currentDoc = new Document(parsed);
      await saveAndReload();
      res.json({ ok: true, remaining: undoStack.redoSnapshots.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  // File watcher for hot reload
  let watcher: ReturnType<typeof watch> | undefined;
  if (options?.watchPath) {
    watcher = watch(options.watchPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300 },
    });

    watcher.on("change", async () => {
      if (options?.onReload) {
        try {
          currentDoc = await options.onReload();
        } catch {
          // Keep current doc on reload error
        }
      }
      // Notify all SSE clients to reload
      for (const client of sseClients) {
        client.write("data: reload\n\n");
      }
    });
  }

  // Start server — bind to 127.0.0.1 explicitly for reliable connectivity
  const server = await new Promise<Server>((resolve, reject) => {
    const srv = app.listen(port, "127.0.0.1", () => resolve(srv));
    srv.on("error", reject);
  });

  // Read actual port (important when port=0 for OS-assigned port)
  actualPort = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${actualPort}`;

  const stop = async () => {
    // Close SSE clients
    for (const client of sseClients) {
      client.end();
    }
    sseClients = [];

    // Close file watcher
    if (watcher) {
      await watcher.close();
    }

    // Close server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return { url, port: actualPort, server, stop };
}
