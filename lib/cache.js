import NodeCache from "node-cache";

export const groupCache = new NodeCache({ stdTTL: 60 * 5 });

export function setGroupMetadata(meta) {
  if (meta?.id) groupCache.set(meta.id, meta);
}

export function getGroupMetadata(id) {
  if (!id) return null;
  return groupCache.get(id);
}