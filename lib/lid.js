import NodeCache from "node-cache";

export const groupCache = new NodeCache({ stdTTL: 60 * 5 });

export function setGroupMetadata(meta) {
  if (meta?.id) groupCache.set(meta.id, meta);
}

export function getGroupMetadata(id) {
  if (!id) return null;
  return groupCache.get(id);
}

export function resolveLidToJid(input, meta) {
  if (!input) return null;

  let lid = input;
  if (lid.startsWith("@")) lid = lid.slice(1);

  // Don't alter valid group, broadcast, or status JIDs
  if (
    lid.endsWith("@g.us") ||
    lid.endsWith("@broadcast") ||
    lid.endsWith("@newsletter") ||
    lid.endsWith("status@broadcast")
  ) {
    return lid;
  }

  if (!lid.endsWith("@lid") && !lid.includes("@s.whatsapp.net")) {
    lid = `${lid}@lid`;
  }

  if (lid.endsWith("@s.whatsapp.net")) return lid;
  if (!meta?.participants) return lid;

  const participant = meta.participants.find(
    p => p.id === lid || p.lid === lid
  );
  return participant?.jid || lid;
}