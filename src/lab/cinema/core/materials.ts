import * as THREE from 'three'
import { cinemaTexture } from './textures'

/**
 * ATOMLAB Cinema — кэш материалов.
 *
 * Материалы шарятся по ключу: 10 атомов на сцене не должны компилировать
 * 10 шейдеров. Всё, что мутируется покадрово (uniforms связей, газа),
 * НЕ кэшируется — иначе два объекта затирают друг другу состояние.
 */

const coreCache = new Map<string, THREE.MeshStandardMaterial>()
const shellCache = new Map<string, THREE.ShaderMaterial>()
const nucleusCache = new Map<string, THREE.MeshBasicMaterial>()
const spriteCache = new Map<string, THREE.MeshBasicMaterial>()

function hexOf(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * Кристаллическое ядро атома: PBR-поверхность с внутренним свечением.
 * Полупрозрачна, чтобы читалось светящееся ядро внутри — это дешёвая
 * замена transmission (рефракция на 10 атомах съедает кадр).
 */
export function crystalCoreMaterial(color: number, emissive = 0.55, opacity = 0.92): THREE.MeshStandardMaterial {
  const key = `${color}_${emissive.toFixed(2)}_${opacity.toFixed(2)}`
  let m = coreCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hexOf(color),
      emissive: hexOf(color),
      emissiveIntensity: emissive,
      roughness: 0.18,
      metalness: 0.05,
      transparent: opacity < 1,
      opacity,
      depthWrite: true,
    })
    coreCache.set(key, m)
  }
  return m
}

/**
 * Ядро атома — крошечная яркая сфера внутри кристалла.
 *
 * @deprecated Внутри полупрозрачного ядра, пишущего глубину, такая сфера не
 * проходит depth test и никогда не видна. Искра ядра теперь — параметр `spark`
 * френелевской оболочки (fresnelShellMaterial): ноль лишних draw call.
 */
export function nucleusMaterial(color: number): THREE.MeshBasicMaterial {
  const key = String(color)
  let m = nucleusCache.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: hexOf(color),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    nucleusCache.set(key, m)
  }
  return m
}

/**
 * Френелевская оболочка: свечение по кромке сферы.
 * Именно она даёт «стеклянно-кристаллический» вид почти бесплатно —
 * один дешёвый fragment-шейдер без прозрачных сортировок и рефракции.
 *
 * `spark` — искра ядра: мягкое пятно в центре диска, там, где нормаль смотрит
 * в камеру. Оболочка аддитивна и лежит снаружи ядра, поэтому искра читается
 * «сквозь стекло», хотя отдельного меша ядра больше нет.
 */
export function fresnelShellMaterial(color: number, power = 2.6, intensity = 0.9, spark = 0): THREE.ShaderMaterial {
  const key = `${color}_${power}_${intensity}_${spark.toFixed(2)}`
  let m = shellCache.get(key)
  if (!m) {
    m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: {
        uColor: { value: new THREE.Color(hexOf(color)) },
        // Искра светлее цвета элемента: раскалённое ядро, а не цветной шарик.
        uSparkColor: { value: new THREE.Color(hexOf(color)).lerp(new THREE.Color(1, 1, 1), 0.55) },
        uPower: { value: power },
        uIntensity: { value: intensity },
        uSpark: { value: spark },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        void main() {
          vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
          vNormalV = normalize(normalMatrix * normal);
          vViewDir = normalize(-viewPos.xyz);
          gl_Position = projectionMatrix * viewPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uSparkColor;
        uniform float uPower;
        uniform float uIntensity;
        uniform float uSpark;
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        void main() {
          float d = clamp(dot(normalize(vNormalV), normalize(vViewDir)), 0.0, 1.0);
          float f = pow(1.0 - d, uPower);
          // d^12: половина яркости при d≈0.94 — пятно ≈0.35 радиуса, как у прежнего ядра.
          float d4 = d * d * d * d;
          float spark = d4 * d4 * d4 * uSpark;
          // Аддитивное смешение (SRC_ALPHA, ONE): цвет уже взвешен, альфа = 1.
          gl_FragColor = vec4(uColor * (f * uIntensity) + uSparkColor * spark, 1.0);
        }
      `,
    })
    shellCache.set(key, m)
  }
  return m
}

/** Спрайтовый материал для частиц (three.quarks) — цвет задают сами частицы. */
export function particleSpriteMaterial(
  kind: 'glow' | 'spark' | 'puff',
  blending: THREE.Blending = THREE.AdditiveBlending,
): THREE.MeshBasicMaterial {
  const key = `${kind}_${blending}`
  let m = spriteCache.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      map: cinemaTexture(kind),
      transparent: true,
      blending,
      depthWrite: false,
      side: THREE.DoubleSide,
      // Аддитивному спрайту порядок граней безразличен — один проход вместо двух.
      // Обычное смешение оставляем двухпроходным: там порядок граней виден.
      // three.quarks флаг в свои батч-материалы не копирует — его дописывает CinemaVfxStage.
      forceSinglePass: blending === THREE.AdditiveBlending,
      color: 0xffffff,
    })
    spriteCache.set(key, m)
  }
  return m
}

/** Полная выгрузка кэша — при закрытии 3D-лаборатории. */
export function disposeCinemaMaterials(): void {
  coreCache.forEach((m) => m.dispose())
  shellCache.forEach((m) => m.dispose())
  nucleusCache.forEach((m) => m.dispose())
  spriteCache.forEach((m) => m.dispose())
  coreCache.clear()
  shellCache.clear()
  nucleusCache.clear()
  spriteCache.clear()
}
