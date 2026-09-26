/**
 * Computes a real SHA-256 hash of a File/Blob.
 * For huge video files (>64MB), computes a fast deterministic fingerprint hash
 * combining the header, middle chunk, tail chunk, and file size to keep performance snappy,
 * or full hash when requested.
 */
export async function calculateFileHash(file: File, fullHash = false): Promise<string> {
  // If file is smaller than 32MB or fullHash is requested, compute complete SHA-256
  if (fullHash || file.size <= 32 * 1024 * 1024) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return bufferToHex(hashBuffer);
  }

  // Fast deterministic fingerprint for large 4K videos / large MOV files:
  // Combines 2MB head + 2MB middle + 2MB tail + size metadata
  const chunkSize = 2 * 1024 * 1024;
  const headBlob = file.slice(0, chunkSize);
  const midStart = Math.floor(file.size / 2) - Math.floor(chunkSize / 2);
  const midBlob = file.slice(midStart, midStart + chunkSize);
  const tailBlob = file.slice(file.size - chunkSize, file.size);

  const [headBuf, midBuf, tailBuf] = await Promise.all([
    headBlob.arrayBuffer(),
    midBlob.arrayBuffer(),
    tailBlob.arrayBuffer(),
  ]);

  const combined = new Uint8Array(headBuf.byteLength + midBuf.byteLength + tailBuf.byteLength + 8);
  combined.set(new Uint8Array(headBuf), 0);
  combined.set(new Uint8Array(midBuf), headBuf.byteLength);
  combined.set(new Uint8Array(tailBuf), headBuf.byteLength + midBuf.byteLength);

  // Append size as 64-bit uint
  const view = new DataView(combined.buffer);
  view.setBigUint64(headBuf.byteLength + midBuf.byteLength + tailBuf.byteLength, BigInt(file.size), true);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return 'fp_' + bufferToHex(hashBuffer);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
