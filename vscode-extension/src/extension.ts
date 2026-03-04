import * as vscode from "vscode";
import * as path from "node:path";
import { PreviewManager } from "./preview-manager";
import { PreviewPanel } from "./preview-panel";
import { NodeTreeProvider, revealNodeInEditor } from "./tree/node-tree-provider";
import { ColorDecorationProvider } from "./decorations/color-decoration";
import {
  CMD_OPEN_PREVIEW,
  CMD_OPEN_PREVIEW_TO_SIDE,
  CMD_REFRESH_TREE,
  CMD_REVEAL_NODE,
  VIEW_NODE_TREE,
  CANVAS_JSON_EXT,
  OUTPUT_CHANNEL_NAME,
} from "./constants";

const activePanels = new Map<string, PreviewPanel>();

let previewManager: PreviewManager;

// Module-scope references for bidirectional selection
let treeProvider: NodeTreeProvider;
let treeView: vscode.TreeView<import("./tree/node-tree-provider").TreeElement>;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  previewManager = new PreviewManager(outputChannel, context.extensionPath);

  // Phase 1: Preview commands
  context.subscriptions.push(
    outputChannel,
    previewManager,
    vscode.commands.registerCommand(CMD_OPEN_PREVIEW, () =>
      openPreview(vscode.ViewColumn.Active),
    ),
    vscode.commands.registerCommand(CMD_OPEN_PREVIEW_TO_SIDE, () =>
      openPreview(vscode.ViewColumn.Beside),
    ),
  );

  // Phase 2: Node tree view
  treeProvider = new NodeTreeProvider();
  treeView = vscode.window.createTreeView(VIEW_NODE_TREE, {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(
    treeProvider,
    treeView,
    vscode.commands.registerCommand(CMD_REFRESH_TREE, () => treeProvider.refresh()),
    vscode.commands.registerCommand(
      CMD_REVEAL_NODE,
      (uri: vscode.Uri, nodeId: string, section?: string) => {
        // If a preview panel is open for this file, highlight in preview instead of opening code
        const panel = activePanels.get(uri.fsPath);
        if (panel && !section) {
          panel.postToPreview({ type: "canvaskit:selectNode", nodeId });
          return;
        }
        // No preview open (or token/component section) → open in editor
        return revealNodeInEditor(uri, nodeId, section);
      },
    ),
  );

  // Phase 3: Tree selection → Preview highlight
  context.subscriptions.push(
    treeView.onDidChangeSelection((e) => {
      const selected = e.selection[0];
      if (!selected || selected.kind !== "node") return;
      const filePath = selected.uri.fsPath;
      const panel = activePanels.get(filePath);
      if (panel) {
        panel.postToPreview({ type: "canvaskit:selectNode", nodeId: selected.nodeId });
      }
    }),
  );

  // Phase 2: Color decorations
  const colorDecorations = new ColorDecorationProvider();
  context.subscriptions.push(colorDecorations);
}

export function deactivate(): void {
  for (const [, panel] of activePanels) {
    panel.dispose();
  }
  activePanels.clear();
}

async function openPreview(column: vscode.ViewColumn): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor");
    return;
  }

  const filePath = editor.document.uri.fsPath;
  if (!filePath.endsWith(CANVAS_JSON_EXT)) {
    vscode.window.showErrorMessage("Active file is not a .canvas.json file");
    return;
  }

  // Reveal existing panel if already open
  const existing = activePanels.get(filePath);
  if (existing) {
    existing.reveal(column);
    return;
  }

  try {
    const serverUrl = await previewManager.startPreview(filePath);
    const fileName = path.basename(filePath);

    const panel = PreviewPanel.create(serverUrl, fileName, column, () => {
      activePanels.delete(filePath);
      previewManager.stopPreview(filePath);
    });

    // Phase 3: Preview click → Tree reveal (no code tab)
    panel.onPreviewMessage((msg) => {
      if (msg.type === "canvaskit:nodeClicked") {
        const element = treeProvider.findNodeElement(msg.nodeId);
        if (element) {
          treeView.reveal(element, { select: true, focus: false });
        }
      }
    });

    activePanels.set(filePath, panel);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to start preview: ${message}`);
  }
}
