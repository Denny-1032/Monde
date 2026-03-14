/**
 * Generate Monde app icons using pngjs
 * Creates icon.png (1024x1024), adaptive-icon.png (1024x1024), and favicon.png (48x48)
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const BRAND_GREEN = { r: 10, g: 110, b: 60 }; // #0A6E3C
const WHITE = { r: 255, g: 255, b: 255 };

function createPNG(width, height) {
  const png = new PNG({ width, height });
  return png;
}

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
  // Fill main body
  fillRect(png, x + radius, y, w - 2 * radius, h, color);
  fillRect(png, x, y + radius, w, h - 2 * radius, color);
  // Fill corners
  fillCircle(png, x + radius, y + radius, radius, color);
  fillCircle(png, x + w - radius - 1, y + radius, radius, color);
  fillCircle(png, x + radius, y + h - radius - 1, radius, color);
  fillCircle(png, x + w - radius - 1, y + h - radius - 1, radius, color);
}

// Draw the letter "M" as thick geometric strokes
function drawM(png, cx, cy, size, color) {
  const thickness = Math.round(size * 0.16);
  const halfSize = Math.round(size / 2);
  const top = cy - halfSize;
  const bottom = cy + halfSize;
  const left = cx - halfSize;
  const right = cx + halfSize - thickness;

  // Left vertical bar
  fillRect(png, left, top, thickness, size, color);

  // Right vertical bar
  fillRect(png, right, top, thickness, size, color);

  // Left diagonal (top-left to center)
  const midX = cx - Math.round(thickness / 2);
  const midY = cy + Math.round(size * 0.05);
  for (let i = 0; i < size * 0.55; i++) {
    const progress = i / (size * 0.55);
    const x = Math.round(left + thickness + progress * (midX - left - thickness));
    const y = Math.round(top + progress * (midY - top));
    fillRect(png, x, y, thickness, Math.max(2, Math.round(thickness * 0.8)), color);
  }

  // Right diagonal (top-right to center)
  for (let i = 0; i < size * 0.55; i++) {
    const progress = i / (size * 0.55);
    const x = Math.round(right - progress * (right - midX - thickness));
    const y = Math.round(top + progress * (midY - top));
    fillRect(png, x, y, thickness, Math.max(2, Math.round(thickness * 0.8)), color);
  }
}

// Draw a small wallet/tap icon below the M
function drawTapIndicator(png, cx, cy, size, color) {
  // Three concentric arcs (simplified as horizontal lines with curve approximation)
  const arcSizes = [size * 0.3, size * 0.5, size * 0.7];
  const thickness = Math.max(2, Math.round(size * 0.04));
  
  for (const arcSize of arcSizes) {
    const r = Math.round(arcSize);
    // Draw top-right quarter arc
    for (let angle = -45; angle <= 45; angle++) {
      const rad = (angle * Math.PI) / 180;
      const x = Math.round(cx + r * Math.cos(rad));
      const y = Math.round(cy - r * Math.sin(rad));
      fillRect(png, x, y, thickness, thickness, color);
    }
  }
  
  // Small dot at center
  fillCircle(png, cx, cy, Math.round(size * 0.06), color);
}

function generateIcon(size, isAdaptive) {
  const png = createPNG(size, size);
  
  // Fill background
  fillRect(png, 0, 0, size, size, BRAND_GREEN);
  
  // For adaptive icon, the foreground area is smaller (inner 66%)
  const iconArea = isAdaptive ? Math.round(size * 0.5) : Math.round(size * 0.55);
  const cx = Math.round(size / 2);
  const cy = Math.round(size / 2) - Math.round(iconArea * 0.08);
  
  // Draw the M
  drawM(png, cx, cy, iconArea, WHITE);
  
  // Draw tap indicator below M
  const tapY = cy + Math.round(iconArea * 0.55);
  drawTapIndicator(png, cx + Math.round(iconArea * 0.15), tapY, iconArea * 0.5, WHITE);
  
  return png;
}

function generateFavicon(size) {
  const png = createPNG(size, size);
  const radius = Math.round(size * 0.2);
  
  // Fill with transparent
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(png, x, y, { r: 0, g: 0, b: 0 }, 0);
    }
  }
  
  // Rounded green background
  fillRoundedRect(png, 0, 0, size, size, radius, BRAND_GREEN);
  
  // Draw M
  const cx = Math.round(size / 2);
  const cy = Math.round(size / 2);
  drawM(png, cx, cy, Math.round(size * 0.6), WHITE);
  
  return png;
}

// Generate all icons
const assetsDir = path.join(__dirname, '..', 'assets');

console.log('Generating icon.png (1024x1024)...');
const icon = generateIcon(1024, false);
const iconBuffer = PNG.sync.write(icon);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconBuffer);

console.log('Generating adaptive-icon.png (1024x1024)...');
const adaptiveIcon = generateIcon(1024, true);
const adaptiveBuffer = PNG.sync.write(adaptiveIcon);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptiveBuffer);

console.log('Generating favicon.png (48x48)...');
const favicon = generateFavicon(48);
const faviconBuffer = PNG.sync.write(favicon);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), faviconBuffer);

console.log('Done! All icons generated.');
