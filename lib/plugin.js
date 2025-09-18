import fs from "fs"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import { getConfig } from "./filewatcher.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const plugins = new Map()
const listeners = []

export default function nexus(meta, exec) {
  if (meta?.name) {
    const plugin = { ...meta, exec }
    plugins.set(meta.name, plugin)
    if (meta.alias) plugins.set(meta.alias, { ...plugin, aliasOf: meta.name })
  } else if (meta?.on) {
    listeners.push({ ...meta, exec })
    if (meta.alias) listeners.push({ ...meta, exec, aliasOf: meta.on })
  } else {
    console.error("Invalid plugin structure:", meta)
  }
}

export function loadPlugins() {
  const pluginDir = path.join(__dirname, "../plugins")
  if (!fs.existsSync(pluginDir)) return

  const loadFile = async file => {
    const pluginPath = path.join(pluginDir, file)
    try {
      const moduleUrl = pathToFileURL(pluginPath).href
      await import(moduleUrl + "?update=" + Date.now())
    } catch (err) {
      console.error("Failed to load plugin:", file, err)
    }
  }

  fs.readdirSync(pluginDir)
    .filter(f => f.endsWith(".js"))
    .forEach(loadFile)

  fs.watch(pluginDir, (event, filename) => {
    if (!filename.endsWith(".js")) return
    console.log("[Plugin Reload]", filename)
    loadFile(filename)
  })
}

export function getPluginCount() {
  const commandCount = new Set([...plugins.values()].map(p => p.exec)).size
  const listenerCount = listeners.length
  return commandCount + listenerCount
}

export async function handleMessage(m) {
  try {
    const config = getConfig()
    const text = m.text?.trim()
    if (!text && !m.type) return

    if (text && text.startsWith(config.PREFIX)) {
      const [cmd, ...args] = text.slice(config.PREFIX.length).split(/\s+/)
      const plugin = plugins.get(cmd)
      if (plugin) {
        if (config.MODE === "private" && !(m.isOwner.includes(m.participant) || m.isSudo.includes(m.participant))) {
          return
        }
        if (plugin.React) {
          await m.client.sendMessage(m.from, { react: { text: plugin.React, key: m } })
        }
        return plugin.exec(m, args)
      }
    }

    for (const listener of listeners) {
      if (listener.on === "text" && text) {
        if (config.MODE === "private" && !(m.isOwner.includes(m.participant) || m.isSudo.includes(m.participant))) {
          continue
        }
        if (listener.Listen && text.split(/\s+/)[0].toLowerCase() === listener.Listen.toLowerCase()) {
          if (listener.React) {
            await m.client.sendMessage(m.from, { react: { text: listener.React, key: m } })
          }
          await listener.exec(m)
        }
      } else if (listener.on === m.type) {
        if (config.MODE === "private" && !(m.isOwner.includes(m.participant) || m.isSudo.includes(m.participant))) {
          continue
        }
        if (listener.React) {
          await m.client.sendMessage(m.from, { react: { text: listener.React, key: m } })
        }
        await listener.exec(m)
      }
    }
  } catch (err) {
    console.error("Plugin execution error:", err)
  }
}

export { plugins, listeners }