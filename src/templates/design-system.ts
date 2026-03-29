import type { CanvasDocument } from "../core/schema.js";

// ── Local Helpers ────────────────────────────────────────────
type FrameOpts = {
  name: string;
  layout?: Record<string, unknown>;
  children?: string[];
  styles?: Record<string, unknown>;
  clip?: boolean;
  effects?: Array<Record<string, unknown>>;
};

function makeFrame(id: string, opts: FrameOpts): [string, Record<string, unknown>] {
  return [
    id,
    {
      type: "frame" as const,
      name: opts.name,
      clip: opts.clip ?? false,
      layout: opts.layout ?? { direction: "column" },
      children: opts.children ?? [],
      styles: opts.styles ?? {},
      ...(opts.effects ? { effects: opts.effects } : {}),
    },
  ];
}

function makeText(
  id: string,
  name: string,
  content: string,
  styles?: Record<string, unknown>,
): [string, Record<string, unknown>] {
  return [id, { type: "text" as const, name, content, styles: styles ?? {} }];
}

function makeIcon(
  id: string,
  name: string,
  icon: string,
  styles?: Record<string, unknown>,
): [string, Record<string, unknown>] {
  return [id, { type: "icon" as const, name, icon, styles: styles ?? {} }];
}

// ── Page Builder Helpers ─────────────────────────────────────
function pageShell(
  prefix: string,
  title: string,
  description: string,
  contentChildren: string[],
  extraNodes: Array<[string, Record<string, unknown>]>,
): Record<string, Record<string, unknown>> {
  const rootId = "root";
  const titleId = `${prefix}-title`;
  const descId = `${prefix}-desc`;
  const contentId = `${prefix}-content`;

  return Object.fromEntries([
    makeFrame(rootId, {
      name: "Root",
      layout: { direction: "column", gap: "32px" },
      children: [titleId, descId, contentId],
      styles: { backgroundColor: "{colors.background}", padding: "48px" },
    }),
    makeText(titleId, "Page Title", title, {
      fontSize: "40px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeText(descId, "Page Description", description, {
      fontSize: "16px",
      color: "{colors.text-muted}",
    }),
    makeFrame(contentId, {
      name: "Content Area",
      layout: { direction: "column", gap: "24px" },
      children: contentChildren,
      styles: { width: "100%" },
    }),
    ...extraNodes,
  ]);
}

// ── Color Palette Page (page1) ───────────────────────────────
function buildColorPalettePage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const sectionIds: string[] = [];

  // Primary / Secondary / Accent section
  const brandColors = [
    { key: "primary", label: "Primary", color: "{colors.primary}" },
    { key: "secondary", label: "Secondary", color: "{colors.secondary}" },
    { key: "accent", label: "Accent", color: "{colors.accent}" },
  ];

  const brandSwatchIds: string[] = [];
  for (const c of brandColors) {
    const swatchId = `cp-swatch-${c.key}`;
    const labelId = `cp-label-${c.key}`;
    const groupId = `cp-group-${c.key}`;
    nodes.push(
      makeFrame(groupId, {
        name: `${c.label} Group`,
        layout: { direction: "column", gap: "8px", align: "center" },
        children: [swatchId, labelId],
        styles: {},
      }),
      makeFrame(swatchId, {
        name: `${c.label} Swatch`,
        layout: { direction: "column" },
        children: [],
        styles: { backgroundColor: c.color, width: "80px", height: "80px", borderRadius: "8px" },
      }),
      makeText(labelId, `${c.label} Label`, c.label, {
        fontSize: "14px",
        color: "{colors.text}",
      }),
    );
    brandSwatchIds.push(groupId);
  }

  const brandSectionId = "cp-brand-section";
  nodes.push(
    makeFrame(brandSectionId, {
      name: "Brand Colors",
      layout: { direction: "row", gap: "24px", wrap: true },
      children: brandSwatchIds,
      styles: { width: "100%" },
    }),
  );
  sectionIds.push(brandSectionId);

  // Semantic colors
  const semanticColors = [
    { key: "success", label: "Success", color: "{colors.success}" },
    { key: "warning", label: "Warning", color: "{colors.warning}" },
    { key: "error", label: "Error", color: "{colors.error}" },
    { key: "info", label: "Info", color: "{colors.info}" },
  ];

  const semanticSwatchIds: string[] = [];
  for (const c of semanticColors) {
    const swatchId = `cp-swatch-${c.key}`;
    const labelId = `cp-label-${c.key}`;
    const groupId = `cp-group-${c.key}`;
    nodes.push(
      makeFrame(groupId, {
        name: `${c.label} Group`,
        layout: { direction: "column", gap: "8px", align: "center" },
        children: [swatchId, labelId],
        styles: {},
      }),
      makeFrame(swatchId, {
        name: `${c.label} Swatch`,
        layout: { direction: "column" },
        children: [],
        styles: { backgroundColor: c.color, width: "80px", height: "80px", borderRadius: "8px" },
      }),
      makeText(labelId, `${c.label} Label`, c.label, {
        fontSize: "14px",
        color: "{colors.text}",
      }),
    );
    semanticSwatchIds.push(groupId);
  }

  const semanticSectionId = "cp-semantic-section";
  nodes.push(
    makeFrame(semanticSectionId, {
      name: "Semantic Colors",
      layout: { direction: "row", gap: "24px", wrap: true },
      children: semanticSwatchIds,
      styles: { width: "100%" },
    }),
  );
  sectionIds.push(semanticSectionId);

  // Neutral scale
  const neutralKeys = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
  const neutralSwatchIds: string[] = [];
  for (const n of neutralKeys) {
    const swatchId = `cp-swatch-neutral-${n}`;
    const labelId = `cp-label-neutral-${n}`;
    const groupId = `cp-group-neutral-${n}`;
    nodes.push(
      makeFrame(groupId, {
        name: `Neutral ${n} Group`,
        layout: { direction: "column", gap: "8px", align: "center" },
        children: [swatchId, labelId],
        styles: {},
      }),
      makeFrame(swatchId, {
        name: `Neutral ${n} Swatch`,
        layout: { direction: "column" },
        children: [],
        styles: {
          backgroundColor: `{colors.neutral-${n}}`,
          width: "60px",
          height: "60px",
          borderRadius: "8px",
        },
      }),
      makeText(labelId, `Neutral ${n} Label`, n, {
        fontSize: "14px",
        color: "{colors.text}",
      }),
    );
    neutralSwatchIds.push(groupId);
  }

  const neutralSectionId = "cp-neutral-section";
  nodes.push(
    makeFrame(neutralSectionId, {
      name: "Neutral Scale",
      layout: { direction: "row", gap: "16px", wrap: true },
      children: neutralSwatchIds,
      styles: { width: "100%" },
    }),
  );
  sectionIds.push(neutralSectionId);

  return pageShell("cp", "Color Palette", "Brand, semantic, and neutral color tokens.", sectionIds, nodes);
}

