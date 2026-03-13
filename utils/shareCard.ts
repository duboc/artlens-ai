import { IdentifyResponse } from '../types';

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const WATERMARK_TEXT = 'AI Leadership Academy';
const BRAND_FONT = 'Google Sans, sans-serif';

/**
 * Loads an image from a URL or data URL and returns an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Wraps text into lines that fit within a given width.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Creates a share card for scanned artwork:
 * artwork photo + title/artist/year + curiosity + branding
 */
export async function createArtworkShareCard(
  imageUrl: string,
  artData: IdentifyResponse,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Load and draw artwork image (top portion)
  try {
    const img = await loadImage(imageUrl);
    const imageHeight = CARD_HEIGHT * 0.6;
    const scale = Math.max(CARD_WIDTH / img.width, imageHeight / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const offsetX = (CARD_WIDTH - drawWidth) / 2;
    const offsetY = (imageHeight - drawHeight) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CARD_WIDTH, imageHeight);
    ctx.clip();
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();

    // Gradient overlay at bottom of image for text readability
    const gradient = ctx.createLinearGradient(0, imageHeight - 200, 0, imageHeight);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, imageHeight - 200, CARD_WIDTH, 200);
  } catch {
    // If image fails to load, continue with black background
  }

  const contentY = CARD_HEIGHT * 0.62;
  const padding = 60;
  const maxTextWidth = CARD_WIDTH - padding * 2;

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 48px ${BRAND_FONT}`;
  const titleLines = wrapText(ctx, artData.title, maxTextWidth);
  let y = contentY;
  for (const line of titleLines) {
    ctx.fillText(line, padding, y);
    y += 56;
  }

  // Artist + Year
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `24px ${BRAND_FONT}`;
  ctx.fillText(`${artData.artist} · ${artData.year}`, padding, y + 8);
  y += 50;

  // Curiosity (first one from deep analysis, or funFact)
  const curiosity = artData.deepAnalysis?.curiosities?.[0] || artData.funFact;
  if (curiosity) {
    // Divider line
    ctx.strokeStyle = 'rgba(66, 133, 244, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(CARD_WIDTH - padding, y);
    ctx.stroke();
    y += 30;

    ctx.fillStyle = 'rgba(66, 133, 244, 0.8)';
    ctx.font = `bold 16px monospace`;
    ctx.fillText('DID YOU KNOW?', padding, y);
    y += 30;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `italic 22px ${BRAND_FONT}`;
    const curiosityLines = wrapText(ctx, `"${curiosity}"`, maxTextWidth);
    for (const line of curiosityLines.slice(0, 4)) {
      ctx.fillText(line, padding, y);
      y += 30;
    }
  }

  // Branding bar at bottom
  const brandBarHeight = 70;
  ctx.fillStyle = 'rgba(26, 26, 26, 0.95)';
  ctx.fillRect(0, CARD_HEIGHT - brandBarHeight, CARD_WIDTH, brandBarHeight);

  // Google dots
  const dotsY = CARD_HEIGHT - brandBarHeight / 2;
  const dotRadius = 5;
  const dotSpacing = 14;
  const dotsStartX = padding;
  const dotColors = ['#EA4335', '#FBBC04', '#34A853', '#4285F4'];
  dotColors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(dotsStartX + i * dotSpacing, dotsY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Brand text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = `16px ${BRAND_FONT}`;
  ctx.fillText(WATERMARK_TEXT, dotsStartX + dotColors.length * dotSpacing + 10, dotsY + 5);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/png',
    );
  });
}

/**
 * Adds "AI Leadership Academy" watermark to a generated portrait image.
 * Used for both sharing and downloading generated images.
 */
export async function addWatermark(imageUrl: string): Promise<Blob> {
  const img = await loadImage(imageUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;

  // Draw original image
  ctx.drawImage(img, 0, 0);

  // Semi-transparent bar at bottom
  const barHeight = Math.max(50, img.height * 0.06);
  const gradient = ctx.createLinearGradient(0, img.height - barHeight * 2, 0, img.height);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, img.height - barHeight * 2, img.width, barHeight * 2);

  // Google dots
  const padding = img.width * 0.04;
  const dotsY = img.height - barHeight / 2;
  const dotRadius = Math.max(3, img.width * 0.005);
  const dotSpacing = dotRadius * 3;
  const dotColors = ['#EA4335', '#FBBC04', '#34A853', '#4285F4'];
  dotColors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(padding + i * dotSpacing, dotsY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Watermark text
  const fontSize = Math.max(12, img.width * 0.025);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `${fontSize}px ${BRAND_FONT}`;
  ctx.fillText(
    WATERMARK_TEXT,
    padding + dotColors.length * dotSpacing + dotRadius * 2,
    dotsY + fontSize * 0.35,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/png',
    );
  });
}

/**
 * Shares a blob as a file via Web Share API.
 * Falls back to triggering a download if file sharing is not supported.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  title: string,
  text: string,
): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, text, files: [file] });
  } else {
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
