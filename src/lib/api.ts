import { NextResponse, type NextRequest } from 'next/server'
import type { ZodType } from 'zod'
import { db } from './db'
import { getSession } from './session'
import type { SessionUser } from './session-token'
import type { Role } from './validation'

export type AuthedHandler = (req: NextRequest, session: SessionUser) => Promise<NextResponse>

// Wraps a route handler with session lookup, optional role restriction and a
// catch-all error response. Every state-changing route in the app goes through
// this wrapper, so authorisation is enforced on the server in one place.
export function withAuth(roles: Role[] | null, handler: AuthedHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    if (roles && !roles.includes(session.role)) {
      return NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 })
    }
    try {
      return await handler(req, session)
    } catch (error) {
      console.error('[api] Unhandled error:', error)
      return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
    }
  }
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

export async function parseJsonBody<T>(req: NextRequest, schema: ZodType<T>): Promise<ParseResult<T>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }),
    }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid input.', issues: result.error.flatten().fieldErrors },
        { status: 422 },
      ),
    }
  }
  return { ok: true, data: result.data }
}

// Audit failures must never break the request that produced them.
export async function writeAudit(
  action: string,
  entityType: string,
  options: { actorId?: string | null; entityId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action,
        entityType,
        actorId: options.actorId ?? null,
        entityId: options.entityId ?? null,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
      },
    })
  } catch (error) {
    console.error('[audit] Failed to record audit log entry:', error)
  }
}
