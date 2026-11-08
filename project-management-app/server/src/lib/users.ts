export function serializeUser(user: {
  id: string
  email: string
  displayName: string | null
  photoUrl?: string | null
  photoUpdatedAt?: Date | null
}) {
  const photoUrl = user.photoUpdatedAt
    ? `/api/avatars/${encodeURIComponent(user.id)}?v=${user.photoUpdatedAt.getTime()}`
    : (user.photoUrl ?? null)

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    photoUrl,
  }
}
