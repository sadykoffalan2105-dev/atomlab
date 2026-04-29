import { Component, type ReactNode } from 'react'

export class CanvasErrorBoundary extends Component<
  {
    children: ReactNode
    fallback?: ReactNode | ((error: unknown) => ReactNode)
  },
  { error: unknown | null }
> {
  state: { error: unknown | null } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch() {
    // React will log the error to console; we only switch UI to fallback.
  }

  render() {
    const { error } = this.state
    if (error) {
      const { fallback } = this.props
      if (typeof fallback === 'function') return fallback(error)
      if (fallback != null) return fallback
      return (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            padding: 12,
            borderRadius: 12,
            color: 'rgba(220,228,255,0.92)',
            background: 'rgba(8,10,26,0.92)',
            border: '1px solid rgba(61,255,236,0.22)',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          3D не удалось отрисовать. Откройте Console в браузере, чтобы увидеть ошибку WebGL/Three.js.
        </div>
      )
    }

    return this.props.children
  }
}

