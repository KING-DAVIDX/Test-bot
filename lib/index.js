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
import config from "../config.js";
import { serialize } from "./serialize.js";
import { initStore } from "./store.js";
import { downloadSessionFiles } from "./session.js";
import { resolveLidToJid, setGroupMetadata, getGroupMetadata } from "./lid.js";
import { loadPlugins, handleMessage, getPluginCount } from "./plugin.js";
import { logMessage } from "./log.js";
import { getConfig } from "./filewatcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mutex = new Mutex();
let sock;

export async function start() {
  const release = await mutex.acquire();
  try {
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
      browser: Browsers.macOS("Safari"),
      markOnlineOnConnect: true
    });

    sock.ev.on("creds.update", async () => {
      await saveCreds();
    });

    sock.ev.on("groups.update", async ([event]) => {
      try {
        const metadata = await sock.groupMetadata(event.id);
        setGroupMetadata(metadata);
      } catch {}
    });

    sock.ev.on("group-participants.update", async (event) => {
      try {
        const metadata = await sock.groupMetadata(event.id);
        setGroupMetadata(metadata);
      } catch {}
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
              const meta = await sock.groupMetadata(resolveLidToJid(s.from));
              setGroupMetadata(meta);
              fromName = `[${meta.subject}] [${s.pushName || resolveLidToJid(s.participant)}]`;
            } catch {
              fromName = `[${resolveLidToJid(s.from)}] [${s.pushName || resolveLidToJid(s.participant)}]`;
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
        console.log(chalk.greenBright("Connection successful"));
        if (getConfig().START_UP_MSG) {
          try {
            await sock.sendMessage(sock.user.id, {
              image: { url: "https://cdn.kordai.biz.id/serve/f2YaUEhETXP4.jpg" },
              caption: `NEXUS-BOT | Prefix: ${getConfig().PREFIX} | Plugins: ${getPluginCount()}`
            });
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

    const app = express();
    app.get("/", (req, res) => {
      res.send("WhatsApp bot server is running");
    });

    app.listen(3000, () => {
      console.log(chalk.blue("Server running on http://localhost:3000"));
    });

    await initStore();
    loadPlugins();
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