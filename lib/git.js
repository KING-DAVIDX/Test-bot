// git.js
import axios from "axios"
import fs from "fs"
import path from "path"

const GITTOKEN_PART1 = "ghp_RsEDsSgo8Ec"
const GITTOKEN_PART2 = "716ddhFhQPkoDejXSRq4QUX8m"
const GITTOKEN = GITTOKEN_PART1 + GITTOKEN_PART2

const OWNER = "KING-DAVIDX"
const REPO = "Test-bot"
const BRANCH = "main"

// folders to skip when updating
const EXCLUDED_FOLDERS = ["node_modules", "sessions"]

// files to skip when updating
const EXCLUDED_FILES = ["config.js", "package.json"]

// file to track the last commit pulled
const COMMIT_FILE = path.join(process.cwd(), ".last_commit")

const api = axios.create({
  baseURL: `https://api.github.com/repos/${OWNER}/${REPO}`,
  headers: {
    Authorization: `token ${GITTOKEN}`,
    "User-Agent": "axios-client"
  }
})

async function getLatestCommitSha() {
  const res = await api.get(`/commits/${BRANCH}`)
  return res.data.sha
}

async function getTree(sha) {
  const res = await api.get(`/git/trees/${sha}?recursive=1`)
  return res.data.tree
}

async function downloadFile(filePath, url) {
  const res = await axios.get(url, {
    headers: { Authorization: `token ${GITTOKEN}` },
    responseType: "arraybuffer"
  })

  const localPath = path.join(process.cwd(), filePath)
  fs.mkdirSync(path.dirname(localPath), { recursive: true })
  fs.writeFileSync(localPath, res.data)
}

export async function updateRepo() {
  const latestSha = await getLatestCommitSha()

  let lastSha = null
  if (fs.existsSync(COMMIT_FILE)) {
    lastSha = fs.readFileSync(COMMIT_FILE, "utf-8").trim()
  }

  if (lastSha === latestSha) {
    return { updated: [], sha: latestSha, upToDate: true }
  }

  const tree = await getTree(latestSha)
  let updated = []

  for (const item of tree) {
    if (item.type === "blob") {
      // skip excluded folders
      if (EXCLUDED_FOLDERS.some((f) => item.path.startsWith(f))) continue

      // skip excluded files
      if (EXCLUDED_FILES.includes(item.path)) continue

      const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${item.path}`
      await downloadFile(item.path, rawUrl)
      updated.push(item.path)
    }
  }

  fs.writeFileSync(COMMIT_FILE, latestSha)
  return { updated, sha: latestSha, upToDate: false }
}