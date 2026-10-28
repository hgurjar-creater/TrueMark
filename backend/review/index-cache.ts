import type { Fact, Rule } from '@prisma/client'
import { Bm25Index } from '@/lib/review/retrieval'

interface WorkspaceIndexes {
  signature: string
  ruleIndex: Bm25Index
  factIndex: Bm25Index
  rulesById: Map<string, Rule>
  factsById: Map<string, Fact>
}

const MAX_CACHED_WORKSPACES = 32
const indexesByWorkspace = new Map<string, WorkspaceIndexes>()

function librarySignature(rules: Rule[], facts: Fact[]): string {
  return [
    ...rules.map((rule) => `r:${rule.id}:${rule.updatedAt.getTime()}`),
    ...facts.map((fact) => `f:${fact.id}:${fact.updatedAt.getTime()}`),
  ].join('|')
}

export function getWorkspaceIndexes(workspaceId: string, rules: Rule[], facts: Fact[]): WorkspaceIndexes {
  const signature = librarySignature(rules, facts)
  const cached = indexesByWorkspace.get(workspaceId)
  if (cached?.signature === signature) {
    indexesByWorkspace.delete(workspaceId)
    indexesByWorkspace.set(workspaceId, cached)
    return cached
  }

  const indexes: WorkspaceIndexes = {
    signature,
    ruleIndex: new Bm25Index(rules.map((rule) => ({ id: rule.id, text: `${rule.title} ${rule.text}` }))),
    factIndex: new Bm25Index(facts.map((fact) => ({ id: fact.id, text: fact.statement }))),
    rulesById: new Map(rules.map((rule) => [rule.id, rule])),
    factsById: new Map(facts.map((fact) => [fact.id, fact])),
  }

  indexesByWorkspace.delete(workspaceId)
  indexesByWorkspace.set(workspaceId, indexes)
  while (indexesByWorkspace.size > MAX_CACHED_WORKSPACES) {
    const oldestWorkspaceId = indexesByWorkspace.keys().next().value
    if (!oldestWorkspaceId) break
    indexesByWorkspace.delete(oldestWorkspaceId)
  }
  return indexes
}

export function invalidateWorkspaceIndexes(workspaceId: string) {
  indexesByWorkspace.delete(workspaceId)
}
