import * as cheerio from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";

const SPOTIFY_URL = "https://kworb.net/spotify/artist/1z4g3DjTBBZKhvAroFlhOM_songs.html";

function parseNumber(value) {
  return Number(String(value || "").replace(/[^0-9]/g, "")) || 0;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" }
  });

  if (!response.ok) throw new Error(`Erro ao acessar ${url}`);
  return response.text();
}

async function main() {
  const html = await fetchHTML(SPOTIFY_URL);
  const $ = cheerio.load(html);

  const songs = [];

  $("tr").each((_, row) => {
    const cells = $(row).find("td");
    const title = cleanText($(cells[0]).text());

    if (!title || cells.length < 3) return;

    const streams = parseNumber($(cells[cells.length - 2]).text());
    const daily = parseNumber($(cells[cells.length - 1]).text());

    if (!streams) return;

    songs.push({
      rank: songs.length + 1,
      title,
      streams,
      daily
    });
  });

  if (!songs.length) {
    throw new Error("Spotify songs not found.");
  }

  const output = {
    source: SPOTIFY_URL,
    updatedAt: new Date().toISOString(),
    totals: {
      tracks: songs.length,
      streams: songs.reduce((sum, song) => sum + song.streams, 0),
      daily: songs.reduce((sum, song) => sum + song.daily, 0)
    },
    songs
  };

  await mkdir("data", { recursive: true });
  await writeFile("data/spotify.json", JSON.stringify(output, null, 2), "utf8");

  console.log(`Updated ${songs.length} Spotify songs.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
