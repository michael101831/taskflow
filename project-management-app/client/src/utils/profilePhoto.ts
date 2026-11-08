const largestSide = 512

export async function prepareProfilePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF.')
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Photo must be 8 MB or smaller.')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, largestSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    bitmap.close()
    throw new Error('Photo could not be prepared.')
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  })

  if (!blob) throw new Error('Photo could not be prepared.')
  return blob
}
