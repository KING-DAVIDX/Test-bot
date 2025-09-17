import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import config from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const plugins = new Map();
const listeners = [];

export default function nexus(meta, exec) {
  if (meta?.name) {
    plugins.set(meta.name, { ...meta, exec });
    if (meta.alias) plugins.set(meta.alias, { ...meta, exec });
  } else if (meta?.on) {
    listeners.push({ ...meta, exec });
    if (meta.alias) listeners.push({ ...meta, exec });
  } else {
    console.error("Invalid plugin structure:", meta);
  }
}

export function loadPlugins() {
  const pluginDir = path.join(__dirname, "../plugins");
  if (!fs.existsSync(pluginDir)) return;

  const loadFile = async file => {
    const pluginPath = path.join(pluginDir, file);
    try {
      const moduleUrl = pathToFileURL(pluginPath).href;
      await import(moduleUrl + "?update=" + Date.now());
    } catch (err) {
      console.error("Failed to load plugin:", file, err);
    }
  };

  fs.readdirSync(pluginDir)
    .filter(f => f.endsWith(".js"))
    .forEach(loadFile);

  fs.watch(pluginDir, (event, filename) => {
    if (!filename.endsWith(".js")) return;
    console.log("[Plugin Reload]", filename);
    loadFile(filename);
  });
}

export async function handleMessage(m) {
  try {
    const text = m.text?.trim();
    if (!text && !m.type) return;

    if (text && text.startsWith(config.PREFIX)) {
      const [cmd, ...args] = text.slice(config.PREFIX.length).split(/\s+/);
      const plugin = plugins.get(cmd);
      if (plugin) {
        if (plugin.React) {
          await m.client.sendMessage(m.from, {
            react: { text: plugin.React, key: m.key }
          });
        }
        return plugin.exec(m, args);
      }
    }

    for (const listener of listeners) {
      if (listener.on === "text" && text) {
        if (listener.Listen && text.split(/\s+/)[0].toLowerCase() === listener.Listen.toLowerCase()) {
          if (listener.React) {
            await m.client.sendMessage(m.from, {
              react: { text: listener.React, key: m.key }
            });
          }
          await listener.exec(m);
        }
      } else if (listener.on === m.type) {
        if (listener.React) {
          await m.client.sendMessage(m.from, {
            react: { text: listener.React, key: m.key }
          });
        }
        await listener.exec(m);
      }
    }
  } catch (err) {
    console.error("Plugin execution error:", err);
  }
}