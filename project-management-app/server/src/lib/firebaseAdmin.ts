import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type AppOptions,
} from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const projectId = process.env.FIREBASE_PROJECT_ID

if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID is required')
}

const options: AppOptions = { projectId }

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  options.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  options.credential = applicationDefault()
}

const app = getApps()[0] ?? initializeApp(options)

export const adminAuth = getAuth(app)
