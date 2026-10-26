import { getApp, getApps, initializeApp } from '@firebase/app'
import { connectAuthEmulator, getAuth } from '@firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)

if (
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' &&
  !auth.emulatorConfig
) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  })
}
