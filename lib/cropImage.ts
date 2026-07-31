export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous"); // needed to avoid cross-origin issues
    image.src = url;
  });

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  options?: { maxSize?: number; quality?: number },
): Promise<Blob> {
  // Profile avatars only ever render at a few dozen pixels, so uploading at
  // full camera resolution (often several MB) just makes the upload slower
  // for no visible benefit. Cap the output and compress it before it's
  // ever sent over the network.
  const { maxSize = 640, quality = 0.85 } = options || {};

  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  const outputSize = Math.round(
    Math.min(maxSize, Math.max(pixelCrop.width, pixelCrop.height)),
  );
  canvas.width = outputSize;
  canvas.height = outputSize;

  // draw cropped image onto canvas
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, 2 * Math.PI);
  ctx.clip();

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  // return as a blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (file) => {
        if (file) {
          resolve(file);
        } else {
          reject(new Error("Canvas is empty"));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}
