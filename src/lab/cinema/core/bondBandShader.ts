import * as THREE from 'three'
import type { BondPool } from './pools'

/**
 * ATOMLAB Cinema — «честная связь»: все связи сцены одним draw call.
 *
 * Геометрия — один открытый цилиндр-посредник (proxy) на экземпляр. Вершинный
 * шейдер сам ставит его между атомами a и b и строит базис (ось T, направление
 * полос N, бинормаль B) прямо в GLSL — на CPU нет кватернионов и матриц.
 * Фрагментный шейдер внутри посредника «трассирует» до трёх настоящих трубок
 * (полос кратности): пересечение луча с цилиндром в сечении — это квадратное
 * уравнение, поэтому силуэты полос точные, дальняя полоса честно прячется за
 * ближней, а сглаживание кромки берётся из расстояния луча до оси в пикселях.
 *
 * Язык связи (molecule-visual B6, anim-engine B5):
 *   • кратность — полосы вдоль N: 1 → одна по центру, 2 → две, 3 → три;
 *     дробная (1.5, 1.75) — целые полосы сплошные плюс одна пунктирная,
 *     доля «штриха» в периоде = дробная часть (делокализация); пунктир медленно
 *     ползёт по связи от времени сцены;
 *   • половины окрашены цветами своих атомов; граница цвета и центр яркости
 *     (деформационная плотность связывающей пары) смещены полярностью до 20 % длины
 *     к более электроотрицательному атому, трубка к нему чуть толще;
 *   • form — волна образования от обоих атомов к середине, фронт светится (>1 → bloom);
 *   • stress — раскал до белого с лёгким детерминированным мерцанием от uTime;
 *   • thinning — перешеек посередине; при thinning > 0.3 включается характер
 *     разрыва split: 0 → симметричный перешеек и по одному светящемуся электрону
 *     на каждом обрывке (гомолиз); ±1 → плотность стекает к B/A, перешеек уходит
 *     к атому-донору и рвётся у него первым, донорский обрывок тускнеет и
 *     истончается, а на обрывке приёмника светится пара (гетеролиз).
 *
 * Прозрачность и порядок: материал — «непрозрачная светящаяся трубка».
 * NormalBlending с премультиплицированной альфой, depthWrite = true. Альфа < 1
 * бывает только на пиксельной кромке (сглаживание). Общая opacity < 1 рисуется
 * screen-door дизерингом (Байер 4×4, discard), поэтому результат не зависит от
 * порядка отрисовки и связи правильно перекрывают друг друга и атомы. Цвет на
 * выходе премультиплицирован — материал можно переключить на AdditiveBlending
 * без правки шейдера. Туман three (fog chunks), tone mapping и перевод в
 * выходное цветовое пространство подключены.
 *
 * piNormal в пуле трактуется как направление разнесения полос (перпендикуляр к
 * оси, лежит в плоскости молекулы — так рисуют вторую черту двойной связи).
 * Из нормали плоскости молекулы его даёт writeBondBandDirection(). Если
 * piNormal = (0,0,0) или параллельна оси, полосы разносятся перпендикулярно оси
 * и лучу зрения — кратность видна с любого ракурса.
 *
 * Глубина: gl_FragDepth не пишется (иначе теряется early-z) — пишется глубина
 * передней грани посредника, она ближе настоящей поверхности не более чем на
 * внешний радиус жгута. Концы посредника — в центрах атомов, их закрывают сферы.
 */

/** Сколько float на экземпляр в чередующемся (interleaved) буфере. */
export const BOND_INSTANCE_STRIDE = 24

/**
 * Раскладка экземпляра — 6 атрибутов vec4 поверх одного InstancedInterleavedBuffer
 * (7 активных атрибутов вместе с position — с запасом под лимит 16 на мобильных GPU).
 */
