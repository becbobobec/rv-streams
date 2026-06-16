import * as cheerio from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";

const SPOTIFY_URL = "https://kworb.net/spotify/artist/1z4g3DjTBBZKhvAroFlhOM_songs.html";
const YOUTUBE_URL = "https://kworb.net/youtube/artist/redvelvet.html";

function parseNumber(value) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 RedVelvetCharts/1.0" }
  });
  if (!response.ok) throw new Error(`Erro ao acessar ${url}: ${response.status}`);
  return response.text();
}

function parseSpotify(html) {
  const $ = cheerio.load(html);
  const songs = [];

  $("tr").each((_, row) => {
    const cells = $(row).find("td");
    const link = $(row).find("a[href*='open.spotify.com']").first();
    if (!link.length || cells.length < 3) return;

    const title = cleanText(link.text()).replace(/^\*\s*/, "");
    const streams = parseNumber($(cells[cells.length - 2]).text());
    const daily = parseNumber($(cells[cells.length - 1]).text());

    if (!title || !streams) return;

    songs.push({
      rank: songs.length + 1,
      title,
      streams,
      daily,
      url: link.attr("href") || ""
    });
  });

  if (!songs.length) throw new Error("Spotify table not found.");

  return {
    source: SPOTIFY_URL,
    updatedAt: new Date().toISOString(),
    totals: {
      streams: songs.reduce((sum, s) => sum + s.streams, 0),
      daily: songs.reduce((sum, s) => sum + s.daily, 0),
      tracks: songs.length
    },
    songs
  };
}

function parseYouTube(html) {
  const $ = cheerio.load(html);

  const lines = $("body")
    .text()
    .split(/\n+/)
    .map(cleanText);

  const bodyText = lines.join(" ");

  const videos = [];

  for (let i = 0; i < lines.length; i++) {
    const title = lines[i];
    if (!title) continue;
    if (title.includes("Video Views Yesterday Published")) continue;

    let stats = "";

    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      if (/^[\d,]+\s+[\d,]+\s+\d{4}\/\d{2}$/.test(lines[j])) {
        stats = lines[j];
        break;
      }
    }

    if (!stats) continue;

    const match = stats.match(/^([\d,]+)\s+([\d,]+)\s+(\d{4}\/\d{2})$/);

    if (!match) continue;

    videos.push({
      rank: videos.length + 1,
      title,
      views: parseNumber(match[1]),
      yesterday: parseNumber(match[2]),
      published: match[3],
      url: YOUTUBE_URL
    });
  }

  if (!videos.length) {
    throw new Error("YouTube table not found.");
  }

  return {
    source: YOUTUBE_URL,
    updatedAt: new Date().toISOString(),
    totals: {
      views: parseNumber(bodyText.match(/Total views:\s*([\d,]+)/)?.[1]),
      dailyAverage: parseNumber(bodyText.match(/Current daily avg:\s*([\d,]+)/)?.[1]),
      videos: videos.length
    },
    videos
  };
}

  if (!videos.length) throw new Error("YouTube table not found.");

  return {
    source: YOUTUBE_URL,
    updatedAt: new Date().toISOString(),
    totals: {
      views: parseNumber(bodyText.match(/Total views:\s*([\d,]+)/)?.[1]),
      dailyAverage: parseNumber(bodyText.match(/Current daily avg:\s*([\d,]+)/)?.[1]),
      videos: videos.length
    },
    videos
  };
}

async function main() {
  await mkdir("data", { recursive: true });

  const [spotifyHTML, youtubeHTML] = await Promise.all([
    fetchHTML(SPOTIFY_URL),
    fetchHTML(YOUTUBE_URL)
  ]);

  const spotify = parseSpotify(spotifyHTML);
  const youtube = parseYouTube(youtubeHTML);

  await writeFile("data/spotify.json", JSON.stringify(spotify, null, 2), "utf8");
  await writeFile("data/youtube.json", JSON.stringify(youtube, null, 2), "utf8");

  console.log(`Spotify: ${spotify.songs.length} songs`);
  console.log(`YouTube: ${youtube.videos.length} videos`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
