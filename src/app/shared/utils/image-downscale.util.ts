/**
 * Shrinks a picked image before it is uploaded.
 *
 * The avatar in the header is 42 pixels across and the file behind it was
 * 781 KB — three quarters of everything a cold dashboard load downloads, for
 * a circle the size of a fingernail. Nothing resizes it on the way in, so
 * whatever came off the phone camera is what every page then fetches.
 *
 * Done here rather than only asked of the API because this is where the
 * original is: by the time the request leaves, the bytes are already on the
 * wire. The stored file still wants a thumbnail on the server — that is a
 * separate request to the backend — but no new upload needs one after this.
 *
 * Every failure path returns the original file. A picture that will not decode
 * is still a picture the admin chose, and refusing to upload it would be a
 * worse bug than uploading it large.
 */
const MAX_EDGE = 512;
const JPEG_QUALITY = 0.85;

export async function downscaleImage(file: File, maxEdge = MAX_EDGE): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) return file;
  // An SVG has no pixel size to shrink to and would be rasterised; a GIF would
  // lose its animation. Both are small enough not to be the problem.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;

  let bitmap: HTMLImageElement;
  try {
    bitmap = await decode(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.naturalWidth, bitmap.naturalHeight));
  const width = Math.max(1, Math.round(bitmap.naturalWidth * scale));
  const height = Math.max(1, Math.round(bitmap.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  // A photograph saved as PNG is the usual cause of a file this size, and
  // re-encoding it as PNG would keep most of it. JPEG is only unsafe where the
  // image has transparency to lose, so that is the one thing worth checking.
  const type = file.type === 'image/png' && hasTransparency(ctx, width, height)
    ? 'image/png'
    : 'image/jpeg';

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, type, JPEG_QUALITY)
  );
  // Re-encoding a small picture can come out bigger than it went in.
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], renameTo(file.name, type), { type, lastModified: Date.now() });
}

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

/** Reads the alpha channel only; the colour data is never looked at. */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    // A cross-origin source taints the canvas. Assume it has alpha rather than
    // flatten something that may need it.
    return true;
  }
}

function renameTo(name: string, type: string): string {
  const ext = type === 'image/png' ? '.png' : '.jpg';
  const stem = name.replace(/\.[^.]+$/, '') || 'avatar';
  return stem + ext;
}
