import type { CanvasDocument } from "../core/schema.js";

// ── Constants ────────────────────────────────────────────────
const SLIDE_W = 1920;
const SLIDE_H = 1080;

// ── Local Helpers ────────────────────────────────────────────
type FrameOpts = {
  name: string;
  layout?: Record<string, unknown>;
  children?: string[];
  styles?: Record<string, unknown>;
  clip?: boolean;
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

function makeVector(
  id: string,
  name: string,
  path: string,
  viewBox: string,
  styles?: Record<string, unknown>,
): [string, Record<string, unknown>] {
  return [id, { type: "vector" as const, name, path, viewBox, styles: styles ?? {} }];
}

function slideRoot(
  children: string[],
  bgColor: string = "{colors.background}",
): [string, Record<string, unknown>] {
  return makeFrame("root", {
    name: "Root",
    layout: { direction: "column", justify: "center", align: "center" },
    children,
    styles: {
      backgroundColor: bgColor,
      width: `${SLIDE_W}px`,
      height: `${SLIDE_H}px`,
      padding: "96px",
    },
  });
}

// ── Page 1: Cover ────────────────────────────────────────────
function buildCoverSlide(): Record<string, Record<string, unknown>> {
  return Object.fromEntries([
    slideRoot(["cover-title", "cover-subtitle", "cover-date", "cover-presenter"]),
    makeText("cover-title", "Slide Title", "Presentation Title", {
      fontSize: "64px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeText("cover-subtitle", "Slide Subtitle", "A subtitle for context", {
      fontSize: "24px",
      color: "{colors.text-muted}",
    }),
    makeText("cover-date", "Date", "2026-01-01", {
      fontSize: "16px",
      color: "{colors.text-muted}",
    }),
    makeText("cover-presenter", "Presenter", "Presenter Name", {
      fontSize: "16px",
      color: "{colors.text-muted}",
    }),
  ]);
}

// ── Page 2: Table of Contents ────────────────────────────────
function buildTocSlide(): Record<string, Record<string, unknown>> {
  const items = [
    "1. Introduction",
    "2. Problem Statement",
    "3. Solution Overview",
    "4. Key Features",
    "5. Results",
    "6. Next Steps",
  ];
  const itemIds = items.map((_, i) => `toc-item-${i + 1}`);
  const nodes: Array<[string, Record<string, unknown>]> = [];

  nodes.push(
    slideRoot(["toc-heading", "toc-list"], "{colors.background}"),
    makeText("toc-heading", "TOC Heading", "Table of Contents", {
      fontSize: "48px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeFrame("toc-list", {
      name: "TOC List",
      layout: { direction: "column", gap: "16px" },
      children: itemIds,
      styles: {},
    }),
  );

  for (let i = 0; i < items.length; i++) {
    nodes.push(
      makeText(`toc-item-${i + 1}`, `TOC Item ${i + 1}`, items[i], {
        fontSize: "24px",
        color: "{colors.text}",
      }),
    );
  }

  return Object.fromEntries(nodes);
}

// ── Page 3: Section Divider ──────────────────────────────────
function buildSectionDividerSlide(): Record<string, Record<string, unknown>> {
  return Object.fromEntries([
    slideRoot(["sec-title", "sec-subtitle"], "{colors.primary}"),
    makeText("sec-title", "Section Title", "Section Title", {
      fontSize: "56px",
      fontWeight: "bold",
      color: "{colors.white}",
    }),
    makeText("sec-subtitle", "Section Subtitle", "Brief description of this section", {
      fontSize: "24px",
      color: "{colors.white}",
    }),
  ]);
}

// ── Page 4: Text + Bullet List ───────────────────────────────
function buildBulletListSlide(): Record<string, Record<string, unknown>> {
  const bulletItems = [
    "First key point",
    "Second key point",
    "Third key point",
    "Fourth key point",
  ];
  const bulletRowIds = bulletItems.map((_, i) => `bl-item-${i + 1}`);
  const nodes: Array<[string, Record<string, unknown>]> = [];

  nodes.push(
    slideRoot(["bl-heading", "bl-list"]),
    makeText("bl-heading", "Slide Heading", "Key Points", {
      fontSize: "48px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeFrame("bl-list", {
      name: "Bullet List",
      layout: { direction: "column", gap: "12px" },
      children: bulletRowIds,
      styles: {},
    }),
  );

  for (let i = 0; i < bulletItems.length; i++) {
    const rowId = `bl-item-${i + 1}`;
    const bulletId = `bl-bullet-${i + 1}`;
    const textId = `bl-text-${i + 1}`;
    nodes.push(
      makeFrame(rowId, {
        name: `Bullet Item ${i + 1}`,
        layout: { direction: "row", gap: "12px", align: "center" },
        children: [bulletId, textId],
        styles: {},
      }),
      makeText(bulletId, `Bullet ${i + 1}`, "\u30FB", {
        fontSize: "24px",
        color: "{colors.accent}",
      }),
      makeText(textId, `Bullet Text ${i + 1}`, bulletItems[i], {
        fontSize: "24px",
        color: "{colors.text}",
      }),
    );
  }

  return Object.fromEntries(nodes);
}

// ── Page 5: Two Columns ──────────────────────────────────────
function buildTwoColumnSlide(): Record<string, Record<string, unknown>> {
  return Object.fromEntries([
    slideRoot(["tc-heading", "tc-columns"]),
    makeText("tc-heading", "Slide Heading", "Two Column Layout", {
      fontSize: "48px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeFrame("tc-columns", {
      name: "Columns",
      layout: { direction: "row", gap: "48px" },
      children: ["tc-left", "tc-right"],
      styles: { width: "100%" },
    }),
    makeFrame("tc-left", {
      name: "Left Column",
      layout: { direction: "column", gap: "16px" },
      children: ["tc-left-title", "tc-left-text"],
      styles: { width: "50%" },
    }),
    makeText("tc-left-title", "Left Title", "Left Column", {
      fontSize: "24px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeText("tc-left-text", "Left Text", "Content for the left side of the layout.", {
      fontSize: "18px",
      color: "{colors.text-muted}",
    }),
    makeFrame("tc-right", {
      name: "Right Column",
      layout: { direction: "column", gap: "16px" },
      children: ["tc-right-title", "tc-right-text"],
      styles: { width: "50%" },
    }),
    makeText("tc-right-title", "Right Title", "Right Column", {
      fontSize: "24px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeText("tc-right-text", "Right Text", "Content for the right side of the layout.", {
      fontSize: "18px",
      color: "{colors.text-muted}",
    }),
  ]);
}

// ── Page 6: Image + Text ─────────────────────────────────────
function buildImageTextSlide(): Record<string, Record<string, unknown>> {
  return Object.fromEntries([
    slideRoot(["it-content"]),
    makeFrame("it-content", {
      name: "Content Row",
      layout: { direction: "row", gap: "48px", align: "center" },
      children: ["it-image-area", "it-text-area"],
      styles: { width: "100%" },
    }),
    makeFrame("it-image-area", {
      name: "Image Placeholder",
      layout: { direction: "column", align: "center", justify: "center" },
      children: ["it-image-icon", "it-image-label"],
      styles: {
        backgroundColor: "{colors.surface}",
        width: "50%",
        height: "400px",
        borderRadius: "12px",
      },
    }),
    makeIcon("it-image-icon", "Image Icon", "lucide:image", {
      color: "{colors.text-muted}",
      width: "48px",
      height: "48px",
    }),
    makeText("it-image-label", "Image Label", "Image placeholder", {
      fontSize: "14px",
      color: "{colors.text-muted}",
    }),
    makeFrame("it-text-area", {
      name: "Text Area",
      layout: { direction: "column", gap: "16px" },
      children: ["it-title", "it-description"],
      styles: { width: "50%" },
    }),
    makeText("it-title", "Image Slide Title", "Image & Text", {
      fontSize: "36px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeText("it-description", "Image Slide Description", "A description that accompanies the image on the left. Replace the placeholder with your own visual content.", {
      fontSize: "18px",
      color: "{colors.text-muted}",
      lineHeight: "1.6",
    }),
  ]);
}

// ── Page 7: Table ────────────────────────────────────────────
function buildTableSlide(): Record<string, Record<string, unknown>> {
  const nodes: Array<[string, Record<string, unknown>]> = [];

  const headerCols = ["Feature", "Plan A", "Plan B"];
  const dataRows = [
    ["Storage", "10 GB", "100 GB"],
    ["Users", "5", "Unlimited"],
    ["Support", "Email", "24/7 Phone"],
    ["Price", "$9/mo", "$29/mo"],
  ];

  // Header row
  const headerColIds = headerCols.map((_, i) => `tb-th-${i + 1}`);
  nodes.push(
    makeFrame("tb-header", {
      name: "Table Header",
      layout: { direction: "row" },
      children: headerColIds,
      styles: {
        backgroundColor: "{colors.surface}",
        borderBottomWidth: "2px",
        borderBottomColor: "{colors.border}",
      },
    }),
  );
  for (let i = 0; i < headerCols.length; i++) {
    nodes.push(
      makeText(`tb-th-${i + 1}`, `Header ${i + 1}`, headerCols[i], {
        fontSize: "18px",
        fontWeight: "semibold",
        color: "{colors.text}",
        padding: "16px",
        width: "33%",
      }),
    );
  }

  // Data rows
  const rowIds: string[] = [];
  for (let r = 0; r < dataRows.length; r++) {
    const rowId = `tb-row-${r + 1}`;
    const colIds = dataRows[r].map((_, c) => `tb-td-${r + 1}-${c + 1}`);
    rowIds.push(rowId);
    nodes.push(
      makeFrame(rowId, {
        name: `Table Row ${r + 1}`,
        layout: { direction: "row" },
        children: colIds,
        styles: {
          borderBottomWidth: "1px",
          borderBottomColor: "{colors.border}",
        },
      }),
    );
    for (let c = 0; c < dataRows[r].length; c++) {
      nodes.push(
        makeText(`tb-td-${r + 1}-${c + 1}`, `Cell ${r + 1}-${c + 1}`, dataRows[r][c], {
          fontSize: "16px",
          color: "{colors.text}",
          padding: "16px",
          width: "33%",
        }),
      );
    }
  }

  nodes.push(
    slideRoot(["tb-title", "tb-container"]),
    makeText("tb-title", "Table Title", "Comparison Table", {
      fontSize: "48px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeFrame("tb-container", {
      name: "Table Container",
      layout: { direction: "column" },
      children: ["tb-header", ...rowIds],
      styles: {
        borderWidth: "1px",
        borderColor: "{colors.border}",
        borderRadius: "8px",
        width: "100%",
      },
    }),
  );

  return Object.fromEntries(nodes);
}

// ── Page 8: Flowchart ────────────────────────────────────────
function buildFlowchartSlide(): Record<string, Record<string, unknown>> {
  const arrowPath = "M0 12 L20 12 M15 7 L20 12 L15 17";
  const arrowViewBox = "0 0 24 24";

  return Object.fromEntries([
    slideRoot(["fc-title", "fc-flow"]),
    makeText("fc-title", "Flowchart Title", "Process Flow", {
      fontSize: "48px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeFrame("fc-flow", {
      name: "Flow Container",
      layout: { direction: "row", gap: "24px", align: "center" },
      children: ["fc-step-1", "fc-arrow-1", "fc-step-2", "fc-arrow-2", "fc-step-3"],
      styles: {},
    }),
    makeFrame("fc-step-1", {
      name: "Step 1",
      layout: { direction: "column", align: "center", justify: "center" },
      children: ["fc-step-1-text"],
      styles: {
        borderWidth: "2px",
        borderColor: "{colors.primary}",
        borderRadius: "12px",
        padding: "24px",
        paddingX: "32px",
        backgroundColor: "{colors.surface}",
      },
    }),
    makeText("fc-step-1-text", "Step 1 Text", "Research", {
      fontSize: "20px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeVector("fc-arrow-1", "Arrow 1", arrowPath, arrowViewBox, {
      width: "48px",
      height: "24px",
      color: "{colors.primary}",
    }),
    makeFrame("fc-step-2", {
      name: "Step 2",
      layout: { direction: "column", align: "center", justify: "center" },
      children: ["fc-step-2-text"],
      styles: {
        borderWidth: "2px",
        borderColor: "{colors.primary}",
        borderRadius: "12px",
        padding: "24px",
        paddingX: "32px",
        backgroundColor: "{colors.surface}",
      },
    }),
    makeText("fc-step-2-text", "Step 2 Text", "Design", {
      fontSize: "20px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
    makeVector("fc-arrow-2", "Arrow 2", arrowPath, arrowViewBox, {
      width: "48px",
      height: "24px",
      color: "{colors.primary}",
    }),
    makeFrame("fc-step-3", {
      name: "Step 3",
      layout: { direction: "column", align: "center", justify: "center" },
      children: ["fc-step-3-text"],
      styles: {
        borderWidth: "2px",
        borderColor: "{colors.primary}",
        borderRadius: "12px",
        padding: "24px",
        paddingX: "32px",
        backgroundColor: "{colors.surface}",
      },
    }),
    makeText("fc-step-3-text", "Step 3 Text", "Deliver", {
      fontSize: "20px",
      fontWeight: "semibold",
      color: "{colors.text}",
    }),
  ]);
}

// ── Page 9: Chart ────────────────────────────────────────────
function buildChartSlide(): Record<string, Record<string, unknown>> {
  const bars = [
    { key: "q1", label: "Q1", value: "45%", height: "135px" },
    { key: "q2", label: "Q2", value: "62%", height: "186px" },
    { key: "q3", label: "Q3", value: "78%", height: "234px" },
    { key: "q4", label: "Q4", value: "91%", height: "273px" },
  ];
  const barIds = bars.map((b) => `ch-bar-${b.key}`);
  const nodes: Array<[string, Record<string, unknown>]> = [];

  nodes.push(
    slideRoot(["ch-title", "ch-area"]),
    makeText("ch-title", "Chart Title", "Quarterly Results", {
      fontSize: "48px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeFrame("ch-area", {
      name: "Chart Area",
      layout: { direction: "row", gap: "32px", align: "end" },
      children: barIds,
      styles: { height: "400px" },
    }),
  );

  for (const b of bars) {
    const barGroupId = `ch-bar-${b.key}`;
    const valueId = `ch-value-${b.key}`;
    const fillId = `ch-fill-${b.key}`;
    const labelId = `ch-label-${b.key}`;
    nodes.push(
      makeFrame(barGroupId, {
        name: `Bar ${b.label}`,
        layout: { direction: "column", align: "center", gap: "8px" },
        children: [valueId, fillId, labelId],
        styles: {},
      }),
      makeText(valueId, `Value ${b.label}`, b.value, {
        fontSize: "14px",
        fontWeight: "semibold",
        color: "{colors.text}",
      }),
      makeFrame(fillId, {
        name: `Fill ${b.label}`,
        layout: { direction: "column" },
        children: [],
        styles: {
          width: "64px",
          height: b.height,
          backgroundColor: "{colors.primary}",
          borderRadius: "8px 8px 0 0",
        },
      }),
      makeText(labelId, `Label ${b.label}`, b.label, {
        fontSize: "16px",
        color: "{colors.text-muted}",
      }),
    );
  }

  return Object.fromEntries(nodes);
}

// ── Page 10: Quote ───────────────────────────────────────────
function buildQuoteSlide(): Record<string, Record<string, unknown>> {
  return Object.fromEntries([
    slideRoot(["qt-quote", "qt-source"]),
    makeText("qt-quote", "Quote Text", "\u201CThe best way to predict the future is to create it.\u201D", {
      fontSize: "48px",
      fontWeight: "bold",
      color: "{colors.text}",
      lineHeight: "1.4",
    }),
    makeText("qt-source", "Quote Source", "\u2014 Peter Drucker", {
      fontSize: "20px",
      color: "{colors.text-muted}",
    }),
  ]);
}

// ── Page 11: Summary ─────────────────────────────────────────
function buildSummarySlide(): Record<string, Record<string, unknown>> {
  const points = [
    "Clear problem definition drives the solution",
    "User feedback is incorporated continuously",
    "Results exceeded expectations by 30%",
    "Next phase begins in Q2",
  ];
  const pointIds = points.map((_, i) => `sm-point-${i + 1}`);
  const nodes: Array<[string, Record<string, unknown>]> = [];

  nodes.push(
    slideRoot(["sm-title", "sm-points"]),
    makeText("sm-title", "Summary Title", "Key Takeaways", {
      fontSize: "48px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeFrame("sm-points", {
      name: "Key Points",
      layout: { direction: "column", gap: "16px" },
      children: pointIds,
      styles: {},
    }),
  );

  for (let i = 0; i < points.length; i++) {
    nodes.push(
      makeText(`sm-point-${i + 1}`, `Key Point ${i + 1}`, points[i], {
        fontSize: "24px",
        color: "{colors.text}",
      }),
    );
  }

  return Object.fromEntries(nodes);
}

// ── Page 12: End Page ────────────────────────────────────────
function buildEndSlide(): Record<string, Record<string, unknown>> {
  return Object.fromEntries([
    slideRoot(["end-thankyou", "end-email", "end-website"]),
    makeText("end-thankyou", "Thank You Text", "Thank you", {
      fontSize: "64px",
      fontWeight: "bold",
      color: "{colors.text}",
    }),
    makeText("end-email", "Contact Email", "email@example.com", {
      fontSize: "20px",
      color: "{colors.text-muted}",
    }),
    makeText("end-website", "Contact Website", "https://example.com", {
      fontSize: "20px",
      color: "{colors.accent}",
    }),
  ]);
}

// ── Main Export ──────────────────────────────────────────────
export function buildPresentation(): CanvasDocument {
  const now = new Date().toISOString();

  const makeSlide = (
    name: string,
    buildFn: () => Record<string, Record<string, unknown>>,
  ) => ({
    name,
    width: SLIDE_W,
    height: SLIDE_H,
    x: 0,
    y: 0,
    nodes: buildFn() as any,
  });

  return {
    version: "1.0.0",
    meta: {
      name: "Presentation",
      created: now,
      modified: now,
    },
    tokens: {
      colors: {
        primary: { value: "#2563EB", description: "Primary brand color (blue)" },
        accent: { value: "#7C3AED", description: "Accent color (violet)" },
        background: { value: "#0F172A", description: "Dark slide background" },
        "background-light": { value: "#1E293B", description: "Lighter dark background" },
        surface: { value: "#334155", description: "Surface color" },
        text: { value: "#F8FAFC", description: "Primary text color (light)" },
        "text-muted": { value: "#94A3B8", description: "Muted text color" },
        "text-dark": { value: "#0F172A", description: "Dark text for light backgrounds" },
        border: { value: "#475569", description: "Border color" },
        white: { value: "#FFFFFF", description: "White" },
      },
      spacing: {
        sm: { value: "8px" },
        md: { value: "16px" },
        lg: { value: "24px" },
        xl: { value: "32px" },
        "2xl": { value: "48px" },
        "3xl": { value: "64px" },
        "4xl": { value: "96px" },
      },
      typography: {
        title: { fontFamily: "Inter", fontSize: "64px", fontWeight: "bold", lineHeight: "1.1" },
        subtitle: { fontFamily: "Inter", fontSize: "24px", fontWeight: "normal", lineHeight: "1.4" },
        heading: { fontFamily: "Inter", fontSize: "48px", fontWeight: "bold", lineHeight: "1.2" },
        body: { fontFamily: "Inter", fontSize: "18px", fontWeight: "normal", lineHeight: "1.6" },
        caption: { fontFamily: "Inter", fontSize: "14px", fontWeight: "normal", lineHeight: "1.5" },
      },
      borderRadius: {},
      shadows: {},
      breakpoints: {},
    },
    components: {},
    pages: {
      page1: makeSlide("\u8868\u7D19", buildCoverSlide),
      page2: makeSlide("\u76EE\u6B21", buildTocSlide),
      page3: makeSlide("\u30BB\u30AF\u30B7\u30E7\u30F3\u533A\u5207\u308A", buildSectionDividerSlide),
      page4: makeSlide("\u30C6\u30AD\u30B9\u30C8+\u7B87\u6761\u66F8\u304D", buildBulletListSlide),
      page5: makeSlide("2\u30AB\u30E9\u30E0", buildTwoColumnSlide),
      page6: makeSlide("\u753B\u50CF+\u30C6\u30AD\u30B9\u30C8", buildImageTextSlide),
      page7: makeSlide("\u30C6\u30FC\u30D6\u30EB", buildTableSlide),
      page8: makeSlide("\u56F3\u89E3/\u30D5\u30ED\u30FC\u30C1\u30E3\u30FC\u30C8", buildFlowchartSlide),
      page9: makeSlide("\u30B0\u30E9\u30D5/\u30C1\u30E3\u30FC\u30C8", buildChartSlide),
      page10: makeSlide("\u5F15\u7528/\u30CF\u30A4\u30E9\u30A4\u30C8", buildQuoteSlide),
      page11: makeSlide("\u307E\u3068\u3081", buildSummarySlide),
      page12: makeSlide("\u6700\u7D42\u30DA\u30FC\u30B8", buildEndSlide),
    },
  };
}
