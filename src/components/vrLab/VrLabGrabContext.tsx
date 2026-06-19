import { useThree } from '@react-three/fiber'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clamp01 } from '../../vrLab/vrLabAnimation'
import { canPourFromTilt } from '../../vrLab/physics/PourSolver'

type GrabContextValue = {
  grabbedId: string | null
  tilt: number
  streamingId: string | null
  setGrabbed: (id: string | null) => void
  setTilt: (value: number) => void
  addTilt: (delta: number) => void
  resetTilt: () => void
  setStreaming: (id: string | null) => void
  activeTiltFlaskId: string | null
  setActiveTiltFlaskId: (id: string | null) => void
}

const GrabContext = createContext<GrabContextValue | null>(null)

export function useVrLabGrab() {
  const ctx = useContext(GrabContext)
  if (!ctx) throw new Error('useVrLabGrab must be used inside VrLabGrabProvider')
  return ctx
}

export function useVrLabGrabOptional() {
  return useContext(GrabContext)
}

type ProviderProps = {
  children: ReactNode
  selectedId: string | null
  busy: boolean
}

export function VrLabGrabProvider({ children, selectedId, busy }: ProviderProps) {
  const { gl } = useThree()
  const [grabbedId, setGrabbedId] = useState<string | null>(null)
  const [tilt, setTiltState] = useState(0)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [activeTiltFlaskId, setActiveTiltFlaskId] = useState<string | null>(null)

  const setGrabbed = useCallback(
    (id: string | null) => {
      setGrabbedId(id)
      if (id) {
        setActiveTiltFlaskId(id)
        setTiltState(0)
      } else {
        setStreamingId(null)
      }
    },
    [],
  )

  const setTilt = useCallback((value: number) => {
    setTiltState(clamp01(value))
  }, [])

  const addTilt = useCallback((delta: number) => {
    setTiltState((t) => clamp01(t + delta))
  }, [])

  const resetTilt = useCallback(() => {
    setTiltState(0)
    setStreamingId(null)
  }, [])

  const tiltTargetId = grabbedId ?? activeTiltFlaskId ?? selectedId

  useEffect(() => {
    if (busy) return

    const onWheel = (e: WheelEvent) => {
      if (!tiltTargetId) return
      e.preventDefault()
      addTilt(-e.deltaY * 0.0018)
    }

    const onKey = (e: KeyboardEvent) => {
      if (!tiltTargetId) return
      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        addTilt(e.shiftKey ? -0.12 : 0.12)
      }
      if (e.key === 'ArrowDown') addTilt(0.08)
      if (e.key === 'ArrowUp') addTilt(-0.08)
    }

    const el = gl.domElement
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [addTilt, busy, gl.domElement, tiltTargetId])

  useEffect(() => {
    if (selectedId) setActiveTiltFlaskId(selectedId)
  }, [selectedId])

  const value = useMemo(
    () => ({
      grabbedId,
      tilt,
      streamingId,
      setGrabbed,
      setTilt,
      addTilt,
      resetTilt,
      setStreaming: setStreamingId,
      activeTiltFlaskId: tiltTargetId,
      setActiveTiltFlaskId,
    }),
    [addTilt, grabbedId, resetTilt, setGrabbed, setTilt, streamingId, tilt, tiltTargetId],
  )

  return <GrabContext.Provider value={value}>{children}</GrabContext.Provider>
}

export { canPourFromTilt }
