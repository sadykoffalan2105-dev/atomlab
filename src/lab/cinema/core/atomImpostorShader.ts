import * as THREE from 'three'
import { getLabSoftboxLighting, type SoftboxLighting } from './envLighting'
import type { AtomPool } from './pools'

/**
 * ATOMLAB Cinema — шейдеры инстансных атомов, язык «честное стекло».
 *
 * CPK-цвет остаётся «паспортом» элемента, а свет и оттенок кромки несут только
 * химию, не декор:
 *   • wrap-диффуз от ключа + облучённость из SH окружения (без точечных ламп);
 *   • небольшой GGX-блик ключа и размытое SH-отражение по Френелю;
 *   • кромка подкрашена цветом элемента, заряд смещает её: − холодный циан,
 *     + тёплый янтарь (мягко, не перекрашивает атом);
 *   • emissive ≤ 1 — ровное собственное свечение ниже порога bloom,
 *     > 1 — «энергия»: ядро разгорается в белое и уходит в bloom.
 *
 * Два режима одной и той же модели освещения:
 *   impostor — квад к камере, пересечение луча со сферой во фрагменте,
 *              gl_FragDepth, аналитический AA силуэта (cinematic);
 *   mesh     — низкополигональная икосфера без discard и без gl_FragDepth
 *              (lite: тайловые GPU телефонов не теряют early-z).
 *
 * Упаковка инстанса (ATOM_INSTANCE_STRIDE = 10 float):
 *   [0..3] aSphere  xyz центр, w радиус
 *   [4..7] aColor   rgb линейный, a непрозрачность
 *   [8..9] aEnergy  emissive, charge
 */

export type AtomRenderMode = 'impostor' | 'mesh'

export const ATOM_INSTANCE_STRIDE = 10
export const ATOM_NEIGHBOR_SLOTS = 4
/** 4 × vec4 на атом: xyz — вектор к центру соседа (мировые единицы пула), w — его радиус */
export const ATOM_NEIGHBOR_STRIDE = 16

// ——— чистая логика (проверяется в Node) ———

/**
 * Пул → плотный буфер инстансов. Пишет только первые count слотов.
 * Возвращает число записанных инстансов.
 */
export function packAtomInstances(pool: AtomPool, out: Float32Array): number {
  const n = Math.max(0, Math.min(pool.count, pool.capacity, Math.floor(out.length / ATOM_INSTANCE_STRIDE)))
  const pos = pool.position
  const col = pool.color
  for (let i = 0; i < n; i++) {
    const o = i * ATOM_INSTANCE_STRIDE
    const i3 = i * 3
    out[o] = pos[i3]!
    out[o + 1] = pos[i3 + 1]!
    out[o + 2] = pos[i3 + 2]!
    out[o + 3] = pool.radius[i]!
    out[o + 4] = col[i3]!
    out[o + 5] = col[i3 + 1]!
    out[o + 6] = col[i3 + 2]!
    out[o + 7] = pool.opacity[i]!
    out[o + 8] = pool.emissive[i]!
    out[o + 9] = pool.charge[i]!
  }
  return n
}

const nearDist = new Float64Array(ATOM_NEIGHBOR_SLOTS)
const nearIdx = new Int32Array(ATOM_NEIGHBOR_SLOTS)

/**
 * Соседи для контактного затенения: до 4 ближайших атомов, чьи сферы
 * касаются или почти касаются (d < (rᵢ + rⱼ)·reach). Пустые слоты — нули.
 * O(n²) — вызывать при смене геометрии (version), не обязательно каждый кадр;
 * для 200 атомов это ~40 тыс. сравнений. Аллокаций нет.
 */
