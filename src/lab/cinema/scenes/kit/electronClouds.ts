import * as THREE from 'three'

/**
 * Электронное облако ВНЕШНЕГО энергетического уровня частиц сцены (школьная модель, Kimyo 8:
 * «электроны образуют вокруг ядра как бы электронное облако»). Облако — мерцающая «пыль» точек у
 * поверхности шара, как точечные рисунки облаков в учебнике:
 *   • плотность = доля заполнения уровня (fill = внешних электронов / 8, см. chemistry/data/electronLevels);
 *     у Na — 1 из 8, у Cl — 7 из 8;
 *   • у акцептора в облаке «окно» (hole) там, куда придёт электрон, — оно закрывается в кадр захвата;
 *   • перед отрывом облако донора вытягивается к партнёру (stretch) и уходит вместе с электроном;
 *   • у катиона облаком становится завершённый предвнешний уровень — он проявляется по мере сжатия шара.
 * Первая сцена — NaCl (scenes/nacl); число частиц задаёт сцена.
 * Все параметры — uniform'ы: геометрия создаётся один раз, в кадре ноль аллокаций.
 */

const vert = (n: number) => /* glsl */ `
attribute float aAtom;
attribute vec3 aDir;
attribute float aR;
attribute float aRank;
attribute float aSeed;
uniform vec4 uCenter[${n}];
uniform vec4 uParam[${n}];
uniform vec3 uHoleDir[${n}];
uniform vec3 uStretchDir[${n}];
uniform float uTime;
uniform float uSize;
uniform float uPxScale;
varying float vAlpha;

vec3 rotAxis(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

void main() {
  int i = int(aAtom + 0.5);
  vec4 C = uCenter[i];
  vec4 P = uParam[i];
  // Медленное «кипение» облака: каждая точка вращается вокруг своей оси.
  vec3 axis = normalize(vec3(sin(aSeed * 12.9), 1.3, cos(aSeed * 7.1)));
  vec3 d = rotAxis(aDir, axis, uTime * (0.16 + 0.22 * aSeed));
  vec3 pos = C.xyz + d * (C.w * aR);
  // Вытягивание к партнёру: сильнее всего у точек на обращённой к нему стороне.
  float face = max(0.0, dot(d, uStretchDir[i]));
  pos += uStretchDir[i] * (P.w * C.w * 1.5 * face * face);
  // Заполнение уровня: видны точки с рангом ниже доли fill (мягкий край, без мигания всем облаком).
  float vis = P.y * (1.0 - smoothstep(P.x - 0.05, P.x, aRank));
  // «Окно» под недостающий электрон (конус ~30° вокруг направления прихода).
  vis *= 1.0 - P.z * smoothstep(0.8, 0.9, dot(d, uHoleDir[i]));
  vis *= 0.72 + 0.28 * sin(uTime * 2.1 + aSeed * 43.0);
  // Облако читается ореолом у силуэта: точки на обращённой к зрителю стороне приглушены,
  // иначе они сплошь засыпают шар и символ внутри него.
  vec3 nView = normalize(normalMatrix * d);
  vis *= mix(1.0, 0.22, nView.z * nView.z);
  vAlpha = vis;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float sc = length(modelViewMatrix[0].xyz);
  gl_PointSize = vis > 0.002 ? uSize * sc * uPxScale / max(0.05, -mv.z) : 0.0;
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d2 = dot(q, q) * 4.0;
  if (d2 > 1.0) discard;
  float a = exp(-d2 * 3.2) * vAlpha * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
`

/** Детерминированный ГПСЧ: облако одинаково в каждом прогоне (скриншоты, тесты). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type ElectronCloudView = {
  points: THREE.Points
  material: THREE.ShaderMaterial
  /** Параметры облака частицы i (в системе stage). */
  set(i: number, center: THREE.Vector3, radius: number, fill: number, amount: number, hole: number, holeDir: THREE.Vector3, stretch: number, stretchDir: THREE.Vector3): void
  /** Время «живого» мерцания (идёт и на паузе) и перевод размера точки в пиксели. */
  frame(time: number, pxPerProjUnit: number): void
  dispose(): void
}

