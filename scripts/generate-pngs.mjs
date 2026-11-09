import { crc32, deflateSync } from "node:zlib";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function u32(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value >>> 0, 0);
  return buf;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  return Buffer.concat([u32(data.length), body, u32(crc32(body))]);
}

function greyPng(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width + 1;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const start = y * stride;
    raw[start] = 0;
    raw.fill(128, start + 1, start + stride);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function padded(png) {
  const target = 1_000_001;
  if (png.length > target) {
    throw new Error(`png is ${png.length} bytes`);
  }
  const out = Buffer.alloc(target);
  png.copy(out);
  return out;
}

async function writeBytes(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, bytes);
  await rename(tmp, file);
}

function jpegBytes() {
  const app0 = Buffer.concat([
    Buffer.from([0xff, 0xe0, 0x00, 0x10]),
    Buffer.from("JFIF\0", "ascii"),
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
  ]);
  const comment = Buffer.from([0xff, 0xfe, 0x00, 0x04, 0x00, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, comment, Buffer.from([0xff, 0xd9])]);
}

function badSignature(png) {
  const out = Buffer.from(png);
  out[0] ^= 0xff;
  return out;
}

const square = greyPng(1024, 1024);
const jpeg = jpegBytes();
if (jpeg.length < 24) {
  throw new Error(`jpeg is ${jpeg.length} bytes`);
}

const outputs = [
  ["content/wraps/sample-solid-grey/Solid Grey.png", square],
  ["test/fixtures/valid.png", square],
  ["test/fixtures/too-big.png", padded(square)],
  ["test/fixtures/1023x1024.png", greyPng(1023, 1024)],
  ["test/fixtures/renamed-jpeg.png", jpeg],
  ["test/fixtures/bad-signature.png", badSignature(square)],
  ["test/fixtures/abcdefghijklmnopqrstuvwxyz1.png", square],
  ["test/fixtures/cybertruck-square.png", square],
];

for (const [rel, bytes] of outputs) {
  await writeBytes(path.join(root, rel), bytes);
}
