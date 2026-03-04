import * as vscode from "vscode";
import { parseCanvasDocument, resolveTokenColor } from "../canvas-parser";
import { CANVAS_JSON_EXT } from "../constants";

const HEX_PATTERN = /"(#[0-9a-fA-F]{3,8})"/g;
const TOKEN_REF_PATTERN = /"\{colors\.([^}]+)\}"/g;

const DEBOUNCE_MS = 200;

/**
 * Provides inline color swatch decorations for .canvas.json files.
 * Detects hex colors and {colors.*} token references.
 */
export class ColorDecorationProvider implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly decorationTypeCache = new Map<string, vscode.TextEditorDecorationType>();

  constructor() {
    // Trigger on active editor change
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.updateDecorations(editor);
      }),
    );

    // Trigger on text change (debounced)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && e.document === editor.document) {
          this.debouncedUpdate(editor);
        }
      }),
    );

    // Initial decoration for active editor
    if (vscode.window.activeTextEditor) {
      this.updateDecorations(vscode.window.activeTextEditor);
    }
  }

  dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    for (const dt of this.decorationTypeCache.values()) {
      dt.dispose();
    }
    this.decorationTypeCache.clear();
    for (const d of this.disposables) d.dispose();
  }

  private debouncedUpdate(editor: vscode.TextEditor): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.updateDecorations(editor), DEBOUNCE_MS);
  }

  private getDecorationType(color: string): vscode.TextEditorDecorationType {
    const cached = this.decorationTypeCache.get(color);
    if (cached) return cached;

    const dt = vscode.window.createTextEditorDecorationType({
      before: {
        contentText: " ",
        width: "0.8em",
        height: "0.8em",
        margin: "0 0.2em 0 0",
        border: "1px solid rgba(128,128,128,0.4)",
        backgroundColor: color,
      },
    });
    this.decorationTypeCache.set(color, dt);
    return dt;
  }

  updateDecorations(editor: vscode.TextEditor): void {
    if (!editor.document.uri.fsPath.endsWith(CANVAS_JSON_EXT)) {
      return;
    }

    const text = editor.document.getText();

    // Parse for token resolution
    const doc = parseCanvasDocument(text);
    const tokens = doc?.tokens;

    // Group decorations by color
    const decorationsByColor = new Map<string, vscode.DecorationOptions[]>();

    const addDecoration = (color: string, range: vscode.Range) => {
      const normalized = color.toLowerCase();
      let list = decorationsByColor.get(normalized);
      if (!list) {
        list = [];
        decorationsByColor.set(normalized, list);
      }
      list.push({ range });
    };

    // Detect hex colors
    HEX_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = HEX_PATTERN.exec(text)) !== null) {
      const hexValue = match[1];
      const startOffset = match.index + 1; // skip opening quote
      const pos = editor.document.positionAt(startOffset);
      // Place decoration at the start of the hex value
      addDecoration(hexValue, new vscode.Range(pos, pos));
    }

    // Detect token references
    if (tokens) {
      TOKEN_REF_PATTERN.lastIndex = 0;
      while ((match = TOKEN_REF_PATTERN.exec(text)) !== null) {
        const tokenName = match[1];
        const resolved = resolveTokenColor(tokenName, tokens);
        if (resolved) {
          const startOffset = match.index + 1; // skip opening quote
          const pos = editor.document.positionAt(startOffset);
          addDecoration(resolved, new vscode.Range(pos, pos));
        }
      }
    }

    // Track which decoration types are used in this pass
    const usedColors = new Set<string>();

    // Apply decorations
    for (const [color, options] of decorationsByColor) {
      usedColors.add(color);
      const dt = this.getDecorationType(color);
      editor.setDecorations(dt, options);
    }

    // Clear decorations for colors no longer present
    for (const [color, dt] of this.decorationTypeCache) {
      if (!usedColors.has(color)) {
        editor.setDecorations(dt, []);
      }
    }
  }
}
