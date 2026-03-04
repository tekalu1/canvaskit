import { describe, it, expect, vi, beforeEach } from "vitest";
import { VariableManager } from "../../src/core/variable.js";
import { createTestDocument } from "../helpers/create-test-document.js";
import type { Document } from "../../src/core/document.js";

describe("VariableManager", () => {
  let doc: Document;
  let vm: VariableManager;

  beforeEach(() => {
    doc = createTestDocument();
    vm = new VariableManager(doc);
  });

  // ----------------------------------------------------------------
  // set()
  // ----------------------------------------------------------------
  describe("set()", () => {
    it("should set a new variable", () => {
      vm.set("primary", "color", "#3b82f6");
      const v = vm.get("primary");
      expect(v).toBeDefined();
      expect(v!.type).toBe("color");
      expect(v!.values[0].value).toBe("#3b82f6");
    });

    it("should update an existing variable's default value", () => {
      vm.set("primary", "color", "#3b82f6");
      vm.set("primary", "color", "#ef4444");
      const v = vm.get("primary");
      expect(v!.values[0].value).toBe("#ef4444");
    });

    it("should set a variable with theme overrides", () => {
      vm.set("primary", "color", "#3b82f6");
      vm.set("primary", "color", "#1e293b", { mode: "dark" });
      const v = vm.get("primary");
      expect(v!.values).toHaveLength(2);
      const themed = v!.values.find((val) => val.theme?.mode === "dark");
      expect(themed).toBeDefined();
      expect(themed!.value).toBe("#1e293b");
    });

    it("should call doc.touch()", () => {
      const spy = vi.spyOn(doc, "touch");
      vm.set("spacing-sm", "spacing", "8px");
      expect(spy).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // get()
  // ----------------------------------------------------------------
  describe("get()", () => {
    it("should get an existing variable", () => {
      vm.set("primary", "color", "#3b82f6");
      const v = vm.get("primary");
      expect(v).toBeDefined();
      expect(v!.type).toBe("color");
    });

    it("should return undefined for nonexistent variable", () => {
      expect(vm.get("nonexistent")).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // delete()
  // ----------------------------------------------------------------
  describe("delete()", () => {
    it("should delete an existing variable and return true", () => {
      vm.set("primary", "color", "#3b82f6");
      const result = vm.delete("primary");
      expect(result).toBe(true);
      expect(vm.get("primary")).toBeUndefined();
    });

    it("should return false when deleting nonexistent variable", () => {
      const result = vm.delete("nonexistent");
      expect(result).toBe(false);
    });

    it("should call doc.touch() on successful delete", () => {
      vm.set("primary", "color", "#3b82f6");
      const spy = vi.spyOn(doc, "touch");
      vm.delete("primary");
      expect(spy).toHaveBeenCalled();
    });

    it("should not call doc.touch() on failed delete", () => {
      const spy = vi.spyOn(doc, "touch");
      vm.delete("nonexistent");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // list()
  // ----------------------------------------------------------------
  describe("list()", () => {
    it("should list all variables", () => {
      vm.set("primary", "color", "#3b82f6");
      vm.set("spacing-sm", "spacing", "8px");
      const list = vm.list();
      expect(list).toHaveLength(2);
      expect(list.map((item) => item.name)).toContain("primary");
      expect(list.map((item) => item.name)).toContain("spacing-sm");
    });

    it("should return empty list when no variables exist", () => {
      const list = vm.list();
      expect(list).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // setThemeAxis()
  // ----------------------------------------------------------------
  describe("setThemeAxis()", () => {
    it("should set a theme axis", () => {
      vm.setThemeAxis("mode", ["light", "dark"]);
      const axes = vm.getThemeAxes();
      expect(axes.mode).toEqual(["light", "dark"]);
    });

    it("should call doc.touch()", () => {
      const spy = vi.spyOn(doc, "touch");
      vm.setThemeAxis("mode", ["light", "dark"]);
      expect(spy).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // getThemeAxes()
  // ----------------------------------------------------------------
  describe("getThemeAxes()", () => {
    it("should get all theme axes", () => {
      vm.setThemeAxis("mode", ["light", "dark"]);
      vm.setThemeAxis("density", ["compact", "comfortable"]);
      const axes = vm.getThemeAxes();
      expect(Object.keys(axes)).toHaveLength(2);
      expect(axes.mode).toEqual(["light", "dark"]);
      expect(axes.density).toEqual(["compact", "comfortable"]);
    });

    it("should return empty object when no axes exist", () => {
      const axes = vm.getThemeAxes();
      expect(axes).toEqual({});
    });
  });

  // ----------------------------------------------------------------
  // deleteThemeAxis()
  // ----------------------------------------------------------------
  describe("deleteThemeAxis()", () => {
    it("should delete an existing theme axis and return true", () => {
      vm.setThemeAxis("mode", ["light", "dark"]);
      const result = vm.deleteThemeAxis("mode");
      expect(result).toBe(true);
      expect(vm.getThemeAxes().mode).toBeUndefined();
    });

    it("should return false when deleting nonexistent axis", () => {
      const result = vm.deleteThemeAxis("nonexistent");
      expect(result).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // resolve()
  // ----------------------------------------------------------------
  describe("resolve()", () => {
    it("should resolve a variable value", () => {
      vm.set("primary", "color", "#3b82f6");
      expect(vm.resolve("primary")).toBe("#3b82f6");
    });

    it("should resolve with theme context", () => {
      vm.set("primary", "color", "#3b82f6");
      vm.set("primary", "color", "#1e293b", { mode: "dark" });
      expect(vm.resolve("primary", { mode: "dark" })).toBe("#1e293b");
    });

    it("should fallback to default when theme context does not match", () => {
      vm.set("primary", "color", "#3b82f6");
      vm.set("primary", "color", "#1e293b", { mode: "dark" });
      expect(vm.resolve("primary", { mode: "high-contrast" })).toBe("#3b82f6");
    });

    it("should return undefined for nonexistent variable", () => {
      expect(vm.resolve("nonexistent")).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // toCssCustomProperties()
  // ----------------------------------------------------------------
  describe("toCssCustomProperties()", () => {
    it("should generate CSS custom properties", () => {
      vm.set("primary", "color", "#3b82f6");
      vm.set("spacing-sm", "spacing", "8px");
      const css = vm.toCssCustomProperties();
      expect(css).toContain(":root {");
      expect(css).toContain("--primary: #3b82f6;");
      expect(css).toContain("--spacing-sm: 8px;");
    });

    it("should include theme-specific overrides", () => {
      vm.set("primary", "color", "#3b82f6");
      vm.set("primary", "color", "#1e293b", { mode: "dark" });
      vm.setThemeAxis("mode", ["light", "dark"]);
      const css = vm.toCssCustomProperties();
      expect(css).toContain('[data-theme="dark"]');
      expect(css).toContain("--primary: #1e293b;");
    });

    it("should return empty string when no variables exist", () => {
      const css = vm.toCssCustomProperties();
      expect(css).toBe("");
    });
  });
});
