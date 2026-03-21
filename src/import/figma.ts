/**
 * Figma API importer — fetches a Figma file and converts it to .canvas.json format.
 */

import { Document } from "../core/document.js";
import type { CanvasNode } from "../core/schema.js";
import {
  extractTokens,
  mapFigmaNode,
  mapFigmaComponents,
  buildComponentMap,
  resetIdCounter,
  type FigmaFile,
  type FigmaNode,
} from "./figma-mapper.js";

export interface FigmaImportOptions {
  importImages?: boolean;
  importComponents?: boolean;
  extractTokens?: boolean;
}

export interface FigmaImportResult {
  document: Document;
  pages: number;
  nodes: number;
  tokens: number;
  components: number;
}

/**
 * Fetch a Figma file via the REST API.
 */
export async function fetchFigmaFile(
  fileKey: string,
  accessToken: string,
  nodeIds?: string[]
): Promise<FigmaFile> {
  let url = `https://api.figma.com/v1/files/${fileKey}`;
  if (nodeIds && nodeIds.length > 0) {
    url += `?ids=${nodeIds.join(",")}`;
  }

  const res = await fetch(url, {
    headers: { "X-Figma-Token": accessToken },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Figma API error (${res.status}): ${body}`
    );
  }

  return (await res.json()) as FigmaFile;
}

/**
 * Count total nodes in a flat node map.
 */
function countNodes(nodes: Record<string, CanvasNode>): number {
  return Object.keys(nodes).length;
}

/**
 * Count total tokens across all categories.
 */
function countTokens(tokens: Record<string, Record<string, unknown>>): number {
  let total = 0;
  for (const cat of Object.values(tokens)) {
    total += Object.keys(cat).length;
  }
  return total;
}

/**
 * Import a Figma file and convert it to a CanvasKit Document.
 *
 * This function orchestrates the full import pipeline:
 * 1. Fetch file from Figma API
 * 2. Map Figma pages/nodes to CanvasKit format
 * 3. Extract design tokens (optional)
 * 4. Map component definitions (optional)
 */
export async function importFromFigma(
  fileKey: string,
  accessToken: string,
  nodeIds?: string[],
  options?: FigmaImportOptions
): Promise<FigmaImportResult> {
  const opts: FigmaImportOptions = {
    importImages: true,
    importComponents: true,
    extractTokens: true,
    ...options,
  };

  const figmaFile = await fetchFigmaFile(fileKey, accessToken, nodeIds);
  return convertFigmaFile(figmaFile, opts);
}

/**
 * Convert an already-fetched FigmaFile object to a CanvasKit Document.
 * Useful for testing without hitting the API.
 */
export function convertFigmaFile(
  figmaFile: FigmaFile,
  options?: FigmaImportOptions
): FigmaImportResult {
  const opts: FigmaImportOptions = {
    importImages: true,
    importComponents: true,
    extractTokens: true,
    ...options,
  };

  resetIdCounter();
  const doc = Document.create(figmaFile.name);
  // Remove default page
  doc.removePage("page1");

  const componentMap = buildComponentMap(figmaFile.components ?? {});

  // Map each top-level canvas (page) in the Figma document
  let totalNodes = 0;
  const pages = figmaFile.document.children ?? [];

  for (let i = 0; i < pages.length; i++) {
    const figmaPage = pages[i]!;
    const pageId = `page${i + 1}`;
    const nodes: Record<string, CanvasNode> = {};

    // Map all children of the page into a root frame
    const childIds: string[] = [];
    if (figmaPage.children) {
      for (const child of figmaPage.children) {
        const childId = mapFigmaNode(child, nodes, componentMap);
        childIds.push(childId);
      }
    }

    // Create root frame
    nodes["root"] = {
      type: "frame",
      name: "Root",
      clip: false,
      layout: { direction: "column" },
      children: childIds,
    };

    const width = figmaPage.absoluteBoundingBox?.width ?? 1440;

    doc.addPage(pageId, {
      name: figmaPage.name,
      width,
      height: null,
      x: 0,
      y: 0,
      nodes,
    });

    totalNodes += countNodes(nodes);
  }

  // Extract tokens
  let tokenCount = 0;
  if (opts.extractTokens) {
    const tokens = extractTokens(figmaFile.document);
    if (tokens.colors) {
      Object.assign(doc.data.tokens.colors, tokens.colors);
    }
    if (tokens.spacing) {
      Object.assign(doc.data.tokens.spacing, tokens.spacing);
    }
    tokenCount = countTokens(doc.data.tokens as Record<string, Record<string, unknown>>);
  }

  // Map components
  let componentCount = 0;
  if (opts.importComponents && figmaFile.components) {
    const components = mapFigmaComponents(figmaFile.components);
    Object.assign(doc.data.components, components);
    componentCount = Object.keys(components).length;
  }

  return {
    document: doc,
    pages: pages.length,
    nodes: totalNodes,
    tokens: tokenCount,
    components: componentCount,
  };
}
