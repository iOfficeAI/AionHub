#!/usr/bin/env node
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_FFMPEG = "ffmpeg";
const DEFAULT_FFPROBE = "ffprobe";

function usage() {
  console.log(`Usage:
node keyframe-video-outfit.mjs --video <person.mp4> --clothes <clothes.jpg> --out <result.mp4> [options]

Options:
  --workdir <dir>         Working directory. Default: ./siliconflow-keyframe-video-work
  --segments <n>          Number of representative keyframes. Default: 7
  --api-key-file <file>   Read SiliconFlow API key from a text file instead of env.
  --ffmpeg <path>         ffmpeg executable path.
  --ffprobe <path>        ffprobe executable path.
  --image-size <WxH>      I2V output size. Default: original video size clamped to 720x1280 for vertical.
  --poll-ms <ms>          Video status poll interval. Default: 15000
  --help                  Show this help.
`);
}

function parseArgs(argv) {
  const args = {
    segments: 7,
    pollMs: 15000,
    workdir: path.resolve("siliconflow-keyframe-video-work"),
    ffmpeg: DEFAULT_FFMPEG,
    ffprobe: DEFAULT_FFPROBE,
  };

  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--help" || key === "-h") {
      args.help = true;
      continue;
    }
    const value = argv[++i];
    if (!value) throw new Error(`Missing value for ${key}`);
    if (key === "--video") args.video = path.resolve(value);
    else if (key === "--clothes") args.clothes = path.resolve(value);
    else if (key === "--out") args.out = path.resolve(value);
    else if (key === "--workdir") args.workdir = path.resolve(value);
    else if (key === "--segments") args.segments = Number.parseInt(value, 10);
    else if (key === "--api-key-file") args.apiKeyFile = path.resolve(value);
    else if (key === "--ffmpeg") args.ffmpeg = value;
    else if (key === "--ffprobe") args.ffprobe = value;
    else if (key === "--image-size") args.imageSize = value;
    else if (key === "--poll-ms") args.pollMs = Number.parseInt(value, 10);
    else throw new Error(`Unknown argument: ${key}`);
  }

  return args;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stderr}`));
    });
  });
}

async function apiKey(args) {
  if (args.apiKeyFile) return (await readFile(args.apiKeyFile, "utf8")).trim();
  if (process.env.SILICONFLOW_API_KEY) return process.env.SILICONFLOW_API_KEY.trim();
  throw new Error("Set SILICONFLOW_API_KEY or pass --api-key-file.");
}

function mimeFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function dataUrl(filePath) {
  const bytes = await readFile(filePath);
  return `data:${mimeFromFile(filePath)};base64,${bytes.toString("base64")}`;
}

async function probeVideo(ffprobe, videoPath) {
  const { stdout } = await run(ffprobe, [
    "-hide_banner",
    "-v", "error",
    "-show_entries", "stream=codec_type,width,height,avg_frame_rate,r_frame_rate,nb_frames,duration",
    "-show_entries", "format=duration,size",
    "-of", "json",
    videoPath,
  ]);
  const json = JSON.parse(stdout);
  const video = json.streams.find((stream) => stream.codec_type === "video") ?? {};
  const duration = Number.parseFloat(json.format?.duration ?? video.duration ?? "0");
  return {
    width: Number(video.width),
    height: Number(video.height),
    duration,
    frames: Number(video.nb_frames || 0),
  };
}

function outputSize(meta, override) {
  if (override) return override;
  if (meta.height >= meta.width) return "720x1280";
  return "1280x720";
}

async function extractKeyframes(args, meta, videoPath, framesDir) {
  await mkdir(framesDir, { recursive: true });
  const times = [];
  for (let i = 0; i < args.segments; i++) {
    const t = Math.min(meta.duration - 0.05, (meta.duration * i) / Math.max(1, args.segments - 1));
    times.push(Math.max(0, t));
  }

  for (let i = 0; i < times.length; i++) {
    const out = path.join(framesDir, `keyframe_${String(i + 1).padStart(2, "0")}.jpg`);
    if (existsSync(out)) continue;
    await run(args.ffmpeg, [
      "-y",
      "-ss", String(times[i]),
      "-i", videoPath,
      "-frames:v", "1",
      "-q:v", "2",
      out,
    ]);
  }
}

async function resizeReference(args, source, outPath) {
  if (existsSync(outPath)) return;
  await run(args.ffmpeg, [
    "-y",
    "-i", source,
    "-vf", "scale='min(768,iw)':-2",
    "-q:v", "3",
    outPath,
  ]);
}

function editPrompt(index, total) {
  return [
    "Use image 1 as the exact target video keyframe. Use image 2 only as clothing reference.",
    "Replace only visible clothing with the reference outfit style. Preserve identity, face if visible, sunglasses if visible, hair, expression, pose, hand position, handbag, legs, shoes, background, lighting, camera angle, crop, and vertical video composition.",
    "For close-up frames, edit only clothing below the chin and do not cover the face.",
    "Do not use image 2 as a pose reference. Do not create a new room. Do not add a phone, text, watermark, logo, or extra people.",
    `Keyframe ${index} of ${total}.`,
  ].join(" ");
}

async function editKeyframes(args, key, framesDir, clothesRef, editedDir) {
  await mkdir(editedDir, { recursive: true });
  const frames = (await readdir(framesDir)).filter((name) => name.endsWith(".jpg")).sort();
  const image2 = await dataUrl(clothesRef);

  for (let i = 0; i < frames.length; i++) {
    const source = path.join(framesDir, frames[i]);
    const out = path.join(editedDir, `edited_${String(i + 1).padStart(2, "0")}.png`);
    const jsonPath = path.join(editedDir, `edited_${String(i + 1).padStart(2, "0")}.json`);
    if (existsSync(out)) continue;

    const response = await fetch("https://api.siliconflow.cn/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Qwen/Qwen-Image-Edit-2509",
        prompt: editPrompt(i + 1, frames.length),
        image: await dataUrl(source),
        image2,
      }),
    });

    const json = await response.json();
    await writeFile(jsonPath, JSON.stringify(json, null, 2));
    if (!response.ok) throw new Error(`Image edit failed for keyframe ${i + 1}: ${response.status} ${JSON.stringify(json)}`);

    const url = json.images?.[0]?.url ?? json.data?.[0]?.url;
    if (!url) throw new Error(`No image URL for keyframe ${i + 1}.`);
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) throw new Error(`Edited image download failed for keyframe ${i + 1}.`);
    await writeFile(out, Buffer.from(await imageResponse.arrayBuffer()));
    console.log(`edited keyframe ${i + 1}/${frames.length}`);
  }
}

function segmentPrompt(index, total) {
  return [
    `Animate edited fashion keyframe ${index} of ${total}.`,
    "Keep the same person, same outfit, same clothing colors and pattern, same background, same crop, and same vertical frame.",
    "Use gentle realistic motion only: small pose shift, slight fabric motion, slight camera motion.",
    "No text, watermark, logo, phone, or extra people.",
  ].join(" ");
}

function videoUrlFromStatus(status) {
  return status.results?.videos?.[0]?.url ?? status.results?.video?.url ?? status.video?.url ?? status.data?.[0]?.url ?? status.url;
}

async function submitVideos(args, key, editedDir, segmentsDir, size) {
  await mkdir(segmentsDir, { recursive: true });
  const images = (await readdir(editedDir)).filter((name) => /^edited_\d+\.png$/.test(name)).sort();
  const jobs = [];

  for (let i = 0; i < images.length; i++) {
    const submitPath = path.join(segmentsDir, `segment_${String(i + 1).padStart(2, "0")}_submit.json`);
    let requestId = null;
    if (existsSync(submitPath)) {
      const existing = JSON.parse(await readFile(submitPath, "utf8"));
      requestId = existing.requestId;
    }
    if (!requestId) {
      const response = await fetch("https://api.siliconflow.cn/v1/video/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "Wan-AI/Wan2.2-I2V-A14B",
          prompt: segmentPrompt(i + 1, images.length),
          image: await dataUrl(path.join(editedDir, images[i])),
          image_size: size,
        }),
      });
      const json = await response.json();
      await writeFile(submitPath, JSON.stringify(json, null, 2));
      if (!response.ok || !json.requestId) throw new Error(`Video submit failed for segment ${i + 1}: ${response.status} ${JSON.stringify(json)}`);
      requestId = json.requestId;
    }
    jobs.push({ index: i + 1, requestId });
    console.log(`segment ${i + 1} request ${requestId}`);
  }

  await writeFile(path.join(segmentsDir, "jobs.json"), JSON.stringify(jobs, null, 2));
  return jobs;
}

async function pollVideos(args, key, jobs, segmentsDir) {
  const pending = new Map(jobs.map((job) => [job.index, job]));
  while (pending.size > 0) {
    for (const [index, job] of [...pending]) {
      const outPath = path.join(segmentsDir, `segment_${String(index).padStart(2, "0")}.mp4`);
      if (existsSync(outPath)) {
        pending.delete(index);
        continue;
      }
      const response = await fetch("https://api.siliconflow.cn/v1/video/status", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId: job.requestId }),
      });
      const status = await response.json();
      await writeFile(path.join(segmentsDir, `segment_${String(index).padStart(2, "0")}_status.json`), JSON.stringify(status, null, 2));
      if (!response.ok) throw new Error(`Status failed for segment ${index}: ${response.status} ${JSON.stringify(status)}`);

      const state = String(status.status ?? status.state ?? status.task_status ?? "").toLowerCase();
      const url = videoUrlFromStatus(status);
      console.log(`segment ${index}: ${state || "unknown"}`);
      if (url || ["succeed", "succeeded", "success", "completed"].includes(state)) {
        if (!url) throw new Error(`Segment ${index} completed without URL.`);
        const download = await fetch(url);
        if (!download.ok) throw new Error(`Segment ${index} download failed: ${download.status}`);
        await writeFile(outPath, Buffer.from(await download.arrayBuffer()));
        pending.delete(index);
        console.log(`segment ${index} downloaded`);
      } else if (["failed", "failure", "error"].includes(state)) {
        throw new Error(`Segment ${index} failed: ${JSON.stringify(status)}`);
      }
    }
    if (pending.size > 0) await new Promise((resolve) => setTimeout(resolve, args.pollMs));
  }
}

async function makeContactSheet(args, framesDir, editedDir, outPath) {
  const frames = (await readdir(framesDir)).filter((name) => name.endsWith(".jpg")).sort();
  const inputs = [];
  const labels = [];
  for (let i = 0; i < frames.length; i++) {
    inputs.push("-i", path.join(framesDir, frames[i]));
    inputs.push("-i", path.join(editedDir, `edited_${String(i + 1).padStart(2, "0")}.png`));
    labels.push(`[${i * 2}:v]scale=240:-1[o${i}];[${i * 2 + 1}:v]scale=240:-1[e${i}]`);
  }
  const rows = frames.map((_, i) => `[o${i}][e${i}]hstack=inputs=2[r${i}]`);
  const stackInputs = frames.map((_, i) => `[r${i}]`).join("");
  const filter = `${labels.join(";")};${rows.join(";")};${stackInputs}vstack=inputs=${frames.length}[out]`;
  await run(args.ffmpeg, ["-y", ...inputs, "-filter_complex", filter, "-map", "[out]", "-frames:v", "1", outPath]);
}

async function composeFinal(args, meta, segmentsDir, originalAscii, finalAscii) {
  const segmentFiles = (await readdir(segmentsDir)).filter((name) => /^segment_\d+\.mp4$/.test(name)).sort();
  const slice = meta.duration / segmentFiles.length;
  const ffArgs = ["-y"];
  for (const file of segmentFiles) ffArgs.push("-i", path.join(segmentsDir, file));
  ffArgs.push("-i", originalAscii);

  const filters = [];
  for (let i = 0; i < segmentFiles.length; i++) {
    filters.push(`[${i}:v]trim=start=0:duration=${slice},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,fps=25,format=yuv420p[v${i}]`);
  }
  const concatInputs = segmentFiles.map((_, i) => `[v${i}]`).join("");
  const filter = `${filters.join(";")};${concatInputs}concat=n=${segmentFiles.length}:v=1:a=0[vout]`;

  ffArgs.push(
    "-filter_complex", filter,
    "-map", "[vout]",
    "-map", `${segmentFiles.length}:a?`,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    "-movflags", "+faststart",
    finalAscii,
  );
  await run(args.ffmpeg, ffArgs);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.video || !args.clothes || !args.out) {
    usage();
    throw new Error("--video, --clothes, and --out are required.");
  }
  if (!Number.isInteger(args.segments) || args.segments < 2) throw new Error("--segments must be at least 2.");

  const key = await apiKey(args);
  await mkdir(args.workdir, { recursive: true });

  const originalAscii = path.join(args.workdir, "source_video.mp4");
  const clothesAscii = path.join(args.workdir, "clothes_ref" + path.extname(args.clothes).toLowerCase());
  await copyFile(args.video, originalAscii);
  await copyFile(args.clothes, clothesAscii);

  const meta = await probeVideo(args.ffprobe, originalAscii);
  await writeFile(path.join(args.workdir, "video_probe.json"), JSON.stringify(meta, null, 2));
  const size = outputSize(meta, args.imageSize);
  console.log(`video ${meta.width}x${meta.height}, duration ${meta.duration.toFixed(2)}s, segments ${args.segments}, I2V size ${size}`);

  const framesDir = path.join(args.workdir, "keyframes");
  const editedDir = path.join(args.workdir, "edited_keyframes");
  const segmentsDir = path.join(args.workdir, "video_segments");
  const resizedRef = path.join(args.workdir, "clothes_ref_small.jpg");
  const finalAscii = path.join(args.workdir, "final_keyframe_video.mp4");

  await extractKeyframes(args, meta, originalAscii, framesDir);
  await resizeReference(args, clothesAscii, resizedRef);
  await editKeyframes(args, key, framesDir, resizedRef, editedDir);
  await makeContactSheet(args, framesDir, editedDir, path.join(args.workdir, "keyframe_check.jpg"));
  const jobs = await submitVideos(args, key, editedDir, segmentsDir, size);
  await pollVideos(args, key, jobs, segmentsDir);
  await composeFinal(args, meta, segmentsDir, originalAscii, finalAscii);
  await copyFile(finalAscii, args.out);

  const previewOut = args.out.replace(/\.mp4$/i, "-preview.jpg");
  await run(args.ffmpeg, ["-y", "-i", finalAscii, "-vf", "fps=1,scale=180:-1,tile=4x2", "-frames:v", "1", previewOut]);
  console.log(`done: ${args.out}`);
  console.log(`preview: ${previewOut}`);
  console.log(`keyframe check: ${path.join(args.workdir, "keyframe_check.jpg")}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
