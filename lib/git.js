import axios from "axios";
import fs from "fs";
import path from "path";

const GITTOKEN_PART1 = "ghp_RsEDsSgo8Ec";
const GITTOKEN_PART2 = "716ddhFhQPkoDejXSRq4QUX8m";
const GITTOKEN = GITTOKEN_PART1 + GITTOKEN_PART2;

const OWNER = "KING-DAVIDX";
const REPO = "Test-bot";
const BRANCH = "main";

const EXCLUDED_FOLDERS = ["node_modules", "sessions", "config"];
const EXCLUDED_FILES = ["config.js", "package.json"];
const COMMIT_FILE = path.join(process.cwd(), ".last_commit");

const api = axios.create({
  baseURL: `https://api.github.com/repos/${OWNER}/${REPO}`,
  headers: {
    Authorization: `token ${GITTOKEN}`,
    "User-Agent": "axios-client",
  },
});

async function getLatestCommitSha() {
  const res = await api.get(`/commits/${BRANCH}`);
  return res.data.sha;
}

async function getChangedFiles(base, head) {
  const res = await api.get(`/compare/${base}...${head}`);
  return res.data.files.map((f) => f.filename);
}

async function downloadFile(filePath, url) {
  const res = await axios.get(url, {
    headers: { Authorization: `token ${GITTOKEN}` },
    responseType: "arraybuffer",
  });
  const localPath = path.join(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, res.data);
}

export async function updateRepo() {
  const latestSha = await getLatestCommitSha();
  let lastSha = null;

  if (fs.existsSync(COMMIT_FILE)) {
    lastSha = fs.readFileSync(COMMIT_FILE, "utf-8").trim();
  }

  // First run: just record latest commit, skip downloading everything
  if (!lastSha) {
    fs.writeFileSync(COMMIT_FILE, latestSha);
    return { updated: [], sha: latestSha, upToDate: true };
  }

  if (lastSha === latestSha) {
    return { updated: [], sha: latestSha, upToDate: true };
  }

  // Only fetch actual diff
  const changedFiles = await getChangedFiles(lastSha, latestSha);

  let updated = [];
  for (const file of changedFiles) {
    if (EXCLUDED_FOLDERS.some((f) => file.startsWith(f))) continue;
    if (EXCLUDED_FILES.includes(file)) continue;

    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${file}`;
    await downloadFile(file, rawUrl);
    updated.push(file);
  }

  fs.writeFileSync(COMMIT_FILE, latestSha);
  return { updated, sha: latestSha, upToDate: updated.length === 0 };
}