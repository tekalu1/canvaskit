import { describe, it, expect, afterEach } from "vitest";
import { startPreviewServer, type PreviewServerInfo } from "../../src/preview/server.js";
import {
  createDocumentWithNodes,
  createTestDocument,
} from "../helpers/create-test-document.js";

// Track servers to clean up
let activeServer: PreviewServerInfo | null = null;

async function cleanup() {
  if (activeServer) {
    await activeServer.stop();
    activeServer = null;
  }
}

afterEach(cleanup);

describe("startPreviewServer", () => {
  // -------------------------------------------------------
  // Basic startup
  // -------------------------------------------------------

  it("starts a server and returns url and port", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0, // OS-assigned port
    });
    expect(activeServer.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(activeServer.port).toBeGreaterThan(0);
  });

  it("serves HTML at the root endpoint", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(activeServer.url);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Hello World");
  });

  it("includes hot reload script in HTML", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(activeServer.url);
    const html = await res.text();
    expect(html).toContain("EventSource");
    expect(html).toContain("__canvaskit_sse");
  });

  it("health check endpoint returns ok", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(`${activeServer.url}/__canvaskit_health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.pageId).toBe("page1");
  });

  it("returns 500 for missing page", async () => {
    const doc = createTestDocument();
    activeServer = await startPreviewServer(doc, "nonexistent", undefined, {
      port: 0,
    });

    const res = await fetch(activeServer.url);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("Error");
  });

  // -------------------------------------------------------
  // Server lifecycle
  // -------------------------------------------------------

  it("stop() shuts down the server", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const url = activeServer.url;
    await activeServer.stop();
    activeServer = null;

    // Server should be down
    await expect(fetch(url)).rejects.toThrow();
  });

  it("uses specified port", async () => {
    const doc = createDocumentWithNodes();
    // Use a high port unlikely to conflict
    const port = 19876;
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port,
    });

    expect(activeServer.port).toBe(port);
    expect(activeServer.url).toBe(`http://127.0.0.1:${port}`);
  });

  it("defaults to port 3456 when no port specified", async () => {
    // Skip if port 3456 is already in use (e.g. another preview server running)
    const net = await import("node:net");
    const portFree = await new Promise<boolean>((resolve) => {
      const srv = net.createServer();
      srv.once("error", () => resolve(false));
      srv.listen(3456, "127.0.0.1", () => srv.close(() => resolve(true)));
    });
    if (!portFree) {
      console.warn("Skipping default port test: port 3456 already in use");
      return;
    }

    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1");

    expect(activeServer.port).toBe(3456);
  });

  // -------------------------------------------------------
  // SSE endpoint
  // -------------------------------------------------------

  it("SSE endpoint responds with event stream", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
      const res = await fetch(
        `${activeServer.url}/__canvaskit_sse`,
        { signal: controller.signal }
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain(
        "text/event-stream"
      );
    } catch {
      // AbortError is expected when SSE stream is kept open
    } finally {
      clearTimeout(timeout);
    }
  });

  // -------------------------------------------------------
  // Subtree export
  // -------------------------------------------------------

  it("serves specific subtree when nodeId is provided", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", "content", {
      port: 0,
    });

    const res = await fetch(activeServer.url);
    const html = await res.text();
    expect(html).toContain("Hello World");
    expect(html).toContain("hero.png");
  });

  // -------------------------------------------------------
  // Tailwind classes in preview
  // -------------------------------------------------------

  it("preview HTML contains Tailwind classes", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(activeServer.url);
    const html = await res.text();
    expect(html).toContain("flex");
    expect(html).toContain("tailwindcss");
  });

  // -------------------------------------------------------
  // Phase 3: Selection overlay injection
  // -------------------------------------------------------

  it("includes selection overlay script in HTML", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(activeServer.url);
    const html = await res.text();
    expect(html).toContain("__ck_hover");
    expect(html).toContain("__ck_select");
    expect(html).toContain("canvaskit:nodeClicked");
    expect(html).toContain("canvaskit:ready");
  });

  it("overlay script handles canvaskit:selectNode messages", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(activeServer.url);
    const html = await res.text();
    expect(html).toContain("canvaskit:selectNode");
    expect(html).toContain("canvaskit:clearSelection");
    expect(html).toContain("scrollIntoView");
  });

  // -------------------------------------------------------
  // Phase 4: Editor UI injection
  // -------------------------------------------------------

  it("includes editor UI script in HTML by default", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(activeServer.url);
    const html = await res.text();
    expect(html).toContain("__ck_toolbar");
    expect(html).toContain("__ck_props");
    expect(html).toContain("__canvaskit_api");
  });

  it("omits editor UI when editorUi=false", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
      editorUi: false,
    });

    const res = await fetch(activeServer.url);
    const html = await res.text();
    expect(html).not.toContain("__ck_toolbar");
    // Selection overlay should still be present
    expect(html).toContain("__ck_hover");
  });

  // -------------------------------------------------------
  // Phase 4A: REST API endpoints
  // -------------------------------------------------------

  it("GET /nodes returns node list", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(`${activeServer.url}/__canvaskit_api/nodes`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.nodes).toBeDefined();
    expect(Array.isArray(data.nodes)).toBe(true);
  });

  it("GET /node/:id returns node info", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(`${activeServer.url}/__canvaskit_api/node/root`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.node).toBeDefined();
    expect(data.node.type).toBe("frame");
  });

  it("POST /node/update modifies a node", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(`${activeServer.url}/__canvaskit_api/node/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [{ id: "title", name: "Updated Title" }],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.updated).toContain("title");
  });

  it("POST /node/add creates a new node", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(`${activeServer.url}/__canvaskit_api/node/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: [{ type: "text", name: "New Node", parentId: "content", content: "Hi" }],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.added).toBeDefined();
    expect(data.added.length).toBe(1);
  });

  it("POST /node/delete removes a node", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(`${activeServer.url}/__canvaskit_api/node/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: "title" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.deleted).toBe("title");

    // Verify it's gone
    const getRes = await fetch(`${activeServer.url}/__canvaskit_api/node/title`);
    const getData = await getRes.json();
    expect(getData.ok).toBeFalsy();
  });

  it("POST /undo restores previous state", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    // Make a change
    await fetch(`${activeServer.url}/__canvaskit_api/node/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ id: "title", name: "Changed" }] }),
    });

    // Undo
    const res = await fetch(`${activeServer.url}/__canvaskit_api/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify name is restored
    const getRes = await fetch(`${activeServer.url}/__canvaskit_api/node/title`);
    const getData = await getRes.json();
    expect(getData.node.name).not.toBe("Changed");
  });

  it("POST /undo with nothing to undo returns ok=false", async () => {
    const doc = createDocumentWithNodes();
    activeServer = await startPreviewServer(doc, "page1", undefined, {
      port: 0,
    });

    const res = await fetch(`${activeServer.url}/__canvaskit_api/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json();
    expect(data.ok).toBe(false);
  });
});