// ── Typography Page (page2) ──────────────────────────────────
function buildTypographyPage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const itemIds: string[] = [];

  const typoEntries = [
    { key: "h1", label: "Heading 1", size: "48px", weight: "bold" },
    { key: "h2", label: "Heading 2", size: "36px", weight: "bold" },
    { key: "h3", label: "Heading 3", size: "30px", weight: "semibold" },
    { key: "h4", label: "Heading 4", size: "24px", weight: "semibold" },
    { key: "h5", label: "Heading 5", size: "20px", weight: "semibold" },
    { key: "h6", label: "Heading 6", size: "16px", weight: "semibold" },
    { key: "body", label: "Body Text", size: "16px", weight: "normal" },
    { key: "caption", label: "Caption", size: "14px", weight: "normal" },
    { key: "link", label: "Link Text", size: "16px", weight: "normal" },
  ];

  for (const t of typoEntries) {
    const sampleId = `ty-sample-${t.key}`;
    const labelId = `ty-label-${t.key}`;
    const rowId = `ty-row-${t.key}`;

    const sampleStyles: Record<string, unknown> = {
      fontSize: t.size,
      fontWeight: t.weight,
      color: "{colors.text}",
    };
    if (t.key === "link") {
      sampleStyles.color = "{colors.primary}";
    }

    nodes.push(
      makeFrame(rowId, {
        name: `${t.label} Row`,
        layout: { direction: "column", gap: "4px" },
        children: [labelId, sampleId],
        styles: { padding: "8px" },
      }),
      makeText(labelId, `${t.label} Label`, `${t.label} — ${t.size} / ${t.weight}`, {
        fontSize: "14px",
        color: "{colors.text-muted}",
      }),
      makeText(sampleId, `${t.label} Sample`, `The quick brown fox jumps over the lazy dog`, sampleStyles),
    );
    itemIds.push(rowId);
  }

  return pageShell("ty", "Typography", "Typography scale and text styles.", itemIds, nodes);
}

// ── Spacing & Sizing Page (page3) ────────────────────────────
function buildSpacingPage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const itemIds: string[] = [];

  const spacingEntries = [
    { key: "2xs", size: "2px" },
    { key: "xs", size: "4px" },
    { key: "sm", size: "8px" },
    { key: "md", size: "16px" },
    { key: "lg", size: "24px" },
    { key: "xl", size: "32px" },
    { key: "2xl", size: "48px" },
    { key: "3xl", size: "64px" },
  ];

  for (const s of spacingEntries) {
    const barId = `sp-bar-${s.key}`;
    const labelId = `sp-label-${s.key}`;
    const rowId = `sp-row-${s.key}`;
    nodes.push(
      makeFrame(rowId, {
        name: `Spacing ${s.key} Row`,
        layout: { direction: "row", gap: "16px", align: "center" },
        children: [labelId, barId],
        styles: {},
      }),
      makeText(labelId, `Spacing ${s.key} Label`, `${s.key} (${s.size})`, {
        fontSize: "14px",
        color: "{colors.text}",
        width: "120px",
      }),
      makeFrame(barId, {
        name: `Spacing ${s.key} Bar`,
        layout: { direction: "column" },
        children: [],
        styles: {
          backgroundColor: "{colors.primary}",
          width: s.size,
          height: s.size,
          borderRadius: "4px",
        },
      }),
    );
    itemIds.push(rowId);
  }

  return pageShell("sp", "Spacing & Sizing", "Spacing scale from 2px to 64px.", itemIds, nodes);
}

