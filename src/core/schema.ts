import { z } from "zod";

// ============================================================
// Design Token Schemas
// ============================================================

export const ColorTokenSchema = z.object({
  value: z.string(),
  description: z.string().optional(),
});

export const SpacingTokenSchema = z.object({
  value: z.string(),
  description: z.string().optional(),
});

export const TypographyTokenSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.string(),
  fontWeight: z.string(),
  lineHeight: z.string(),
  description: z.string().optional(),
});

export const BorderRadiusTokenSchema = z.object({
  value: z.string(),
  description: z.string().optional(),
});

export const ShadowTokenSchema = z.object({
  value: z.string(),
  description: z.string().optional(),
});

export const BreakpointTokenSchema = z.object({
  value: z.string(),
  description: z.string().optional(),
});

export const TokensSchema = z.object({
  colors: z.record(z.string(), ColorTokenSchema).default({}),
  spacing: z.record(z.string(), SpacingTokenSchema).default({}),
  typography: z.record(z.string(), TypographyTokenSchema).default({}),
  borderRadius: z.record(z.string(), BorderRadiusTokenSchema).default({}),
  shadows: z.record(z.string(), ShadowTokenSchema).default({}),
  breakpoints: z.record(z.string(), BreakpointTokenSchema).default({}),
});

// ============================================================
// Node Schemas
// ============================================================

export const NodeType = z.enum([
  "frame",
  "text",
  "image",
  "icon",
  "component",
  "vector",
]);

export const LayoutSchema = z
  .object({
    direction: z.enum(["row", "column", "none"]).default("column"),
    gap: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
    align: z.string().optional(),
    justify: z.string().optional(),
    wrap: z.boolean().optional(),
  })
  .optional();

export const StylesSchema = z.record(z.string(), z.unknown()).optional();

// ============================================================
// Visual Primitive Schemas
// ============================================================

export const StrokeSchema = z.object({
  color: z.string(),
  width: z.union([z.string(), z.number()]),
  style: z.enum(["solid", "dashed", "dotted"]).default("solid"),
});

export const ShadowEffectSchema = z.object({
  type: z.literal("shadow"),
  offsetX: z.string().default("0"),
  offsetY: z.string().default("4px"),
  blur: z.string().default("6px"),
  spread: z.string().default("0"),
  color: z.string().default("rgba(0,0,0,0.1)"),
  inset: z.boolean().default(false),
});

export const BlurEffectSchema = z.object({
  type: z.literal("blur"),
  radius: z.string(),
});

export const BackdropBlurEffectSchema = z.object({
  type: z.literal("backdrop-blur"),
  radius: z.string(),
});

export const EffectSchema = z.discriminatedUnion("type", [
  ShadowEffectSchema,
  BlurEffectSchema,
  BackdropBlurEffectSchema,
]);

export const GradientStopSchema = z.object({
  color: z.string(),
  position: z.number().min(0).max(1),
});

export const GradientSchema = z.object({
  type: z.enum(["linear", "radial", "conic"]),
  angle: z.number().optional(),
  colors: z.array(GradientStopSchema).min(2),
});

export const BaseNodeSchema = z.object({
  type: NodeType,
  name: z.string(),
  styles: StylesSchema,
  stroke: StrokeSchema.optional(),
  effects: z.array(EffectSchema).optional(),
  gradient: GradientSchema.optional(),
});

export const FrameNodeSchema = BaseNodeSchema.extend({
  type: z.literal("frame"),
  layout: LayoutSchema,
  children: z.array(z.string()).default([]),
  clip: z.boolean().default(false),
});

export const TextNodeSchema = BaseNodeSchema.extend({
  type: z.literal("text"),
  content: z.string(),
});

export const ImageNodeSchema = BaseNodeSchema.extend({
  type: z.literal("image"),
  src: z.string().optional(),
  alt: z.string().optional(),
});

export const IconNodeSchema = BaseNodeSchema.extend({
  type: z.literal("icon"),
  icon: z.string(), // e.g. "lucide:layers"
});

export const ComponentNodeSchema = BaseNodeSchema.extend({
  type: z.literal("component"),
  componentRef: z.string(),
  props: z.record(z.string(), z.unknown()).default({}),
  overrides: z.record(z.string(), z.unknown()).default({}),
});

export const VectorNodeSchema = BaseNodeSchema.extend({
  type: z.literal("vector"),
  path: z.string().optional(),
  viewBox: z.string().optional(),
});