export const BOND_INSTANCE_LAYOUT = {
  /** aA = (a.xyz, radius) */
  a: 0,
  radius: 3,
  /** aB = (b.xyz, order) */
  b: 4,
  order: 7,
  /** aColorA = (colorA.rgb, polarity) */
  colorA: 8,
  polarity: 11,
  /** aColorB = (colorB.rgb, opacity) */
  colorB: 12,
  opacity: 15,
  /** aPiNormal = (piNormal.xyz, split) */
  piNormal: 16,
  split: 19,
  /** aState = (form, stress, thinning, dashStatic: 1 — неподвижный штрих водородной связи) */
  form: 20,
  stress: 21,
  thinning: 22,
  dashStatic: 23,
} as const

/** Радиальные сегменты посредника: полный и облегчённый режим. */
export const BOND_BAND_RADIAL_SEGMENTS = { full: 10, lite: 6 } as const

/** Период пунктира — в радиусах одинарной связи. */
const DASH_PERIOD_RADII = 4.2
/** Скорость «ползания» пунктира, периодов в секунду. */
const DASH_SPEED = 0.3

export type BondBandLayout = {
  /** число полос 1..3 */
  bands: number
  /** доля штриха в периоде у пунктирной полосы; 1 — пунктира нет */
  duty: number
  /** радиус одной полосы в долях radius */
  bandRadius: number
  /** шаг между центрами полос в долях radius */
  spacing: number
  /** индекс пунктирной полосы (последняя, со стороны +N) или −1 */
  dashIndex: number
}

export function createBondBandLayout(): BondBandLayout {
  return { bands: 1, duty: 1, bandRadius: 1, spacing: 2.3, dashIndex: -1 }
}

/**
 * Раскладка полос по кратности — точное зеркало GLSL bondBandLayout().
 * Кратность < 1 (переходное состояние) — одна пунктирная полоса.
 */
export function bondBandLayout(order: number, out: BondBandLayout): BondBandLayout {
  const o = Math.min(3, Math.max(0, Number.isFinite(order) ? order : 1))
  const whole = Math.floor(o + 0.02)
  const frac = o - whole
  const hasDash = frac >= 0.04 ? 1 : 0
  const bands = Math.min(3, Math.max(1, whole + hasDash))
  const bandRadius = bands < 1.5 ? 1 : bands < 2.5 ? 0.62 : 0.5
  out.bands = bands
  out.duty = hasDash ? Math.min(1, Math.max(0, frac)) : 1
  out.bandRadius = bandRadius
  out.spacing = bandRadius * 2.3
  out.dashIndex = hasDash ? bands - 1 : -1
  return out
}

/** Смещение центра полосы k вдоль N, в долях radius. */
export function bondBandOffset(layout: BondBandLayout, k: number): number {
  return (k - 0.5 * (layout.bands - 1)) * layout.spacing
}

/**
 * Внешний радиус жгута (в долях radius, без пиксельного запаса) — ширина
 * посредника под самый широкий набор полос с учётом натяжения и полярности.
 */
