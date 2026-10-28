import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { db } from '@/lib/db'

export const GET = withAuth(['SUPER_ADMIN'], async () => {
  const feedback = await db.productFeedback.findMany({
    orderBy: { createdAt: 'desc' }, take: 50,
    include: { user: { select: { name: true, role: true } }, submission: { select: { title: true } } },
  })
  return NextResponse.json({ feedback })
})
