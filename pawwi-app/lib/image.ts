// Compresión/normalización de imágenes en el cliente (perfil, chat).
// Decodifica de forma robusta: createImageBitmap es rápido y respeta EXIF, pero
// falla con HEIC (fotos de cámara iPhone) → cae a un <img> vía object URL.
async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo decodificar la imagen")); };
      img.src = url;
    });
  }
}

// Reduce a máx `maxSize` px y comprime a JPEG. Normaliza HEIC → JPEG.
export async function resizeImage(file: File, maxSize = 1280, quality = 0.82): Promise<Blob> {
  const source = await decodeImage(file);
  const srcW = (source as HTMLImageElement).naturalWidth || source.width;
  const srcH = (source as HTMLImageElement).naturalHeight || source.height;
  let width = srcW;
  let height = srcH;
  if (width > maxSize || height > maxSize) {
    const scale = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(source, 0, 0, width, height);
  if ("close" in source) source.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", quality),
  );
}
