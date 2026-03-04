import type { Tokens } from "../core/schema.js";

/**
 * Generate a tailwind.config.js content string from document tokens.
 * Maps token categories to Tailwind theme extensions.
 */
export function generateTailwindConfig(tokens: Tokens): string {
  const theme: Record<string, Record<string, string>> = {};

  // Colors
  if (tokens.colors && Object.keys(tokens.colors).length > 0) {
    theme.colors = {};
    for (const [key, token] of Object.entries(tokens.colors)) {
      theme.colors[key] = token.value;
    }
  }

  // Spacing
  if (tokens.spacing && Object.keys(tokens.spacing).length > 0) {
    theme.spacing = {};
    for (const [key, token] of Object.entries(tokens.spacing)) {
      theme.spacing[key] = token.value;
    }
  }

  // Border Radius
  if (tokens.borderRadius && Object.keys(tokens.borderRadius).length > 0) {
    theme.borderRadius = {};
    for (const [key, token] of Object.entries(tokens.borderRadius)) {
      theme.borderRadius[key] = token.value;
    }
  }

  // Box Shadows
  if (tokens.shadows && Object.keys(tokens.shadows).length > 0) {
    theme.boxShadow = {};
    for (const [key, token] of Object.entries(tokens.shadows)) {
      theme.boxShadow[key] = token.value;
    }
  }

  // Breakpoints / screens
  if (tokens.breakpoints && Object.keys(tokens.breakpoints).length > 0) {
    theme.screens = {};
    for (const [key, token] of Object.entries(tokens.breakpoints)) {
      theme.screens[key] = token.value;
    }
  }

  // Typography — map to fontFamily, fontSize
  if (tokens.typography && Object.keys(tokens.typography).length > 0) {
    const fontFamily: Record<string, string[]> = {};
    const fontSize: Record<string, [string, { lineHeight: string; fontWeight: string }]> = {};

    for (const [key, token] of Object.entries(tokens.typography)) {
      // Each typography token becomes a font-family entry and a font-size entry
      fontFamily[key] = [token.fontFamily];
      fontSize[key] = [
        token.fontSize,
        {
          lineHeight: token.lineHeight,
          fontWeight: token.fontWeight,
        },
      ];
    }

    if (Object.keys(fontFamily).length > 0) {
      theme.fontFamily = fontFamily as unknown as Record<string, string>;
    }
    if (Object.keys(fontSize).length > 0) {
      theme.fontSize = fontSize as unknown as Record<string, string>;
    }
  }

  const config = {
    content: ["./**/*.html"],
    theme: {
      extend: theme,
    },
    plugins: [],
  };

  return `/** @type {import('tailwindcss').Config} */
export default ${JSON.stringify(config, null, 2)};
`;
}
