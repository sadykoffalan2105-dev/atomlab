import { Component, Fragment, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: ReactNode | ((error: unknown, retry: () => void) => ReactNode)
  resetKey?: string | number
}

type State = { error: unknown | null; mountKey: number; retryCount: number }

const RETRY_PLACEHOLDER = (
  <div
    aria-hidden
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      background: '#0a0c18',
    }}
  />
)

/**
 * Ловит сбои WebGL/Three.js; одна автоматическая перезагрузка Canvas.
 * Fragment без DOM-обёртки — не ломает .canvasWrap > :first-child для R3F.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null, mountKey: 0, retryCount: 0 }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error }
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, retryCount: 0, mountKey: this.state.mountKey + 1 })
    }
  }

  componentDidCatch(_error: unknown): void {
    const { retryCount } = this.state
    if (retryCount < 3) {
      window.setTimeout(() => {
        this.setState((s) => ({
          error: null,
          retryCount: s.retryCount + 1,
          mountKey: s.mountKey + 1,
        }))
      }, 120)
    }
  }

  private retry = (): void => {
    this.setState((s) => ({
      error: null,
      retryCount: 0,
      mountKey: s.mountKey + 1,
    }))
  }

  render() {
    const { error, mountKey, retryCount } = this.state

    if (error) {
      if (retryCount < 3) return RETRY_PLACEHOLDER

      const { fallback } = this.props
      if (typeof fallback === 'function') return fallback(error, this.retry)
      if (fallback != null) return fallback
      return (
        <div
          role="status"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            padding: 12,
            color: 'rgba(220,228,255,0.92)',
            background: 'rgba(8,10,26,0.92)',
            border: '1px solid rgba(61,255,236,0.22)',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <p>3D не удалось отрисовать.</p>
          <button type="button" onClick={this.retry} style={{ cursor: 'pointer' }}>
            Повторить
          </button>
        </div>
      )
    }

    return <Fragment key={mountKey}>{this.props.children}</Fragment>
  }
}
