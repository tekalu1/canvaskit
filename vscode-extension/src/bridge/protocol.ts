/**
 * PostMessage protocol between VS Code extension and preview iframe.
 *
 * All message types are prefixed with `canvaskit:` to avoid collisions
 * with other postMessage traffic.
 */

// --- Extension → Preview ---

export interface SelectNodeMessage {
  type: "canvaskit:selectNode";
  nodeId: string;
}

export interface ClearSelectionMessage {
  type: "canvaskit:clearSelection";
}

export type ExtensionToPreviewMessage =
  | SelectNodeMessage
  | ClearSelectionMessage;

// --- Preview → Extension ---

export interface NodeClickedMessage {
  type: "canvaskit:nodeClicked";
  nodeId: string;
}

export interface SelectionClearedMessage {
  type: "canvaskit:selectionCleared";
}

export interface PreviewReadyMessage {
  type: "canvaskit:ready";
}

export type PreviewToExtensionMessage =
  | NodeClickedMessage
  | SelectionClearedMessage
  | PreviewReadyMessage;

// --- Union ---

export type BridgeMessage =
  | ExtensionToPreviewMessage
  | PreviewToExtensionMessage;

/**
 * Type guard: check if a value is a valid bridge message.
 */
export function isBridgeMessage(msg: unknown): msg is BridgeMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as { type?: unknown };
  return typeof m.type === "string" && m.type.startsWith("canvaskit:");
}