export function bondBandOuterRadius(layout: BondBandLayout, stress: number, polarity: number): number {
  const bulge = (1 + 0.18 * stress) * (1 + 0.12 * Math.abs(polarity))
  return ((layout.bands - 1) * 0.5 * layout.spacing + layout.bandRadius) * bulge
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/**
 * Где рвётся связь (доля длины от A) — зеркало GLSL: split включается только
 * при thinning > 0.3; +1 (пара уходит к B) сдвигает перешеек к A.
 */
export function bondNeckCenter(split: number, thinning: number): number {
  const s = Math.min(1, Math.max(-1, split)) * smoothstep(0.3, 0.55, Math.min(1, Math.max(0, thinning)))
  return 0.5 - 0.22 * s
}

/**
 * Записать в pool.piNormal направление полос для связи i из нормали плоскости
 * молекулы (n): dir = normalize(n × (b − a)). Если n ≈ ∥ оси или нулевая — пишет
 * (0,0,0), и рендерер разнесёт полосы к камере сам. Возвращает true, если записал.
 */
export function writeBondBandDirection(pool: BondPool, i: number, nx: number, ny: number, nz: number): boolean {
  const i3 = i * 3
  const tx = pool.b[i3] - pool.a[i3]
  const ty = pool.b[i3 + 1] - pool.a[i3 + 1]
  const tz = pool.b[i3 + 2] - pool.a[i3 + 2]
  const cx = ny * tz - nz * ty
  const cy = nz * tx - nx * tz
  const cz = nx * ty - ny * tx
  const cl = Math.hypot(cx, cy, cz)
  const ref = Math.hypot(nx, ny, nz) * Math.hypot(tx, ty, tz)
  if (!(ref > 1e-12) || cl < 0.02 * ref) {
    pool.piNormal[i3] = 0
    pool.piNormal[i3 + 1] = 0
    pool.piNormal[i3 + 2] = 0
    return false
  }
  pool.piNormal[i3] = cx / cl
  pool.piNormal[i3 + 1] = cy / cl
  pool.piNormal[i3 + 2] = cz / cl
  return true
}

/** Упаковать первые count связей пула в чередующийся буфер (раскладка BOND_INSTANCE_LAYOUT). */
export function packBondInstances(pool: BondPool, out: Float32Array, count: number): void {
  const S = BOND_INSTANCE_STRIDE
  for (let i = 0; i < count; i++) {
    const o = i * S
    const i3 = i * 3
    out[o] = pool.a[i3]
    out[o + 1] = pool.a[i3 + 1]
    out[o + 2] = pool.a[i3 + 2]
    out[o + 3] = pool.radius[i]
    out[o + 4] = pool.b[i3]
    out[o + 5] = pool.b[i3 + 1]
    out[o + 6] = pool.b[i3 + 2]
    out[o + 7] = pool.order[i]
    out[o + 8] = pool.colorA[i3]
    out[o + 9] = pool.colorA[i3 + 1]
    out[o + 10] = pool.colorA[i3 + 2]
    out[o + 11] = pool.polarity[i]
    out[o + 12] = pool.colorB[i3]
    out[o + 13] = pool.colorB[i3 + 1]
    out[o + 14] = pool.colorB[i3 + 2]
    out[o + 15] = pool.opacity[i]
    out[o + 16] = pool.piNormal[i3]
    out[o + 17] = pool.piNormal[i3 + 1]
    out[o + 18] = pool.piNormal[i3 + 2]
    out[o + 19] = pool.split[i]
    out[o + 20] = pool.form[i]
    out[o + 21] = pool.stress[i]
    out[o + 22] = pool.thinning[i]
    // Старые пулы без поля — штрих ползёт, как раньше.
    out[o + 23] = pool.dashStatic ? pool.dashStatic[i]! : 0
  }
}

/* ------------------------------------------------------------------ GLSL -- */

const LAYOUT_GLSL = /* glsl */ `
  // Кратность → число полос, доля штриха пунктирной полосы, радиус полосы и шаг (в радиусах одинарной).
  void bondBandLayout(float order, out float nBands, out float duty, out float rb, out float spacing) {
    float o = clamp(order, 0.0, 3.0);
    float whole = floor(o + 0.02);
    float fracPart = o - whole;
    float hasDash = step(0.04, fracPart);
    nBands = clamp(whole + hasDash, 1.0, 3.0);
    duty = hasDash > 0.5 ? clamp(fracPart, 0.0, 1.0) : 1.0;
    rb = nBands < 1.5 ? 1.0 : (nBands < 2.5 ? 0.62 : 0.5);
    spacing = rb * 2.3;
  }
`

const VERTEX_SHADER = /* glsl */ `
  #include <fog_pars_vertex>

  attribute vec4 aA;        // a.xyz, radius
  attribute vec4 aB;        // b.xyz, order
  attribute vec4 aColorA;   // colorA.rgb, polarity
  attribute vec4 aColorB;   // colorB.rgb, opacity
  attribute vec4 aPiNormal; // piNormal.xyz, split
  attribute vec4 aState;    // form, stress, thinning, dashStatic

  uniform float uPixelK;     // размер пикселя на глубине 1 (перспектива) или просто размер (орто)
  uniform float uProxyScale; // 1/cos(π/сегменты): многоугольник описан вокруг окружности
  uniform float uDashPeriod; // период пунктира в радиусах одинарной связи

  varying vec3 vViewPos;
  varying vec3 vA;
  varying vec3 vT;
  varying vec3 vN;
  varying vec3 vColorA;
  varying vec3 vColorB;
  varying vec4 vGeom;  // длина, радиус (вид), кратность, полярность
  varying vec4 vState; // form, stress, thinning, split
  varying vec4 vMisc;  // opacity, число штрихов, зерно мерцания, ползёт ли штрих (1/0)

  ${LAYOUT_GLSL}

  void main() {
    float opacity = aColorB.w;
    vec3 aV = (modelViewMatrix * vec4(aA.xyz, 1.0)).xyz;
    vec3 bV = (modelViewMatrix * vec4(aB.xyz, 1.0)).xyz;
    vec3 axis = bV - aV;
    float len = length(axis);
    if (len < 1e-5 || opacity < 0.004 || aState.x <= 0.001) {
      // Невидимая связь схлопывается за дальнюю плоскость — ни одного фрагмента.
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }
    vec3 T = axis / len;
    vec3 mid = 0.5 * (aV + bV);
    vec3 toCam = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-mid);
    mat3 mv3 = mat3(modelViewMatrix);
    float modelScale = length(mv3[0]);

    // Направление полос: piNormal без составляющей вдоль оси, иначе — поперёк оси и луча зрения.
    vec3 N = mv3 * aPiNormal.xyz;
    N -= T * dot(N, T);
    float nLen = length(N);
    float nRef = length(aPiNormal.xyz) * modelScale;
    if (nRef > 1e-6 && nLen > 0.02 * nRef) {
      N /= nLen;
    } else {
      vec3 c = cross(T, toCam);
      float cLen = length(c);
      N = cLen > 1e-4 ? c / cLen : normalize(cross(T, abs(T.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    }
    vec3 Bn = cross(T, N);

    float radiusV = aA.w * modelScale;
    float nBands, duty, rb, spacing;
    bondBandLayout(aB.w, nBands, duty, rb, spacing);
    float bulge = (1.0 + 0.18 * aState.y) * (1.0 + 0.12 * abs(aColorA.w));
    float farDepth = isOrthographic ? 1.0 : max(max(-aV.z, -bV.z), 1e-3);
    float rOut = ((nBands - 1.0) * 0.5 * spacing + rb) * radiusV * bulge + 1.5 * farDepth * uPixelK;

    // Базис (N, T, Bn) левый: минус у Bn делает размещение правым, иначе FrontSide рисует дальнюю стенку.
    vec3 pV = mid + T * (position.y * len) + (N * position.x - Bn * position.z) * (rOut * uProxyScale);

    vViewPos = pV;
    vA = aV;
    vT = T;
    vN = N;
    vColorA = aColorA.rgb;
    vColorB = aColorB.rgb;
    vGeom = vec4(len, radiusV, aB.w, aColorA.w);
    vState = vec4(aState.x, aState.y, aState.z, aPiNormal.w);
    vMisc = vec4(opacity, max(1.0, floor(len / max(uDashPeriod * radiusV, 1e-5) + 0.5)), fract(float(gl_InstanceID) * 0.618034), aState.w > 0.5 ? 0.0 : 1.0);

    vec4 mvPosition = vec4(pV, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform float uPixelK;
  uniform float uDashSpeed;

  varying vec3 vViewPos;
  varying vec3 vA;
  varying vec3 vT;
  varying vec3 vN;
  varying vec3 vColorA;
  varying vec3 vColorB;
  varying vec4 vGeom;
  varying vec4 vState;
  varying vec4 vMisc;

  ${LAYOUT_GLSL}

  // Состояние текущей связи — заполняет main, читают функции профиля.
  float gLen;
  float gRadius;
  float gPolarity;
  float gForm;
  float gStress;
  float gThin;
  float gSplit;
  float gNeckC;
  float gNeckW;

  // Порог Байера 4×4 (0..1) — screen-door прозрачность без сортировки.
  float bondBayer4(vec2 fc) {
    vec2 p = mod(floor(fc), 4.0);
    vec2 p1 = mod(p, 2.0);
    vec2 p2 = floor(p * 0.5);
    float b1 = mod(p1.x * 2.0 + p1.y * 3.0, 4.0);
    float b2 = mod(p2.x * 2.0 + p2.y * 3.0, 4.0);
    return (b1 * 4.0 + b2 + 0.5) / 16.0;
  }

  // Координата от атома-донора разрыва (σ = 0 у атома, теряющего пару).
  float bondDonorCoord(float s) {
    return gSplit >= 0.0 ? s : 1.0 - s;
  }

  // Фронт волны образования (доля длины от каждого конца); у донора разрыва отступает раньше.
  float bondFrontAt(float s) {
    float donorSide = abs(gSplit) * smoothstep(0.6, 0.4, bondDonorCoord(s));
    return gForm * 0.56 - 0.25 * donorSide * (1.0 - gForm);
  }

  // Множитель радиуса полосы вдоль связи: полярность, натяжение, волна, перешеек, «слив» пары.
  float bondProfileAt(float s) {
    if (s <= 0.0 || s >= 1.0) return 0.0;
    float r = (1.0 + 0.12 * gPolarity * (2.0 * s - 1.0)) * (1.0 + 0.18 * gStress);
    float edge = min(s, 1.0 - s);
    r *= sqrt(clamp((bondFrontAt(s) - edge) / 0.05, 0.0, 1.0));
    float neck = exp(-pow2((s - gNeckC) / gNeckW));
    r *= max(0.0, 1.0 - gThin * 1.25 * neck) * (1.0 - 0.12 * gThin);
    r *= mix(1.0, 0.3 + 0.7 * smoothstep(0.05, 0.7, bondDonorCoord(s)), abs(gSplit));
    return r;
  }

  // Пунктир дробной кратности: штрихи со скруглёнными концами, ползут со временем.
  float bondDashAt(float s, float duty, float dashCount, float rbWorld) {
    float p = fract(s * dashCount - uTime * uDashSpeed * vMisc.w);
    float halfDuty = 0.5 * duty;
    float endDist = (halfDuty - abs(p - halfDuty)) * gLen / dashCount;
    if (endDist <= 0.0) return 0.0;
    float capX = clamp(1.0 - endDist / max(rbWorld, 1e-6), 0.0, 1.0);
    return sqrt(1.0 - capX * capX);
  }

  void main() {
    float opacity = vMisc.x;
    if (opacity < 0.996 && bondBayer4(gl_FragCoord.xy) > opacity) discard;

    gLen = vGeom.x;
    gRadius = vGeom.y;
    gPolarity = clamp(vGeom.w, -1.0, 1.0);
    gForm = clamp(vState.x, 0.0, 1.0);
    gStress = clamp(vState.y, 0.0, 1.0);
    gThin = clamp(vState.z, 0.0, 1.0);
    gSplit = clamp(vState.w, -1.0, 1.0) * smoothstep(0.3, 0.55, gThin);
    gNeckC = 0.5 - 0.22 * gSplit;
    // Перед самым разрывом перешеек сужается: обрывки тупее, разрыв читается резко.
    gNeckW = mix(0.15, 0.08, smoothstep(0.55, 1.0, gThin));

    vec3 T = normalize(vT);
    vec3 N = normalize(vN - T * dot(vN, T));
    vec3 Bn = cross(T, N);
    float nBands, duty, rb, spacing;
    bondBandLayout(vGeom.z, nBands, duty, rb, spacing);
    float rbWorld = rb * gRadius;
    float dashCount = vMisc.y;
    float pw = (isOrthographic ? 1.0 : max(-vViewPos.z, 1e-4)) * uPixelK;

    float s = 0.0;
    vec3 nrm = N;
    float cov = 0.0;
    float dashed = 0.0;
    vec3 V;

  #ifdef BOND_LITE
    // Облегчённо: полосы — цилиндрические импосторы на плоскости, обращённой к камере.
    V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-vViewPos);
    vec3 rel = vViewPos - vA;
    s = dot(rel, T) / gLen;
    vec3 side = cross(T, V);
    float sideLen = length(side);
    side = sideLen > 1e-4 ? side / sideLen : Bn;
    vec3 facing = cross(side, T);
    float x = dot(rel, side);
    float prof = bondProfileAt(s) * rbWorld;
    float nSide = dot(N, side);
    float nFace = dot(N, facing);
    float bestZ = -1e20;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      if (fk > nBands - 0.5) break;
      float off = (fk - 0.5 * (nBands - 1.0)) * spacing * gRadius;
      float isDash = (duty < 0.999 && fk > nBands - 1.5) ? 1.0 : 0.0;
      float rk = prof;
      if (isDash > 0.5) rk *= step(fract(s * dashCount - uTime * uDashSpeed * vMisc.w), duty);
      float dx = x - off * nSide;
      if (rk <= 0.0) continue;
      // Покрытие пикселя; трубка тоньше пикселя гаснет, а не остаётся волоском в разрыве.
      float c = clamp((rk - abs(dx)) / pw + 0.5, 0.0, 1.0) * clamp(2.0 * rk / pw, 0.0, 1.0);
      if (c <= 0.0) continue;
      cov = max(cov, c);
      float nx = clamp(dx / max(rk, 1e-6), -1.0, 1.0);
      float nz = sqrt(1.0 - nx * nx);
      float z = off * nFace + nz * rk;
      if (z > bestZ) {
        bestZ = z;
        nrm = side * nx + facing * nz;
        dashed = isDash;
      }
    }
    if (cov <= 0.0) discard;
  #else
    // Полный режим: луч из камеры против трёх трубок в системе связи (сечение ⊥ оси).
    vec3 ro = isOrthographic ? vec3(vViewPos.xy, 0.0) : vec3(0.0);
    vec3 rd = isOrthographic ? vec3(0.0, 0.0, -1.0) : normalize(vViewPos);
    V = -rd;
    vec3 rel = ro - vA;
    vec2 o2 = vec2(dot(rel, N), dot(rel, Bn));
    vec2 d2 = vec2(dot(rd, N), dot(rd, Bn));
    float d2Len = max(length(d2), 1e-4);
    vec2 d2n = d2 / d2Len;
    float oS = dot(rel, T);
    float dS = dot(rd, T);
    float bestT = 1e20;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      if (fk > nBands - 0.5) break;
      float off = (fk - 0.5 * (nBands - 1.0)) * spacing * gRadius;
      vec2 q = o2 - vec2(off, 0.0);
      float b = dot(q, d2n);
      float dist = sqrt(max(dot(q, q) - b * b, 0.0));
      float tc = -b / d2Len;
      // Трубка тонкая: радиус берём в точке наибольшего сближения луча с осью полосы.
      float sc = (oS + dS * tc) / gLen;
      float isDash = (duty < 0.999 && fk > nBands - 1.5) ? 1.0 : 0.0;
      float rk = rbWorld * bondProfileAt(sc);
      if (isDash > 0.5) rk *= bondDashAt(sc, duty, dashCount, rbWorld);
      if (rk <= 0.0) continue;
      // Покрытие пикселя; трубка тоньше пикселя гаснет, а не остаётся волоском в разрыве.
      float c = clamp((rk - dist) / pw + 0.5, 0.0, 1.0) * clamp(2.0 * rk / pw, 0.0, 1.0);
      if (c <= 0.0) continue;
      cov = max(cov, c);
      float t = (-b - sqrt(max(rk * rk - dist * dist, 0.0))) / d2Len;
      if (t < bestT) {
        bestT = t;
        vec2 h = q + d2 * t;
        float hl = length(h);
        vec2 n2 = hl > 1e-7 ? h / hl : vec2(0.0, 1.0);
        nrm = N * n2.x + Bn * n2.y;
        s = (oS + dS * t) / gLen;
        dashed = isDash;
      }
    }
    if (cov <= 0.0) discard;
    // Наклон поверхности на перешейке и у фронта волны — нормаль «видит» сужение.
    float slope = (bondProfileAt(s + 0.012) - bondProfileAt(s - 0.012)) * rbWorld / (0.024 * gLen);
    nrm = normalize(nrm - T * clamp(slope, -4.0, 4.0));
  #endif

    // Плотность связывающей пары: центр смещён полярностью и характером разрыва.
    float densC = clamp(0.5 + 0.2 * gPolarity + 0.28 * gSplit, 0.12, 0.88);
    float dens = 0.62 + 0.38 * exp(-pow2((s - densC) / 0.24));
    // Граница цветов половин: к менее электроотрицательному атому, при разрыве — к перешейку.
    float colorEdge = mix(0.5 - 0.2 * gPolarity, gNeckC, smoothstep(0.3, 0.8, gThin));
    vec3 base = mix(vColorA, vColorB, smoothstep(colorEdge - 0.07, colorEdge + 0.07, s));
    // Гетеролиз: донорский обрывок гаснет.
    float donorNeck = 0.5 - 0.22 * abs(gSplit);
    float dim = mix(1.0, 0.28 + 0.72 * smoothstep(donorNeck - 0.02, donorNeck + 0.25, bondDonorCoord(s)), abs(gSplit));
    // Электроны на краях разрыва: 1 + 1 при гомолизе, 0 + 2 при гетеролизе.
    float sideB = smoothstep(gNeckC - 0.02, gNeckC + 0.02, s);
    float wB = 0.5 + 0.5 * gSplit;
    float electrons = 2.0 * mix(1.0 - wB, wB, sideB);
    float edgeGlow = smoothstep(0.55, 0.95, gThin) * exp(-pow2((s - gNeckC) / (1.2 * gNeckW))) * electrons;
    // Светящийся фронт волны образования.
    float frontGlow = (1.0 - smoothstep(0.75, 1.0, gForm)) * exp(-pow2((min(s, 1.0 - s) - bondFrontAt(s) + 0.03) / 0.035));

    vec3 L = normalize(vec3(-0.35, 0.62, 0.7));
    float wrap = dot(nrm, L) * 0.5 + 0.5;
    float diff = wrap * wrap;
    float rim = pow(1.0 - clamp(dot(nrm, V), 0.0, 1.0), 2.5);
    float body = dens * dim * (dashed > 0.5 ? 0.82 : 1.0);
    vec3 col = base * (0.24 + 0.76 * diff) * body;
    col += base * rim * 0.5 * body;
  #ifndef BOND_LITE
    vec3 H = normalize(L + V);
    col += vec3(0.32 * pow(max(dot(nrm, H), 0.0), 36.0)) * dim;
  #endif
    col += mix(base, vec3(1.0), 0.6) * (1.2 * edgeGlow + 1.5 * frontGlow);
    // Натяжение: раскал до белого (>1 — в bloom).
    float hot = gStress * gStress;
    col = mix(col, vec3(1.0, 0.95, 0.88) * (1.25 + 0.85 * hot), 0.72 * hot);
  #ifndef BOND_LITE
    float seed = vMisc.z;
    col *= 1.0 + gStress * 0.16 * sin(uTime * 29.0 + seed * 40.0) * sin(uTime * 13.7 + s * 17.0 + seed * 11.0);
  #endif

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    gl_FragColor = vec4(gl_FragColor.rgb * cov, cov);
  }
`

export type BondBandMaterialOptions = {
  /** облегчённый режим: плоские импосторы полос, без блика и мерцания */
  lite?: boolean
}

export function createBondBandMaterial({ lite = false }: BondBandMaterialOptions = {}): THREE.ShaderMaterial {
  const radial = lite ? BOND_BAND_RADIAL_SEGMENTS.lite : BOND_BAND_RADIAL_SEGMENTS.full
  return new THREE.ShaderMaterial({
    name: lite ? 'CinemaBondBandsLite' : 'CinemaBondBands',
    defines: lite ? { BOND_LITE: '' } : {},
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uPixelK: { value: 0.002 },
        uProxyScale: { value: 1 / Math.cos(Math.PI / radial) },
        uDashPeriod: { value: DASH_PERIOD_RADII },
        uDashSpeed: { value: DASH_SPEED },
      },
    ]),
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    side: THREE.FrontSide,
    fog: true,
  })
}

