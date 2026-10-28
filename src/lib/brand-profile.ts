import { db } from '@/lib/db'

export const DEFAULT_PALETTE = ['#6D4AFF', '#211D2D', '#FFFFFF']

export async function getBrandProfile(workspaceId: string) {
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
  const profile = await db.brandProfile.upsert({
    where: { workspaceId },
    update: {},
    create: { workspaceId, name: workspace.name, palette: JSON.stringify(DEFAULT_PALETTE) },
  })
  let palette: string[] = DEFAULT_PALETTE
  try {
    const decoded: unknown = JSON.parse(profile.palette)
    if (Array.isArray(decoded) && decoded.every((value) => typeof value === 'string')) palette = decoded
  } catch {
    // Keep the safe demo palette when stored settings cannot be decoded.
  }
  return { ...profile, palette }
}
