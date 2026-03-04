/**
 * Style property validator for CanvasKit nodes.
 *
 * Warns about common CSS property typos while allowing arbitrary
 * pass-through properties (CanvasKit intentionally supports custom styles).
 */

/** Warning produced when a style property matches a known typo pattern. */
export interface StyleWarning {
  property: string;
  message: string;
  suggestion?: string;
}

/** Record of a single auto-fix applied to a style property. */
export interface StyleFix {
  original: string;
  corrected: string;
}

/** Known CSS properties (camelCase) that CanvasKit uses. */
const KNOWN_STYLE_PROPERTIES = new Set([
  // Layout & Sizing
  "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
  "padding", "paddingX", "paddingY", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  // Visual
  "backgroundColor", "color", "opacity", "overflow",
  "border", "borderTop", "borderRight", "borderBottom", "borderLeft",
  "borderRadius", "shadow",
  // Typography
  "fontSize", "fontWeight", "fontFamily", "lineHeight", "letterSpacing",
  "textAlign", "textDecoration", "textTransform", "textShadow",
  // Position
  "position", "top", "right", "bottom", "left", "zIndex",
  // Flex child
  "flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf",
  // Other
  "cursor", "display", "transform", "transition",
  "backdropFilter", "filter", "pointerEvents", "boxShadow",
  "backgroundImage", "backgroundSize", "backgroundPosition",
  "objectFit", "objectPosition",
  "whiteSpace", "wordBreak", "overflowWrap",
]);

/** Map of common typos (lowercase) to correct property names. */
const COMMON_TYPOS: Record<string, string> = {
  "backgroudcolor": "backgroundColor",
  "backgorundcolor": "backgroundColor",
  "backgroundcolor": "backgroundColor",
  "bgcolor": "backgroundColor",
  "backgrondcolor": "backgroundColor",
  "fontsize": "fontSize",
  "fontsiz": "fontSize",
  "fontweight": "fontWeight",
  "fontwieght": "fontWeight",
  "fontfamily": "fontFamily",
  "fontfamly": "fontFamily",
  "lineheight": "lineHeight",
  "textalign": "textAlign",
  "textdecoration": "textDecoration",
  "texttransform": "textTransform",
  "borderradius": "borderRadius",
  "bordrradius": "borderRadius",
  "paddingx": "paddingX",
  "paddingy": "paddingY",
  "paddingtop": "paddingTop",
  "paddingright": "paddingRight",
  "paddingbottom": "paddingBottom",
  "paddingleft": "paddingLeft",
  "margintop": "marginTop",
  "marginright": "marginRight",
  "marginbottom": "marginBottom",
  "marginleft": "marginLeft",
  "zindex": "zIndex",
  "maxwidth": "maxWidth",
  "minwidth": "minWidth",
  "maxheight": "maxHeight",
  "minheight": "minHeight",
  "backgroundimage": "backgroundImage",
  "backgroundsize": "backgroundSize",
  "backgroundposition": "backgroundPosition",
  "objectfit": "objectFit",
  "objectposition": "objectPosition",
  "whitespace": "whiteSpace",
  "wordbreak": "wordBreak",
  "overflowwrap": "overflowWrap",
  "letterspacing": "letterSpacing",
  "textshadow": "textShadow",
  "flexgrow": "flexGrow",
  "flexshrink": "flexShrink",
  "flexbasis": "flexBasis",
  "alignself": "alignSelf",
  "pointerevents": "pointerEvents",
  "backdropfilter": "backdropFilter",
};

/**
 * Validate style properties and return warnings for common typos.
 *
 * Only warns about properties that match a known typo pattern.
 * Truly unknown/custom properties pass through silently since
 * CanvasKit intentionally supports arbitrary style pass-through.
 */
export function validateStyles(styles: Record<string, unknown>): StyleWarning[] {
  const warnings: StyleWarning[] = [];
  for (const prop of Object.keys(styles)) {
    if (KNOWN_STYLE_PROPERTIES.has(prop)) continue;

    const suggestion = COMMON_TYPOS[prop.toLowerCase()];
    if (suggestion) {
      warnings.push({
        property: prop,
        message: `Unknown style property "${prop}". Did you mean "${suggestion}"?`,
        suggestion,
      });
    }
  }
  return warnings;
}

/**
 * Auto-fix known style property typos.
 *
 * Returns a new styles object with corrected property names
 * and a list of fixes that were applied.
 * Values are preserved; only keys are renamed.
 * Non-typo properties (both known and custom) pass through unchanged.
 */
export function autoFixStyles(styles: Record<string, unknown>): {
  fixed: Record<string, unknown>;
  fixes: StyleFix[];
} {
  const fixed: Record<string, unknown> = {};
  const fixes: StyleFix[] = [];

  for (const [prop, value] of Object.entries(styles)) {
    if (KNOWN_STYLE_PROPERTIES.has(prop)) {
      fixed[prop] = value;
      continue;
    }

    const corrected = COMMON_TYPOS[prop.toLowerCase()];
    if (corrected) {
      fixed[corrected] = value;
      fixes.push({ original: prop, corrected });
    } else {
      fixed[prop] = value;
    }
  }

  return { fixed, fixes };
}
