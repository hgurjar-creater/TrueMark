import { db } from '@/lib/db'
import {
  factSchema,
  factUpdateSchema,
  isLibraryKind,
  ruleSchema,
  ruleUpdateSchema,
  termSchema,
  termUpdateSchema,
  type LibraryKind,
} from './schemas'

export type LibraryResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; issues?: Record<string, string[]> }

function prismaCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  return String((error as { code?: unknown }).code ?? '')
}

function databaseFailure(error: unknown): LibraryResult<never> {
  const code = prismaCode(error)
  if (code === 'P2002') return { ok: false, status: 409, error: 'A library item with that code already exists.' }
  if (code === 'P2003') return { ok: false, status: 409, error: 'This item is linked to existing findings and cannot be deleted.' }
  if (code === 'P2025') return { ok: false, status: 404, error: 'Library item not found.' }
  console.error('[library] Database operation failed:', error)
  return { ok: false, status: 500, error: 'Unable to save this library item.' }
}

export async function listLibraryItems(kind: string, workspaceId: string): Promise<LibraryResult<unknown[]>> {
  if (!isLibraryKind(kind)) return { ok: false, status: 404, error: 'Unknown library type.' }
  try {
    switch (kind) {
      case 'rules':
        return { ok: true, status: 200, data: await db.rule.findMany({ where: { workspaceId }, orderBy: { code: 'asc' } }) }
      case 'facts':
        return { ok: true, status: 200, data: await db.fact.findMany({ where: { workspaceId }, orderBy: { code: 'asc' } }) }
      case 'terms':
        return { ok: true, status: 200, data: await db.term.findMany({ where: { workspaceId }, orderBy: { code: 'asc' } }) }
    }
  } catch (error) {
    return databaseFailure(error)
  }
}

export async function createLibraryItem(kind: string, raw: unknown, workspaceId: string): Promise<LibraryResult<unknown>> {
  if (!isLibraryKind(kind)) return { ok: false, status: 404, error: 'Unknown library type.' }
  try {
    switch (kind) {
      case 'rules': {
        const parsed = ruleSchema.safeParse(raw)
        if (!parsed.success) return { ok: false, status: 422, error: 'Invalid input.', issues: parsed.error.flatten().fieldErrors }
        const item = await db.rule.create({ data: { ...parsed.data, workspaceId } })
        return { ok: true, status: 201, data: item }
      }
      case 'facts': {
        const parsed = factSchema.safeParse(raw)
        if (!parsed.success) return { ok: false, status: 422, error: 'Invalid input.', issues: parsed.error.flatten().fieldErrors }
        const item = await db.fact.create({ data: { ...parsed.data, workspaceId } })
        return { ok: true, status: 201, data: item }
      }
      case 'terms': {
        const parsed = termSchema.safeParse(raw)
        if (!parsed.success) return { ok: false, status: 422, error: 'Invalid input.', issues: parsed.error.flatten().fieldErrors }
        const item = await db.term.create({ data: { ...parsed.data, workspaceId } })
        return { ok: true, status: 201, data: item }
      }
    }
  } catch (error) {
    return databaseFailure(error)
  }
}

export async function updateLibraryItem(kind: string, id: string, raw: unknown, workspaceId: string): Promise<LibraryResult<unknown>> {
  if (!isLibraryKind(kind)) return { ok: false, status: 404, error: 'Unknown library type.' }
  try {
    switch (kind) {
      case 'rules': {
        const parsed = ruleUpdateSchema.safeParse(raw)
        if (!parsed.success) return { ok: false, status: 422, error: 'Invalid input.', issues: parsed.error.flatten().fieldErrors }
        if (!await db.rule.findFirst({ where: { id, workspaceId }, select: { id: true } })) return { ok: false, status: 404, error: 'Library item not found.' }
        return { ok: true, status: 200, data: await db.rule.update({ where: { id }, data: parsed.data }) }
      }
      case 'facts': {
        const parsed = factUpdateSchema.safeParse(raw)
        if (!parsed.success) return { ok: false, status: 422, error: 'Invalid input.', issues: parsed.error.flatten().fieldErrors }
        if (!await db.fact.findFirst({ where: { id, workspaceId }, select: { id: true } })) return { ok: false, status: 404, error: 'Library item not found.' }
        return { ok: true, status: 200, data: await db.fact.update({ where: { id }, data: parsed.data }) }
      }
      case 'terms': {
        const parsed = termUpdateSchema.safeParse(raw)
        if (!parsed.success) return { ok: false, status: 422, error: 'Invalid input.', issues: parsed.error.flatten().fieldErrors }
        if (!await db.term.findFirst({ where: { id, workspaceId }, select: { id: true } })) return { ok: false, status: 404, error: 'Library item not found.' }
        return { ok: true, status: 200, data: await db.term.update({ where: { id }, data: parsed.data }) }
      }
    }
  } catch (error) {
    return databaseFailure(error)
  }
}

export async function deleteLibraryItem(kind: string, id: string, workspaceId: string): Promise<LibraryResult<{ id: string }>> {
  if (!isLibraryKind(kind)) return { ok: false, status: 404, error: 'Unknown library type.' }
  try {
    switch (kind) {
      case 'rules':
        if (!await db.rule.findFirst({ where: { id, workspaceId }, select: { id: true } })) return { ok: false, status: 404, error: 'Library item not found.' }
        await db.rule.delete({ where: { id } })
        break
      case 'facts':
        if (!await db.fact.findFirst({ where: { id, workspaceId }, select: { id: true } })) return { ok: false, status: 404, error: 'Library item not found.' }
        await db.fact.delete({ where: { id } })
        break
      case 'terms':
        if (!await db.term.findFirst({ where: { id, workspaceId }, select: { id: true } })) return { ok: false, status: 404, error: 'Library item not found.' }
        await db.term.delete({ where: { id } })
        break
    }
    return { ok: true, status: 200, data: { id } }
  } catch (error) {
    return databaseFailure(error)
  }
}

export function libraryEntityName(kind: LibraryKind): string {
  return kind.slice(0, -1).replace(/^./, (letter) => letter.toUpperCase())
}
