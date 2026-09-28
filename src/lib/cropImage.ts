import type { Area } from 'react-easy-crop';

export const PROFILE_PHOTO_MIN_PX = 512;
export const PROFILE_PHOTO_MAX_PX = 1024;
export const PROFILE_PHOTO_JPEG_QUALITY = 0.96;

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.crossOrigin = 'anonymous';
    image.src = url;
  });
}

export type CropImageOptions = {
  mimeType?: 'image/jpeg' | 'image/png';
  quality?: number;
  minOutputSize?: number;
  maxOutputSize?: number;
};

export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  options: CropImageOptions = {}
): Promise<Blob> {
  const {
    mimeType = 'image/jpeg',
    quality = PROFILE_PHOTO_JPEG_QUALITY,
    minOutputSize = PROFILE_PHOTO_MIN_PX,
    maxOutputSize = PROFILE_PHOTO_MAX_PX,
  } = options;

  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível processar a imagem.');
  }

  const sourceX = Math.round(pixelCrop.x);
  const sourceY = Math.round(pixelCrop.y);
  const sourceW = Math.round(pixelCrop.width);
  const sourceH = Math.round(pixelCrop.height);

  let outputSize = Math.max(sourceW, sourceH);
  if (minOutputSize > 0) {
    outputSize = Math.max(outputSize, minOutputSize);
  }
  if (maxOutputSize > 0) {
    outputSize = Math.min(outputSize, maxOutputSize);
  }

  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, outputSize, outputSize);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar a imagem recortada.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}