export function createElectronClouds(opts: { atoms: number; lowPower?: boolean; color: THREE.Color }): ElectronCloudView {
  const atoms = opts.atoms
  const perAtom = opts.lowPower ? 140 : 260
  const n = perAtom * atoms
  const atom = new Float32Array(n)
  const dir = new Float32Array(n * 3)
  const rad = new Float32Array(n)
  const rank = new Float32Array(n)
  const seed = new Float32Array(n)
  const rnd = mulberry32(0x4e61436c)
  for (let a = 0; a < atoms; a++) {
    for (let j = 0; j < perAtom; j++) {
      const o = a * perAtom + j
      atom[o] = a
      // равномерно по сфере
      const z = rnd() * 2 - 1
      const phi = rnd() * Math.PI * 2
      const q = Math.sqrt(1 - z * z)
      dir[o * 3] = q * Math.cos(phi)
      dir[o * 3 + 1] = q * Math.sin(phi)
      dir[o * 3 + 2] = z
      // Плотнее всего у поверхности шара, редкий «хвост» наружу (облако без резкой границы).
      rad[o] = 0.98 + Math.min(0.55, -Math.log(1 - rnd() * 0.999) * 0.16)
      // Ранг — равномерная сетка с дрожанием: при fill = 1/8 видна ровно восьмая часть точек.
      rank[o] = (j + rnd()) / perAtom
      seed[o] = rnd()
    }
  }
  const geometry = new THREE.BufferGeometry()
  // Позиции считает шейдер; атрибут position нужен three для числа вершин.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  geometry.setAttribute('aAtom', new THREE.BufferAttribute(atom, 1))
  geometry.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
  geometry.setAttribute('aR', new THREE.BufferAttribute(rad, 1))
  geometry.setAttribute('aRank', new THREE.BufferAttribute(rank, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)

  const uCenter = Array.from({ length: atoms }, () => new THREE.Vector4())
  const uParam = Array.from({ length: atoms }, () => new THREE.Vector4())
  const uHoleDir = Array.from({ length: atoms }, () => new THREE.Vector3(1, 0, 0))
  const uStretchDir = Array.from({ length: atoms }, () => new THREE.Vector3(1, 0, 0))
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
  const material = new THREE.ShaderMaterial({
    vertexShader: vert(atoms),
    fragmentShader: FRAG,
    uniforms: {
      uCenter: { value: uCenter },
      uParam: { value: uParam },
      uHoleDir: { value: uHoleDir },
      uStretchDir: { value: uStretchDir },
      uTime: { value: 0 },
      uSize: { value: opts.lowPower ? 0.07 : 0.055 },
      uPxScale: { value: 800 },
      uColor: { value: opts.color.clone() },
      uOpacity: { value: 0.7 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false,
  })
  const points = new THREE.Points(geometry, material)
  points.name = 'electron-clouds'
  points.frustumCulled = false
  points.renderOrder = 9

  return {
    points,
    material,
    set(i, center, radius, fill, amount, hole, holeDir, stretch, stretchDir) {
      uCenter[i]!.set(center.x, center.y, center.z, radius)
      uParam[i]!.set(fill, amount, hole, stretch)
      uHoleDir[i]!.copy(holeDir)
      uStretchDir[i]!.copy(stretchDir)
    },
    frame(time, pxPerProjUnit) {
      material.uniforms.uTime!.value = time
      material.uniforms.uPxScale!.value = pxPerProjUnit * dpr
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

let ringTex: THREE.DataTexture | null = null

/** Кольцо-вспышка (без DOM): отрыв электрона у донора и захват у акцептора. */
export function ringFlashTexture(): THREE.DataTexture {
  if (ringTex) return ringTex
  const n = 96
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot((x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5) * 2
      const a = Math.exp(-(((r - 0.82) / 0.07) ** 2)) + 0.25 * Math.exp(-(((r - 0.82) / 0.2) ** 2))
      const o = (y * n + x) * 4
      data[o] = 255
      data[o + 1] = 255
      data[o + 2] = 255
      data[o + 3] = Math.round(Math.min(1, a) * 255)
    }
  }
  ringTex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat)
  ringTex.magFilter = THREE.LinearFilter
  ringTex.minFilter = THREE.LinearFilter
  ringTex.needsUpdate = true
  return ringTex
}
