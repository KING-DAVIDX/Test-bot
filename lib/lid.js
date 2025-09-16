import NodeCache from "node-cache";

const groupCache = new NodeCache({ stdTTL: 60 * 5 });

export function cacheGroupMetadata(meta) {
  if (!meta?.id || !meta?.participants) return;
  groupCache.set(meta.id, meta);
}

export function resolveLidToJid(input, groupId) {
  if (!input) return null;

  let lid = input;
  if (lid.startsWith("@")) lid = lid.slice(1);
  if (!lid.endsWith("@lid") && !lid.includes("@s.whatsapp.net")) {
    lid = `${lid}@lid`;
  }

  if (lid.endsWith("@s.whatsapp.net")) return lid;

  const meta = groupCache.get(groupId);
  if (!meta) return lid;

  const participant = meta.participants.find(p => p.id === lid || p.lid === lid);
  return participant?.jid || lid;
}
