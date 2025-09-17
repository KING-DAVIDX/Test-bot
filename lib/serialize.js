import { fileURLToPath } from "url";
import path from "path";
import baileys from "baileys";
import { resolveLidToJid } from "./lid.js";

const { generateWAMessageFromContent } = baileys;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function serialize(sock, msg) {
  if (!msg) return null;
  const m = {};
  const { key, message, pushName, broadcast, status } = msg;

  m.id = key?.id;
  m.from = key?.remoteJid ? resolveLidToJid(key.remoteJid) : null;
  m.fromAlt = key?.remoteJidAlt || null;
  m.fromMe = key?.fromMe || false;
  m.participant = key?.participant
    ? resolveLidToJid(key.participant)
    : m.fromMe
      ? sock.user.id
      : m.from;
  m.participantAlt = key?.participantAlt || null;
  m.pushName = pushName || "";
  m.broadcast = broadcast || false;
  m.status = status || null;
  m.messageStubType = msg.messageStubType || null;
  m.messageStubParameters = msg.messageStubParameters || [];
  m.verifiedBizName = msg.verifiedBizName || null;
  m.isGroup = m.from?.endsWith("@g.us") || false;
  m.isChannel = m.from?.endsWith("@newsletter") || false;
  m.isStatus = m.from?.endsWith("status@broadcast") || false;
  m.type = message ? Object.keys(message).find(k => !["messageContextInfo"].includes(k)) : null;
  if (m.isStatus) m.type = "status";

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
    message?.messageContextInfo ||
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

  if (message?.senderKeyDistributionMessage) {
    m.senderKeyDistribution = message.senderKeyDistributionMessage;
  }

  m.client = sock;

  m.sendText = async (text, options = {}) =>
    sock.sendMessage(m.from, { text }, options);

  m.reply = async (text, options = {}) =>
    sock.sendMessage(m.from, { text }, { quoted: msg, ...options });

  m.sendImage = async (pathOrBuffer, caption = "", options = {}) =>
    sock.sendMessage(m.from, { image: pathOrBuffer, caption }, options);

  m.sendVideo = async (pathOrBuffer, caption = "", options = {}) =>
    sock.sendMessage(m.from, { video: pathOrBuffer, caption }, options);

  m.sendAudio = async (pathOrBuffer, options = {}) =>
    sock.sendMessage(m.from, { audio: pathOrBuffer, mimetype: "audio/mp4" }, options);

  m.sendSticker = async (pathOrBuffer, options = {}) =>
    sock.sendMessage(m.from, { sticker: pathOrBuffer }, options);

  m.sendDoc = async (pathOrBuffer, mimetype = "application/pdf", fileName = "file", options = {}) =>
    sock.sendMessage(m.from, { document: pathOrBuffer, mimetype, fileName }, options);

  m.sendPoll = async (name, values = [], selectableCount = 1, options = {}) =>
    sock.sendMessage(m.from, { poll: { name, values, selectableCount } }, options);

  m.pollsnap = async (caption, votes = [], options = {}) => {
    const wmsg = generateWAMessageFromContent(
      m.from,
      {
        pollResultSnapshotMessage: {
          name: caption,
          pollVotes: votes
        }
      },
      { quoted: msg, ...options }
    );
    await m.client.relayMessage(wmsg.key.remoteJid, wmsg.message, {
      messageId: wmsg.key.id
    });
    return wmsg;
  };

  return m;
}