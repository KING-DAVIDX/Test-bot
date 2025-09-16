import { fileURLToPath } from "url";
import path from "path";
import { resolveLidToJid } from "./lid.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function serialize(sock, msg) {
  if (!msg) return null;
  const m = {};
  const { key, message, pushName, broadcast, status } = msg;

  m.id = key?.id;
  m.from = resolveLidToJid(key?.remoteJid, key?.remoteJid);
  m.fromAlt = key?.remoteJidAlt || null;
  m.fromMe = key?.fromMe || false;
  m.participant = resolveLidToJid(key?.participant || m.from, key?.remoteJid);
  m.pushName = pushName || "";
  m.broadcast = broadcast || false;
  m.status = status || null;
  m.isGroup = m.from?.endsWith("@g.us") || false;
  m.isChannel = m.from?.endsWith("@newsletter") || false;
  m.isStatus = m.from?.endsWith("status@broadcast") || false;
  m.type = message ? Object.keys(message).find(k => !["messageContextInfo"].includes(k)) : null;
  
  if (m.isStatus) {
    m.type = "status";
  }

  m.text = message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.stickerMessage?.caption ||
    message?.reactionMessage?.text ||
    message?.pollCreationMessageV3?.name ||
    "";

  const contextInfo = message?.extendedTextMessage?.contextInfo ||
    message?.imageMessage?.contextInfo ||
    message?.videoMessage?.contextInfo ||
    message?.documentMessage?.contextInfo ||
    message?.stickerMessage?.contextInfo ||
    {};

  m.mentionedJid = (contextInfo.mentionedJid || []).map(j => resolveLidToJid(j, m.from));
  m.groupMentions = contextInfo.groupMentions || [];

  if (contextInfo.quotedMessage) {
    const quoted = {};
    quoted.type = Object.keys(contextInfo.quotedMessage)[0];
    quoted.text = contextInfo.quotedMessage?.conversation ||
      contextInfo.quotedMessage?.extendedTextMessage?.text ||
      contextInfo.quotedMessage?.imageMessage?.caption ||
      contextInfo.quotedMessage?.videoMessage?.caption ||
      contextInfo.quotedMessage?.documentMessage?.caption ||
      "";
    quoted.id = contextInfo.stanzaId;
    quoted.sender = resolveLidToJid(contextInfo.participant, m.from);
    quoted.mentionedJid = (contextInfo.quotedMessage?.extendedTextMessage?.contextInfo?.mentionedJid || [])
      .map(j => resolveLidToJid(j, m.from));
    quoted.groupMentions = contextInfo.quotedMessage?.extendedTextMessage?.contextInfo?.groupMentions || [];
    m.quoted = quoted;
  }

  if (message?.reactionMessage) {
    m.reaction = {
      text: message.reactionMessage.text,
      key: message.reactionMessage.key,
    };
  }

  if (message?.pollCreationMessageV3) {
    m.poll = {
      name: message.pollCreationMessageV3.name,
      options: message.pollCreationMessageV3.options?.map(o => o.optionName),
      selectable: message.pollCreationMessageV3.selectableOptionsCount,
    };
  }
  
  if (message?.pollUpdateMessage) {
    m.pollUpdate = message.pollUpdateMessage;
  }

  if (message?.protocolMessage) {
    m.protocolMessage = message.protocolMessage;
  }

  return m;
}