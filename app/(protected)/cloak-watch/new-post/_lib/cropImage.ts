import type { Area } from "react-easy-crop";

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

// Re-encoding through canvas produces a fresh, uncompressed-relative-to-source
// bitmap — at full crop resolution and 90%+ quality this routinely comes out
// *larger* than the original (efficiently hardware-encoded) camera JPEG, and
// blows well past Vercel's ~4.5MB serverless request body limit even for a
// single "reasonably sized" source photo. Cap the output to the same 1600px
// ceiling (and matching quality) the server resizes to anyway, so the file
// that actually gets uploaded is small regardless of the crop selection.
const MAX_OUTPUT_DIMENSION = 1600;
const OUTPUT_QUALITY = 0.85;

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string,
  mimeType: string = "image/jpeg",
): Promise<File> {
  const image = await createImage(imageSrc);

  const scale = Math.min(
    1,
    MAX_OUTPUT_DIMENSION / Math.max(pixelCrop.width, pixelCrop.height),
  );
  const outputWidth = Math.max(1, Math.round(pixelCrop.width * scale));
  const outputHeight = Math.max(1, Math.round(pixelCrop.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(new File([blob], fileName, { type: mimeType }));
      },
      mimeType,
      OUTPUT_QUALITY,
    );
  });
}
