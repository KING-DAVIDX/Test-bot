import axios from "axios"
import fs from "fs"
import path from "path"

const GITTOKEN_PART1 = "ghp_RsEDsSgo8Ec"
const GITTOKEN_PART2 = "716ddhFhQPkoDejXSRq4QUX8m"
const GITTOKEN = GITTOKEN_PART1 + GITTOKEN_PART2

const OWNER = "KING-DAVIDX"
const REPO = "Test-bot"
const BRANCH = "main"

const EXCLUDED_FOLDERS = ["node_modules", "sessions", "config"]
const EXCLUDED_FILES = ["config.js", "package.json"]
const COMMIT_FILE = path.join(process.cwd(), ".last_commit")

const api = axios.create({
  baseURL: `https://api.github.com/repos/${OWNER}/${REPO}`,
  headers: {
    Authorization: `token ${GITTOKEN}`,
    "User-Agent": "axios-client",
  },
})

async function getLatestCommitSha() {
  const res = await api.get(`/commits/${BRANCH}`)
  return res.data.sha
}

export async function updateRepo() {
  const latestSha = await getLatestCommitSha()
  let lastSha = null

  if (fs.existsSync(COMMIT_FILE)) {
    lastSha = fs.readFileSync(COMMIT_FILE, "utf-8").trim()
  }

  if (!lastSha) {
    fs.writeFileSync(COMMIT_FILE, latestSha)
    return { updated: [], deleted: [], sha: latestSha, upToDate: true }
  }

  if (lastSha === latestSha) {
    return { updated: [], deleted: [], sha: latestSha, upToDate: true }
  }

  const res = await api.get(`/compare/${lastSha}...${latestSha}`)
  const changedFiles = res.data.files

  let updated = []
  let deleted = []

  for (const file of changedFiles) {
    const filename = file.filename
    const status = file.status // "added" | "modified" | "removed" | "renamed"

    if (EXCLUDED_FOLDERS.some((f) => filename.startsWith(f))) continue
    if (EXCLUDED_FILES.includes(filename)) continue

    const localPath = path.join(process.cwd(), filename)

    if (status === "removed") {
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath)
        deleted.push(filename)
      }
      continue
    }

    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${filename}`
    const resFile = await axios.get(rawUrl, {
      headers: { Authorization: `token ${GITTOKEN}` },
      responseType: "text",
    })
    const remoteContent = resFile.data

    if (fs.existsSync(localPath)) {
      const localContent = fs.readFileSync(localPath, "utf-8")
      if (remoteContent !== localContent) {
        fs.mkdirSync(path.dirname(localPath), { recursive: true })
        fs.writeFileSync(localPath, remoteContent, "utf-8")
        updated.push(filename)
      }
    } else {
      fs.mkdirSync(path.dirname(localPath), { recursive: true })
      fs.writeFileSync(localPath, remoteContent, "utf-8")
      updated.push(filename)
    }
  }

  fs.writeFileSync(COMMIT_FILE, latestSha)
  return {
    updated,
    deleted,
    sha: latestSha,
    upToDate: updated.length === 0 && deleted.length === 0,
  }
}