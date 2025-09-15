import { downloadContentFromMessage } from "baileys";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function serialize(sock, msg) {
  if (!msg) return null;
  const m = {};
  const { key, message, pushName, broadcast, status } = msg;

  m.id = key?.id;
  m.from = key?.remoteJid;
  m.fromAlt = key?.remoteJidAlt || null;
  m.fromMe = key?.fromMe || false;
  m.participant = key?.participant || m.from;
  m.pushName = pushName || "";
  m.broadcast = broadcast || false;
  m.status = status || null;

  // detect type
  m.type = message
    ? Object.keys(message).find(k => !["messageContextInfo"].includes(k))
    : null;

  // text handling
  m.text =
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    "";

  // context info
  const contextInfo =
    message?.extendedTextMessage?.contextInfo ||
    message?.imageMessage?.contextInfo ||
    message?.videoMessage?.contextInfo ||
    {};

  m.mentionedJid = contextInfo.mentionedJid || [];
  m.groupMentions = contextInfo.groupMentions || [];

  // quoted message
  if (contextInfo.quotedMessage) {
    const quoted = {};
    quoted.type = Object.keys(contextInfo.quotedMessage)[0];
    quoted.text =
      contextInfo.quotedMessage?.conversation ||
      contextInfo.quotedMessage?.extendedTextMessage?.text ||
      contextInfo.quotedMessage?.imageMessage?.caption ||
      contextInfo.quotedMessage?.videoMessage?.caption ||
      "";
    quoted.id = contextInfo.stanzaId;
    quoted.sender = contextInfo.participant;
    quoted.mentionedJid =
      contextInfo.quotedMessage?.extendedTextMessage?.contextInfo
        ?.mentionedJid || [];
    quoted.groupMentions =
      contextInfo.quotedMessage?.extendedTextMessage?.contextInfo
        ?.groupMentions || [];
    m.quoted = quoted;
  }

  // media handler
  m.download = async (folder = "downloads") => {
    try {
      const type = m.type?.replace("Message", "");
      const msgContent = message[m.type];
      if (!msgContent) return null;
      const stream = await downloadContentFromMessage(msgContent, type);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      if (!fs.existsSync(path.join(__dirname, folder))) {
        fs.mkdirSync(path.join(__dirname, folder), { recursive: true });
      }
      const fileName = `${Date.now()}`;
      const filePath = path.join(__dirname, folder, fileName);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch {
      return null;
    }
  };

  return m;
    }
