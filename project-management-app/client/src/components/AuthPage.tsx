import { useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from '@firebase/auth'
import { auth } from '../lib/firebase'

type AuthMode = 'login' | 'register'

const developerCredentials = {
  email: 'developer@taskflow.local',
  password: 'taskflow-dev-123',
}

function getAuthErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return 'Authentication failed. Please try again.'
  }

  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'An account already exists for this email.'
    case 'auth/invalid-credential':
      return 'The email or password is incorrect.'
    case 'auth/weak-password':
      return 'Use a password with at least six characters.'
    default:
      return 'Authentication failed. Please try again.'
  }
}

export function AuthPage() {
  const isUsingAuthEmulator =
    import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
      setIsSubmitting(false)
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setErrorMessage('')
  }

  async function loginWithDeveloperAccount() {
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      await signInWithEmailAndPassword(
        auth,
        developerCredentials.email,
        developerCredentials.password,
      )
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'auth/invalid-credential' ||
          error.code === 'auth/user-not-found')
      ) {
        try {
          await createUserWithEmailAndPassword(
            auth,
            developerCredentials.email,
            developerCredentials.password,
          )
          return
        } catch (createError) {
          setErrorMessage(getAuthErrorMessage(createError))
        }
      } else {
        setErrorMessage(getAuthErrorMessage(error))
      }

      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand__mark">T</span>
          <span>TaskFlow</span>
        </div>

        <div>
          <p className="eyebrow">
            {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
          </p>
          <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
          <p className="auth-intro">
            Manage projects, priorities, and deadlines in one place.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              required
              minLength={6}
              type="password"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          {errorMessage && (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        {isUsingAuthEmulator && (
          <div className="developer-login">
            <span>or</span>
            <button
              className="secondary-button"
              type="button"
              disabled={isSubmitting}
              onClick={() => void loginWithDeveloperAccount()}
            >
              Use developer account
            </button>
          </div>
        )}

        <p className="auth-switch">
          {mode === 'login'
            ? "Don't have an account?"
            : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </section>
    </main>
  )
}