export function computeAtomContacts(pool: AtomPool, out: Float32Array, reach = 1.15): number {
  const n = Math.max(0, Math.min(pool.count, pool.capacity, Math.floor(out.length / ATOM_NEIGHBOR_STRIDE)))
  const pos = pool.position
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < ATOM_NEIGHBOR_SLOTS; s++) {
      nearDist[s] = Infinity
      nearIdx[s] = -1
    }
    const ri = pool.radius[i]!
    const xi = pos[i * 3]!
    const yi = pos[i * 3 + 1]!
    const zi = pos[i * 3 + 2]!
    const visibleI = ri > 0 && pool.opacity[i]! > 0.01
    for (let j = 0; visibleI && j < n; j++) {
      if (j === i) continue
      const rj = pool.radius[j]!
      if (rj <= 0 || pool.opacity[j]! <= 0.01) continue
      const dx = pos[j * 3]! - xi
      const dy = pos[j * 3 + 1]! - yi
      const dz = pos[j * 3 + 2]! - zi
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d <= 1e-6 || d >= (ri + rj) * reach) continue
      if (d >= nearDist[ATOM_NEIGHBOR_SLOTS - 1]!) continue
      // вставка в отсортированный список из 4
      let s = ATOM_NEIGHBOR_SLOTS - 1
      while (s > 0 && nearDist[s - 1]! > d) {
        nearDist[s] = nearDist[s - 1]!
        nearIdx[s] = nearIdx[s - 1]!
        s--
      }
      nearDist[s] = d
      nearIdx[s] = j
    }
    for (let s = 0; s < ATOM_NEIGHBOR_SLOTS; s++) {
      const o = i * ATOM_NEIGHBOR_STRIDE + s * 4
      const j = nearIdx[s]!
      if (j < 0) {
        out[o] = 0
        out[o + 1] = 0
        out[o + 2] = 0
        out[o + 3] = 0
        continue
      }
      out[o] = pos[j * 3]! - xi
      out[o + 1] = pos[j * 3 + 1]! - yi
      out[o + 2] = pos[j * 3 + 2]! - zi
      out[o + 3] = pool.radius[j]!
    }
  }
  return n
}

// ——— общие uniforms освещения ———

/**
 * Одни и те же объекты { value } подставляются во все материалы атомов:
 * CinemaLightRig меняет освещение один раз — обновляются все батчи сразу,
 * без перекомпиляции и без ререндеров React.
 */
export const atomLightUniforms = {
  uSH: { value: new Float32Array(27) },
  uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyColor: { value: new THREE.Color(0, 0, 0) },
  uEnvIntensity: { value: 1 },
}

let lightingReady = false

function ensureAtomLighting(): void {
  if (lightingReady) return
  setAtomLighting(getLabSoftboxLighting())
}

/** Задать освещение атомов (SH + ключ). envIntensity масштабирует всё окружение. */
export function setAtomLighting(lighting: SoftboxLighting, envIntensity?: number): void {
  atomLightUniforms.uSH.value.set(lighting.sh)
  const [kx, ky, kz] = lighting.keyDir
  atomLightUniforms.uKeyDir.value.set(kx, ky, kz).normalize()
  const [er, eg, eb] = lighting.keyIrradiance
  atomLightUniforms.uKeyColor.value.setRGB(er, eg, eb)
  if (envIntensity !== undefined) atomLightUniforms.uEnvIntensity.value = envIntensity
  lightingReady = true
}

/** Общая яркость окружения атомов (0 — только собственное свечение и кромка). */
export function setAtomEnvIntensity(value: number): void {
  atomLightUniforms.uEnvIntensity.value = value
}

/** Высота буфера кадра в пикселях — нужна импостору для запаса квада на AA. */
export function syncAtomMaterialViewport(material: THREE.ShaderMaterial, heightPx: number): void {
  const u = material.uniforms.uViewportHeight
  if (u && u.value !== heightPx) u.value = heightPx
}

// ——— GLSL ———

