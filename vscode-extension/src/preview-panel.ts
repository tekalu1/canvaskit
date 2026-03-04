import * as vscode from "vscode";
import { WEBVIEW_TYPE } from "./constants";
import type { ExtensionToPreviewMessage, PreviewToExtensionMessage } from "./bridge/protocol";
import { isBridgeMessage } from "./bridge/protocol";

export class PreviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private messageHandlers: Array<(msg: PreviewToExtensionMessage) => void> = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;

    // Listen for messages from the webview (bridge script forwards iframe messages)
    panel.webview.onDidReceiveMessage(
      (msg: unknown) => {
        if (isBridgeMessage(msg)) {
          for (const handler of this.messageHandlers) {
            handler(msg as PreviewToExtensionMessage);
          }
        }
      },
      null,
      this.disposables,
    );
  }

  static create(
    serverUrl: string,
    fileName: string,
    column: vscode.ViewColumn,
    onDispose: () => void,
  ): PreviewPanel {
    const panel = vscode.window.createWebviewPanel(
      WEBVIEW_TYPE,
      `Preview: ${fileName}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    const instance = new PreviewPanel(panel);
    instance.setHtml(serverUrl);

    panel.onDidDispose(() => {
      instance.dispose();
      onDispose();
    }, null, instance.disposables);

    return instance;
  }

  /**
   * Send a message to the preview iframe via the webview bridge.
   */
  postToPreview(msg: ExtensionToPreviewMessage): void {
    this.panel.webview.postMessage(msg);
  }

  /**
   * Register a handler for messages from the preview iframe.
   */
  onPreviewMessage(handler: (msg: PreviewToExtensionMessage) => void): vscode.Disposable {
    this.messageHandlers.push(handler);
    return new vscode.Disposable(() => {
      const idx = this.messageHandlers.indexOf(handler);
      if (idx >= 0) this.messageHandlers.splice(idx, 1);
    });
  }

  reveal(column?: vscode.ViewColumn): void {
    this.panel.reveal(column);
  }

  dispose(): void {
    this.messageHandlers.length = 0;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }

  private setHtml(serverUrl: string): void {
    this.panel.webview.html = /* html */ `<!DOCTYPE html>
<html lang="en" style="height:100%;margin:0;padding:0;">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; frame-src http://127.0.0.1:*; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
  >
  <style>
    body { margin: 0; padding: 0; height: 100vh; overflow: hidden; }
    iframe { border: none; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <iframe id="preview-frame" src="${serverUrl}" sandbox="allow-scripts allow-same-origin"></iframe>
  <script>
    (function() {
      var vscode = acquireVsCodeApi();
      var iframe = document.getElementById('preview-frame');

      // Bridge: relay canvaskit: messages between iframe and extension
      window.addEventListener('message', function(event) {
        var msg = event.data;
        if (!msg || typeof msg.type !== 'string') return;
        if (msg.type.indexOf('canvaskit:') !== 0) return;

        if (event.source === iframe.contentWindow) {
          // iframe → extension host
          vscode.postMessage(msg);
        } else {
          // extension host → iframe
          iframe.contentWindow.postMessage(msg, '*');
        }
      });
    })();
  </script>
</body>
</html>`;
  }
}
