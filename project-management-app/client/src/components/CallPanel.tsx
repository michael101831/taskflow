import { useEffect, useRef, useState, type FormEvent } from 'react'
import { auth } from '../lib/firebase'
import { CallSession, type CallPeer } from '../lib/teamCall'
import { callsApi, callSocketUrl } from '../services/api'
import type { CallRoom, ProjectMember } from '../types'

type CallPanelProps = {
  projectId: string
  projectName: string
  members: ProjectMember[]
  currentUserId: string
}

function personName(person: { displayName: string | null; email: string }) {
  return person.displayName || person.email
}

function mediaError(caught: unknown) {
  if (caught instanceof DOMException && caught.name === 'NotAllowedError') {
    return 'Allow the camera and microphone in your browser to join the call.'
  }
  if (caught instanceof DOMException && caught.name === 'NotFoundError') {
    return 'No camera or microphone was found on this device.'
  }
  if (caught instanceof Error && caught.message) return caught.message
  return 'The call could not start.'
}

function VideoTile({
  stream,
  label,
  playMuted,
  micOff,
  cameraOff,
  mirror,
}: {
  stream: MediaStream | null
  label: string
  playMuted: boolean
  micOff: boolean
  cameraOff: boolean
  mirror?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    if (stream) void video.play().catch(() => undefined)
  }, [stream])

  return (
    <article className="call-tile">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={playMuted}
        className={mirror ? 'call-tile__video call-tile__video--mirror' : 'call-tile__video'}
      />
      {(cameraOff || !stream) && (
        <div className="call-tile__placeholder">
          <span>{label.slice(0, 1).toUpperCase()}</span>
          <p>{cameraOff ? 'Camera off' : 'Connecting...'}</p>
        </div>
      )}
      <p className="call-tile__name">
        {label}
        {micOff ? ' · Muted' : ''}
      </p>
    </article>
  )
}

