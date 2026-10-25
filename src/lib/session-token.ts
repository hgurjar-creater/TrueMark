// Edge-safe session token helpers. This module must stay free of Node-only
// imports (bcrypt, Prisma) because src/middleware.ts runs on the Edge runtime.

import { SignJWT, jwtVerify } from 'jose'
import { toRole, type Role } from './validation'

export const SESSION_COOKIE_NAME = 'truemark_session'
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
}

export interface SessionCookieOptions {
  httpOnly: true
  sameSite: 'lax'
  secure: boolean
  path: '/'
  maxAge: number
}

export function sessionCookieOptions(secure: boolean): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  }
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'AUTH_SECRET is missing or too short. Set it to a random string of at least 32 characters in .env.',
    )
  }
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const role = toRole(String(payload.role ?? ''))
    if (
      typeof payload.sub !== 'string' ||
      !role ||
      typeof payload.name !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return null
    }
    return { id: payload.sub, name: payload.name, email: payload.email, role }
  } catch (error) {
    // Invalid or expired tokens are an expected outcome; a missing or short
    // AUTH_SECRET is a configuration error and must stay visible.
    if (error instanceof Error && error.message.startsWith('AUTH_SECRET')) throw error
    return null
  }
}
