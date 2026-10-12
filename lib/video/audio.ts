"use client";

const SAMPLE_RATE = 16000; // what Whisper expects

/** Decodes the video's audio track and resamples it to 16 kHz mono. */
export async function extraerAudio(file: File): Promise<Float32Array> {
  const buffer = await file.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(buffer);
  } finally {
    ctx.close().catch(() => {});
  }

  const frames = Math.ceil(decoded.duration * SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, frames, SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination); // down-mixes to mono
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

export { SAMPLE_RATE };