export function CallPanel({
  projectId,
  projectName,
  members,
  currentUserId,
}: CallPanelProps) {
  const [rooms, setRooms] = useState<CallRoom[]>([])
  const [activeRoomId, setActiveRoomId] = useState('')
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [roomName, setRoomName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [phase, setPhase] = useState<'ready' | 'connecting' | 'live'>('ready')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<CallPeer[]>([])
  const sessionRef = useRef<CallSession | null>(null)
  const coworkers = members.filter((member) => member.id !== currentUserId)
  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null
  const invited = activeRoom
    ? activeRoom.members.filter((member) => member.id !== currentUserId)
    : []

  useEffect(() => {
    return () => {
      sessionRef.current?.stop()
      sessionRef.current = null
    }
  }, [projectId])

  useEffect(() => {
    let cancelled = false

    async function loadRooms() {
      try {
        const nextRooms = await callsApi.list(projectId)
        if (!cancelled) setRooms(nextRooms)
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Call rooms could not be loaded.')
        }
      }
    }

    void loadRooms()
    const timer = window.setInterval(() => void loadRooms(), 8000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [projectId])

  function leave() {
    sessionRef.current?.stop()
    sessionRef.current = null
    setLocalStream(null)
    setPeers([])
    setMuted(false)
    setCameraOff(false)
    setPhase('ready')
  }

  function selectRoom(roomId: string) {
    if (roomId === activeRoomId) return
    leave()
    setActiveRoomId(roomId)
    setError('')
  }

  function toggleMember(memberId: string) {
    setSelectedIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    )
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)
    setError('')

    try {
      const room = await callsApi.create(projectId, {
        memberIds: selectedIds,
        ...(selectedIds.length > 1 ? { name: roomName } : {}),
      })
      setRooms((current) => [room, ...current.filter((item) => item.id !== room.id)])
      leave()
      setActiveRoomId(room.id)
      setIsComposerOpen(false)
      setSelectedIds([])
      setRoomName('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The room could not be created.')
    } finally {
      setIsCreating(false)
    }
  }

  async function join() {
    if (!activeRoom) return
    setError('')
    setPhase('connecting')
    let stream: MediaStream | null = null

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      })
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sign in to join the call')

      const session = new CallSession(stream, {
        onPeers: setPeers,
        onOpen: () => setPhase('live'),
        onError: (message) => {
          setError(message)
          setLocalStream(null)
          setPeers([])
          setPhase('ready')
        },
        onClose: () => {
          setLocalStream(null)
          setPeers([])
          setPhase('ready')
        },
      })
      sessionRef.current = session
      setLocalStream(stream)
      setMuted(false)
      setCameraOff(false)
      session.connect(callSocketUrl(), token, activeRoom.id)
    } catch (caught) {
      if (sessionRef.current) {
        sessionRef.current.stop()
        sessionRef.current = null
      } else {
        stream?.getTracks().forEach((track) => track.stop())
      }
      setLocalStream(null)
      setPhase('ready')
      setError(mediaError(caught))
    }
  }

  function toggleMute() {
    const next = !muted
    sessionRef.current?.setMicEnabled(!next)
    setMuted(next)
  }

  function toggleCamera() {
    const next = !cameraOff
    sessionRef.current?.setCameraEnabled(!next)
    setCameraOff(next)
  }

  const people = 1 + peers.length

  return (
    <section className="call-layout" aria-label={`${projectName} call rooms`}>
      <aside className="chat-list call-rooms">
        <div className="chat-list__header">
          <h2>Rooms</h2>
          <button
            type="button"
            onClick={() => {
              setIsComposerOpen((open) => !open)
              setError('')
            }}
          >
            {isComposerOpen ? 'Close' : 'New room'}
          </button>
        </div>

        {isComposerOpen && (
          <form className="chat-form" onSubmit={(event) => void createRoom(event)}>
            <fieldset>
              <legend>Coworkers</legend>
              {coworkers.length === 0 ? (
                <p>Add a teammate in Members before starting a call.</p>
              ) : (
                coworkers.map((member) => (
                  <label key={member.id}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                    />
                    {personName(member)}
                    <span>{member.role}</span>
                  </label>
                ))
              )}
            </fieldset>
            {selectedIds.length > 1 && (
              <label>
                Room name
                <input
                  value={roomName}
                  maxLength={40}
                  onChange={(event) => setRoomName(event.target.value)}
                />
              </label>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={
                isCreating ||
                selectedIds.length === 0 ||
                (selectedIds.length > 1 && roomName.trim().length === 0)
              }
            >
              {isCreating ? 'Creating...' : 'Start Room'}
            </button>
          </form>
        )}

        <ul className="chat-list__items">
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                className={
                  room.id === activeRoomId
                    ? 'chat-list__item chat-list__item--active'
                    : 'chat-list__item'
                }
                aria-current={room.id === activeRoomId ? 'true' : undefined}
                onClick={() => selectRoom(room.id)}
              >
                <span className="chat-list__name">{room.name}</span>
                <span className="chat-list__kind">
                  {room.kind === 'direct' ? 'Direct' : 'Group'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {(error || activeRoom) && (
      <div className="call-stage">
        {error && (
          <p className="request-error" role="alert">
            {error}
          </p>
        )}

        {phase === 'live' && activeRoom ? (
          <>
            <p className="call-status" role="status">
              {people === 1
                ? `You are in ${activeRoom.name}. Waiting for someone you invited.`
                : `${people} people in ${activeRoom.name}`}
            </p>
            <div className="call-grid">
              <VideoTile
                stream={localStream}
                label="You"
                playMuted
                micOff={muted}
                cameraOff={cameraOff}
                mirror
              />
              {peers.map((peer) => (
                <VideoTile
                  key={peer.id}
                  stream={peer.stream}
                  label={peer.name}
                  playMuted={false}
                  micOff={!peer.audio}
                  cameraOff={!peer.video}
                />
              ))}
            </div>
            <div className="call-controls">
              <button
                className="secondary-button"
                type="button"
                aria-pressed={muted}
                onClick={toggleMute}
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                className="secondary-button"
                type="button"
                aria-pressed={cameraOff}
                onClick={toggleCamera}
              >
                {cameraOff ? 'Start video' : 'Stop video'}
              </button>
              <button className="danger-button" type="button" onClick={leave}>
                Leave call
              </button>
            </div>
          </>
        ) : activeRoom ? (
          <div className="call-lobby">
            <h2>{activeRoom.name}</h2>
            <p>
              {activeRoom.kind === 'direct'
                ? `Private call with ${invited.map(personName).join(', ')}. Nobody else on ${projectName} can see this room.`
                : `Invited: ${invited.map(personName).join(', ')}. Only these people can see this room.`}
            </p>
            <button
              className="primary-button"
              type="button"
              disabled={phase === 'connecting'}
              onClick={() => void join()}
            >
              {phase === 'connecting' ? 'Joining...' : 'Join call'}
            </button>
          </div>
        ) : null}
      </div>
      )}
    </section>
  )
}