// ── Border Radius & Shadows Page (page4) ─────────────────────
function buildBorderRadiusShadowsPage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const sectionIds: string[] = [];

  // Border Radius section
  const radiusEntries = [
    { key: "none", value: "0px" },
    { key: "sm", value: "4px" },
    { key: "md", value: "8px" },
    { key: "lg", value: "12px" },
    { key: "xl", value: "16px" },
    { key: "full", value: "9999px" },
  ];

  const radiusItemIds: string[] = [];
  for (const r of radiusEntries) {
    const boxId = `br-radius-${r.key}`;
    const labelId = `br-radius-label-${r.key}`;
    const groupId = `br-radius-group-${r.key}`;
    nodes.push(
      makeFrame(groupId, {
        name: `Radius ${r.key} Group`,
        layout: { direction: "column", gap: "8px", align: "center" },
        children: [boxId, labelId],
        styles: {},
      }),
      makeFrame(boxId, {
        name: `Radius ${r.key}`,
        layout: { direction: "column" },
        children: [],
        styles: {
          backgroundColor: "{colors.primary}",
          width: "80px",
          height: "80px",
          borderRadius: r.value,
        },
      }),
      makeText(labelId, `Radius ${r.key} Label`, `${r.key} (${r.value})`, {
        fontSize: "14px",
        color: "{colors.text}",
      }),
    );
    radiusItemIds.push(groupId);
  }

  const radiusSectionId = "br-radius-section";
  nodes.push(
    makeFrame(radiusSectionId, {
      name: "Border Radius",
      layout: { direction: "row", gap: "24px", wrap: true },
      children: radiusItemIds,
      styles: { width: "100%" },
    }),
  );
  sectionIds.push(radiusSectionId);

  // Shadows section
  const shadowEntries = [
    {
      key: "sm",
      label: "Small",
      effect: { type: "shadow", offsetX: "0", offsetY: "1px", blur: "2px", spread: "0", color: "rgba(0,0,0,0.05)" },
    },
    {
      key: "md",
      label: "Medium",
      effect: { type: "shadow", offsetX: "0", offsetY: "4px", blur: "6px", spread: "-1px", color: "rgba(0,0,0,0.1)" },
    },
    {
      key: "lg",
      label: "Large",
      effect: { type: "shadow", offsetX: "0", offsetY: "10px", blur: "15px", spread: "-3px", color: "rgba(0,0,0,0.1)" },
    },
  ];

  const shadowItemIds: string[] = [];
  for (const s of shadowEntries) {
    const boxId = `br-shadow-${s.key}`;
    const labelId = `br-shadow-label-${s.key}`;
    const groupId = `br-shadow-group-${s.key}`;
    nodes.push(
      makeFrame(groupId, {
        name: `Shadow ${s.label} Group`,
        layout: { direction: "column", gap: "8px", align: "center" },
        children: [boxId, labelId],
        styles: {},
      }),
      makeFrame(boxId, {
        name: `Shadow ${s.label}`,
        layout: { direction: "column" },
        children: [],
        styles: {
          backgroundColor: "{colors.background}",
          width: "120px",
          height: "80px",
          borderRadius: "8px",
        },
        effects: [s.effect],
      }),
      makeText(labelId, `Shadow ${s.label} Label`, `${s.key}`, {
        fontSize: "14px",
        color: "{colors.text}",
      }),
    );
    shadowItemIds.push(groupId);
  }

  const shadowSectionId = "br-shadow-section";
  nodes.push(
    makeFrame(shadowSectionId, {
      name: "Shadows",
      layout: { direction: "row", gap: "24px", wrap: true },
      children: shadowItemIds,
      styles: { width: "100%" },
    }),
  );
  sectionIds.push(shadowSectionId);

  return pageShell("br", "Border Radius & Shadows", "Corner radius and shadow variations.", sectionIds, nodes);
}

// ── Icons Page (page5) ───────────────────────────────────────
function buildIconsPage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const itemIds: string[] = [];

  const icons = [
    { key: "home", icon: "lucide:home", label: "Home" },
    { key: "settings", icon: "lucide:settings", label: "Settings" },
    { key: "user", icon: "lucide:user", label: "User" },
    { key: "search", icon: "lucide:search", label: "Search" },
    { key: "heart", icon: "lucide:heart", label: "Heart" },
    { key: "star", icon: "lucide:star", label: "Star" },
    { key: "mail", icon: "lucide:mail", label: "Mail" },
    { key: "bell", icon: "lucide:bell", label: "Bell" },
    { key: "camera", icon: "lucide:camera", label: "Camera" },
    { key: "trash", icon: "lucide:trash", label: "Trash" },
    { key: "edit", icon: "lucide:edit", label: "Edit" },
    { key: "plus", icon: "lucide:plus", label: "Plus" },
  ];

  for (const ic of icons) {
    const iconId = `ic-icon-${ic.key}`;
    const labelId = `ic-label-${ic.key}`;
    const groupId = `ic-group-${ic.key}`;
    nodes.push(
      makeFrame(groupId, {
        name: `${ic.label} Icon Group`,
        layout: { direction: "column", gap: "8px", align: "center" },
        children: [iconId, labelId],
        styles: { padding: "16px" },
      }),
      makeIcon(iconId, `${ic.label} Icon`, ic.icon, {
        color: "{colors.text}",
        width: "24px",
        height: "24px",
      }),
      makeText(labelId, `${ic.label} Label`, ic.label, {
        fontSize: "14px",
        color: "{colors.text-muted}",
      }),
    );
    itemIds.push(groupId);
  }

  const gridId = "ic-grid";
  nodes.push(
    makeFrame(gridId, {
      name: "Icons Grid",
      layout: { direction: "row", gap: "16px", wrap: true },
      children: itemIds,
      styles: { width: "100%" },
    }),
  );

  return pageShell("ic", "Icons", "Lucide icon set samples.", [gridId], nodes);
}

