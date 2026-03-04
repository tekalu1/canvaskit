import { describe, it, expect } from "vitest";
import { validateStyles, autoFixStyles } from "../../src/core/style-validator.js";

describe("validateStyles", () => {
  // ── Known properties produce no warnings ──────────────────
  it("should produce no warnings for known properties", () => {
    const warnings = validateStyles({
      backgroundColor: "#fff",
      fontSize: "14px",
      fontWeight: "bold",
      padding: "8px",
      display: "flex",
    });
    expect(warnings).toEqual([]);
  });

  it("should produce no warnings for empty styles", () => {
    const warnings = validateStyles({});
    expect(warnings).toEqual([]);
  });

  // ── Common typos are detected ─────────────────────────────
  it("should detect backgroundColor typo (backgroudColor)", () => {
    const warnings = validateStyles({ backgroudColor: "#f00" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].property).toBe("backgroudColor");
    expect(warnings[0].suggestion).toBe("backgroundColor");
    expect(warnings[0].message).toContain("Did you mean");
  });

  it("should detect backgroundColor typo (backgroundcolor)", () => {
    const warnings = validateStyles({ backgroundcolor: "#f00" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].suggestion).toBe("backgroundColor");
  });

  it("should detect bgcolor shorthand typo", () => {
    const warnings = validateStyles({ bgcolor: "#f00" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].suggestion).toBe("backgroundColor");
  });

  it("should detect fontSize typo (fontsize)", () => {
    const warnings = validateStyles({ fontsize: "14px" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].suggestion).toBe("fontSize");
  });

  it("should detect fontWeight typo (fontweight)", () => {
    const warnings = validateStyles({ fontweight: "bold" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].suggestion).toBe("fontWeight");
  });

  it("should detect borderRadius typo (borderradius)", () => {
    const warnings = validateStyles({ borderradius: "8px" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].suggestion).toBe("borderRadius");
  });

  it("should detect zIndex typo (zindex)", () => {
    const warnings = validateStyles({ zindex: 10 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].suggestion).toBe("zIndex");
  });

  it("should detect fontwieght typo", () => {
    const warnings = validateStyles({ fontwieght: "bold" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].suggestion).toBe("fontWeight");
  });

  // ── Multiple typos in one call ────────────────────────────
  it("should detect multiple typos at once", () => {
    const warnings = validateStyles({
      backgroundcolor: "#fff",
      fontsize: "14px",
      zindex: 5,
    });
    expect(warnings).toHaveLength(3);
    const suggestions = warnings.map((w) => w.suggestion);
    expect(suggestions).toContain("backgroundColor");
    expect(suggestions).toContain("fontSize");
    expect(suggestions).toContain("zIndex");
  });

  // ── Unknown (non-typo) properties produce no warnings ─────
  it("should not warn about truly custom properties", () => {
    const warnings = validateStyles({
      myCustomProp: "value",
      dataTestId: "test",
      gridArea: "main",
    });
    expect(warnings).toEqual([]);
  });

  // ── Mixed: known + typo + custom ─────────────────────────
  it("should only warn about typos in a mix of property types", () => {
    const warnings = validateStyles({
      backgroundColor: "#fff",  // known - no warning
      fontsize: "14px",         // typo  - warning
      myCustomProp: "value",    // custom - no warning
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].property).toBe("fontsize");
    expect(warnings[0].suggestion).toBe("fontSize");
  });

  // ── Case-insensitive typo matching ────────────────────────
  it("should match typos case-insensitively", () => {
    const warnings = validateStyles({ FontSize: "14px" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].suggestion).toBe("fontSize");
  });

  it("should match BGCOLOR case-insensitively", () => {
    const warnings = validateStyles({ BGCOLOR: "#f00" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].suggestion).toBe("backgroundColor");
  });
});

describe("autoFixStyles", () => {
  it("should fix known typos and return fixes list", () => {
    const { fixed, fixes } = autoFixStyles({
      backgroudcolor: "#f00",
      fontsize: "14px",
    });
    expect(fixed).toEqual({
      backgroundColor: "#f00",
      fontSize: "14px",
    });
    expect(fixes).toHaveLength(2);
    expect(fixes).toContainEqual({ original: "backgroudcolor", corrected: "backgroundColor" });
    expect(fixes).toContainEqual({ original: "fontsize", corrected: "fontSize" });
  });

  it("should preserve values when keys are renamed", () => {
    const { fixed, fixes } = autoFixStyles({
      bgcolor: "rgba(255, 0, 0, 0.5)",
      fontwieght: 700,
    });
    expect(fixed.backgroundColor).toBe("rgba(255, 0, 0, 0.5)");
    expect(fixed.fontWeight).toBe(700);
    expect(fixes).toHaveLength(2);
  });

  it("should leave non-typo properties unchanged", () => {
    const { fixed, fixes } = autoFixStyles({
      backgroundColor: "#fff",
      myCustomProp: "value",
      padding: "8px",
    });
    expect(fixed).toEqual({
      backgroundColor: "#fff",
      myCustomProp: "value",
      padding: "8px",
    });
    expect(fixes).toEqual([]);
  });

  it("should return empty fixes for empty styles", () => {
    const { fixed, fixes } = autoFixStyles({});
    expect(fixed).toEqual({});
    expect(fixes).toEqual([]);
  });

  it("should fix typos case-insensitively", () => {
    const { fixed, fixes } = autoFixStyles({ FontSize: "16px" });
    expect(fixed).toEqual({ fontSize: "16px" });
    expect(fixes).toEqual([{ original: "FontSize", corrected: "fontSize" }]);
  });

  it("should handle mix of known, typo, and custom properties", () => {
    const { fixed, fixes } = autoFixStyles({
      backgroundColor: "#fff",
      fontsize: "14px",
      myCustomProp: "value",
    });
    expect(fixed).toEqual({
      backgroundColor: "#fff",
      fontSize: "14px",
      myCustomProp: "value",
    });
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toEqual({ original: "fontsize", corrected: "fontSize" });
  });

  it("should fix multiple typos at once", () => {
    const { fixed, fixes } = autoFixStyles({
      backgroundcolor: "#fff",
      fontsize: "14px",
      zindex: 5,
      borderradius: "4px",
    });
    expect(fixed).toEqual({
      backgroundColor: "#fff",
      fontSize: "14px",
      zIndex: 5,
      borderRadius: "4px",
    });
    expect(fixes).toHaveLength(4);
  });
});