export type BondBandResources = {
  capacity: number
  geometry: THREE.InstancedBufferGeometry
  material: THREE.ShaderMaterial
  buffer: THREE.InstancedInterleavedBuffer
  data: Float32Array
  /** что уже залито — чтобы не гонять буфер без изменений */
  syncedPool: BondPool | null
  syncedVersion: number
  syncedCount: number
}

/** Геометрия-посредник + чередующийся буфер экземпляров + материал. */
export function createBondBandResources(capacity: number, lite = false): BondBandResources {
  const radial = lite ? BOND_BAND_RADIAL_SEGMENTS.lite : BOND_BAND_RADIAL_SEGMENTS.full
  const cap = Math.max(1, Math.floor(capacity))
  const base = new THREE.CylinderGeometry(1, 1, 1, radial, 1, true)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setIndex(base.getIndex())
  geometry.setAttribute('position', base.getAttribute('position'))
  base.dispose()

  const data = new Float32Array(cap * BOND_INSTANCE_STRIDE)
  const buffer = new THREE.InstancedInterleavedBuffer(data, BOND_INSTANCE_STRIDE, 1)
  buffer.setUsage(THREE.DynamicDrawUsage)
  const L = BOND_INSTANCE_LAYOUT
  geometry.setAttribute('aA', new THREE.InterleavedBufferAttribute(buffer, 4, L.a))
  geometry.setAttribute('aB', new THREE.InterleavedBufferAttribute(buffer, 4, L.b))
  geometry.setAttribute('aColorA', new THREE.InterleavedBufferAttribute(buffer, 4, L.colorA))
  geometry.setAttribute('aColorB', new THREE.InterleavedBufferAttribute(buffer, 4, L.colorB))
  geometry.setAttribute('aPiNormal', new THREE.InterleavedBufferAttribute(buffer, 4, L.piNormal))
  geometry.setAttribute('aState', new THREE.InterleavedBufferAttribute(buffer, 4, L.form))
  geometry.instanceCount = 0
  // Экземпляры разбросаны по всей сцене; меш рисуется с frustumCulled = false.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)

  return {
    capacity: cap,
    geometry,
    material: createBondBandMaterial({ lite }),
    buffer,
    data,
    syncedPool: null,
    syncedVersion: -1,
    syncedCount: -1,
  }
}