// ── Buttons Page (page6) ─────────────────────────────────────
function buildButtonsPage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const sectionIds: string[] = [];

  const variants = [
    {
      key: "primary",
      label: "Primary",
      bg: "{colors.primary}",
      color: "{colors.background}",
      border: false,
    },
    {
      key: "secondary",
      label: "Secondary",
      bg: "transparent",
      color: "{colors.primary}",
      border: true,
    },
    {
      key: "ghost",
      label: "Ghost",
      bg: "transparent",
      color: "{colors.text}",
      border: false,
    },
    {
      key: "destructive",
      label: "Destructive",
      bg: "{colors.error}",
      color: "{colors.background}",
      border: false,
    },
  ];

  const sizes = [
    { key: "sm", label: "Small", fontSize: "14px", padding: "6px", paddingX: "12px" },
    { key: "md", label: "Medium", fontSize: "14px", padding: "8px", paddingX: "16px" },
    { key: "lg", label: "Large", fontSize: "16px", padding: "12px", paddingX: "24px" },
  ];

  for (const v of variants) {
    const btnIds: string[] = [];
    for (const s of sizes) {
      const btnId = `bt-${v.key}-${s.key}`;
      const styles: Record<string, unknown> = {
        fontSize: s.fontSize,
        fontWeight: "semibold",
        color: v.color,
        backgroundColor: v.bg,
        padding: s.padding,
        paddingX: s.paddingX,
        borderRadius: "8px",
      };
      if (v.border) {
        styles.borderWidth = "1px";
        styles.borderColor = "{colors.primary}";
      }
      nodes.push(makeText(btnId, `${v.label} ${s.label} Button`, `${v.label} ${s.label}`, styles));
      btnIds.push(btnId);
    }

    const rowId = `bt-row-${v.key}`;
    const labelId = `bt-label-${v.key}`;
    const sectionId = `bt-section-${v.key}`;
    nodes.push(
      makeText(labelId, `${v.label} Label`, v.label, {
        fontSize: "16px",
        fontWeight: "semibold",
        color: "{colors.text}",
      }),
      makeFrame(rowId, {
        name: `${v.label} Buttons Row`,
        layout: { direction: "row", gap: "16px", align: "center" },
        children: btnIds,
        styles: {},
      }),
      makeFrame(sectionId, {
        name: `${v.label} Section`,
        layout: { direction: "column", gap: "12px" },
        children: [labelId, rowId],
        styles: {},
      }),
    );
    sectionIds.push(sectionId);
  }

  return pageShell("bt", "Buttons", "Button variants and sizes.", sectionIds, nodes);
}

