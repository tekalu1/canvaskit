import type { ComponentDefinition } from "./schema.js";
import { ComponentDefinitionSchema } from "./schema.js";
import { Document } from "./document.js";

export class ComponentRegistry {
  constructor(private doc: Document) {}

  create(name: string, definition: ComponentDefinition): void {
    const result = ComponentDefinitionSchema.safeParse(definition);
    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid component definition: ${errors}`);
    }
    this.doc.data.components[name] = result.data;
    this.doc.touch();
  }

  get(name: string): ComponentDefinition | undefined {
    return this.doc.data.components[name];
  }

  list(): Array<{
    name: string;
    description?: string;
    variantCount: number;
    propsCount: number;
  }> {
    return Object.entries(this.doc.data.components).map(([name, def]) => ({
      name,
      description: def.description,
      variantCount: Object.keys(def.variants).length,
      propsCount: def.props.length,
    }));
  }

  delete(name: string): boolean {
    if (!(name in this.doc.data.components)) return false;
    delete this.doc.data.components[name];
    this.doc.touch();
    return true;
  }
}
