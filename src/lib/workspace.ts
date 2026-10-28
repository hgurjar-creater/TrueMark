import { NextResponse } from 'next/server'
import type { SessionUser } from './session-token'

export function workspaceIdOrError(session: SessionUser): string | NextResponse {
  return session.workspaceId ?? NextResponse.json({ error: 'This account is not assigned to a brand workspace.' }, { status: 403 })
}
