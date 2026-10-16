// Runs only in the admin browser. Reduces phone camera originals to manageable JPEGs.
export async function optimizeMemorialPhoto(file: File): Promise<File> {
  if (!(file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name))) {
    throw new Error("Choose an image file.");
  }
  if (file.size > 35 * 1024 * 1024) {
    throw new Error("This image is larger than 35 MB. Choose a smaller copy.");
  }

  return new Promise<File>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const fail = () => {
      URL.revokeObjectURL(objectUrl);
      if (["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 8 * 1024 * 1024) {
        resolve(file);
      } else {
        reject(new Error("Could not read this image. Export it as a JPEG or PNG, then try again."));
      }
    };
    image.onload = () => {
      try {
        const maxDimension = 1800;
        const factor = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * factor));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
        const ctx = canvas.getContext("2d");
        if (!ctx) return fail();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("Could not prepare this image. Please use a JPEG or PNG."));
            return;
          }
          resolve(new File([blob], "memorial-photo.jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.86);
      } catch {
        fail();
      }
    };
    image.onerror = fail;
    image.src = objectUrl;
  });
}
