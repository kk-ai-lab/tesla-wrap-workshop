import { readFile, writeFile, lstat, mkdir, realpath } from 'node:fs/promises';
import { resolve, dirname, basename, relative, isAbsolute, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const [sourceList, templateDirectory, templateCommit, requestedOutput] = process.argv.slice(2);
if (!sourceList || !templateDirectory || !/^[a-f0-9]{40}$/.test(templateCommit ?? '') || !requestedOutput) throw new Error('Usage: node scripts/prepare-imagegen-candidates.mjs SOURCE_ARRAY_JSON TEMPLATE_DIRECTORY TEMPLATE_COMMIT_SHA NEW_OUTPUT_DIRECTORY');
const repository = await realpath('.');
const outputPath = resolve(requestedOutput);
const outputRoot = join(await realpath(dirname(outputPath)), basename(outputPath));
const fromRepository = relative(repository, outputRoot);
if (fromRepository !== '..' && !fromRepository.startsWith(`..${sep}`) && !isAbsolute(fromRepository)) throw new Error('Output directory must be outside the repository.');
try {
  await lstat(outputRoot);
  throw new Error(`Output directory already exists: ${outputRoot}`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const sources = JSON.parse(await readFile(sourceList, 'utf8'));
const ids = ['copper-circuit', 'tidal-jade', 'porcelain-grid', 'ember-chevron', 'pine-canopy', 'dune-rhythm', 'midnight-weave', 'cobalt-pulse', 'olive-orbit', 'plum-lattice', 'silver-prism', 'ochre-arches'];
assert.equal(sources.length, ids.length, 'Expected twelve ordered imagegen source paths.');
const hash = data => createHash('sha256').update(data).digest('hex');
const isPaintable = (data, offset) => data[offset] === 255 && data[offset + 1] === 255 && data[offset + 2] === 255 && data[offset + 3] === 255;
const records = [];
const pending = [];
for (const [index, id] of ids.entries()) {
  const directory = `content/wraps/${id}`;
  const meta = JSON.parse(await readFile(`${directory}/meta.json`, 'utf8'));
  assert(typeof meta.file === 'string' && basename(meta.file) === meta.file && /^[A-Za-z0-9_\- ]{1,26}\.png$/.test(meta.file), `${id} invalid output filename`);
  assert(typeof meta.variant === 'string' && /^[a-z0-9-]+$/.test(meta.variant), `${id} invalid template variant`);
  const original = await readFile(sources[index]);
  const sourceInfo = await sharp(original).metadata();
  const template = await readFile(join(templateDirectory, `${meta.variant}.png`));
  const { data: pixels, info } = await sharp(template).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  const { width, height } = info;
  const resized = await sharp(original).rotate().resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  let output;
  let texture;
  let textureColours;
  let clampedWhitePixels;
  for (const colours of [null, 256, 128, 64, 32, 16]) {
    textureColours = colours;
    texture = colours === null ? resized : await sharp(await sharp(resized, { raw: { width, height, channels: 3 } }).png({ palette: true, colours, dither: 0, effort: 10 }).toBuffer()).removeAlpha().raw().toBuffer();
    const composed = Buffer.from(pixels);
    clampedWhitePixels = 0;
    for (let offset = 0, rgb = 0; offset < pixels.length; offset += 4, rgb += 3) {
      if (!isPaintable(pixels, offset)) continue;
      texture.copy(composed, offset, rgb, rgb + 3);
      if (isPaintable(composed, offset)) {
        composed[offset + 2] = 254;
        clampedWhitePixels++;
      }
    }
    output = await sharp(composed, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
    if (output.length <= 1_000_000) break;
  }
  assert(output.length <= 1_000_000, `${id} exceeds byte limit`);
  const decoded = await sharp(output).ensureAlpha().raw().toBuffer();
  let paintablePixels = 0;
  let preservedPixels = 0;
  let transparentPixels = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    assert.equal(decoded[offset + 3], pixels[offset + 3], `${id} alpha changed`);
    if (pixels[offset + 3] < 255) transparentPixels++;
    if (isPaintable(pixels, offset)) {
      paintablePixels++;
      assert(!isPaintable(decoded, offset), `${id} unfilled white pixel`);
    } else {
      preservedPixels++;
      assert(decoded.subarray(offset, offset + 4).equals(pixels.subarray(offset, offset + 4)), `${id} protected pixel changed`);
    }
  }
  assert(paintablePixels > 0);
  pending.push({ path: `${directory}/${meta.file}`, data: output });
  meta.provenance = [{ kind: 'own', author: 'OpenAI imagegen (AI-generated candidate; Tesla template composite)', createdWith: `OpenAI imagegen texture composited into official Tesla ${meta.variant} template at commit ${templateCommit}. Only opaque pure-white RGBA pixels replaced; all other pixels and alpha preserved exactly. Texture-only quantization: ${textureColours ?? 'none'}; final PNG RGBA lossless. Sources, hashes and pixel verification: docs/candidate-artwork-sources.json. Candidate; proposed CC0 only for any project-owned contribution, subject to rights review; Tesla template usage, derivative-work permission, layout and in-car review outstanding.` }];
  meta.tags = [...new Set(meta.tags.filter(tag => tag !== 'procedural').concat('ai-generated', 'candidate'))];
  pending.push({ path: `${directory}/meta.json`, data: `${JSON.stringify(meta, null, 2)}\n` });
  records.push({ id, variant: meta.variant, generator: 'OpenAI imagegen', sourcePath: sources[index], sourceSha256: hash(original), sourceBytes: original.length, sourceWidth: sourceInfo.width, sourceHeight: sourceInfo.height, templateReference: { commit: templateCommit, url: `https://github.com/teslamotors/custom-wraps/tree/${templateCommit}/${meta.variant}`, sha256: hash(template), bytes: template.length, usage: 'Tesla template pixels directly retained in composite; permission and derivative-work clearance outstanding' }, outputPath: `${directory}/${meta.file}`, outputSha256: hash(output), outputBytes: output.length, width, height, processing: { fit: 'fill', kernel: 'lanczos3', mask: 'RGBA exactly 255,255,255,255 only', textureColours, dither: 0, clampedWhitePixels, whiteClamp: 'Texture pure white changed to RGB 255,255,254 so all paintable pixels visibly differ from blank template', finalPng: 'lossless truecolour RGBA; no final palette quantization' }, verification: { paintablePixels, filledPixels: paintablePixels, preservedPixels, transparentPixels, protectedPixelMismatches: 0, alphaMismatches: 0 }, reviewStatus: 'candidate; proposed CC0 for project-owned contributions only; Tesla template permission, copyright, authorization, layout and in-car review outstanding' });
}
pending.push({ path: 'docs/candidate-artwork-sources.json', data: `${JSON.stringify({ generatedOn: '2026-11-13', source: 'Twelve user-authorized imagegen textures masked into fixed-commit official Tesla templates. Exact prompts are not preserved. Pixel fidelity is a local processing policy, not a claim of an official Tesla requirement or vehicle acceptance.', sharpVersion: sharp.versions.sharp, records }, null, 2)}\n` });
await mkdir(outputRoot);
for (const file of pending) {
  const destination = join(outputRoot, file.path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, file.data, { flag: 'wx' });
}
console.log(`Prepared review files in ${outputRoot}; catalogue unchanged.`);
console.log(records.map(record => `${record.id}: ${record.width}x${record.height}, ${record.outputBytes} bytes, ${record.verification.paintablePixels} filled; protected/alpha mismatches 0`).join('\n'));
