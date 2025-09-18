import nexus from "../lib/plugin.js"
import util from "util"
import { exec } from "child_process"
const execPromise = util.promisify(exec)

nexus(
  {
    on: "text",
    Category: "owner",
    Info: "Execute Shell commands",
    React: "🖥️",
    Listen: "∆"
  },
  async (m) => {
    const { query } = m.query()
    if (!query) return m.reply("No command provided.")

    try {
      const { stdout, stderr } = await execPromise(query)
      const output = stdout || stderr || "No output"
      await m.reply(output)
    } catch (err) {
      await m.reply(String(err))
    }
  }
)

nexus(
  {
    on: "text",
    Category: "fun",
    Info: "Repeats whatever you say after the keyword 'say'",
    React: "🗣️",
    Listen: "say"
  },
  async (m) => {
    const { query } = m.query()
    if (!query) return m.reply("You didn’t tell me what to say 😅")
    await m.reply(query)
  }
)

nexus(
  {
    on: "text",
    Category: "owner",
    Info: "Evaluate JavaScript code",
    React: "💻",
    Listen: "$"
  },
  async (m) => {
    const { query } = m.query()
    if (!query) return m.reply("No code provided.")

    try {
      let result = await eval(`(async () => { ${query} })()`)
      result = typeof result === "string" ? result : util.inspect(result, { depth: null })
      await m.reply(result)
    } catch (err) {
      await m.reply(String(err))
    }
  }
)

nexus(
  {
    name: "ping",
    alias: "p",
    Category: "utility",
    Info: "Replies with latency",
    React: "🔥"
  },
  async (m) => {
    const start = Date.now()
    const sent = await m.reply("ping 🔥")
    const latency = Date.now() - start
    await m.client.sendMessage(m.from, { text: `_Latency: ${latency}ms_`, edit: sent.key })
  }
)

nexus(
  {
    name: "sticker",
    alias: "s",
    Category: "media",
    Info: "Converts an image to a sticker",
    React: "🎨"
  },
  async (m) => {
    if (m.type !== "imageMessage") {
      return m.reply("Please reply to an image to make a sticker.")
    }
    const buffer = await m.client.downloadMediaMessage(m)
    await m.sendSticker(buffer)
  }
)

nexus(
  {
    on: "imageMessage",
    Category: "media",
    Info: "Replies whenever an image is sent",
    React: "🖼️"
  },
  async (m) => {
    await m.reply("Nice picture! 📸")
  }
)