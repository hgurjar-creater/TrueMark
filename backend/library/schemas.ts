import { z } from 'zod'

const code = z.string().trim().min(1, 'A code is required.').max(40).regex(/^[A-Z][A-Z0-9-]*$/, 'Use uppercase letters, numbers and hyphens for the code.')
const approved = z.boolean().default(false)
const nullableText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null)

export const ruleSchema = z.object({
  code,
  title: z.string().trim().min(3).max(120),
  text: z.string().trim().min(10).max(4000),
  category: nullableText(80),
  approved,
})

export const factSchema = z.object({
  code,
  statement: z.string().trim().min(5).max(2000),
  source: z.string().trim().min(2).max(300),
  expiresAt: z.string().datetime().optional().nullable().transform((value) => value ? new Date(value) : null),
  approved,
})

export const termSchema = z.object({
  code,
  value: z.string().trim().min(1).max(120),
  status: z.enum(['PREFERRED', 'BANNED']),
  replacement: nullableText(120),
  reason: z.string().trim().min(3).max(500),
  approved,
})

function editable<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.')
}

export const ruleUpdateSchema = editable(ruleSchema)
export const factUpdateSchema = editable(factSchema)
export const termUpdateSchema = editable(termSchema)

export type RuleInput = z.infer<typeof ruleSchema>
export type FactInput = z.infer<typeof factSchema>
export type TermInput = z.infer<typeof termSchema>
export type RuleUpdate = z.infer<typeof ruleUpdateSchema>
export type FactUpdate = z.infer<typeof factUpdateSchema>
export type TermUpdate = z.infer<typeof termUpdateSchema>

export type LibraryKind = 'rules' | 'facts' | 'terms'

export function isLibraryKind(value: string): value is LibraryKind {
  return value === 'rules' || value === 'facts' || value === 'terms'
}
