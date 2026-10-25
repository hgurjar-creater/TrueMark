import { z } from 'zod'

// SQLite has no Prisma enums, so every role/status stored as a String column is
// validated through these constants. Keep them in sync with prisma/schema.prisma.

export const ROLES = ['ADMIN', 'MANAGER', 'CREATOR'] as const
export type Role = (typeof ROLES)[number]

export const SUBMISSION_STATUSES = ['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED'] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export const FINDING_STATUSES = ['OPEN', 'ACCEPTED', 'EDITED', 'DISMISSED'] as const
export type FindingStatus = (typeof FINDING_STATUSES)[number]

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SOURCE_TYPES = ['RULE', 'FACT', 'TERM'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const FINDING_ORIGINS = ['DETERMINISTIC', 'AI'] as const
export type FindingOrigin = (typeof FINDING_ORIGINS)[number]

export const TERM_STATUSES = ['PREFERRED', 'BANNED'] as const
export type TermStatus = (typeof TERM_STATUSES)[number]

export function toRole(value: string): Role | null {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null
}

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80, 'Name must be at most 80 characters.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password must be at most 72 characters.'),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
  password: z.string().min(1, 'Enter your password.').max(72),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>

export const CHANNELS = [
  'Blog post',
  'LinkedIn',
  'Instagram',
  'X (Twitter)',
  'Press release',
  'Product page',
  'Presentation',
  'Advertisement',
  'Other',
] as const
export type Channel = (typeof CHANNELS)[number]

export const submissionSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(120),
  channel: z.enum(CHANNELS),
  purpose: z.string().trim().min(3, 'Describe the purpose of the piece.').max(500),
  content: z.string().trim().min(20, 'The draft must be at least 20 characters.').max(20000),
})

export const decisionSchema = z
  .object({
    action: z.enum(['ACCEPT', 'EDIT', 'DISMISS']),
    replacement: z.string().trim().min(1).max(2000).optional(),
    note: z.string().trim().min(1).max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'EDIT' && !data.replacement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide the corrected text.',
        path: ['replacement'],
      })
    }
    if (data.action === 'DISMISS' && !data.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A reason is required when dismissing a finding.',
        path: ['note'],
      })
    }
  })

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment first.').max(2000),
})

export const approvalSchema = z.object({
  action: z.enum(['APPROVE', 'REQUEST_CHANGES']),
  comment: z.string().trim().max(2000).optional(),
})

export type SubmissionInput = z.infer<typeof submissionSchema>
export type DecisionInput = z.infer<typeof decisionSchema>
export type CommentInput = z.infer<typeof commentSchema>
export type ApprovalInput = z.infer<typeof approvalSchema>
