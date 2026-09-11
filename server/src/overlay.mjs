import { deflateSync } from 'node:zlib';

const GUIDES = {
  'horizontal-right': [[.15, .5], [.85, .5]], 'horizontal-left': [[.85, .5], [.15, .5]],
  'vertical-down': [[.5, .15], [.5, .85]], 'vertical-up': [[.5, .85], [.5, .15]],
  'diagonal-down': [[.22, .22], [.78, .78]], 'diagonal-up-left': [[.78, .78], [.22, .22]],
  'diagonal-up': [[.22, .78], [.78, .22]], 'diagonal-down-left': [[.78, .22], [.22, .78]],
};

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function blend(pixels, size, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const offset = (y * size + x) * 3;
  for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(pixels[offset + channel] * (1 - alpha) + color[channel] * alpha);
}
function line(pixels, size, a, b, color, alpha, width = 1) {
  const x0 = Math.round(a[0] * (size - 1)), y0 = Math.round(a[1] * (size - 1));
  const x1 = Math.round(b[0] * (size - 1)), y1 = Math.round(b[1] * (size - 1));
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let step = 0; step <= steps; step++) {
    const x = Math.round(x0 + (x1 - x0) * step / steps), y = Math.round(y0 + (y1 - y0) * step / steps);
    for (let dx = -width; dx <= width; dx++) for (let dy = -width; dy <= width; dy++) blend(pixels, size, x + dx, y + dy, color, alpha);
  }
}

export function renderOverlayPng(strokes, size = 384) {
  const pixels = Buffer.alloc(size * size * 3, 250);
  for (const guide of Object.values(GUIDES)) line(pixels, size, guide[0], guide[1], [188, 180, 204], .2);
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.points.length; index++) {
      const a = stroke.points[index - 1], b = stroke.points[index];
      line(pixels, size, [a.x, a.y], [b.x, b.y], [93, 55, 160], .15, 1);
    }
  }
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    pixels.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
