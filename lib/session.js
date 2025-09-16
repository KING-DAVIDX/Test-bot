import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import config from "../config.js";

const supabase = createClient("https://cdvmjrpmrhvzwjutjqwc.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdm1qcnBtcmh2endqdXRqcXdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc4MjIzNywiZXhwIjoyMDY5MzU4MjM3fQ.XngWATkln_MgRDU8mog9DJjQ_wUwzy5GbyrRlSMULSc");

export async function downloadSessionFiles(destDir) {
  const listRes = await supabase.storage.from("session").list(config.SESSION);
  if (listRes.error) throw listRes.error;

  const files = listRes.data || [];
  for (const f of files) {
    const remotePath = `${config.SESSION}/${f.name}`;
    const dl = await supabase.storage.from("session").download(remotePath);
    if (dl.error) throw dl.error;
    const data = dl.data;
    let buf;
    if (data && typeof data.arrayBuffer === "function") {
      buf = Buffer.from(await data.arrayBuffer());
    } else {
      buf = Buffer.from(data);
    }
    fs.writeFileSync(path.join(destDir, f.name), buf);
  }
}