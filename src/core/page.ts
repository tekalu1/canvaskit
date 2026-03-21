import { Document } from "./document.js";

export class PageManager {
  constructor(private doc: Document) {}

  update(
    pageId: string,
    updates: { name?: string; width?: number; height?: number | null; x?: number; y?: number }
  ): { id: string; name: string; width: number; height: number | null; x: number; y: number } {
    const page = this.doc.data.pages[pageId];
    if (!page) throw new Error(`Page "${pageId}" not found`);

    if (updates.name !== undefined) page.name = updates.name;
    if (updates.width !== undefined) page.width = updates.width;
    if ("height" in updates) page.height = updates.height!;
    if (updates.x !== undefined) page.x = updates.x;
    if (updates.y !== undefined) page.y = updates.y;

    this.doc.touch();
    return { id: pageId, name: page.name, width: page.width, height: page.height, x: page.x, y: page.y };
  }

  list(): Array<{ id: string; name: string; width: number; height: number | null; x: number; y: number; nodeCount: number }> {
    return Object.entries(this.doc.data.pages).map(([id, page]) => ({
      id,
      name: page.name,
      width: page.width,
      height: page.height,
      x: page.x,
      y: page.y,
      nodeCount: Object.keys(page.nodes).length,
    }));
  }
}
