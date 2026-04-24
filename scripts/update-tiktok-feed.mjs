#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const username = process.env.TIKTOK_USERNAME?.replace(/^@/, "") || "fallowfpv";
const profileUrl = `https://www.tiktok.com/@${username}`;
const maxItems = Number(process.env.TIKTOK_MAX_ITEMS || "24");
const outPath = resolve(process.cwd(), "tiktok-feed.json");

function toIso(v) {
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(v * 1000).toISOString();
  }
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return "";
}

function pickThumb(entry) {
  if (entry?.thumbnail) return String(entry.thumbnail);
  if (Array.isArray(entry?.thumbnails) && entry.thumbnails.length > 0) {
    const t = entry.thumbnails.find((x) => x?.url) || entry.thumbnails[0];
    if (t?.url) return String(t.url);
  }
  return "";
}

function normalizeEntry(entry) {
  const id = String(entry?.id || "").trim();
  if (!id) return null;
  const title = String(entry?.title || entry?.description || "TikTok").trim();
  const watchUrl = String(entry?.webpage_url || `${profileUrl}/video/${id}`);
  return {
    platform: "tiktok",
    id,
    title: title || "TikTok",
    publishedAt: toIso(entry?.timestamp || entry?.upload_date),
    thumbnailUrl: pickThumb(entry),
    watchUrl,
  };
}

async function run() {
  const args = [
    "--flat-playlist",
    "--dump-single-json",
    "--playlist-end",
    String(maxItems),
    profileUrl,
  ];

  const { stdout } = await execFileAsync("yt-dlp", args, {
    maxBuffer: 20 * 1024 * 1024,
  });
  const payload = JSON.parse(stdout);
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];

  const videos = entries.map(normalizeEntry).filter(Boolean);

  const out = {
    updatedAt: new Date().toISOString(),
    source: "yt-dlp",
    username,
    profileUrl,
    videos,
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  process.stdout.write(`Wrote ${videos.length} TikTok videos to ${outPath}\n`);
}

run().catch((err) => {
  process.stderr.write(String(err?.stack || err) + "\n");
  process.exit(1);
});
