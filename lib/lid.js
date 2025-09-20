import NodeCache from "node-cache"
import { jidNormalizedUser } from "baileys"

// Export the cache instance but don't set it up here
export let groupCache = null

export function initGroupCache(cacheInstance) {
  groupCache = cacheInstance
}

export function setGroupMetadata(meta) {
  if (meta?.id && groupCache) {
    groupCache.set(meta.id, meta)
  }
}

export function getGroupMetadata(id) {
  if (!id || !groupCache) return null
  return groupCache.get(id)
}

export function resolveLidToJid(input, meta) {
  if (!input) return null

  let lid = input
  if (lid.startsWith("@")) lid = lid.slice(1)

  if (
    lid.endsWith("@g.us") ||
    lid.endsWith("@broadcast") ||
    lid.endsWith("@newsletter") ||
    lid.endsWith("status@broadcast")
  ) {
    return lid
  }

  if (!lid.endsWith("@lid") && !lid.includes("@s.whatsapp.net")) {
    lid = `${lid}@lid`
  }

  if (lid.endsWith("@s.whatsapp.net")) {
    return jidNormalizedUser(lid)
  }

  if (!meta?.participants) return lid

  const participant = meta.participants.find(
    p => p.id === lid || p.lid === lid
  )

  return participant?.jid ? jidNormalizedUser(participant.jid) : lid
}