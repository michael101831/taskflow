import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { message: string }
> {
  state = { message: '' }

  static getDerivedStateFromError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : 'The page failed to load.',
    }
  }

  render() {
    if (this.state.message) {
      return (
        <main className="auth-page">
          <p role="alert">{this.state.message}</p>
        </main>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