const SHADE_GLSL = /* glsl */ `
  uniform vec3 uSH[ 9 ];
  uniform vec3 uKeyDir;
  uniform vec3 uKeyColor;
  uniform float uEnvIntensity;

  // Облучённость из SH L2 (как shGetIrradianceAt в three.js).
  vec3 atomIrradiance( vec3 n ) {
    float x = n.x, y = n.y, z = n.z;
    vec3 r = uSH[ 0 ] * 0.886227;
    r += uSH[ 1 ] * 1.023328 * y;
    r += uSH[ 2 ] * 1.023328 * z;
    r += uSH[ 3 ] * 1.023328 * x;
    r += uSH[ 4 ] * 0.858086 * x * y;
    r += uSH[ 5 ] * 0.858086 * y * z;
    r += uSH[ 6 ] * ( 0.743125 * z * z - 0.247708 );
    r += uSH[ 7 ] * 0.858086 * x * z;
    r += uSH[ 8 ] * 0.429043 * ( x * x - y * y );
    return max( r, vec3( 0.0 ) );
  }

  // N, V — мировые единичные; V направлен к наблюдателю. occ — контактное затенение 0..1.
  vec3 atomShade( vec3 N, vec3 V, vec3 albedo, float emissive, float charge, float occ ) {
    float NoV = clamp( dot( N, V ), 0.0, 1.0 );
    float NoL = dot( N, uKeyDir );

    // Диффуз: окружение (уже содержит мягкий ключ) + wrap от ключа для формы.
    float wrap = NoL * 0.5 + 0.5;
    wrap *= wrap;
    vec3 ambient = atomIrradiance( N ) * ( uEnvIntensity * RECIPROCAL_PI );
    vec3 keyWrap = uKeyColor * ( wrap * 0.16 * uEnvIntensity );
    vec3 diffuse = albedo * ( ambient * occ + keyWrap * mix( 1.0, occ, 0.6 ) + 0.03 );

    // Небольшой GGX-блик ключа (roughness ≈ 0.4) — «стекло», не хром.
    vec3 H = normalize( uKeyDir + V );
    float NoH = clamp( dot( N, H ), 0.0, 1.0 );
    const float a2 = 0.026;
    float dd = NoH * NoH * ( a2 - 1.0 ) + 1.0;
    float D = min( a2 / ( PI * dd * dd ), 9.0 );
    float fres = 0.04 + 0.96 * pow( 1.0 - NoV, 5.0 );
    vec3 spec = uKeyColor * ( D * clamp( NoL, 0.0, 1.0 ) * 0.03 * uEnvIntensity );
    vec3 envSpec = atomIrradiance( reflect( -V, N ) ) * ( uEnvIntensity * RECIPROCAL_PI * fres * occ );

    // Кромка: цвет элемента, заряд смещает оттенок.
    float rim = pow( 1.0 - NoV, 3.0 );
    float q = clamp( charge, -1.0, 1.0 );
    vec3 qTint = q < 0.0 ? vec3( 0.30, 0.86, 1.0 ) : vec3( 1.0, 0.62, 0.24 );
    vec3 rimCol = mix( mix( albedo, vec3( 1.0 ), 0.3 ), qTint, abs( q ) * 0.7 );
    vec3 rimLight = rimCol * ( rim * ( 0.22 + 0.3 * abs( q ) ) );

    // Собственное свечение: ≤ 1 ровное, > 1 — энергия, центр разгорается в белое.
    float e = max( emissive, 0.0 );
    float hot = max( e - 1.0, 0.0 );
    float core = mix( 0.7, 1.2, NoV * NoV );
    vec3 glowCol = mix( albedo, vec3( 1.0 ), clamp( hot * 0.5, 0.0, 0.6 ) * NoV );
    vec3 glow = glowCol * ( ( min( e, 1.0 ) * 0.3 + hot * 1.4 ) * core );

    return diffuse + spec + envSpec + rimLight + glow;
  }

  #ifdef ATOM_CONTACT
    // Аналитическое затенение от сферы-соседа (сосед в системе вида, от центра C).
    float atomContactTerm( vec3 P, vec3 N, vec3 C, vec4 nb ) {
      vec3 di = C + nb.xyz - P;
      float l2 = max( dot( di, di ), 1e-6 );
      float o = max( dot( N, di ), 0.0 ) * inversesqrt( l2 ) * ( nb.w * nb.w ) / l2;
      return 1.0 - clamp( o, 0.0, 1.0 ) * 0.8;
    }
  #endif
`

const CONTACT_VERTEX_PARS = /* glsl */ `
  #ifdef ATOM_CONTACT
    attribute vec4 aNeighbor0;
    attribute vec4 aNeighbor1;
    attribute vec4 aNeighbor2;
    attribute vec4 aNeighbor3;
    varying vec4 vNeighbor0;
    varying vec4 vNeighbor1;
    varying vec4 vNeighbor2;
    varying vec4 vNeighbor3;
  #endif
`

const CONTACT_VERTEX = /* glsl */ `
  #ifdef ATOM_CONTACT
    mat3 mv3 = mat3( modelViewMatrix );
    vNeighbor0 = vec4( mv3 * aNeighbor0.xyz, aNeighbor0.w * scale );
    vNeighbor1 = vec4( mv3 * aNeighbor1.xyz, aNeighbor1.w * scale );
    vNeighbor2 = vec4( mv3 * aNeighbor2.xyz, aNeighbor2.w * scale );
    vNeighbor3 = vec4( mv3 * aNeighbor3.xyz, aNeighbor3.w * scale );
  #endif
`

