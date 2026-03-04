import * as vscode from "vscode";
import { ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import * as net from "node:net";
import {
  CFG_CLI_PATH,
  CFG_PREVIEW_PORT,
  DEFAULT_PORT,
  HEALTH_CHECK_PATH,
  HEALTH_POLL_INTERVAL_MS,
  HEALTH_POLL_TIMEOUT_MS,
  SERVER_URL_PATTERN,
} from "./constants";

interface PreviewServer {
  process: ChildProcess;
  url: string;
  port: number;
}

export class PreviewManager implements vscode.Disposable {
  private servers = new Map<string, PreviewServer>();
  private outputChannel: vscode.OutputChannel;
  private extensionPath: string;

  constructor(outputChannel: vscode.OutputChannel, extensionPath: string) {
    this.outputChannel = outputChannel;
    this.extensionPath = extensionPath;
  }

  async startPreview(filePath: string): Promise<string> {
    const existing = this.servers.get(filePath);
    if (existing) {
      return existing.url;
    }

    const cliPath = await this.resolveCliPath();
    const port = await this.getFreePort();

    this.outputChannel.appendLine(`Starting preview for ${filePath} on port ${port}`);
    this.outputChannel.appendLine(`CLI path: ${cliPath}`);

    const cwd = path.dirname(filePath);
    const child = spawn("node", [cliPath, "preview", filePath, "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      cwd,
      env: { ...process.env },
    });

    // Capture stderr early so error messages are available on fast exit
    const stderrChunks: string[] = [];
    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      stderrChunks.push(text);
      this.outputChannel.appendLine(`[stderr] ${text}`);
    });

    child.on("exit", (code) => {
      this.outputChannel.appendLine(`Preview server exited (code ${code}) for ${filePath}`);
      this.servers.delete(filePath);
    });

    const url = await this.waitForServer(child, port, stderrChunks);

    const server: PreviewServer = { process: child, url, port };
    this.servers.set(filePath, server);

    return url;
  }

  stopPreview(filePath: string): void {
    const server = this.servers.get(filePath);
    if (!server) return;

    server.process.kill();
    this.servers.delete(filePath);
    this.outputChannel.appendLine(`Stopped preview for ${filePath}`);
  }

  dispose(): void {
    for (const [filePath] of this.servers) {
      this.stopPreview(filePath);
    }
  }

  private async resolveCliPath(): Promise<string> {
    // 1. User setting
    const configured = vscode.workspace.getConfiguration().get<string>(CFG_CLI_PATH);
    if (configured) {
      return configured;
    }

    // 2. Extension's parent directory dist/index.js (dev mode — extension lives in vscode-extension/)
    const projectRoot = path.dirname(this.extensionPath);
    const extensionDevPath = path.join(projectRoot, "dist", "index.js");
    if (fs.existsSync(extensionDevPath)) {
      return extensionDevPath;
    }

    // 3. Workspace dist/index.js
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const devPath = path.join(folder.uri.fsPath, "dist", "index.js");
        if (fs.existsSync(devPath)) {
          return devPath;
        }
      }
    }

    // 4. Workspace node_modules/.bin/canvaskit
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const binPath = path.join(folder.uri.fsPath, "node_modules", ".bin", "canvaskit");
        if (fs.existsSync(binPath)) {
          return binPath;
        }
      }
    }

    // 4. Fall back to PATH
    return "canvaskit";
  }

  private getFreePort(): Promise<number> {
    const configuredPort = vscode.workspace.getConfiguration().get<number>(CFG_PREVIEW_PORT, DEFAULT_PORT);
    if (configuredPort !== 0) {
      return Promise.resolve(configuredPort);
    }

    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.listen(0, "127.0.0.1", () => {
        const addr = srv.address() as net.AddressInfo;
        const port = addr.port;
        srv.close(() => resolve(port));
      });
      srv.on("error", reject);
    });
  }

  private waitForServer(child: ChildProcess, expectedPort: number, stderrChunks: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      // Try to capture URL from stdout
      child.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        this.outputChannel.appendLine(`[stdout] ${text.trim()}`);

        if (resolved) return;
        const match = text.match(SERVER_URL_PATTERN);
        if (match) {
          resolved = true;
          resolve(`http://127.0.0.1:${match[1]}`);
        }
      });

      child.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Failed to start preview server: ${err.message}`));
        }
      });

      child.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          const detail = stderrChunks.length > 0 ? `\n${stderrChunks.join("\n")}` : "";
          reject(new Error(`Preview server exited unexpectedly with code ${code}${detail}`));
        }
      });

      // Fallback: poll health endpoint
      const startTime = Date.now();
      const poll = () => {
        if (resolved) return;
        if (Date.now() - startTime > HEALTH_POLL_TIMEOUT_MS) {
          resolved = true;
          reject(new Error("Preview server did not start within timeout"));
          return;
        }

        const req = http.get(`http://127.0.0.1:${expectedPort}${HEALTH_CHECK_PATH}`, (res) => {
          if (res.statusCode === 200 && !resolved) {
            resolved = true;
            resolve(`http://127.0.0.1:${expectedPort}`);
          } else {
            setTimeout(poll, HEALTH_POLL_INTERVAL_MS);
          }
          res.resume();
        });
        req.on("error", () => {
          setTimeout(poll, HEALTH_POLL_INTERVAL_MS);
        });
        req.end();
      };

      setTimeout(poll, HEALTH_POLL_INTERVAL_MS);
    });
  }
}