/**
 * Кадровое обновление: заливает в GPU только диапазон [0, count) и только при
 * смене pool.version / count / самого пула; время и размер пикселя — всегда.
 * heightPx — высота буфера рисования в пикселях. Возвращает число экземпляров.
 */
export function updateBondBands(
  res: BondBandResources,
  pool: BondPool,
  timeSec: number,
  camera: THREE.Camera,
  heightPx: number,
): number {
  const count = Math.max(0, Math.min(pool.count, pool.capacity, res.capacity))
  if (pool !== res.syncedPool || pool.version !== res.syncedVersion || count !== res.syncedCount) {
    if (count > 0) {
      packBondInstances(pool, res.data, count)
      res.buffer.clearUpdateRanges()
      res.buffer.addUpdateRange(0, count * BOND_INSTANCE_STRIDE)
      res.buffer.needsUpdate = true
    }
    res.geometry.instanceCount = count
    res.syncedPool = pool
    res.syncedVersion = pool.version
    res.syncedCount = count
  }
  const u = res.material.uniforms
  u.uTime!.value = timeSec
  // P[1][1] = 1/tan(fov/2) (перспектива) или 2/(top−bottom) (орто): пиксель = 2/(P11·H) на глубине 1.
  const p11 = camera.projectionMatrix.elements[5] ?? 1
  u.uPixelK!.value = 2 / (Math.max(1e-6, Math.abs(p11)) * Math.max(1, heightPx))
  return count
}

export function disposeBondBandResources(res: BondBandResources): void {
  res.geometry.dispose()
  res.material.dispose()
}
