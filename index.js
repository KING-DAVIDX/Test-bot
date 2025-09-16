import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";
import express from "express";
import chalk from "chalk";
import { createClient } from "@supabase/supabase-js";
import {
  default as makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
  DisconnectReason
} from "baileys";
import { Mutex } from "async-mutex";
import config from "./config.js";
import { serialize } from "./lib/serialize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supabase = createClient(config.DBURL, config.SUPKEY);
const mutex = new Mutex();
let sock;

async function downloadSessionFiles(destDir) {
  const listRes = await supabase.storage.from("session").list(config.SESSION);
  if (listRes.error) throw listRes.error;
  const files = listRes.data || [];
  for (const f of files) {
    const remotePath = `${config.SESSION}/${f.name}`;
    const dl = await supabase.storage.from("session").download(remotePath);
    if (dl.error) throw dl.error;
    const data = dl.data;
    let buf;
    if (data && typeof data.arrayBuffer === "function") buf = Buffer.from(await data.arrayBuffer());
    else buf = Buffer.from(data);
    fs.writeFileSync(path.join(destDir, f.name), buf);
  }
}

async function start() {
  const release = await mutex.acquire();
  try {
    const sessionDir = path.join(__dirname, "session");
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

    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        for (const msg of messages) {
          const s = await serialize(sock, msg);
          if (!s) continue;

          // skip distribution key logs
          if (s.type === "senderKeyDistributionMessage") continue;

          // resolve group name if group
          let fromName = s.pushName || s.participant || "Unknown";
          if (s.isGroup) {
            try {
              const meta = await sock.groupMetadata(s.from);
              fromName = `${meta.subject} | ${s.pushName || s.participant}`;
            } catch {
              fromName = `${s.from} | ${s.pushName || s.participant}`;
            }
          }

          // build refined log without emojis
          let contentLog = "";
          switch (s.type) {
            case "conversation":
            case "extendedTextMessage":
              contentLog = chalk.white(`Text: ${s.text}`);
              break;
            case "imageMessage":
              contentLog = chalk.blue(`Image${s.text ? " | " + s.text : ""}`);
              break;
            case "videoMessage":
              contentLog = chalk.magenta(`Video${s.text ? " | " + s.text : ""}`);
              break;
            case "audioMessage":
              contentLog = chalk.cyan(`Audio`);
              break;
            case "stickerMessage":
              contentLog = chalk.green(`Sticker`);
              break;
            case "documentMessage":
            case "documentWithCaptionMessage":
              contentLog = chalk.yellow(
                `Document${s.text ? " | " + s.text : ""}`
              );
              break;
            case "reactionMessage":
              contentLog = chalk.red(`Reaction: ${s.reaction?.text}`);
              break;
            case "pollCreationMessageV3":
              contentLog = chalk.greenBright(
                `Poll: ${s.poll?.name} [${s.poll?.options?.join(", ")}]`
              );
              break;
            case "pollUpdateMessage":
              contentLog = chalk.greenBright(`Poll Update`);
              break;
            case "protocolMessage":
              contentLog = chalk.gray(`Protocol Message`);
              break;
            default:
              contentLog = chalk.gray(`${s.type}`);
          }

          console.log(
            chalk.bold(`[${s.fromMe ? "ME" : fromName}]`) + contentLog
          );

          if (s.quoted) {
            console.log(
              chalk.dim(
                `   ↳ quoted: ${s.quoted.text || "[" + s.quoted.type + "]"}`
              )
            );
          }
        }
      } catch (e) {
        console.error(e && e.stack ? e.stack : e);
      }
    });

    sock.ev.on("connection.update", async update => {
      const { connection, lastDisconnect } = update;
      if (connection === "open") {
        console.log(chalk.greenBright("Connection successful"));
        try {
          await sock.sendMessage(sock.user.id, { text: "Bot connected successfully" });
        } catch (err) {
          console.error("Failed to send success message:", err);
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

const app = express();

app.get("/", (req, res) => {
  res.send("WhatsApp bot server is running");
});

app.listen(3000, () => {
  console.log(chalk.blue("Server running on http://localhost:3000"));
});

start().catch(err => console.error(err && err.stack ? err.stack : err));