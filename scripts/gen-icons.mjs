// Genera los PNG de la PWA / apple-touch-icon a partir del logo.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/icons/logo-mark.svg', 'utf8');
// Versión a sangre completa (iOS y Android aplican su propia máscara redondeada).
const full = svg.replace('rx="18"', 'rx="0"');
// Versión "maskable": el trazo dentro de la zona segura (80 %).
const maskable = full.replace(/<path /, '<g transform="translate(6.4 6.4) scale(.8)"><path ').replace(/<\/circle>/, '</circle></g>');

const out = [
  ['public/icons/apple-touch-icon.png', full, 180],
  ['public/icons/icon-192.png', full, 192],
  ['public/icons/icon-512.png', full, 512],
  ['public/icons/icon-maskable-512.png', maskable, 512],
  ['public/favicon.png', svg, 64],
];
for (const [file, source, size] of out) {
  writeFileSync(file, await sharp(Buffer.from(source), { density: 600 }).resize(size, size).png().toBuffer());
  console.log('✓', file);
}
