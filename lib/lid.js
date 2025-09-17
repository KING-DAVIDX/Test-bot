export function resolveLidToJid(input, meta) {
  if (!input) return null;

  let lid = input;
  if (lid.startsWith("@")) lid = lid.slice(1);
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