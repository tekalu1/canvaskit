import * as vscode from "vscode";
import * as fs from "node:fs";
import {
  type CanvasDocument,
  type CanvasNode,
  type FrameNode,
  type Page,
  type TokenMap,
  type TokenValue,
  type TypographyToken,
  type ComponentDef,
  parseCanvasDocument,
  findRootNodes,
} from "../canvas-parser";
import { CANVAS_JSON_EXT } from "../constants";

// --- TreeElement discriminated union ---

export type TreeElement =
  | { kind: "document"; doc: CanvasDocument; uri: vscode.Uri }
  | { kind: "section"; section: "pages" | "tokens" | "components"; doc: CanvasDocument; uri: vscode.Uri }
  | { kind: "page"; pageId: string; page: Page; doc: CanvasDocument; uri: vscode.Uri }
  | { kind: "node"; nodeId: string; node: CanvasNode; page: Page; pageId: string; doc: CanvasDocument; uri: vscode.Uri }
  | { kind: "tokenCategory"; category: string; entries: Record<string, TokenValue | TypographyToken>; doc: CanvasDocument; uri: vscode.Uri }
  | { kind: "token"; name: string; entry: TokenValue | TypographyToken; category: string; doc: CanvasDocument; uri: vscode.Uri }
  | { kind: "component"; compId: string; comp: ComponentDef; doc: CanvasDocument; uri: vscode.Uri };

// --- Node type → icon mapping ---

const NODE_ICONS: Record<string, string> = {
  frame: "layout",
  text: "symbol-string",
  image: "file-media",
  icon: "symbol-misc",
  component: "symbol-class",
  vector: "symbol-namespace",
};

// --- Provider ---

