import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { getConfig } from "./filewatcher.js";
import { clearPlugins, registerPlugin, getPluginCount as dbPluginCount } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const plugins = new Map();
const listeners = [];

export default function nexus(meta, exec) {
  if (meta?.name) {
    const plugin = { ...meta, exec };
    plugins.set(meta.name, plugin);
    if (meta.alias) plugins.set(meta.alias, { ...plugin, aliasOf: meta.name });
    registerPlugin(meta);
  } else if (meta?.on) {
    listeners.push({ ...meta, exec });
    if (meta.alias) listeners.push({ ...meta, exec, aliasOf: meta.on });
    registerPlugin(meta);
  } else {
    console.error("Invalid plugin structure:", meta);
  }
}

export async function loadPlugins() {
  const pluginDir = path.join(__dirname, "../plugins");
  if (!fs.existsSync(pluginDir)) return;

  // Clear DB before fresh load
  await clearPlugins();
  plugins.clear();
  listeners.length = 0;

  const loadFile = async (file) => {
    const pluginPath = path.join(pluginDir, file);
    try {
      const moduleUrl = pathToFileURL(pluginPath).href;
      await import(moduleUrl + "?update=" + Date.now());
    } catch (err) {
      console.error("Failed to load plugin:", file, err);
    }
  };

  fs.readdirSync(pluginDir)
    .filter((f) => f.endsWith(".js"))
    .forEach(loadFile);

  fs.watch(pluginDir, (event, filename) => {
    if (!filename.endsWith(".js")) return;
    console.log("[Plugin Reload]", filename);
    loadFile(filename);
  });
}

export const getPluginCount = dbPluginCount;

export async function handleMessage(m) {
  try {
    const config = getConfig();
    const text = m.text?.trim();
    if (!text && !m.type) return;

    if (text && text.startsWith(config.PREFIX)) {
      const [cmd, ...args] = text.slice(config.PREFIX.length).trim().split(/\s+/);
      const plugin = plugins.get(cmd);
      if (plugin) {
        if (
          config.MODE === "private" &&
          !(m.isOwner.includes(m.participant) || m.isSudo.includes(m.participant))
        ) {
          return;
        }
        const result = await plugin.exec(m, args);
        if (plugin.React) {
          await m.client.sendMessage(m.from, { react: { text: plugin.React, key: m.key } });
        }
        return result;
      }
    }

    for (const listener of listeners) {
      if (listener.on === "text" && text) {
        if (
          config.MODE === "private" &&
          !(m.isOwner.includes(m.participant) || m.isSudo.includes(m.participant))
        ) {
          continue;
        }
        if (
          listener.Listen &&
          text.split(/\s+/)[0].toLowerCase() === listener.Listen.toLowerCase()
        ) {
          const result = await listener.exec(m);
          if (listener.React) {
            await m.client.sendMessage(m.from, { react: { text: listener.React, key: m.key } });
          }
          return result;
        }
      } else if (listener.on === m.type) {
        if (
          config.MODE === "private" &&
          !(m.isOwner.includes(m.participant) || m.isSudo.includes(m.participant))
        ) {
          continue;
        }
        const result = await listener.exec(m);
        if (listener.React) {
          await m.client.sendMessage(m.from, { react: { text: listener.React, key: m.key } });
        }
        return result;
      }
    }
  } catch (err) {
    console.error("Plugin execution error:", err);
  }
}

export { plugins, listeners };