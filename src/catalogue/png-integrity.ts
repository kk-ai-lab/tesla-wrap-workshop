import sharp from "sharp";

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function verifyPngIntegrity(bytes: Buffer, pixelLimit: number): Promise<boolean> {
  let offset = 8;
  let seenHeader = false;
  let seenData = false;
  let endedData = false;
  let seenEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return false;
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type) || crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) return false;
    if (!seenHeader) {
      if (type !== "IHDR" || length !== 13) return false;
      seenHeader = true;
    } else if (type === "IHDR") return false;
    if (type === "IDAT") {
      if (endedData) return false;
      seenData = true;
    } else if (seenData) {
      endedData = true;
    }
    if (type === "IEND") {
      if (length !== 0 || !seenData || end !== bytes.length) return false;
      seenEnd = true;
      break;
    }
    offset = end;
  }
  if (!seenEnd) return false;
  try {
    await sharp(bytes, { failOn: "warning", limitInputPixels: pixelLimit }).raw().toBuffer();
    return true;
  } catch {
    return false;
  }
}
