import { useState } from 'react'
import { apiUrl } from '../services/api'

export function photoSrc(photoUrl: string) {
  return photoUrl.startsWith('/') ? apiUrl(photoUrl) : photoUrl
}

export function personName(person: { displayName: string | null; email: string }) {
  return person.displayName || person.email
}

export function Avatar({
  person,
}: {
  person: { displayName: string | null; email: string; photoUrl: string | null }
}) {
  const [failed, setFailed] = useState(false)
  const name = personName(person)
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  if (person.photoUrl && !failed) {
    return (
      <img
        className="avatar"
        src={photoSrc(person.photoUrl)}
        alt=""
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span className="avatar" aria-hidden="true">
      {initial}
    </span>
  )
}
