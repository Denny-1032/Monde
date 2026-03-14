/**
 * Generate Monde app icons using pngjs
 * Clean simple white M on Monde green background.
 * Creates icon.png (1024x1024), adaptive-icon.png (1024x1024), and favicon.png (48x48)
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const BRAND_GREEN = { r: 10, g: 110, b: 60 }; // #0A6E3C
const WHITE = { r: 255, g: 255, b: 255 };

function setPixel(png, x, y, color, alpha = 255) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = alpha;
}

function fillRect(png, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(png, x + dx, y + dy, color);
    }
  }
}

function fillCircle(png, cx, cy, r, color) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        setPixel(png, cx + x, cy + y, color);
      }
    }
  }
}

function fillRoundedRect(png, x, y, w, h, radius, color) {
  fillRect(png, x + radius, y, w - 2 * radius, h, color);
  fillRect(png, x, y + radius, w, h - 2 * radius, color);
  fillCircle(png, x + radius, y + radius, radius, color);
  fillCircle(png, x + w - radius - 1, y + radius, radius, color);
  fillCircle(png, x + radius, y + h - radius - 1, radius, color);
  fillCircle(png, x + w - radius - 1, y + h - radius - 1, radius, color);
}

// Draw a clean, simple "M" — scanline polygon fill for crisp edges.
// Standard sans-serif M: two vertical legs, two diagonals meeting at center.
function drawCleanM(png, cx, cy, size, color) {
  const t = Math.round(size * 0.13); // stroke thickness
  const halfW = Math.round(size * 0.46);
  const halfH = Math.round(size * 0.46);

  const left = cx - halfW;
  const right = cx + halfW;
  const top = cy - halfH;
  const bottom = cy + halfH;
  const midX = cx;
  const dipY = cy + Math.round(halfH * 0.15); // how far down the V dips

  // Use scanline fill for the M polygon.
  // Define outer M shape as vertices (clockwise):
  //  0: outer top-left
  //  1: outer bottom-left
  //  2: inner bottom-left (left leg inner bottom)
  //  3: inner left leg top
  //  4: center dip
  //  5: inner right leg top
  //  6: inner bottom-right
  //  7: outer bottom-right
  //  8: outer top-right
  //  9: right diagonal start (top inner-right)
  // 10: center V top (above dip)
  // 11: left diagonal start (top inner-left)
  const poly = [
    { x: left, y: top },                    // 0  outer top-left
    { x: left, y: bottom },                 // 1  outer bottom-left
    { x: left + t, y: bottom },             // 2  inner bottom-left
    { x: left + t, y: top + t * 1.2 },      // 3  inner left-leg top
    { x: midX, y: dipY },                   // 4  center V dip
    { x: right - t, y: top + t * 1.2 },     // 5  inner right-leg top
    { x: right - t, y: bottom },            // 6  inner bottom-right
    { x: right, y: bottom },                // 7  outer bottom-right
    { x: right, y: top },                   // 8  outer top-right
    { x: right - t * 0.2, y: top },         // 9  right diag start
    { x: midX, y: dipY - t * 1.1 },         // 10 center V top (above dip)
    { x: left + t * 0.2, y: top },          // 11 left diag start
  ];

  // Scanline fill the polygon
  const minY = top;
  const maxY = bottom;
  for (let scanY = minY; scanY <= maxY; scanY++) {
    const intersections = [];
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const p1 = poly[i];
      const p2 = poly[j];
      if ((p1.y <= scanY && p2.y > scanY) || (p2.y <= scanY && p1.y > scanY)) {
        const xInt = p1.x + (scanY - p1.y) / (p2.y - p1.y) * (p2.x - p1.x);
        intersections.push(Math.round(xInt));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const x1 = intersections[i];
      const x2 = intersections[i + 1];
      for (let px = x1; px <= x2; px++) {
        setPixel(png, px, scanY, color);
      }
    }
  }
}

function generateIcon(size, isAdaptive) {
  const png = new PNG({ width: size, height: size });

  // Fill green background
  fillRect(png, 0, 0, size, size, BRAND_GREEN);

  // Draw centered M — adaptive icons get clipped, so use smaller area
  const mSize = isAdaptive ? Math.round(size * 0.50) : Math.round(size * 0.58);
  drawCleanM(png, Math.round(size / 2), Math.round(size / 2), mSize, WHITE);

  return png;
}

function generateFavicon(size) {
  const png = new PNG({ width: size, height: size });
  const radius = Math.round(size * 0.2);

  // Transparent background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(png, x, y, { r: 0, g: 0, b: 0 }, 0);
    }
  }
  fillRoundedRect(png, 0, 0, size, size, radius, BRAND_GREEN);
  drawCleanM(png, Math.round(size / 2), Math.round(size / 2), Math.round(size * 0.55), WHITE);

  return png;
}

// Generate all icons
const assetsDir = path.join(__dirname, '..', 'assets');

console.log('Generating icon.png (1024x1024)...');
const icon = generateIcon(1024, false);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), PNG.sync.write(icon));

console.log('Generating adaptive-icon.png (1024x1024)...');
const adaptiveIcon = generateIcon(1024, true);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), PNG.sync.write(adaptiveIcon));

console.log('Generating favicon.png (48x48)...');
const favicon = generateFavicon(48);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), PNG.sync.write(favicon));

console.log('Done! All icons generated.');
