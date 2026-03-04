import type { Variable, VariableValue, Variables } from "./schema.js";
import type { Document } from "./document.js";

export class VariableManager {
  constructor(private doc: Document) {}

  private ensureVariables(): Variables {
    if (!this.doc.data.variables) {
      this.doc.data.variables = { themeAxes: {}, definitions: {} };
    }
    return this.doc.data.variables;
  }

  /**
   * Set or update a variable definition.
   */
  set(
    name: string,
    type: Variable["type"],
    value: string,
    themeOverrides?: Record<string, string>
  ): void {
    const vars = this.ensureVariables();
    const existing = vars.definitions[name];

    if (existing) {
      // Update existing: merge the new value
      if (themeOverrides) {
        // Add/update a themed value
        const existingThemed = existing.values.find(
          (v) => v.theme && Object.entries(themeOverrides).every(([k, val]) => v.theme?.[k] === val)
        );
        if (existingThemed) {
          existingThemed.value = value;
        } else {
          existing.values.push({ value, theme: themeOverrides });
        }
      } else {
        // Update the default (non-themed) value
        const defaultVal = existing.values.find((v) => !v.theme || Object.keys(v.theme).length === 0);
        if (defaultVal) {
          defaultVal.value = value;
        } else {
          existing.values.unshift({ value });
        }
      }
    } else {
      // Create new variable
      const values: VariableValue[] = [{ value, theme: themeOverrides }];
      vars.definitions[name] = { type, values };
    }

    this.doc.touch();
  }

  /**
   * Get a variable definition by name.
   */
  get(name: string): Variable | undefined {
    return this.doc.data.variables?.definitions[name];
  }

  /**
   * Delete a variable.
   */
  delete(name: string): boolean {
    const vars = this.doc.data.variables;
    if (!vars || !vars.definitions[name]) return false;
    delete vars.definitions[name];
    this.doc.touch();
    return true;
  }

  /**
   * List all variables.
   */
  list(): Array<{ name: string; variable: Variable }> {
    const vars = this.doc.data.variables;
    if (!vars) return [];
    return Object.entries(vars.definitions).map(([name, variable]) => ({
      name,
      variable,
    }));
  }

  /**
   * Resolve a variable reference ($name) to its value for a given theme context.
   */
  resolve(name: string, themeContext?: Record<string, string>): string | undefined {
    const vars = this.doc.data.variables;
    if (!vars) return undefined;

    const variable = vars.definitions[name];
    if (!variable) return undefined;

    if (themeContext) {
      // Find the best matching themed value
      for (const val of variable.values) {
        if (val.theme && Object.entries(val.theme).every(([k, v]) => themeContext[k] === v)) {
          return val.value;
        }
      }
    }

    // Fall back to default (non-themed) value
    const defaultVal = variable.values.find((v) => !v.theme || Object.keys(v.theme).length === 0);
    return defaultVal?.value ?? variable.values[0]?.value;
  }

  /**
   * Set or update a theme axis.
   */
  setThemeAxis(name: string, values: string[]): void {
    const vars = this.ensureVariables();
    vars.themeAxes[name] = values;
    this.doc.touch();
  }

  /**
   * Get all theme axes.
   */
  getThemeAxes(): Record<string, string[]> {
    return this.doc.data.variables?.themeAxes ?? {};
  }

  /**
   * Delete a theme axis.
   */
  deleteThemeAxis(name: string): boolean {
    const vars = this.doc.data.variables;
    if (!vars || !vars.themeAxes[name]) return false;
    delete vars.themeAxes[name];
    this.doc.touch();
    return true;
  }

  /**
   * Export variables as CSS custom properties with theme variants.
   */
  toCssCustomProperties(themeContext?: Record<string, string>): string {
    const vars = this.doc.data.variables;
    if (!vars || Object.keys(vars.definitions).length === 0) return "";

    const lines: string[] = [];

    // Default values
    lines.push(":root {");
    for (const [name, variable] of Object.entries(vars.definitions)) {
      const defaultVal = variable.values.find((v) => !v.theme || Object.keys(v.theme).length === 0);
      if (defaultVal) {
        lines.push(`  --${name}: ${defaultVal.value};`);
      }
    }
    lines.push("}");

    // Theme-specific overrides
    if (vars.themeAxes) {
      for (const [axisName, axisValues] of Object.entries(vars.themeAxes)) {
        for (const axisValue of axisValues) {
          const overrides: string[] = [];
          for (const [name, variable] of Object.entries(vars.definitions)) {
            const themed = variable.values.find(
              (v) => v.theme && v.theme[axisName] === axisValue
            );
            if (themed) {
              overrides.push(`  --${name}: ${themed.value};`);
            }
          }
          if (overrides.length > 0) {
            lines.push(`[data-theme="${axisValue}"] {`);
            lines.push(...overrides);
            lines.push("}");
          }
        }
      }
    }

    return lines.join("\n");
  }
}
