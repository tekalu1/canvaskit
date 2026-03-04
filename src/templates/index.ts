import type { CanvasDocument } from "../core/schema.js";
import { buildLandingPage } from "./landing.js";

export interface Template {
  name: string;
  description: string;
  build: () => CanvasDocument;
}

const templates = new Map<string, Template>();

export function registerTemplate(template: Template): void {
  templates.set(template.name, template);
}

export function getTemplate(name: string): Template | undefined {
  return templates.get(name);
}

export function listTemplates(): Array<{ name: string; description: string }> {
  return Array.from(templates.values()).map((t) => ({
    name: t.name,
    description: t.description,
  }));
}

// Register built-in templates
registerTemplate({
  name: "landing",
  description: "Landing page with navbar, hero, features, and CTA sections",
  build: buildLandingPage,
});
