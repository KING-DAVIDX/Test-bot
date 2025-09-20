import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";
import express from "express";
import chalk from "chalk";
import {
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  makeWASocket,
} from "baileys";
import { Mutex } from "async-mutex";
import NodeCache from "node-cache";
import config from "../config.js";
import { serialize } from "./serialize.js";
import { initStore } from "./store.js";
import { downloadSessionFiles } from "./session.js";
import { setGroupMetadata, initGroupCache } from "./lid.js";
import { loadPlugins, handleMessage, getPluginCount } from "./plugin.js";
import { logMessage } from "./log.js";
import { getConfig } from "./filewatcher.js";

const PORT = process.env.PORT || 7860;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mutex = new Mutex();

// Create group cache in index.js
const groupCache = new NodeCache({ 
  stdTTL: 60 * 5, // 5 minutes
  checkperiod: 60 // Check for expired items every minute
});

let sock;

const app = express();
app.get("/", (req, res) => {
  res.send("WhatsApp bot server is running");
});
app.listen(PORT, () => {
  console.log(chalk.blue(`Server running on http://localhost:${PORT}`));
});

// Helper function to get group metadata with caching
async function getCachedGroupMetadata(groupId) {
  if (!groupId) return null;
  
  let metadata = groupCache.get(groupId);
  if (!metadata) {
    try {
      metadata = await sock.groupMetadata(groupId);
      groupCache.set(groupId, metadata);
    } catch (error) {
      console.error(`Failed to fetch metadata for group ${groupId}:`, error);
      return null;
    }
  }
  return metadata;
}

export async function start() {
  const release = await mutex.acquire();
  try {
    // ✅ Initialize store + plugins first
    await initStore();
    await loadPlugins();
    
    // Initialize group cache in lid.js
    initGroupCache(groupCache);

    const sessionDir = path.join(__dirname, "../session");
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    await downloadSessionFiles(sessionDir).catch(() => {});
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
      },
      logger: pino({ level: "fatal" }),
      waWebSocketUrl: 'wss://wa-proxy-x.onrender.com/wa-proxy',
      customUploadHosts: [
        { hostname: 'wa-proxy-x.onrender.com' }
      ],
      browser: Browsers.macOS("Safari"),
      markOnlineOnConnect: true
    });

    sock.ev.on("creds.update", async () => {
      await saveCreds();
    });

    sock.ev.on("groups.update", async (updates) => {
      try {
        for (const update of updates) {
          if (update.id) {
            // Invalidate cache for updated groups
            groupCache.del(update.id);
            // Fetch fresh metadata and cache it
            const metadata = await sock.groupMetadata(update.id);
            setGroupMetadata(metadata);
          }
        }
      } catch (error) {
        console.error("Error handling groups.update:", error);
      }
    });

    sock.ev.on("group-participants.update", async (event) => {
      try {
        if (event.id) {
          // Invalidate cache for the group with participant changes
          groupCache.del(event.id);
          // Fetch fresh metadata and cache it
          const metadata = await sock.groupMetadata(event.id);
          setGroupMetadata(metadata);
        }
      } catch (error) {
        console.error("Error handling group-participants.update:", error);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        for (const msg of messages) {
          const s = await serialize(sock, msg);
          if (!s) continue;
          if (s.type === "senderKeyDistributionMessage" || s.type === "protocolMessage") continue;

          let fromName;
          if (s.isGroup) {
            try {
              // Use cached group metadata
              const meta = await getCachedGroupMetadata(s.from);
              if (meta) {
                setGroupMetadata(meta); // Ensure it's in cache
                fromName = `[${meta.subject}] [${s.pushName || s.participant}]`;
              } else {
                fromName = `[${s.from}] [${s.pushName || s.participant}]`;
              }
            } catch {
              fromName = `[${s.from}] [${s.pushName || s.participant}]`;
            }
          } else if (s.isStatus) {
            fromName = `[STATUS] [${s.pushName || s.participant}]`;
          } else {
            fromName = `[${s.fromMe ? "ME" : s.pushName || s.participant}]`;
          }
          logMessage(s, fromName);
          await handleMessage(s);
        }
      } catch (e) {
        console.error(e && e.stack ? e.stack : e);
      }
    });

    sock.ev.on("connection.update", async update => {
      const { connection, lastDisconnect } = update;
      if (connection === "open") {
        console.log(chalk.greenBright(`✅ Connected to ${sock.user.name}`));
        
        // Pre-cache groups the bot is in
        try {
          const groups = await sock.groupFetchAllParticipating();
          Object.values(groups).forEach(group => {
            if (group.id) {
              setGroupMetadata(group);
            }
          });
          console.log(chalk.blue(`📦 Pre-cached ${Object.keys(groups).length} groups`));
        } catch (error) {
          console.error("Failed to pre-cache groups:", error);
        }
        
        if (getConfig().START_UP_MSG) {
          try {
            await sock.sendMessage(sock.user.id, {
              image: { url: "https://cdn.kordai.biz.id/serve/f2YaUEhETXP4.jpg" },
              caption: `✨ Nexus-Bot Online ✨
👤 User: ${sock.user.name}
⚡ Prefix: ${getConfig().PREFIX}
📦 Plugins Loaded: ${await getPluginCount()}
💾 Groups Cached: ${groupCache.keys().length}`
            }, { ephemeralExpiration: 120 });
          } catch (err) {
            console.error("Failed to send startup message:", err);
          }
        }
      }
      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        if ([DisconnectReason.connectionLost, DisconnectReason.connectionClosed, DisconnectReason.restartRequired].includes(code)) {
          await delay(1000);
          start().catch(() => {});
        } else {
          try { sock.end(); } catch {}
        }
      }
    });

  } finally {
    release();
  }
}

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err?.stack || err);
});
process.on("unhandledRejection", reason => {
  console.error("Unhandled Rejection:", reason);
});

export { groupCache };