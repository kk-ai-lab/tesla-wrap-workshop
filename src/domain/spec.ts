import type { LicenceId } from "./licences";
import { VARIANTS, type VariantId } from "./variants";

export const SPEC = {
  maxBytes: 1_000_000,
  fileName: /^[A-Za-z0-9_\- ]{1,26}\.png$/,
  pngMagic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
} as const;

export type Violation =
  | { code: "not-png" }
  | { code: "invalid-png" }
  | { code: "bad-name"; name: string }
  | { code: "too-big"; bytes: number }
  | { code: "wrong-dims"; got: [number, number]; want: [number, number] }
  | { code: "schema"; path: string; msg: string }
  | { code: "licence-provenance"; licence: LicenceId; kind: string }
  | { code: "dup-sha"; sha256: string; ids: string[] }
  | { code: "id-mismatch"; folder: string; id: string };

const IHDR = [0x49, 0x48, 0x44, 0x52] as const;

function matches(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  for (let i = 0; i < expected.length; i += 1) {
    if (bytes[offset + i] !== expected[i]) {
      return false;
    }
  }
  return true;
}

export function readIhdr(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

export function checkPng(bytes: Uint8Array, name: string, variant: VariantId): Violation[] {
  const violations: Violation[] = [];
  if (!SPEC.fileName.test(name)) {
    violations.push({ code: "bad-name", name });
  }
  if (bytes.byteLength > SPEC.maxBytes) {
    violations.push({ code: "too-big", bytes: bytes.byteLength });
  }
  if (bytes.byteLength < 24 || !matches(bytes, 0, SPEC.pngMagic) || !matches(bytes, 12, IHDR)) {
    violations.push({ code: "not-png" });
    return violations;
  }
  const { width, height } = readIhdr(bytes);
  const wantW = VARIANTS[variant].w;
  const wantH = VARIANTS[variant].h;
  if (width !== wantW || height !== wantH) {
    const got: [number, number] = [width, height];
    const want: [number, number] = [wantW, wantH];
    violations.push({ code: "wrong-dims", got, want });
  }
  return violations;
}
