import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "database", "store.db");
let db;

export async function initStore() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      fromJid TEXT,
      sender TEXT,
      type TEXT,
      text TEXT,
      timestamp INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS plugins (
      name TEXT PRIMARY KEY,
      alias TEXT,
      type TEXT,
      description TEXT,
      createdAt INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  // ===== Message helpers =====
  global.chatHistory = async (limit = 50) => {
    return db.all("SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?", limit);
  };

  global.findMsg = async (id) => {
    return db.get("SELECT * FROM messages WHERE id = ?", id);
  };

  global.loadMessage = async (fromJid, limit = 20) => {
    return db.all(
      "SELECT * FROM messages WHERE fromJid = ? ORDER BY timestamp DESC LIMIT ?",
      fromJid,
      limit
    );
  };

  global.writeMessage = async (msg) => {
    if (!msg?.id) return;
    await db.run(
      `INSERT OR REPLACE INTO messages (id, fromJid, sender, type, text, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      msg.id,
      msg.from,
      msg.pushName || msg.participant || "",
      msg.type || "",
      msg.text || "",
      Math.floor(Date.now() / 1000)
    );
  };

  global.getname = async (jid) => {
    const row = await db.get(
      "SELECT sender FROM messages WHERE fromJid = ? ORDER BY timestamp DESC LIMIT 1",
      jid
    );
    return row?.sender || null;
  };

  global.checkStr = async (str) => {
    return db.all("SELECT * FROM messages WHERE text LIKE ? LIMIT 20", `%${str}%`);
  };

  global.dbhealth = async () => {
    try {
      await db.get("SELECT 1");
      return true;
    } catch {
      return false;
    }
  };

  global.clearOld = async (days = 30) => {
    const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
    await db.run("DELETE FROM messages WHERE timestamp < ?", cutoff);
  };

  // ===== Plugin helpers =====
  global.clearPlugins = async () => {
    await db.run("DELETE FROM plugins");
  };

  global.registerPlugin = async (meta) => {
    if (!meta?.name && !meta?.on) return;
    await db.run(
      `INSERT OR REPLACE INTO plugins (name, alias, type, description, createdAt)
       VALUES (?, ?, ?, ?, strftime('%s','now'))`,
      meta.name || meta.on,
      meta.alias || null,
      meta.on ? "listener" : "command",
      meta.desc || ""
    );
  };

  global.getPluginList = async () => {
    return db.all("SELECT * FROM plugins ORDER BY createdAt DESC");
  };

  global.getPluginCount = async () => {
    const row = await db.get("SELECT COUNT(*) as count FROM plugins");
    return row?.count || 0;
  };

  global.bind = async () => true; // placeholder
  global.close = async () => db.close();
  global.getMessage = async (id) => findMsg(id);
}