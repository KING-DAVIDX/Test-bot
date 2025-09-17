import fs from "fs"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let configModule = null
const configPath = path.join(__dirname, "../config.js")

export async function loadConfig() {
  const moduleUrl = pathToFileURL(configPath).href + "?update=" + Date.now()
  const mod = await import(moduleUrl)
  configModule = mod.default
  return configModule
}

export function getConfig() {
  return configModule
}

export function watchConfig() {
  fs.watchFile(configPath, async () => {
    await loadConfig()
  })
}

await loadConfig()
watchConfig()