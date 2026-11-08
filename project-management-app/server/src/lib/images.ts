const MAX_PHOTO_BYTES = 2 * 1024 * 1024

export function imageType(bytes: Buffer): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | null {
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return null

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes.length >= 6 &&
    bytes.subarray(0, 3).toString('ascii') === 'GIF' &&
    (bytes.subarray(3, 6).toString('ascii') === '87a' || bytes.subarray(3, 6).toString('ascii') === '89a')
  ) {
    return 'image/gif'
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }

  return null
}
