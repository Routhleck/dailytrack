import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleDismiss = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#e4e4e7',
          backgroundColor: '#18181b',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '1.5rem', maxWidth: '28rem' }}>
          An unexpected error occurred. Your local data files are safe — this is a UI rendering issue.
        </p>
        {this.state.error && (
          <pre
            style={{
              fontSize: '0.75rem',
              color: '#71717a',
              background: '#27272a',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              maxWidth: '36rem',
              overflow: 'auto',
              marginBottom: '1.5rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
        )}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
          <button
            onClick={this.handleDismiss}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.375rem',
              border: '1px solid #3f3f46',
              background: 'transparent',
              color: '#a1a1aa',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try to Continue
          </button>
        </div>
      </div>
    )
  }
}
