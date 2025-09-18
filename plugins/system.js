import nexus from "../lib/plugin.js"
import util from "util"
import { exec } from "child_process"
const execPromise = util.promisify(exec)

nexus(
  {
    on: "text",
    Category: "system",
    Info: "Execute Shell commands",
    React: "🖥️",
    Listen: "∆"
  },
  async (m) => {
    const { query } = m.query()
    if (!query) return m.reply("No command provided.")
    try {
      const { stdout, stderr } = await execPromise(query)
      await m.reply(stdout || stderr || "No output")
    } catch (err) {
      await m.reply(String(err))
    }
  }
)

nexus(
  {
    on: "text",
    Category: "system",
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
    Category: "system",
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
    name: "uptime",
    Category: "system",
    Info: "Shows how long the bot has been running",
    React: "⏳"
  },
  async (m) => {
    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = Math.floor(uptime % 60)
    await m.reply(`_Uptime:_ ${hours}h ${minutes}m ${seconds}s`)
  }
)

nexus(
  {
    name: "shutdown",
    Category: "system",
    Info: "Shuts down the bot",
    React: "🛑"
  },
  async (m) => {
    await m.reply("Shutting down... 🛑")
    process.exit(0)
  }
)

nexus(
  {
    name: "restart",
    Category: "system",
    Info: "Restarts the bot",
    React: "🔄"
  },
  async (m) => {
    await m.reply("Restarting... 🔄")
    process.exit(1)
  }
)

nexus(
  {
    name: "gitpull",
    Category: "system",
    Info: "Pull latest changes from git",
    React: "📥"
  },
  async (m) => {
    try {
      const { stdout, stderr } = await execPromise("git pull")
      await m.reply(stdout || stderr || "No output")
    } catch (err) {
      await m.reply(String(err))
    }
  }
)
