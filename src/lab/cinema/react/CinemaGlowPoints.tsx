import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Пул светящихся точек в один draw call.
 *
 * Им нарисованы и электроны, и изогнутые стрелки механизма: точка — это
 * GL_POINT с радиальным затуханием в шейдере, без текстур и без билбордов.
 * Размер задаётся в мировых единицах и учитывает масштаб рига камеры, поэтому
 * при наезде электроны растут вместе с атомами, а не остаются «пикселями».
 *
 * Сцена каждый кадр пишет точки через handle.begin() / push() / end() —
 * буферы выделены один раз под capacity.
 */

export type GlowPointsHandle = {
  begin: () => void
  /** size — диаметр в мировых единицах; alpha 0..1; core 0..1 — доля белого ядра */
  push: (x: number, y: number, z: number, size: number, r: number, g: number, b: number, alpha: number, core?: number) => void
  end: () => void
}

function createGlowPointsMaterial(depthTest: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPixelScale: { value: 400 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec4 aColor;
      attribute float aCore;
      uniform float uPixelScale;
      varying vec4 vColor;
      varying float vCore;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float modelScale = length(modelMatrix[0].xyz);
        gl_PointSize = max(1.0, aSize * modelScale * uPixelScale / max(0.001, -mv.z));
        vColor = aColor;
        vCore = aCore;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec4 vColor;
      varying float vCore;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d2 = dot(p, p);
        if (d2 > 1.0) discard;
        float halo = pow(1.0 - d2, 2.2);
        float core = smoothstep(0.16, 0.0, d2) * vCore;
        vec3 col = mix(vColor.rgb * halo, vec3(1.0), core);
        gl_FragColor = vec4(col, 1.0) * vColor.a * max(halo, core);
      }
    `,
  })
}

/** Пиксели на мировую единицу на расстоянии 1: h / (2·tan(fov/2)). */
function syncPixelScale(points: THREE.Points | null, heightPx: number, camera: THREE.Camera): void {
  const mat = points?.material as THREE.ShaderMaterial | undefined
  if (!mat) return
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45
  mat.uniforms.uPixelScale!.value = heightPx / (2 * Math.tan((fov * Math.PI) / 360))
}

export function CinemaGlowPoints({
  ref,
  capacity,
  depthTest = true,
  renderOrder = 8,
}: {
  ref: Ref<GlowPointsHandle>
  capacity: number
  depthTest?: boolean
  renderOrder?: number
}) {
  const points = useRef<THREE.Points>(null)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const camera = useThree((s) => s.camera)

  const buffers = useMemo(() => {
    const position = new Float32Array(capacity * 3)
    const color = new Float32Array(capacity * 4)
    const sizeAttr = new Float32Array(capacity)
    const core = new Float32Array(capacity)
    const geo = new THREE.BufferGeometry()
    const pos = new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage)
    const col = new THREE.BufferAttribute(color, 4).setUsage(THREE.DynamicDrawUsage)
    const siz = new THREE.BufferAttribute(sizeAttr, 1).setUsage(THREE.DynamicDrawUsage)
    const cor = new THREE.BufferAttribute(core, 1).setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', pos)
    geo.setAttribute('aColor', col)
    geo.setAttribute('aSize', siz)
    geo.setAttribute('aCore', cor)
    geo.setDrawRange(0, 0)
    // Точки двигаются по всему кадру: bounding sphere с запасом, чтобы не отсекались.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50)
    return { geo, position, color, sizeAttr, core, pos, col, siz, cor }
  }, [capacity])

  const material = useMemo(() => createGlowPointsMaterial(depthTest), [depthTest])

  useEffect(() => {
    return () => {
      buffers.geo.dispose()
      material.dispose()
    }
  }, [buffers, material])

  const count = useRef(0)

  useImperativeHandle(
    ref,
    () => ({
      begin() {
        count.current = 0
      },
      push(x, y, z, s, r, g, b, alpha, core = 0) {
        const i = count.current
        if (i >= capacity || alpha <= 0.002) return
        buffers.position[i * 3] = x
        buffers.position[i * 3 + 1] = y
        buffers.position[i * 3 + 2] = z
        buffers.color[i * 4] = r
        buffers.color[i * 4 + 1] = g
        buffers.color[i * 4 + 2] = b
        buffers.color[i * 4 + 3] = alpha
        buffers.sizeAttr[i] = s
        buffers.core[i] = core
        count.current = i + 1
      },
      end() {
        const n = count.current
        // Точки всегда visible: пустой кадр = drawRange 0 (ноль отрисовки), а программа
        // скомпилирована на прогреве урока, а не в кадре первого электрона.
        buffers.geo.setDrawRange(0, n)
        if (n === 0) return
        buffers.pos.clearUpdateRanges()
        buffers.pos.addUpdateRange(0, n * 3)
        buffers.pos.needsUpdate = true
        buffers.col.clearUpdateRanges()
        buffers.col.addUpdateRange(0, n * 4)
        buffers.col.needsUpdate = true
        buffers.siz.clearUpdateRanges()
        buffers.siz.addUpdateRange(0, n)
        buffers.siz.needsUpdate = true
        buffers.cor.clearUpdateRanges()
        buffers.cor.addUpdateRange(0, n)
        buffers.cor.needsUpdate = true
      },
    }),
    [buffers, capacity],
  )

  useFrame(() => {
    syncPixelScale(points.current, size.height * dpr, camera)
  })

  return (
    <points ref={points} geometry={buffers.geo} material={material} renderOrder={renderOrder} frustumCulled={false} dispose={null} />
  )
}
