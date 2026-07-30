import { BILLING_OCR_CONFIG } from './billingOcrConfig';

export interface BillingImagePreprocessMetadata {
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  rotationDegrees: number;
  grayscale: boolean;
  contrastAdjusted: boolean;
  scaled: boolean;
  warnings: string[];
}

export interface PreprocessedImageResult {
  canvas: HTMLCanvasElement;
  metadata: BillingImagePreprocessMetadata;
}

function readExifOrientation(_blob: Blob): number | null {
  return null;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('BILLING_IMAGE_DECODE_FAILED'));
    };
    image.src = url;
  });
}

function drawRotatedImage(
  source: CanvasImageSource,
  width: number,
  height: number,
  rotationDegrees: number,
): HTMLCanvasElement {
  const normalizedRotation = ((rotationDegrees % 360) + 360) % 360;
  const swap = normalizedRotation === 90 || normalizedRotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? height : width;
  canvas.height = swap ? width : height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas-Kontext nicht verfügbar');
  }
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((normalizedRotation * Math.PI) / 180);
  context.drawImage(source, -width / 2, -height / 2, width, height);
  return canvas;
}

function applyGrayscaleAndContrast(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 255;
    if (alpha < 16) {
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = 255;
      continue;
    }
    const gray = Math.round(
      (data[index]! * 0.299 + data[index + 1]! * 0.587 + data[index + 2]! * 0.114),
    );
    const adjusted = Math.min(255, Math.max(0, Math.round((gray - 128) * 1.08 + 128)));
    data[index] = adjusted;
    data[index + 1] = adjusted;
    data[index + 2] = adjusted;
  }
  context.putImageData(imageData, 0, 0);
}

function scaleCanvas(canvas: HTMLCanvasElement, maxDimension: number): HTMLCanvasElement {
  const longest = Math.max(canvas.width, canvas.height);
  if (longest <= maxDimension) {
    return canvas;
  }
  const factor = maxDimension / longest;
  const scaled = document.createElement('canvas');
  scaled.width = Math.floor(canvas.width * factor);
  scaled.height = Math.floor(canvas.height * factor);
  const context = scaled.getContext('2d');
  if (!context) {
    return canvas;
  }
  context.drawImage(canvas, 0, 0, scaled.width, scaled.height);
  if (scaled !== canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
  return scaled;
}

export async function preprocessImageForOcr(
  blob: Blob,
  options: {
    rotationDegrees?: number;
    maxDimension?: number;
  } = {},
): Promise<PreprocessedImageResult> {
  const warnings: string[] = [];
  const image = await loadImageFromBlob(blob);
  const exifRotation = readExifOrientation(blob) ?? 0;
  const rotationDegrees = (options.rotationDegrees ?? 0) + exifRotation;
  let canvas = drawRotatedImage(image, image.width, image.height, rotationDegrees);
  const originalWidth = canvas.width;
  const originalHeight = canvas.height;

  if (Math.min(originalWidth, originalHeight) < BILLING_OCR_CONFIG.minImageDimensionPx) {
    warnings.push('BILLING_IMAGE_TOO_SMALL');
  }

  applyGrayscaleAndContrast(canvas);
  const scaled = scaleCanvas(canvas, options.maxDimension ?? BILLING_OCR_CONFIG.maxImageDimensionPx);
  canvas = scaled;

  return {
    canvas,
    metadata: {
      originalWidth,
      originalHeight,
      outputWidth: canvas.width,
      outputHeight: canvas.height,
      rotationDegrees,
      grayscale: true,
      contrastAdjusted: true,
      scaled: canvas.width !== originalWidth || canvas.height !== originalHeight,
      warnings,
    },
  };
}

export async function preprocessCanvasForOcr(
  sourceCanvas: HTMLCanvasElement,
  options: { rotationDegrees?: number; maxDimension?: number } = {},
): Promise<PreprocessedImageResult> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    sourceCanvas.toBlob((value) => {
      if (!value) {
        reject(new Error('BILLING_IMAGE_PREPROCESSING_FAILED'));
        return;
      }
      resolve(value);
    }, 'image/png');
  });
  return preprocessImageForOcr(blob, options);
}