// ── Form Elements Page (page7) ───────────────────────────────
function buildFormElementsPage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const sectionIds: string[] = [];

  // Input
  const inputId = "fe-input";
  const inputTextId = "fe-input-text";
  const inputLabelId = "fe-input-label";
  const inputSectionId = "fe-input-section";
  nodes.push(
    makeText(inputLabelId, "Input Label", "Input", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeFrame(inputId, {
      name: "Input Field",
      layout: { direction: "row", align: "center" },
      children: [inputTextId],
      styles: {
        borderWidth: "1px",
        borderColor: "{colors.border}",
        borderRadius: "8px",
        padding: "10px",
        paddingX: "14px",
        width: "320px",
      },
    }),
    makeText(inputTextId, "Input Placeholder", "Enter text...", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
    makeFrame(inputSectionId, {
      name: "Input Section",
      layout: { direction: "column", gap: "8px" },
      children: [inputLabelId, inputId],
      styles: {},
    }),
  );
  sectionIds.push(inputSectionId);

  // Select
  const selectId = "fe-select";
  const selectTextId = "fe-select-text";
  const selectIconId = "fe-select-icon";
  const selectLabelId = "fe-select-label";
  const selectSectionId = "fe-select-section";
  nodes.push(
    makeText(selectLabelId, "Select Label", "Select", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeFrame(selectId, {
      name: "Select Field",
      layout: { direction: "row", align: "center", justify: "between" },
      children: [selectTextId, selectIconId],
      styles: {
        borderWidth: "1px",
        borderColor: "{colors.border}",
        borderRadius: "8px",
        padding: "10px",
        paddingX: "14px",
        width: "320px",
      },
    }),
    makeText(selectTextId, "Select Placeholder", "Choose option...", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
    makeIcon(selectIconId, "Chevron Down", "lucide:chevron-down", {
      color: "{colors.text-muted}",
      width: "16px",
      height: "16px",
    }),
    makeFrame(selectSectionId, {
      name: "Select Section",
      layout: { direction: "column", gap: "8px" },
      children: [selectLabelId, selectId],
      styles: {},
    }),
  );
  sectionIds.push(selectSectionId);

  // Checkbox
  const checkboxId = "fe-checkbox";
  const checkboxBoxId = "fe-checkbox-box";
  const checkboxIconId = "fe-checkbox-icon";
  const checkboxTextId = "fe-checkbox-text";
  const checkboxLabelId = "fe-checkbox-label";
  const checkboxSectionId = "fe-checkbox-section";
  nodes.push(
    makeText(checkboxLabelId, "Checkbox Label", "Checkbox", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeFrame(checkboxId, {
      name: "Checkbox",
      layout: { direction: "row", gap: "8px", align: "center" },
      children: [checkboxBoxId, checkboxTextId],
      styles: {},
    }),
    makeFrame(checkboxBoxId, {
      name: "Checkbox Box",
      layout: { direction: "column", align: "center", justify: "center" },
      children: [checkboxIconId],
      styles: {
        width: "20px",
        height: "20px",
        borderWidth: "1px",
        borderColor: "{colors.primary}",
        borderRadius: "4px",
        backgroundColor: "{colors.primary}",
      },
    }),
    makeIcon(checkboxIconId, "Check Icon", "lucide:check", {
      color: "{colors.background}",
      width: "14px",
      height: "14px",
    }),
    makeText(checkboxTextId, "Checkbox Text", "Accept terms and conditions", {
      fontSize: "14px",
      color: "{colors.text}",
    }),
    makeFrame(checkboxSectionId, {
      name: "Checkbox Section",
      layout: { direction: "column", gap: "8px" },
      children: [checkboxLabelId, checkboxId],
      styles: {},
    }),
  );
  sectionIds.push(checkboxSectionId);

  // Radio
  const radioId = "fe-radio";
  const radioBoxId = "fe-radio-box";
  const radioDotId = "fe-radio-dot";
  const radioTextId = "fe-radio-text";
  const radioLabelId = "fe-radio-label";
  const radioSectionId = "fe-radio-section";
  nodes.push(
    makeText(radioLabelId, "Radio Label", "Radio", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeFrame(radioId, {
      name: "Radio",
      layout: { direction: "row", gap: "8px", align: "center" },
      children: [radioBoxId, radioTextId],
      styles: {},
    }),
    makeFrame(radioBoxId, {
      name: "Radio Box",
      layout: { direction: "column", align: "center", justify: "center" },
      children: [radioDotId],
      styles: {
        width: "20px",
        height: "20px",
        borderWidth: "1px",
        borderColor: "{colors.primary}",
        borderRadius: "50%",
      },
    }),
    makeFrame(radioDotId, {
      name: "Radio Dot",
      layout: { direction: "column" },
      children: [],
      styles: {
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: "{colors.primary}",
      },
    }),
    makeText(radioTextId, "Radio Text", "Option A", {
      fontSize: "14px",
      color: "{colors.text}",
    }),
    makeFrame(radioSectionId, {
      name: "Radio Section",
      layout: { direction: "column", gap: "8px" },
      children: [radioLabelId, radioId],
      styles: {},
    }),
  );
  sectionIds.push(radioSectionId);

  return pageShell("fe", "Form Elements", "Input, select, checkbox, and radio components.", sectionIds, nodes);
}

// ── Cards Page (page8) ───────────────────────────────────────
function buildCardsPage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const cardIds: string[] = [];

  // Basic card
  const basicCardId = "cd-basic";
  const basicTitleId = "cd-basic-title";
  const basicBodyId = "cd-basic-body";
  nodes.push(
    makeFrame(basicCardId, {
      name: "Basic Card",
      layout: { direction: "column", gap: "12px" },
      children: [basicTitleId, basicBodyId],
      styles: {
        borderWidth: "1px",
        borderColor: "{colors.border}",
        borderRadius: "12px",
        padding: "24px",
        width: "320px",
      },
    }),
    makeText(basicTitleId, "Card Title", "Basic Card", {
      fontSize: "18px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeText(basicBodyId, "Card Body", "This is a basic card with a title and body text.", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
  );
  cardIds.push(basicCardId);

  // Image card
  const imageCardId = "cd-image";
  const imageAreaId = "cd-image-area";
  const imageIconId = "cd-image-icon";
  const imageTitleId = "cd-image-title";
  const imageBodyId = "cd-image-body";
  nodes.push(
    makeFrame(imageCardId, {
      name: "Image Card",
      layout: { direction: "column", gap: "12px" },
      children: [imageAreaId, imageTitleId, imageBodyId],
      styles: {
        borderWidth: "1px",
        borderColor: "{colors.border}",
        borderRadius: "12px",
        padding: "24px",
        width: "320px",
      },
    }),
    makeFrame(imageAreaId, {
      name: "Image Area",
      layout: { direction: "column", align: "center", justify: "center" },
      children: [imageIconId],
      styles: {
        backgroundColor: "{colors.surface}",
        height: "160px",
        borderRadius: "8px",
      },
    }),
    makeIcon(imageIconId, "Image Placeholder Icon", "lucide:image", {
      color: "{colors.text-muted}",
      width: "32px",
      height: "32px",
    }),
    makeText(imageTitleId, "Image Card Title", "Image Card", {
      fontSize: "18px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeText(imageBodyId, "Image Card Body", "A card with an image placeholder area.", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
  );
  cardIds.push(imageCardId);

  // Status card
  const statusCardId = "cd-status";
  const statusHeaderId = "cd-status-header";
  const statusIconId = "cd-status-icon";
  const statusTitleId = "cd-status-title";
  const statusBodyId = "cd-status-body";
  const statusBadgeId = "cd-status-badge";
  nodes.push(
    makeFrame(statusCardId, {
      name: "Status Card",
      layout: { direction: "column", gap: "12px" },
      children: [statusHeaderId, statusBodyId, statusBadgeId],
      styles: {
        borderWidth: "1px",
        borderColor: "{colors.border}",
        borderRadius: "12px",
        padding: "24px",
        width: "320px",
      },
    }),
    makeFrame(statusHeaderId, {
      name: "Status Header",
      layout: { direction: "row", gap: "8px", align: "center" },
      children: [statusIconId, statusTitleId],
      styles: {},
    }),
    makeIcon(statusIconId, "Status Icon", "lucide:check-circle", {
      color: "{colors.success}",
      width: "20px",
      height: "20px",
    }),
    makeText(statusTitleId, "Status Card Title", "Status Card", {
      fontSize: "18px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeText(statusBodyId, "Status Card Body", "A card with status icon and badge.", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
    makeText(statusBadgeId, "Status Badge", "Active", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.background}",
      backgroundColor: "{colors.success}",
      padding: "4px",
      paddingX: "10px",
      borderRadius: "9999px",
    }),
  );
  cardIds.push(statusCardId);

  const gridId = "cd-grid";
  nodes.push(
    makeFrame(gridId, {
      name: "Cards Grid",
      layout: { direction: "row", gap: "24px", wrap: true },
      children: cardIds,
      styles: { width: "100%" },
    }),
  );

  return pageShell("cd", "Cards", "Card component variations.", [gridId], nodes);
}

// ── Navigation Page (page9) ──────────────────────────────────
function buildNavigationPage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const sectionIds: string[] = [];

  // Navbar
  const navbarId = "nv-navbar";
  const navLogoId = "nv-navbar-logo";
  const navLinksId = "nv-navbar-links";
  const navLink1Id = "nv-navbar-link1";
  const navLink2Id = "nv-navbar-link2";
  const navLink3Id = "nv-navbar-link3";
  nodes.push(
    makeFrame(navbarId, {
      name: "Navbar",
      layout: { direction: "row", justify: "between", align: "center" },
      children: [navLogoId, navLinksId],
      styles: {
        padding: "16px",
        paddingX: "24px",
        borderWidth: "1px",
        borderColor: "{colors.border}",
        borderRadius: "8px",
      },
    }),
    makeText(navLogoId, "Nav Logo", "Logo", {
      fontSize: "18px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeFrame(navLinksId, {
      name: "Nav Links",
      layout: { direction: "row", gap: "24px", align: "center" },
      children: [navLink1Id, navLink2Id, navLink3Id],
      styles: {},
    }),
    makeText(navLink1Id, "Nav Link 1", "Home", {
      fontSize: "14px",
      color: "{colors.text}",
    }),
    makeText(navLink2Id, "Nav Link 2", "About", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
    makeText(navLink3Id, "Nav Link 3", "Contact", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
  );
  sectionIds.push(navbarId);

  // Tabs
  const tabsId = "nv-tabs";
  const tab1Id = "nv-tab-1";
  const tab2Id = "nv-tab-2";
  const tab3Id = "nv-tab-3";
  nodes.push(
    makeFrame(tabsId, {
      name: "Tabs",
      layout: { direction: "row", gap: "0px" },
      children: [tab1Id, tab2Id, tab3Id],
      styles: {
        borderBottomWidth: "1px",
        borderBottomColor: "{colors.border}",
      },
    }),
    makeText(tab1Id, "Tab 1", "Overview", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.primary}",
      padding: "12px",
      paddingX: "16px",
      borderBottomWidth: "2px",
      borderBottomColor: "{colors.primary}",
    }),
    makeText(tab2Id, "Tab 2", "Details", {
      fontSize: "14px",
      color: "{colors.text-muted}",
      padding: "12px",
      paddingX: "16px",
    }),
    makeText(tab3Id, "Tab 3", "Settings", {
      fontSize: "14px",
      color: "{colors.text-muted}",
      padding: "12px",
      paddingX: "16px",
    }),
  );
  sectionIds.push(tabsId);

  // Breadcrumbs
  const breadcrumbsId = "nv-breadcrumbs";
  const bc1Id = "nv-bc-home";
  const bcSep1Id = "nv-bc-sep1";
  const bc2Id = "nv-bc-page";
  const bcSep2Id = "nv-bc-sep2";
  const bc3Id = "nv-bc-current";
  nodes.push(
    makeFrame(breadcrumbsId, {
      name: "Breadcrumbs",
      layout: { direction: "row", gap: "8px", align: "center" },
      children: [bc1Id, bcSep1Id, bc2Id, bcSep2Id, bc3Id],
      styles: {},
    }),
    makeText(bc1Id, "Breadcrumb Home", "Home", {
      fontSize: "14px",
      color: "{colors.primary}",
    }),
    makeText(bcSep1Id, "Breadcrumb Separator 1", "/", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
    makeText(bc2Id, "Breadcrumb Page", "Page", {
      fontSize: "14px",
      color: "{colors.primary}",
    }),
    makeText(bcSep2Id, "Breadcrumb Separator 2", "/", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
    makeText(bc3Id, "Breadcrumb Current", "Current", {
      fontSize: "14px",
      color: "{colors.text}",
    }),
  );
  sectionIds.push(breadcrumbsId);

  // Sidebar
  const sidebarId = "nv-sidebar";
  const sideItem1Id = "nv-side-item1";
  const sideItem2Id = "nv-side-item2";
  const sideItem3Id = "nv-side-item3";
  const sideItem4Id = "nv-side-item4";
  nodes.push(
    makeFrame(sidebarId, {
      name: "Sidebar",
      layout: { direction: "column", gap: "4px" },
      children: [sideItem1Id, sideItem2Id, sideItem3Id, sideItem4Id],
      styles: {
        width: "240px",
        padding: "16px",
        borderWidth: "1px",
        borderColor: "{colors.border}",
        borderRadius: "8px",
      },
    }),
    makeText(sideItem1Id, "Sidebar Item 1", "Dashboard", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.primary}",
      padding: "8px",
      paddingX: "12px",
      backgroundColor: "{colors.surface}",
      borderRadius: "6px",
    }),
    makeText(sideItem2Id, "Sidebar Item 2", "Projects", {
      fontSize: "14px",
      color: "{colors.text}",
      padding: "8px",
      paddingX: "12px",
    }),
    makeText(sideItem3Id, "Sidebar Item 3", "Teams", {
      fontSize: "14px",
      color: "{colors.text}",
      padding: "8px",
      paddingX: "12px",
    }),
    makeText(sideItem4Id, "Sidebar Item 4", "Settings", {
      fontSize: "14px",
      color: "{colors.text}",
      padding: "8px",
      paddingX: "12px",
    }),
  );
  sectionIds.push(sidebarId);

  return pageShell("nv", "Navigation", "Navigation component patterns.", sectionIds, nodes);
}

// ── Feedback Page (page10) ───────────────────────────────────
function buildFeedbackPage(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];
  const sectionIds: string[] = [];

  // Alert
  const alertId = "fb-alert";
  const alertIconId = "fb-alert-icon";
  const alertTextId = "fb-alert-text";
  nodes.push(
    makeFrame(alertId, {
      name: "Alert",
      layout: { direction: "row", gap: "12px", align: "center" },
      children: [alertIconId, alertTextId],
      styles: {
        padding: "12px",
        paddingX: "16px",
        borderWidth: "1px",
        borderColor: "{colors.warning}",
        borderRadius: "8px",
        backgroundColor: "#FEF3C7",
      },
    }),
    makeIcon(alertIconId, "Alert Icon", "lucide:alert-triangle", {
      color: "{colors.warning}",
      width: "20px",
      height: "20px",
    }),
    makeText(alertTextId, "Alert Text", "This is a warning alert message.", {
      fontSize: "14px",
      color: "{colors.text}",
    }),
  );
  sectionIds.push(alertId);

  // Badge
  const badgeSectionId = "fb-badge-section";
  const badge1Id = "fb-badge-default";
  const badge2Id = "fb-badge-success";
  const badge3Id = "fb-badge-error";
  nodes.push(
    makeFrame(badgeSectionId, {
      name: "Badges",
      layout: { direction: "row", gap: "12px", align: "center" },
      children: [badge1Id, badge2Id, badge3Id],
      styles: {},
    }),
    makeText(badge1Id, "Default Badge", "Default", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.text}",
      backgroundColor: "{colors.surface}",
      padding: "4px",
      paddingX: "10px",
      borderRadius: "9999px",
    }),
    makeText(badge2Id, "Success Badge", "Success", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.background}",
      backgroundColor: "{colors.success}",
      padding: "4px",
      paddingX: "10px",
      borderRadius: "9999px",
    }),
    makeText(badge3Id, "Error Badge", "Error", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.background}",
      backgroundColor: "{colors.error}",
      padding: "4px",
      paddingX: "10px",
      borderRadius: "9999px",
    }),
  );
  sectionIds.push(badgeSectionId);

  // Toast
  const toastId = "fb-toast";
  const toastIconId = "fb-toast-icon";
  const toastContentId = "fb-toast-content";
  const toastTitleId = "fb-toast-title";
  const toastMsgId = "fb-toast-message";
  nodes.push(
    makeFrame(toastId, {
      name: "Toast",
      layout: { direction: "row", gap: "12px", align: "center" },
      children: [toastIconId, toastContentId],
      styles: {
        padding: "16px",
        borderWidth: "1px",
        borderColor: "{colors.border}",
        borderRadius: "8px",
        width: "360px",
      },
    }),
    makeIcon(toastIconId, "Toast Icon", "lucide:check-circle", {
      color: "{colors.success}",
      width: "20px",
      height: "20px",
    }),
    makeFrame(toastContentId, {
      name: "Toast Content",
      layout: { direction: "column", gap: "4px" },
      children: [toastTitleId, toastMsgId],
      styles: {},
    }),
    makeText(toastTitleId, "Toast Title", "Success", {
      fontSize: "14px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeText(toastMsgId, "Toast Message", "Your changes have been saved.", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
  );
  sectionIds.push(toastId);

  // Progress
  const progressId = "fb-progress";
  const progressTrackId = "fb-progress-track";
  const progressFillId = "fb-progress-fill";
  const progressLabelId = "fb-progress-label";
  nodes.push(
    makeFrame(progressId, {
      name: "Progress",
      layout: { direction: "column", gap: "8px" },
      children: [progressLabelId, progressTrackId],
      styles: { width: "320px" },
    }),
    makeText(progressLabelId, "Progress Label", "Progress: 65%", {
      fontSize: "14px",
      color: "{colors.text}",
    }),
    makeFrame(progressTrackId, {
      name: "Progress Track",
      layout: { direction: "row" },
      children: [progressFillId],
      styles: {
        height: "8px",
        borderRadius: "9999px",
        backgroundColor: "{colors.surface}",
      },
    }),
    makeFrame(progressFillId, {
      name: "Progress Fill",
      layout: { direction: "column" },
      children: [],
      styles: {
        width: "65%",
        height: "8px",
        borderRadius: "9999px",
        backgroundColor: "{colors.primary}",
      },
    }),
  );
  sectionIds.push(progressId);

  return pageShell("fb", "Feedback", "Alert, badge, toast, and progress components.", sectionIds, nodes);
}

// ── Main Export ──────────────────────────────────────────────
export function buildDesignSystem(): CanvasDocument {
  const now = new Date().toISOString();

  return {
    version: "1.0.0",
    meta: {
      name: "Design System",
      created: now,
      modified: now,
    },
    tokens: {
      colors: {
        primary: { value: "#3B82F6", description: "Primary brand color (blue)" },
        secondary: { value: "#1E293B", description: "Dark color for text and backgrounds" },
        accent: { value: "#8B5CF6", description: "Accent color (violet)" },
        background: { value: "#FFFFFF", description: "Page background" },
        surface: { value: "#F8FAFC", description: "Section/card background" },
        text: { value: "#0F172A", description: "Primary text color" },
        "text-muted": { value: "#64748B", description: "Muted text color" },
        border: { value: "#E2E8F0", description: "Border color" },
        success: { value: "#22C55E", description: "Success semantic color" },
        warning: { value: "#F59E0B", description: "Warning semantic color" },
        error: { value: "#EF4444", description: "Error semantic color" },
        info: { value: "#3B82F6", description: "Info semantic color" },
        "neutral-50": { value: "#F8FAFC", description: "Neutral 50" },
        "neutral-100": { value: "#F1F5F9", description: "Neutral 100" },
        "neutral-200": { value: "#E2E8F0", description: "Neutral 200" },
        "neutral-300": { value: "#CBD5E1", description: "Neutral 300" },
        "neutral-400": { value: "#94A3B8", description: "Neutral 400" },
        "neutral-500": { value: "#64748B", description: "Neutral 500" },
        "neutral-600": { value: "#475569", description: "Neutral 600" },
        "neutral-700": { value: "#334155", description: "Neutral 700" },
        "neutral-800": { value: "#1E293B", description: "Neutral 800" },
        "neutral-900": { value: "#0F172A", description: "Neutral 900" },
      },
      spacing: {
        "2xs": { value: "2px" },
        xs: { value: "4px" },
        sm: { value: "8px" },
        md: { value: "16px" },
        lg: { value: "24px" },
        xl: { value: "32px" },
        "2xl": { value: "48px" },
        "3xl": { value: "64px" },
      },
      typography: {
        h1: { fontFamily: "Inter", fontSize: "48px", fontWeight: "bold", lineHeight: "1.2" },
        h2: { fontFamily: "Inter", fontSize: "36px", fontWeight: "bold", lineHeight: "1.2" },
        h3: { fontFamily: "Inter", fontSize: "30px", fontWeight: "semibold", lineHeight: "1.3" },
        h4: { fontFamily: "Inter", fontSize: "24px", fontWeight: "semibold", lineHeight: "1.4" },
        h5: { fontFamily: "Inter", fontSize: "20px", fontWeight: "semibold", lineHeight: "1.4" },
        h6: { fontFamily: "Inter", fontSize: "16px", fontWeight: "semibold", lineHeight: "1.5" },
        body: { fontFamily: "Inter", fontSize: "16px", fontWeight: "normal", lineHeight: "1.6" },
        caption: { fontFamily: "Inter", fontSize: "14px", fontWeight: "normal", lineHeight: "1.5" },
        link: { fontFamily: "Inter", fontSize: "16px", fontWeight: "normal", lineHeight: "1.6" },
      },
      borderRadius: {
        none: { value: "0px" },
        sm: { value: "4px" },
        md: { value: "8px" },
        lg: { value: "12px" },
        xl: { value: "16px" },
        full: { value: "9999px" },
      },
      shadows: {
        sm: { value: "0 1px 2px 0 rgba(0,0,0,0.05)" },
        md: { value: "0 4px 6px -1px rgba(0,0,0,0.1)" },
        lg: { value: "0 10px 15px -3px rgba(0,0,0,0.1)" },
      },
      breakpoints: {},
    },
    components: {},
    pages: (() => {
      const PAGE_W = 1440;
      const PAGE_GAP = 100;
      const pageDefs: Array<[string, string, () => Record<string, Record<string, unknown>>]> = [
        ["page1", "Color Palette", buildColorPalettePage],
        ["page2", "Typography", buildTypographyPage],
        ["page3", "Spacing & Sizing", buildSpacingPage],
        ["page4", "Border Radius & Shadows", buildBorderRadiusShadowsPage],
        ["page5", "Icons", buildIconsPage],
        ["page6", "Buttons", buildButtonsPage],
        ["page7", "Form Elements", buildFormElementsPage],
        ["page8", "Cards", buildCardsPage],
        ["page9", "Navigation", buildNavigationPage],
        ["page10", "Feedback", buildFeedbackPage],
      ];
      const pages: Record<string, any> = {};
      pageDefs.forEach(([id, name, buildFn], i) => {
        pages[id] = {
          name,
          width: PAGE_W,
          height: null,
          x: i * (PAGE_W + PAGE_GAP),
          y: 0,
          nodes: buildFn() as any,
        };
      });
      return pages;
    })(),
  };
}