export class NodeTreeProvider
  implements vscode.TreeDataProvider<TreeElement>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private cachedDoc: CanvasDocument | null = null;
  private cachedUri: vscode.Uri | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Watch for external file changes
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.canvas.json");
    watcher.onDidChange(() => this.refresh());
    watcher.onDidCreate(() => this.refresh());
    watcher.onDidDelete(() => this.refresh());
    this.disposables.push(watcher);

    // Watch for in-editor text changes (debounced)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.fsPath.endsWith(CANVAS_JSON_EXT)) {
          this.debouncedRefresh();
        }
      }),
    );

    // Watch for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.fsPath.endsWith(CANVAS_JSON_EXT)) {
          this.refresh();
        }
      }),
    );
  }

  dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    for (const d of this.disposables) d.dispose();
    this._onDidChangeTreeData.dispose();
  }

  refresh(): void {
    this.cachedDoc = null;
    this.cachedUri = null;
    this._onDidChangeTreeData.fire(undefined);
  }

  private debouncedRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.refresh(), 500);
  }

  private getActiveDocument(): { doc: CanvasDocument; uri: vscode.Uri } | null {
    // Prefer the active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.fsPath.endsWith(CANVAS_JSON_EXT)) {
      const doc = parseCanvasDocument(activeEditor.document.getText());
      if (doc) {
        this.cachedDoc = doc;
        this.cachedUri = activeEditor.document.uri;
        return { doc, uri: activeEditor.document.uri };
      }
    }

    // Try open text documents
    for (const td of vscode.workspace.textDocuments) {
      if (td.uri.fsPath.endsWith(CANVAS_JSON_EXT)) {
        const doc = parseCanvasDocument(td.getText());
        if (doc) {
          this.cachedDoc = doc;
          this.cachedUri = td.uri;
          return { doc, uri: td.uri };
        }
      }
    }

    // Use cached
    if (this.cachedDoc && this.cachedUri) {
      return { doc: this.cachedDoc, uri: this.cachedUri };
    }

    // Try reading from workspace files
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        try {
          const folderPath = folder.uri.fsPath;
          const found = findCanvasJsonSync(folderPath);
          if (found) {
            const text = fs.readFileSync(found, "utf-8");
            const doc = parseCanvasDocument(text);
            if (doc) {
              const uri = vscode.Uri.file(found);
              this.cachedDoc = doc;
              this.cachedUri = uri;
              return { doc, uri };
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return null;
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    switch (element.kind) {
      case "document": {
        const item = new vscode.TreeItem(
          element.doc.meta.name || "Untitled",
          vscode.TreeItemCollapsibleState.Expanded,
        );
        item.iconPath = new vscode.ThemeIcon("file-code");
        item.description = element.doc.version;
        item.contextValue = "document";
        return item;
      }

      case "section": {
        const label =
          element.section === "pages" ? "Pages"
          : element.section === "tokens" ? "Tokens"
          : "Components";
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = new vscode.ThemeIcon(
          element.section === "pages" ? "files"
          : element.section === "tokens" ? "symbol-color"
          : "extensions",
        );
        item.contextValue = "section";
        return item;
      }

      case "page": {
        const item = new vscode.TreeItem(
          element.page.name || element.pageId,
          vscode.TreeItemCollapsibleState.Expanded,
        );
        item.iconPath = new vscode.ThemeIcon("window");
        item.description = element.pageId;
        item.contextValue = "page";
        return item;
      }

      case "node": {
        const hasChildren =
          element.node.type === "frame" &&
          ((element.node as FrameNode).children?.length ?? 0) > 0;
        const item = new vscode.TreeItem(
          element.node.name || element.nodeId,
          hasChildren
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None,
        );
        const iconId = NODE_ICONS[element.node.type] || "circle-outline";
        item.iconPath = new vscode.ThemeIcon(iconId);
        item.description = `[${element.node.type}]`;
        item.contextValue = "node";
        item.command = {
          command: "canvaskit.revealNode",
          title: "Reveal in Editor",
          arguments: [element.uri, element.nodeId],
        };
        return item;
      }

      case "tokenCategory": {
        const count = Object.keys(element.entries).length;
        const label = capitalize(element.category);
        const item = new vscode.TreeItem(
          `${label} (${count})`,
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.iconPath = new vscode.ThemeIcon(
          element.category === "colors" ? "symbol-color"
          : element.category === "typography" ? "text-size"
          : "symbol-ruler",
        );
        item.contextValue = "tokenCategory";
        return item;
      }

      case "token": {
        const value = "value" in element.entry ? element.entry.value : summarizeTypography(element.entry);
        const item = new vscode.TreeItem(
          element.name,
          vscode.TreeItemCollapsibleState.None,
        );
        item.description = value;
        item.iconPath = new vscode.ThemeIcon("symbol-constant");
        item.contextValue = "token";
        item.command = {
          command: "canvaskit.revealNode",
          title: "Reveal in Editor",
          arguments: [element.uri, element.name, element.category],
        };
        return item;
      }

      case "component": {
        const item = new vscode.TreeItem(
          element.comp.name || element.compId,
          vscode.TreeItemCollapsibleState.None,
        );
        item.iconPath = new vscode.ThemeIcon("symbol-class");
        item.description = element.compId;
        item.contextValue = "component";
        item.command = {
          command: "canvaskit.revealNode",
          title: "Reveal in Editor",
          arguments: [element.uri, element.compId, "components"],
        };
        return item;
      }
    }
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      // Root: return document element
      const active = this.getActiveDocument();
      if (!active) return [];
      return [{ kind: "document", doc: active.doc, uri: active.uri }];
    }

    switch (element.kind) {
      case "document": {
        const sections: TreeElement[] = [];
        sections.push({ kind: "section", section: "pages", doc: element.doc, uri: element.uri });
        if (element.doc.tokens && hasNonEmptyCategory(element.doc.tokens)) {
          sections.push({ kind: "section", section: "tokens", doc: element.doc, uri: element.uri });
        }
        if (element.doc.components && Object.keys(element.doc.components).length > 0) {
          sections.push({ kind: "section", section: "components", doc: element.doc, uri: element.uri });
        }
        return sections;
      }

      case "section": {
        if (element.section === "pages") {
          return Object.entries(element.doc.pages).map(([pageId, page]) => ({
            kind: "page" as const,
            pageId,
            page,
            doc: element.doc,
            uri: element.uri,
          }));
        }
        if (element.section === "tokens") {
          const tokens = element.doc.tokens;
          return Object.entries(tokens)
            .filter(([, entries]) => entries && typeof entries === "object" && Object.keys(entries).length > 0)
            .map(([category, entries]) => ({
              kind: "tokenCategory" as const,
              category,
              entries: entries as Record<string, TokenValue | TypographyToken>,
              doc: element.doc,
              uri: element.uri,
            }));
        }
        if (element.section === "components") {
          return Object.entries(element.doc.components).map(([compId, comp]) => ({
            kind: "component" as const,
            compId,
            comp,
            doc: element.doc,
            uri: element.uri,
          }));
        }
        return [];
      }

      case "page": {
        const rootIds = findRootNodes(element.page);
        return rootIds.map((nodeId) => ({
          kind: "node" as const,
          nodeId,
          node: element.page.nodes[nodeId],
          page: element.page,
          pageId: element.pageId,
          doc: element.doc,
          uri: element.uri,
        }));
      }

      case "node": {
        if (element.node.type !== "frame") return [];
        const frame = element.node as FrameNode;
        if (!frame.children) return [];
        return frame.children
          .filter((childId) => element.page.nodes[childId])
          .map((childId) => ({
            kind: "node" as const,
            nodeId: childId,
            node: element.page.nodes[childId],
            page: element.page,
            pageId: element.pageId,
            doc: element.doc,
            uri: element.uri,
          }));
      }

      case "tokenCategory": {
        return Object.entries(element.entries).map(([name, entry]) => ({
          kind: "token" as const,
          name,
          entry,
          category: element.category,
          doc: element.doc,
          uri: element.uri,
        }));
      }

      default:
        return [];
    }
  }

  /**
   * Return the parent of a tree element. Required for `treeView.reveal()`.
   */
  getParent(element: TreeElement): TreeElement | null {
    switch (element.kind) {
      case "document":
        return null;

      case "section":
        return { kind: "document", doc: element.doc, uri: element.uri };

      case "page":
        return { kind: "section", section: "pages", doc: element.doc, uri: element.uri };

      case "node": {
        // Find parent node by scanning all frame children in the page
        for (const [nid, n] of Object.entries(element.page.nodes)) {
          if (n.type === "frame" && (n as FrameNode).children?.includes(element.nodeId)) {
            return {
              kind: "node",
              nodeId: nid,
              node: n,
              page: element.page,
              pageId: element.pageId,
              doc: element.doc,
              uri: element.uri,
            };
          }
        }
        // Root-level node → parent is the page
        return {
          kind: "page",
          pageId: element.pageId,
          page: element.page,
          doc: element.doc,
          uri: element.uri,
        };
      }

      case "tokenCategory":
        return { kind: "section", section: "tokens", doc: element.doc, uri: element.uri };

      case "token":
        if (element.doc.tokens[element.category]) {
          return {
            kind: "tokenCategory",
            category: element.category,
            entries: element.doc.tokens[element.category] as Record<string, TokenValue | TypographyToken>,
            doc: element.doc,
            uri: element.uri,
          };
        }
        return null;

      case "component":
        return { kind: "section", section: "components", doc: element.doc, uri: element.uri };

      default:
        return null;
    }
  }

  /**
   * Find a tree element for a given nodeId by searching all pages.
   * Returns a `node` TreeElement or null.
   */
  findNodeElement(nodeId: string): TreeElement | null {
    const active = this.getActiveDocument();
    if (!active) return null;

    const { doc, uri } = active;
    for (const [pageId, page] of Object.entries(doc.pages)) {
      if (page.nodes[nodeId]) {
        return {
          kind: "node",
          nodeId,
          node: page.nodes[nodeId],
          page,
          pageId,
          doc,
          uri,
        };
      }
    }
    return null;
  }
}

// --- Helpers ---

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function summarizeTypography(token: TypographyToken): string {
  const parts: string[] = [];
  if (token.fontFamily) parts.push(token.fontFamily);
  if (token.fontSize) parts.push(token.fontSize);
  if (token.fontWeight) parts.push(`w${token.fontWeight}`);
  return parts.join(" / ") || "—";
}

function hasNonEmptyCategory(tokens: TokenMap): boolean {
  for (const entries of Object.values(tokens)) {
    if (entries && typeof entries === "object" && Object.keys(entries).length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Synchronously find first .canvas.json in a directory (shallow + one level deep).
 */
function findCanvasJsonSync(dir: string): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(CANVAS_JSON_EXT)) {
        const p = require("node:path");
        return p.join(dir, entry.name);
      }
    }
    // One level deep
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        try {
          const p = require("node:path");
          const subDir = p.join(dir, entry.name);
          const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
          for (const subEntry of subEntries) {
            if (subEntry.isFile() && subEntry.name.endsWith(CANVAS_JSON_EXT)) {
              return p.join(subDir, subEntry.name);
            }
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

// --- revealNode command implementation ---

export async function revealNodeInEditor(
  uri: vscode.Uri,
  nodeId: string,
  section?: string,
): Promise<void> {
  const editor = await vscode.window.showTextDocument(uri);
  const text = editor.document.getText();

  let searchKey: string;
  if (section === "components") {
    searchKey = `"${nodeId}"`;
  } else if (section) {
    // Token: search inside the category
    searchKey = `"${nodeId}"`;
  } else {
    // Node: search for "nodeId": { pattern
    searchKey = `"${nodeId}"`;
  }

  const offset = text.indexOf(searchKey);
  if (offset === -1) return;

  const pos = editor.document.positionAt(offset);
  const endPos = editor.document.positionAt(offset + searchKey.length);
  editor.selection = new vscode.Selection(pos, endPos);
  editor.revealRange(
    new vscode.Range(pos, endPos),
    vscode.TextEditorRevealType.InCenter,
  );
}