const CONTACT_FRAGMENT_PARS = /* glsl */ `
  #ifdef ATOM_CONTACT
    varying vec4 vNeighbor0;
    varying vec4 vNeighbor1;
    varying vec4 vNeighbor2;
    varying vec4 vNeighbor3;
  #endif
`

/** occ из соседей; ожидает P, Nv (вид), C (центр в виде). */
const CONTACT_FRAGMENT = /* glsl */ `
  float occ = 1.0;
  #ifdef ATOM_CONTACT
    occ *= atomContactTerm( P, Nv, C, vNeighbor0 );
    occ *= atomContactTerm( P, Nv, C, vNeighbor1 );
    occ *= atomContactTerm( P, Nv, C, vNeighbor2 );
    occ *= atomContactTerm( P, Nv, C, vNeighbor3 );
  #endif
`

const IMPOSTOR_VERTEX = /* glsl */ `
  attribute vec4 aSphere;
  attribute vec4 aColor;
  attribute vec2 aEnergy;
  uniform float uViewportHeight;
  varying vec3 vRayPos;
  varying vec4 vSphere;
  varying vec4 vColor;
  varying vec2 vEnergy;
  ${CONTACT_VERTEX_PARS}
  #include <fog_pars_vertex>

  void main() {
    vec3 C = ( modelViewMatrix * vec4( aSphere.xyz, 1.0 ) ).xyz;
    // Риг сцены масштабирует мир равномерно — радиус масштабируется так же.
    float scale = length( modelViewMatrix[ 0 ].xyz );
    float r = aSphere.w * scale;
    vColor = aColor;
    vEnergy = aEnergy;
    vSphere = vec4( C, r );
    ${CONTACT_VERTEX}

    if ( r <= 0.0 || aColor.a <= 0.003 ) {
      // Невидимый атом: вырожденный квад за дальней плоскостью, растеризатор его отбросит.
      vRayPos = C;
      gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
      return;
    }

    bool persp = projectionMatrix[ 2 ][ 3 ] == -1.0;
    vec3 toCam = persp ? -C : vec3( 0.0, 0.0, 1.0 );
    float d2 = max( dot( toCam, toCam ), 1e-8 );
    vec3 fwd = toCam * inversesqrt( d2 );
    // Квад в плоскости через центр ⟂ лучу на центр. Сечение касательного конуса
    // этой плоскостью — ровно окружность r / sqrt(1 − r²/d²): силуэт в перспективе
    // покрыт без запаса «на глаз», даже у края кадра.
    float grow = persp ? inversesqrt( max( 1.0 - r * r / d2, 0.04 ) ) : 1.0;
    float depth = persp ? max( -C.z, 1e-4 ) : 1.0;
    float px = 2.0 * depth / ( projectionMatrix[ 1 ][ 1 ] * max( uViewportHeight, 1.0 ) );
    // Запас ~1.25 px — ровно под полосу AA силуэта.
    float ext = r * grow + 1.25 * px;

    vec3 up0 = abs( fwd.y ) > 0.99 ? vec3( 1.0, 0.0, 0.0 ) : vec3( 0.0, 1.0, 0.0 );
    vec3 right = normalize( cross( up0, fwd ) );
    vec3 up = cross( fwd, right );
    vRayPos = C + ( right * position.x + up * position.y ) * ext;
    gl_Position = projectionMatrix * vec4( vRayPos, 1.0 );

    // Туман считается по передней точке сферы, а не по плоскости квада.
    vec4 mvPosition = vec4( vRayPos.xy, C.z + r, 1.0 );
    #include <fog_vertex>
  }
`

