import { z } from 'zod';

export const SeveritySchema = z.enum(['error', 'warning', 'info']);

export const LinterNameSchema = z.enum(['eslint', 'oxlint', 'tsc', 'biome']);

export const ReplacementSchema = z.object({
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  text: z.string(),
});

export const FixSchema = z.object({
  replacements: z.array(ReplacementSchema),
});

export const RuleMetaSchema = z.object({
  docsUrl: z.string().url().optional(),
  category: z.string().optional(),
  fixable: z.boolean().optional(),
});

export const IssueSchema = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  endLine: z.number().int().positive(),
  endColumn: z.number().int().positive(),
  severity: SeveritySchema,
  ruleId: z.string(),
  message: z.string(),
  source: LinterNameSchema,
  fix: FixSchema.optional(),
  meta: RuleMetaSchema.optional(),
});

export const LinterRunSchema = z.object({
  name: LinterNameSchema,
  version: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  durationMs: z.number().nonnegative(),
  filesProcessed: z.number().int().nonnegative(),
});

export const SummarySchema = z.object({
  total: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  info: z.number().int().nonnegative(),
  fixable: z.number().int().nonnegative(),
});

export const VibelintOutputSchema = z.object({
  timestamp: z.string().datetime(),
  cwd: z.string(),
  durationMs: z.number().nonnegative(),
  linters: z.array(LinterRunSchema),
  issues: z.array(IssueSchema),
  summary: SummarySchema,
});

export type ValidatedVibelintOutput = z.infer<typeof VibelintOutputSchema>;
