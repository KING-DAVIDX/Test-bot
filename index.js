import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";
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

    sock.ev.on("messages.upsert", m => {
      try {
        console.log(JSON.stringify(m, null, 2));
      } catch (e) {
        console.error(e && e.stack ? e.stack : e);
      }
    });

    sock.ev.on("connection.update", async update => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        if ([DisconnectReason.connectionLost, DisconnectReason.connectionClosed, DisconnectReason.restartRequired].includes(code)) {
          await delay(1000);
          start().catch(() => {});
        } else {
          try { sock.end(); } catch (e) {}
        }
      }
    });
  } finally {
    release();
  }
}

start().catch(err => console.error(err && err.stack ? err.stack : err));