export const NodeSchema = z.discriminatedUnion("type", [
  FrameNodeSchema,
  TextNodeSchema,
  ImageNodeSchema,
  IconNodeSchema,
  ComponentNodeSchema,
  VectorNodeSchema,
]);

// ============================================================
// Component Definition Schema
// ============================================================

export const ComponentTemplateNodeSchema: z.ZodType<ComponentTemplateNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    content: z.string().optional(),
    styles: StylesSchema,
    children: z.array(ComponentTemplateNodeSchema).optional(),
  })
);

export const ComponentDefinitionSchema = z.object({
  description: z.string().optional(),
  variants: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .default({}),
  props: z.array(z.string()).default([]),
  defaultProps: z.record(z.string(), z.unknown()).default({}),
  template: ComponentTemplateNodeSchema.optional(),
});

// ============================================================
// Variable & Theme Schemas
// ============================================================

export const VariableValueSchema = z.object({
  value: z.string(),
  theme: z.record(z.string(), z.string()).optional(),
});

export const VariableSchema = z.object({
  type: z.enum(["color", "spacing", "number", "string"]),
  values: z.array(VariableValueSchema).min(1),
});

export const VariablesSchema = z.object({
  themeAxes: z.record(z.string(), z.array(z.string())).default({}),
  definitions: z.record(z.string(), VariableSchema).default({}),
});

// ============================================================
// Page Schema
// ============================================================

export const PageSchema = z.object({
  name: z.string(),
  width: z.number().default(1440),
  height: z.number().nullable().default(null),
  x: z.number().default(0),
  y: z.number().default(0),
  nodes: z.record(z.string(), NodeSchema),
});

// ============================================================
// Document Schema (root of .canvas.json)
// ============================================================

export const MetaSchema = z.object({
  name: z.string(),
  created: z.string(),
  modified: z.string(),
});

export const CanvasDocumentSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().default("1.0.0"),
  meta: MetaSchema,
  tokens: TokensSchema.default({}),
  variables: VariablesSchema.optional(),
  components: z.record(z.string(), ComponentDefinitionSchema).default({}),
  pages: z.record(z.string(), PageSchema),
});

// ============================================================
// Type Exports
// ============================================================

export type ColorToken = z.infer<typeof ColorTokenSchema>;
export type SpacingToken = z.infer<typeof SpacingTokenSchema>;
export type TypographyToken = z.infer<typeof TypographyTokenSchema>;
export type BorderRadiusToken = z.infer<typeof BorderRadiusTokenSchema>;
export type Tokens = z.infer<typeof TokensSchema>;

export type NodeTypeEnum = z.infer<typeof NodeType>;
export type Layout = z.infer<typeof LayoutSchema>;
export type Styles = z.infer<typeof StylesSchema>;
export type Stroke = z.infer<typeof StrokeSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type GradientStop = z.infer<typeof GradientStopSchema>;
export type Gradient = z.infer<typeof GradientSchema>;
export type VariableValue = z.infer<typeof VariableValueSchema>;
export type Variable = z.infer<typeof VariableSchema>;
export type Variables = z.infer<typeof VariablesSchema>;
export type FrameNode = z.infer<typeof FrameNodeSchema>;
export type TextNode = z.infer<typeof TextNodeSchema>;
export type ImageNode = z.infer<typeof ImageNodeSchema>;
export type IconNode = z.infer<typeof IconNodeSchema>;
export type ComponentNode = z.infer<typeof ComponentNodeSchema>;
export type VectorNode = z.infer<typeof VectorNodeSchema>;
export type CanvasNode = z.infer<typeof NodeSchema>;

export interface ComponentTemplateNode {
  type: string;
  content?: string;
  styles?: Record<string, unknown>;
  children?: ComponentTemplateNode[];
}

export type ComponentDefinition = z.infer<typeof ComponentDefinitionSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type CanvasDocument = z.infer<typeof CanvasDocumentSchema>;

// ============================================================
// Token category type
// ============================================================

export type TokenCategory =
  | "colors"
  | "spacing"
  | "typography"
  | "borderRadius"
  | "shadows"
  | "breakpoints";

export const TOKEN_CATEGORIES: TokenCategory[] = [
  "colors",
  "spacing",
  "typography",
  "borderRadius",
  "shadows",
  "breakpoints",
];