const IMPOSTOR_FRAGMENT = /* glsl */ `
  #include <common>
  // В префиксе фрагментного шейдера three матрицы проекции нет — нужна для gl_FragDepth.
  uniform mat4 projectionMatrix;
  varying vec3 vRayPos;
  varying vec4 vSphere;
  varying vec4 vColor;
  varying vec2 vEnergy;
  ${CONTACT_FRAGMENT_PARS}
  #include <fog_pars_fragment>
  #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
    uniform float logDepthBufFC;
  #endif
  ${SHADE_GLSL}

  // Упорядоченный порог Байера 4×4: 0..15/16.
  float atomBayer2( vec2 a ) {
    a = floor( a );
    return fract( a.x * 0.5 + a.y * a.y * 0.75 );
  }
  float atomBayer4( vec2 a ) {
    return atomBayer2( 0.5 * a ) * 0.25 + atomBayer2( a );
  }

  void main() {
    vec3 C = vSphere.xyz;
    float r = vSphere.w;
    vec3 ro = isOrthographic ? vec3( vRayPos.xy, 0.0 ) : vec3( 0.0 );
    vec3 rd = isOrthographic ? vec3( 0.0, 0.0, -1.0 ) : normalize( vRayPos );

    // Пересечение луча со сферой в устойчивой форме (без вычитания больших чисел).
    vec3 oc = ro - C;
    float b = dot( oc, rd );
    vec3 qv = oc - b * rd;
    float h = r * r - dot( qv, qv );

    // Покрытие силуэта: h ≈ 2r·(расстояние до края) — линейно по пикселю.
    float cov = clamp( h / max( fwidth( h ), 1e-10 ) + 0.5, 0.0, 1.0 );
    if ( cov <= 0.0 ) discard;

    float t = -b - sqrt( max( h, 0.0 ) );
    if ( t <= 0.0 ) discard; // камера внутри атома
    vec3 P = ro + rd * t;
    vec3 Nv = normalize( P - C );

    // Непрозрачность < 1 — screen-door: порядок отрисовки не важен, сортировка не нужна.
    if ( vColor.a < 0.999 && vColor.a <= atomBayer4( gl_FragCoord.xy ) + 0.03125 ) discard;

    // Полупокрытая кромка пишет глубину позади сферы: сосед, нарисованный позже
    // в том же батче, перекроет её целиком, а не оставит тёмный ореол.
    vec3 Pd = cov < 0.999 ? P + rd * r : P;
    vec4 clip = projectionMatrix * vec4( Pd, 1.0 );
    #if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
      gl_FragDepth = log2( 1.0 + clip.w ) * logDepthBufFC * 0.5;
    #elif defined( USE_REVERSED_DEPTH_BUFFER )
      gl_FragDepth = clip.z / clip.w;
    #else
      gl_FragDepth = ( clip.z / clip.w ) * 0.5 + 0.5;
    #endif

    ${CONTACT_FRAGMENT}

    vec3 N = normalize( ( vec4( Nv, 0.0 ) * viewMatrix ).xyz );
    vec3 V = normalize( ( vec4( -rd, 0.0 ) * viewMatrix ).xyz );
    vec3 col = atomShade( N, V, vColor.rgb, vEnergy.x, vEnergy.y, occ );

    gl_FragColor = vec4( col, cov );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const MESH_VERTEX = /* glsl */ `
  attribute vec4 aSphere;
  attribute vec4 aColor;
  attribute vec2 aEnergy;
  varying vec3 vViewPos;
  varying vec3 vNormalV;
  varying vec3 vCenter;
  varying vec4 vColor;
  varying vec2 vEnergy;
  ${CONTACT_VERTEX_PARS}
  #include <fog_pars_vertex>

  void main() {
    vec3 C = ( modelViewMatrix * vec4( aSphere.xyz, 1.0 ) ).xyz;
    float scale = length( modelViewMatrix[ 0 ].xyz );
    // Без discard прозрачность не изобразить: исчезающий атом слегка сжимается
    // (и темнеет во фрагменте), при opacity≈0 схлопывается в точку.
    float fade = aColor.a <= 0.003 ? 0.0 : mix( 0.6, 1.0, clamp( aColor.a, 0.0, 1.0 ) );
    float r = aSphere.w * scale * fade;
    vColor = aColor;
    vEnergy = aEnergy;
    vCenter = C;
    ${CONTACT_VERTEX}
    // Икосфера сферически симметрична — строим её прямо в системе вида.
    vNormalV = position;
    vViewPos = C + position * r;
    vec4 mvPosition = vec4( vViewPos, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const MESH_FRAGMENT = /* glsl */ `
  #include <common>
  varying vec3 vViewPos;
  varying vec3 vNormalV;
  varying vec3 vCenter;
  varying vec4 vColor;
  varying vec2 vEnergy;
  ${CONTACT_FRAGMENT_PARS}
  #include <fog_pars_fragment>
  ${SHADE_GLSL}

  void main() {
    vec3 Nv = normalize( vNormalV );
    vec3 P = vViewPos;
    vec3 C = vCenter;
    vec3 rd = isOrthographic ? vec3( 0.0, 0.0, -1.0 ) : normalize( vViewPos );
    ${CONTACT_FRAGMENT}
    vec3 N = normalize( ( vec4( Nv, 0.0 ) * viewMatrix ).xyz );
    vec3 V = normalize( ( vec4( -rd, 0.0 ) * viewMatrix ).xyz );
    vec3 col = atomShade( N, V, vColor.rgb, vEnergy.x, vEnergy.y, occ );
    col *= mix( 0.3, 1.0, clamp( vColor.a, 0.0, 1.0 ) );
    gl_FragColor = vec4( col, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

export type AtomMaterialOptions = {
  /** включить контактное затенение (атрибуты aNeighbor0..3 обязательны) */
  contact?: boolean
}

/**
 * Материал атомов. Ключ программы зависит только от режима и contact — оба
 * фиксировать на весь урок, иначе будет перекомпиляция.
 */
export function createAtomMaterial(mode: AtomRenderMode, options: AtomMaterialOptions = {}): THREE.ShaderMaterial {
  ensureAtomLighting()
  const defines: Record<string, string> = {}
  if (options.contact) defines.ATOM_CONTACT = ''
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    // Ссылки на общие объекты — НЕ клон: освещение меняется для всех материалов разом.
    uSH: atomLightUniforms.uSH,
    uKeyDir: atomLightUniforms.uKeyDir,
    uKeyColor: atomLightUniforms.uKeyColor,
    uEnvIntensity: atomLightUniforms.uEnvIntensity,
    uViewportHeight: { value: 1080 },
  }
  if (mode === 'impostor') {
    return new THREE.ShaderMaterial({
      name: 'CinemaAtomImpostor',
      defines,
      uniforms,
      vertexShader: IMPOSTOR_VERTEX,
      fragmentShader: IMPOSTOR_FRAGMENT,
      fog: true,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
      // Непрозрачный проход, но со смешиванием: частичное покрытие силуэта (AA)
      // смешивается с уже нарисованным. NormalBlending у непрозрачных three выключает,
      // поэтому задаём те же множители через CustomBlending.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    })
  }
  return new THREE.ShaderMaterial({
    name: 'CinemaAtomMesh',
    defines,
    uniforms,
    vertexShader: MESH_VERTEX,
    fragmentShader: MESH_FRAGMENT,
    fog: true,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  })
}

// ——— геометрии ———

/** Квад −1..1 для импостора (4 вершины, 2 треугольника). */
export function createImpostorQuadGeometry(): THREE.InstancedBufferGeometry {
  const geo = new THREE.InstancedBufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
  geo.setIndex([0, 1, 2, 0, 2, 3])
  return geo
}

let icosphereData: { position: Float32Array; index: Uint16Array } | null = null

/** Индексированная единичная икосфера detail 2 (как в three): 92 вершины, 180 треугольников. */
function icosphereArrays(): { position: Float32Array; index: Uint16Array } {
  if (icosphereData) return icosphereData
  const src = new THREE.IcosahedronGeometry(1, 2)
  const p = src.getAttribute('position')
  const map = new Map<string, number>()
  const verts: number[] = []
  const index = new Uint16Array(p.count)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const key = `${Math.round(x * 1e4)}_${Math.round(y * 1e4)}_${Math.round(z * 1e4)}`
    let id = map.get(key)
    if (id === undefined) {
      id = verts.length / 3
      const l = Math.hypot(x, y, z) || 1
      verts.push(x / l, y / l, z / l)
      map.set(key, id)
    }
    index[i] = id
  }
  src.dispose()
  icosphereData = { position: new Float32Array(verts), index }
  return icosphereData
}

/** Икосфера для lite-режима как InstancedBufferGeometry (без instanceMatrix). */
export function createIcosphereInstancedGeometry(): THREE.InstancedBufferGeometry {
  const { position, index } = icosphereArrays()
  const geo = new THREE.InstancedBufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geo.setIndex(new THREE.BufferAttribute(index, 1))
  return geo
}
