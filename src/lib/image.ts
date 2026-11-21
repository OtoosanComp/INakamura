/** Reduce la foto a 320px para no llenar la memoria del teléfono (~20-40 KB por producto). */
export async function resizeImage(file: File, max = 320): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(max, side);
    const ctx = canvas.getContext('2d')!;
    // recorte cuadrado centrado
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Error al procesar'))), 'image/jpeg', 0.8));
  } finally {
    URL.revokeObjectURL(url);
  }
}
