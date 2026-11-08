import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Profile, ProfilePhotoUpdate } from '../types'
import { prepareProfilePhoto } from '../utils/profilePhoto'
import { Avatar, personName } from './Avatar'

interface ProfileModalProps {
  profile: Profile
  onClose: () => void
  onSave: (input: { displayName: string; photo: ProfilePhotoUpdate }) => Promise<void>
}

export function ProfileModal({ profile, onClose, onSave }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const shownPhoto = previewUrl ?? (removePhoto ? null : profile.photoUrl)
  const preview = {
    displayName: displayName.trim() || profile.email,
    email: profile.email,
    photoUrl: shownPhoto,
  }

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  function choosePhoto(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setErrorMessage('Choose a JPEG, PNG, WebP, or GIF.')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('Photo must be 8 MB or smaller.')
      return
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const nextPreview = URL.createObjectURL(file)
    previewUrlRef.current = nextPreview
    setPreviewUrl(nextPreview)
    setPhotoFile(file)
    setRemovePhoto(false)
    setErrorMessage('')
  }

  function clearPhoto() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    setPhotoFile(null)
    setRemovePhoto(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage('')

    try {
      const photo: ProfilePhotoUpdate = photoFile
        ? { action: 'upload', file: await prepareProfilePhoto(photoFile) }
        : removePhoto
          ? { action: 'remove' }
          : { action: 'keep' }
      await onSave({ displayName: displayName.trim(), photo })
      onClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Profile could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <p className="eyebrow">Account</p>
            <h2 id="profile-title">Profile</h2>
          </div>
          <button type="button" aria-label="Close profile" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="profile-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="profile-form__preview">
            <Avatar person={preview} />
            <div>
              <strong>{personName(preview)}</strong>
              <span>{profile.email}</span>
            </div>
          </div>

          <label>
            Display name
            <input
              value={displayName}
              maxLength={40}
              required
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <div className="profile-form__photo">
            <label className="secondary-button">
              Upload photo
              <input
                className="profile-form__file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) choosePhoto(file)
                }}
              />
            </label>
            {shownPhoto && (
              <button className="danger-button" type="button" onClick={clearPhoto}>
                Remove photo
              </button>
            )}
          </div>
          <p className="profile-form__hint">
            Choose a photo from your device. It shows in chat, calls, and the member list.
          </p>

          {errorMessage && (
            <p className="request-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="modal__actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isSaving || !displayName.trim()}>
              {isSaving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
