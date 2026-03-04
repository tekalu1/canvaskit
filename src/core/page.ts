import { Document } from "./document.js";

export class PageManager {
  constructor(private doc: Document) {}

  update(
    pageId: string,
    updates: { name?: string; width?: number; height?: number | null }
  ): { id: string; name: string; width: number; height: number | null } {
    const page = this.doc.data.pages[pageId];
    if (!page) throw new Error(`Page "${pageId}" not found`);

    if (updates.name !== undefined) page.name = updates.name;
    if (updates.width !== undefined) page.width = updates.width;
    if ("height" in updates) page.height = updates.height!;

    this.doc.touch();
    return { id: pageId, name: page.name, width: page.width, height: page.height };
  }

  list(): Array<{ id: string; name: string; width: number; height: number | null; nodeCount: number }> {
    return Object.entries(this.doc.data.pages).map(([id, page]) => ({
      id,
      name: page.name,
      width: page.width,
      height: page.height,
      nodeCount: Object.keys(page.nodes).length,
    }));
  }
}
