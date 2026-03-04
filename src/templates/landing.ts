import type { CanvasDocument } from "../core/schema.js";

export function buildLandingPage(): CanvasDocument {
  const now = new Date().toISOString();

  return {
    version: "1.0.0",
    meta: {
      name: "Landing Page",
      created: now,
      modified: now,
    },
    tokens: {
      colors: {
        primary: { value: "#6366F1", description: "Primary brand color (indigo)" },
        secondary: { value: "#0F172A", description: "Dark color for text and backgrounds" },
        accent: { value: "#EC4899", description: "Accent color (pink)" },
        background: { value: "#FFFFFF", description: "Page background" },
        surface: { value: "#F8FAFC", description: "Section background" },
        text: { value: "#0F172A", description: "Primary text color" },
        "text-muted": { value: "#64748B", description: "Muted text color" },
        "text-light": { value: "#94A3B8", description: "Light text for dark backgrounds" },
        border: { value: "#E2E8F0", description: "Border color" },
      },
      spacing: {
        xs: { value: "4px" },
        sm: { value: "8px" },
        md: { value: "16px" },
        lg: { value: "24px" },
        xl: { value: "32px" },
        "2xl": { value: "48px" },
        "3xl": { value: "64px" },
      },
      typography: {
        display: { fontFamily: "Inter", fontSize: "64px", fontWeight: "bold", lineHeight: "1.1" },
        h1: { fontFamily: "Inter", fontSize: "40px", fontWeight: "bold", lineHeight: "1.2" },
        h3: { fontFamily: "Inter", fontSize: "20px", fontWeight: "semibold", lineHeight: "1.4" },
        body: { fontFamily: "Inter", fontSize: "16px", fontWeight: "normal", lineHeight: "1.6" },
        small: { fontFamily: "Inter", fontSize: "14px", fontWeight: "normal", lineHeight: "1.5" },
      },
      borderRadius: {
        pill: { value: "9999px" },
      },
      shadows: {},
      breakpoints: {},
    },
    components: {},
    pages: {
      page1: {
        name: "Landing Page",
        width: 1440,
        height: null,
        nodes: {
          // Root
          root: {
            type: "frame",
            name: "Root",
            clip: false,
            layout: { direction: "column" },
            children: ["navbar", "hero", "stats", "features", "cta"],
            styles: { backgroundColor: "{colors.background}" },
          },

          // ── Navbar ────────────────────────────
          navbar: {
            type: "frame",
            name: "Navbar",
            clip: false,
            layout: { direction: "row", justify: "between", align: "center" },
            children: ["nav-logo", "nav-links"],
            styles: {
              backgroundColor: "{colors.background}",
              padding: "16px",
              paddingX: "32px",
            },
          },
          "nav-logo": {
            type: "text",
            name: "Logo",
            content: "CanvasKit",
            styles: { fontSize: "20px", fontWeight: "bold", color: "{colors.primary}" },
          },
          "nav-links": {
            type: "frame",
            name: "Nav Links",
            clip: false,
            layout: { direction: "row", gap: "24px", align: "center" },
            children: ["nav-features", "nav-pricing", "nav-cta"],
            styles: {},
          },
          "nav-features": {
            type: "text",
            name: "Features Link",
            content: "Features",
            styles: { fontSize: "14px", color: "{colors.text}" },
          },
          "nav-pricing": {
            type: "text",
            name: "Pricing Link",
            content: "Pricing",
            styles: { fontSize: "14px", color: "{colors.text}" },
          },
          "nav-cta": {
            type: "text",
            name: "Get Started Link",
            content: "Get Started",
            styles: {
              fontSize: "14px",
              fontWeight: "semibold",
              color: "{colors.background}",
              backgroundColor: "{colors.primary}",
              padding: "8px",
              paddingX: "16px",
              borderRadius: "9999px",
            },
          },

          // ── Hero Section ──────────────────────
          hero: {
            type: "frame",
            name: "Hero",
            clip: false,
            layout: { direction: "column", align: "center", gap: "24px" },
            children: ["hero-badge", "hero-title", "hero-subtitle", "hero-cta-row"],
            styles: {
              padding: "64px",
              paddingX: "32px",
              backgroundColor: "{colors.surface}",
            },
          },
          "hero-badge": {
            type: "text",
            name: "Hero Badge",
            content: "Now in Beta",
            styles: {
              fontSize: "14px",
              fontWeight: "semibold",
              color: "{colors.primary}",
              padding: "6px",
              paddingX: "16px",
              borderRadius: "9999px",
              borderWidth: "1px",
              borderColor: "{colors.border}",
            },
          },
          "hero-title": {
            type: "text",
            name: "Hero Title",
            content: "Build Beautiful Designs with Code",
            styles: { fontSize: "64px", fontWeight: "bold", color: "{colors.secondary}", lineHeight: "1.1" },
          },
          "hero-subtitle": {
            type: "text",
            name: "Hero Subtitle",
            content: "A CLI-first design tool that bridges the gap between designers and developers.",
            styles: { fontSize: "18px", color: "{colors.text-muted}" },
          },
          "hero-cta-row": {
            type: "frame",
            name: "Hero CTA Row",
            clip: false,
            layout: { direction: "row", gap: "16px", align: "center" },
            children: ["hero-primary-btn", "hero-secondary-btn"],
            styles: {},
          },
          "hero-primary-btn": {
            type: "text",
            name: "Primary CTA",
            content: "Get Started Free",
            styles: {
              fontSize: "16px",
              fontWeight: "semibold",
              color: "{colors.background}",
              backgroundColor: "{colors.primary}",
              padding: "12px",
              paddingX: "24px",
              borderRadius: "9999px",
            },
          },
          "hero-secondary-btn": {
            type: "text",
            name: "Secondary CTA",
            content: "View Documentation",
            styles: {
              fontSize: "16px",
              fontWeight: "semibold",
              color: "{colors.primary}",
              padding: "12px",
              paddingX: "24px",
              borderRadius: "9999px",
              borderWidth: "1px",
              borderColor: "{colors.primary}",
            },
          },

          // ── Stats Section ─────────────────────
          stats: {
            type: "frame",
            name: "Stats",
            clip: false,
            layout: { direction: "row", justify: "center", align: "center" },
            children: ["stat-1", "stat-2", "stat-3"],
            styles: {
              padding: "32px",
              paddingX: "64px",
              backgroundColor: "{colors.background}",
            },
          },
          "stat-1": {
            type: "frame",
            name: "Stat 1",
            clip: false,
            layout: { direction: "column", align: "center", gap: "4px" },
            children: ["stat-1-value", "stat-1-label"],
            styles: {
              padding: "16px",
              paddingX: "48px",
              borderRightWidth: "1px",
              borderRightColor: "{colors.border}",
            },
          },
          "stat-1-value": {
            type: "text",
            name: "Stat 1 Value",
            content: "10K+",
            styles: { fontSize: "32px", fontWeight: "bold", color: "{colors.secondary}" },
          },
          "stat-1-label": {
            type: "text",
            name: "Stat 1 Label",
            content: "Developers",
            styles: { fontSize: "14px", color: "{colors.text-muted}" },
          },
          "stat-2": {
            type: "frame",
            name: "Stat 2",
            clip: false,
            layout: { direction: "column", align: "center", gap: "4px" },
            children: ["stat-2-value", "stat-2-label"],
            styles: {
              padding: "16px",
              paddingX: "48px",
              borderRightWidth: "1px",
              borderRightColor: "{colors.border}",
            },
          },
          "stat-2-value": {
            type: "text",
            name: "Stat 2 Value",
            content: "50K+",
            styles: { fontSize: "32px", fontWeight: "bold", color: "{colors.secondary}" },
          },
          "stat-2-label": {
            type: "text",
            name: "Stat 2 Label",
            content: "Designs Created",
            styles: { fontSize: "14px", color: "{colors.text-muted}" },
          },
          "stat-3": {
            type: "frame",
            name: "Stat 3",
            clip: false,
            layout: { direction: "column", align: "center", gap: "4px" },
            children: ["stat-3-value", "stat-3-label"],
            styles: {
              padding: "16px",
              paddingX: "48px",
            },
          },
          "stat-3-value": {
            type: "text",
            name: "Stat 3 Value",
            content: "99%",
            styles: { fontSize: "32px", fontWeight: "bold", color: "{colors.secondary}" },
          },
          "stat-3-label": {
            type: "text",
            name: "Stat 3 Label",
            content: "Satisfaction",
            styles: { fontSize: "14px", color: "{colors.text-muted}" },
          },

          // ── Features Section ──────────────────
          features: {
            type: "frame",
            name: "Features",
            clip: false,
            layout: { direction: "column", align: "center", gap: "32px" },
            children: ["features-header", "features-grid"],
            styles: { padding: "64px", paddingX: "32px" },
          },
          "features-header": {
            type: "text",
            name: "Features Title",
            content: "Everything You Need",
            styles: { fontSize: "40px", fontWeight: "bold", color: "{colors.secondary}" },
          },
          "features-grid": {
            type: "frame",
            name: "Features Grid",
            clip: false,
            layout: { direction: "row", gap: "24px", wrap: true, justify: "center" },
            children: ["feature-1", "feature-2", "feature-3"],
            styles: { width: "100%" },
          },

          // Feature Card 1
          "feature-1": {
            type: "frame",
            name: "Feature Card 1",
            clip: false,
            layout: { direction: "column", gap: "12px" },
            children: ["feature-1-icon", "feature-1-title", "feature-1-desc"],
            styles: {
              padding: "32px",
              borderWidth: "1px",
              borderColor: "{colors.border}",
              width: "320px",
            },
          },
          "feature-1-icon": {
            type: "icon",
            name: "Feature 1 Icon",
            icon: "lucide:terminal",
            styles: { color: "{colors.primary}" },
          },
          "feature-1-title": {
            type: "text",
            name: "Feature 1 Title",
            content: "CLI-First Workflow",
            styles: { fontSize: "20px", fontWeight: "semibold", color: "{colors.secondary}" },
          },
          "feature-1-desc": {
            type: "text",
            name: "Feature 1 Description",
            content: "Design directly from your terminal. No GUI required.",
            styles: { fontSize: "14px", color: "{colors.text-muted}" },
          },

          // Feature Card 2
          "feature-2": {
            type: "frame",
            name: "Feature Card 2",
            clip: false,
            layout: { direction: "column", gap: "12px" },
            children: ["feature-2-icon", "feature-2-title", "feature-2-desc"],
            styles: {
              padding: "32px",
              borderWidth: "1px",
              borderColor: "{colors.border}",
              width: "320px",
            },
          },
          "feature-2-icon": {
            type: "icon",
            name: "Feature 2 Icon",
            icon: "lucide:layers",
            styles: { color: "{colors.primary}" },
          },
          "feature-2-title": {
            type: "text",
            name: "Feature 2 Title",
            content: "Design Tokens",
            styles: { fontSize: "20px", fontWeight: "semibold", color: "{colors.secondary}" },
          },
          "feature-2-desc": {
            type: "text",
            name: "Feature 2 Description",
            content: "Manage colors, spacing, typography with a unified token system.",
            styles: { fontSize: "14px", color: "{colors.text-muted}" },
          },

          // Feature Card 3
          "feature-3": {
            type: "frame",
            name: "Feature Card 3",
            clip: false,
            layout: { direction: "column", gap: "12px" },
            children: ["feature-3-icon", "feature-3-title", "feature-3-desc"],
            styles: {
              padding: "32px",
              borderWidth: "1px",
              borderColor: "{colors.border}",
              width: "320px",
            },
          },
          "feature-3-icon": {
            type: "icon",
            name: "Feature 3 Icon",
            icon: "lucide:code",
            styles: { color: "{colors.primary}" },
          },
          "feature-3-title": {
            type: "text",
            name: "Feature 3 Title",
            content: "Multi-Format Export",
            styles: { fontSize: "20px", fontWeight: "semibold", color: "{colors.secondary}" },
          },
          "feature-3-desc": {
            type: "text",
            name: "Feature 3 Description",
            content: "Export to HTML, Vue, React, or SVG with one command.",
            styles: { fontSize: "14px", color: "{colors.text-muted}" },
          },

          // ── CTA Section ───────────────────────
          cta: {
            type: "frame",
            name: "CTA Section",
            clip: false,
            layout: { direction: "column", align: "center", gap: "24px" },
            children: ["cta-title", "cta-subtitle", "cta-button"],
            styles: {
              padding: "64px",
              paddingX: "32px",
              backgroundColor: "{colors.secondary}",
            },
          },
          "cta-title": {
            type: "text",
            name: "CTA Title",
            content: "Ready to Get Started?",
            styles: { fontSize: "40px", fontWeight: "bold", color: "{colors.background}" },
          },
          "cta-subtitle": {
            type: "text",
            name: "CTA Subtitle",
            content: "Start building beautiful designs in minutes.",
            styles: { fontSize: "18px", color: "{colors.text-light}" },
          },
          "cta-button": {
            type: "text",
            name: "CTA Button",
            content: "Start Free Trial",
            styles: {
              fontSize: "16px",
              fontWeight: "semibold",
              color: "{colors.background}",
              backgroundColor: "{colors.accent}",
              padding: "12px",
              paddingX: "32px",
              borderRadius: "9999px",
            },
          },
        },
      },
    },
  };
}
