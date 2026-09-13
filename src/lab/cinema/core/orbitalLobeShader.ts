import * as THREE from 'three'

/**
 * ATOMLAB Cinema — шейдеры орбиталей.
 *
 * Два рендерера одной и той же химии:
 *
 *   • лепестки-импостеры (все уровни качества) — каждый лепесток атомной
 *     p-орбитали рисуется одним развёрнутым к камере квадом, а форма считается
 *     в фрагментном шейдере аналитически: это ИЗОПОВЕРХНОСТЬ настоящей
 *     слейтеровской 2p-функции |ψ| ∝ r·cosθ·e^(−ζr), а не эллипсоид «на глаз».
 *     Все лепестки пула — инстансы одного квада: один draw call;
 *
 *   • рэймарчинг молекулярной орбитали (только cinematic) — внутри
 *     ориентированного бокса суммируется ЛКАО ψ = Σ cᵢ·Nᵢ·(n·(p−Rᵢ))·e^(−ζᵢ|p−Rᵢ|),
 *     и рисуются обе изоповерхности ψ = ±iso.
 *
 * Цвет — ФАЗА волновой функции (знак ψ), а не заряд: поэтому палитра
 * тёплый янтарь / холодный голубой, а не красный/синий зарядовых карт.
 *
 * Прозрачность без сортировки: лепестки складываются аддитивно; рэймарчинг —
 * один объект, свои поверхности он композитит сам спереди назад. Оба пишут
 * gl_FragDepth первой точки поверхности, поэтому непрозрачные атомы честно
 * закрывают то, что за ними, без текстуры глубины сцены.
 * Предполагается обычный (не логарифмический и не reversed) буфер глубины.
 */

/** Палитра фаз (sRGB hex): + тёплый янтарно-оранжевый, − холодный голубой. */
export const ORBITAL_PHASE_PALETTE = {
  positive: 0xffa640,
  negative: 0x4fa8ff,
} as const

export type OrbitalPhasePalette = { positive: number; negative: number }

// ——— форма лепестка-импостера ———

/**
 * Изоуровень лепестка: доля пика |ψ| атомной 2p-функции.
 * В нормированных координатах (r в единицах r₀ = 1/ζ, пик ψ = 1 при r = r₀ на оси)
 * g = u·e^(1−r), и поверхность g = iso записывается замкнуто:
 *   F = r − 1 − ln(u / iso) = 0,  внутри F < 0 (только u > 0 — «свой» лепесток).
 */
export const LOBE_ISO = 0.3

/** Вытяжка вдоль оси: p-лепесток — честная 2p-изоповерхность. */
export const LOBE_P_STRETCH = 1
/** Большой лепесток гибридной неподелённой пары вытянут в «каплю». */
export const LOBE_LONE_PAIR_STRETCH = 1.3
/** Малый задний лепесток неподелённой пары: доля длины большого. */
export const LOBE_LONE_PAIR_BACK_SCALE = 0.38

export type LobeBounds = {
  /** ближняя к ядру точка поверхности на оси, в единицах r₀ (с учётом вытяжки) */
  innerAxial: number
  /** дальняя точка поверхности на оси (кончик лепестка), в единицах r₀ */
  tipAxial: number
  /** центр описанной сферы на оси, в единицах r₀ */
  centerAxial: number
  /** радиус описанной сферы, в единицах r₀ (с небольшим запасом под мягкую кромку) */
  radius: number
}

/** Корни u = 1 + ln(u/iso) на оси (θ = 0): [ближний < 1 < дальний]. */
export function lobeAxisRoots(iso: number): [number, number] {
  const f = (u: number) => u - 1 - Math.log(u / iso)
  const bisect = (lo: number, hi: number) => {
    // f(lo) и f(hi) разных знаков; 60 делений хватает с запасом.
    let a = lo
    let b = hi
    const fa = f(a)
    for (let k = 0; k < 60; k++) {
      const m = 0.5 * (a + b)
      if (f(m) * fa > 0) a = m
      else b = m
    }
    return 0.5 * (a + b)
  }
  return [bisect(1e-6, 1), bisect(1, 64)]
}

/**
 * Описанная сфера лепестка (в единицах r₀) для данного изоуровня и вытяжки.
 * Контур: ρ²(u) = (1 + ln(u/iso))² − u², осевая координата a = S·u.
 * Центр подбирается троичным поиском так, чтобы радиус был минимальным.
 */
export function computeLobeBounds(iso: number, stretch: number): LobeBounds {
  const [u1, u2] = lobeAxisRoots(iso)
  const samples = 256
  const maxDist = (c: number) => {
    let m = 0
    for (let k = 0; k <= samples; k++) {
      const u = u1 + ((u2 - u1) * k) / samples
      const r = 1 + Math.log(u / iso)
      const rho2 = Math.max(0, r * r - u * u)
      const da = stretch * u - c
      const d2 = da * da + rho2
      if (d2 > m) m = d2
    }
    return Math.sqrt(m)
  }
  let lo = stretch * u1
  let hi = stretch * u2
  for (let k = 0; k < 60; k++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (maxDist(m1) < maxDist(m2)) hi = m2
    else lo = m1
  }
  const centerAxial = 0.5 * (lo + hi)
  return {
    innerAxial: stretch * u1,
    tipAxial: stretch * u2,
    centerAxial,
    radius: maxDist(centerAxial) * 1.06,
  }
}

export const LOBE_P_BOUNDS = computeLobeBounds(LOBE_ISO, LOBE_P_STRETCH)
export const LOBE_LONE_PAIR_BOUNDS = computeLobeBounds(LOBE_ISO, LOBE_LONE_PAIR_STRETCH)

/**
 * Материал лепестков. Геометрия — InstancedBufferGeometry квада [-1,1]² с
 * инстансными атрибутами (всё в локальной системе меша, масштаб — из modelMatrix):
 *   aCenter vec4 — xyz ядро, w = r₀ (мировые ед., 1/ζ эффективной АО);
 *   aAxis   vec4 — xyz единичная ось ЭТОГО лепестка, w = вытяжка S;
 *   aBound  vec4 — x центр описанной сферы на оси (в r₀), y её радиус (в r₀),
 *                  z фаза ±1, w слот искры одиночного электрона (−1 — нет);
 *   aLook   vec4 — x яркость·opacity, y заселённость 0..1, zw резерв.
 */
export function createOrbitalLobeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    // Прозрачный DoubleSide иначе рисуется дважды (Back+Front) и дважды пересобирает ключ шейдера.
    forceSinglePass: true,
    uniforms: {
      uTime: { value: 0 },
      uIso: { value: LOBE_ISO },
      /** сколько лепестков делят одну «блуждающую» искру */
      uSparkCount: { value: 0 },
      uPositive: { value: new THREE.Color(ORBITAL_PHASE_PALETTE.positive) },
      uNegative: { value: new THREE.Color(ORBITAL_PHASE_PALETTE.negative) },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aCenter;
      attribute vec4 aAxis;
      attribute vec4 aBound;
      attribute vec4 aLook;
      uniform float uTime;
      uniform float uSparkCount;
      varying vec3 vPos;
      varying vec3 vCenter;
      varying vec3 vAxis;
      varying vec3 vBoundC;
      varying float vBoundR;
      varying float vR0;
      varying float vS;
      varying float vPhase;
      varying vec2 vLook;
      varying vec3 vSpark;
      varying float vSparkA;

      float hash1(float n) {
        return fract(sin(n * 12.9898) * 43758.5453);
      }

      void main() {
        float scale = length(modelMatrix[0].xyz);
        vec3 c = (modelViewMatrix * vec4(aCenter.xyz, 1.0)).xyz;
        vec3 ax = normalize(mat3(modelViewMatrix) * aAxis.xyz);
        float r0 = aCenter.w * scale;
        vec3 bc = c + ax * (aBound.x * r0);
        float br = aBound.y * r0;

        // Квад перпендикулярен лучу камера→центр сферы: тогда силуэт сферы —
        // точный круг радиуса br·d/√(d²−br²).
        vec3 right;
        vec3 up;
        float cover;
        if (isOrthographic) {
          right = vec3(1.0, 0.0, 0.0);
          up = vec3(0.0, 1.0, 0.0);
          cover = br;
        } else {
          float d = length(bc);
          vec3 w = bc / max(d, 1e-5);
          vec3 helper = abs(w.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
          right = normalize(cross(w, helper));
          up = cross(right, w);
          cover = d > br * 1.02 ? br * d / sqrt(d * d - br * br) : br * 6.0;
        }
        vec3 pos = bc + (right * position.x + up * position.y) * cover;

        vPos = pos;
        vCenter = c;
        vAxis = ax;
        vBoundC = bc;
        vBoundR = br;
        vR0 = r0;
        vS = aAxis.w;
        vPhase = aBound.z;
        vLook = aLook.xy;

        // Искра одиночного электрона: ОДНА на пул, перескакивает между
        // лепестками — электрон делокализован по всей орбитали, и шесть
        // одновременных искр читались бы как шесть электронов.
        vSparkA = 0.0;
        vSpark = c;
        if (aBound.w >= 0.0 && uSparkCount > 0.5) {
          float rate = 0.9;
          float stepN = floor(uTime * rate);
          float slot = floor(hash1(stepN + 0.37) * uSparkCount);
          if (abs(slot - aBound.w) < 0.5) {
            float wph = fract(uTime * rate);
            vSparkA = smoothstep(0.0, 0.25, wph) * (1.0 - smoothstep(0.55, 1.0, wph));
            vec3 hp = abs(ax.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
            vec3 t1 = normalize(cross(ax, hp));
            vec3 t2 = cross(ax, t1);
            float ang = uTime * 2.3 + aBound.w * 1.7;
            vSpark = c + ax * (1.7 * aAxis.w * r0) + (t1 * cos(ang) + t2 * sin(ang)) * (0.7 * r0);
          }
        }

        gl_Position = projectionMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform mat4 projectionMatrix;
      uniform float uIso;
      uniform vec3 uPositive;
      uniform vec3 uNegative;
      varying vec3 vPos;
      varying vec3 vCenter;
      varying vec3 vAxis;
      varying vec3 vBoundC;
      varying float vBoundR;
      varying float vR0;
      varying float vS;
      varying float vPhase;
      varying vec2 vLook;
      varying vec3 vSpark;
      varying float vSparkA;

      const int LOBE_STEPS = 12;

      // F = r − 1 − ln(u/iso): < 0 внутри изоповерхности 2p-лепестка.
      float lobeF(vec3 p) {
        vec3 q = (p - vCenter) / vR0;
        float qa = dot(q, vAxis);
        if (qa <= 1e-4) return 4.0;
        float u = qa / vS;
        float r = sqrt(u * u + max(dot(q, q) - qa * qa, 0.0));
        return r - 1.0 - log(u / uIso);
      }

      vec3 lobeGrad(vec3 p) {
        vec3 q = (p - vCenter) / vR0;
        float qa = max(dot(q, vAxis), 1e-4);
        float u = qa / vS;
        vec3 qp = q - vAxis * qa;
        float r = max(sqrt(u * u + dot(qp, qp)), 1e-4);
        return (vAxis * (u / vS) + qp) / r - vAxis / qa;
      }

      float fragDepth(vec3 pView) {
        vec4 clip = projectionMatrix * vec4(pView, 1.0);
        return clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
      }

      void main() {
        vec3 ro;
        vec3 rd;
        if (isOrthographic) {
          ro = vec3(vPos.xy, vBoundC.z + vBoundR * 2.0 + 1.0);
          rd = vec3(0.0, 0.0, -1.0);
        } else {
          ro = vec3(0.0);
          rd = normalize(vPos);
        }

        // Описанная сфера лепестка → отрезок луча [t0, t1].
        vec3 oc = ro - vBoundC;
        float b = dot(oc, rd);
        float h = b * b - (dot(oc, oc) - vBoundR * vBoundR);
        if (h <= 0.0) discard;
        h = sqrt(h);
        float t0 = max(-b - h, 0.0);
        float t1 = -b + h;
        if (t1 <= t0) discard;

        float dt = (t1 - t0) / float(LOBE_STEPS);
        float tHit = -1.0;
        float fill = 0.0;
        float fMin = 4.0;
        float prevF = lobeF(ro + rd * t0);
        if (prevF < 0.0) tHit = t0;
        for (int i = 1; i <= LOBE_STEPS; i++) {
          float t = t0 + dt * float(i);
          float f = lobeF(ro + rd * t);
          fMin = min(fMin, f);
          // «Толщина» лепестка вдоль луча, взвешенная глубиной: плотное ядро светит сильнее кромки.
          fill += clamp(-f, 0.0, 1.0) * dt / vR0;
          if (tHit < 0.0 && f < 0.0) {
            // Секущая между шагами — точка входа без лишних вычислений поля.
            tHit = t - dt * f / (f - prevF);
          }
          prevF = f;
        }

        float occ = clamp(vLook.y, 0.0, 1.0);
        float bright = vLook.x;
        vec3 phaseCol = vPhase >= 0.0 ? uPositive : uNegative;
        vec3 col = vec3(0.0);
        float a = 0.0;
        vec3 depthPoint = vBoundC;

        if (tHit >= 0.0) {
          vec3 p = ro + rd * tHit;
          depthPoint = p;
          vec3 n = normalize(lobeGrad(p));
          float facing = min(abs(dot(n, rd)), 1.0);
          float fres = pow(1.0 - facing, 2.2);
          // Мягкий ключевой свет, закреплённый за камерой (сверху-слева-спереди).
          vec3 L = normalize(vec3(-0.35, 0.7, 0.62));
          float diff = 0.5 + 0.5 * dot(n, L);
          float spec = pow(max(dot(reflect(rd, n), L), 0.0), 24.0);

          // Кромка изоповерхности есть всегда — даже у пустой орбитали (occ = 0).
          float rim = fres * mix(0.75, 1.0, occ) + 0.03;
          float surface = (0.1 + 0.26 * diff) * occ;
          float glow = (1.0 - exp(-fill * 1.4)) * 0.5 * occ;
          col = phaseCol * (rim + surface + glow) + mix(phaseCol, vec3(1.0), 0.6) * (fres * fres * 0.45 + spec * 0.35 * occ);
          a = 1.0;
        } else {
          // Луч прошёл мимо на шаге сетки: мягкий ореол по минимуму поля — сглаженный силуэт.
          float halo = 1.0 - smoothstep(0.0, 0.14, fMin);
          if (halo <= 0.0 && vSparkA <= 0.0) discard;
          col = mix(phaseCol, vec3(1.0), 0.3) * halo * halo * 0.9;
          a = 1.0;
          depthPoint = ro + rd * max(-b, 0.0);
        }

        // Искра неспаренного электрона: заметна только около occ = 0.5.
        float sparkW = vSparkA * (1.0 - smoothstep(0.1, 0.3, abs(occ - 0.5)));
        if (sparkW > 0.0) {
          vec3 w = vSpark - ro;
          float along = dot(w, rd);
          float d2 = dot(w, w) - along * along;
          float sigma = 0.2 * vR0;
          float spark = exp(-d2 / (sigma * sigma)) * sparkW;
          col += mix(phaseCol, vec3(1.0), 0.75) * spark * 1.6;
        }

        gl_FragDepth = fragDepth(depthPoint);
        gl_FragColor = vec4(col * bright, a);
      }
    `,
  })
}

// ——— рэймарчинг молекулярной орбитали ———

/** Потолок атомов в ЛКАО рэймарчинга (размер uniform-массивов). */
export const ORBITAL_RAYMARCH_MAX_ATOMS = 6
/** Потолок шагов луча внутри бокса. */
export const ORBITAL_RAYMARCH_MAX_STEPS = 48

/**
 * Пик |cᵢ·Nᵢ·r·cosθ·e^(−ζr)| нормированной слейтеровской 2p-АО:
 * Nᵢ = √(ζ⁵/π), максимум при r = 1/ζ на оси → |c|·√(ζ³/π)/e.
 */
export function slaterPPeak(coef: number, zeta: number): number {
  return (Math.abs(coef) * Math.sqrt((zeta * zeta * zeta) / Math.PI)) / Math.E
}

/** Нормировка Nᵢ = √(ζ⁵/π) слейтеровской 2p-функции. */
export function slaterPNorm(zeta: number): number {
  return Math.sqrt(Math.pow(zeta, 5) / Math.PI)
}

/**
 * Радиус, дальше которого |amp·r·e^(−ζr)| < threshold (amp ≥ 0).
 * Если пик функции ниже порога — 0 (атом в изоповерхность не входит).
 */
export function slaterPReach(amp: number, zeta: number, threshold: number): number {
  const a = Math.abs(amp)
  if (a <= 0 || zeta <= 0) return 0
  const peakR = 1 / zeta
  if (a * peakR * Math.exp(-1) < threshold) return 0
  // На r > 1/ζ функция монотонно убывает: бисекция.
  let lo = peakR
  let hi = peakR
  while (a * hi * Math.exp(-zeta * hi) >= threshold && hi < peakR * 256) hi *= 2
  for (let k = 0; k < 40; k++) {
    const m = 0.5 * (lo + hi)
    if (a * m * Math.exp(-zeta * m) >= threshold) lo = m
    else hi = m
  }
  return hi
}

/**
 * Материал рэймарчинга. Меш — куб [-1,1]³ с ЕДИНИЧНОЙ локальной матрицей,
 * вложенный в систему координат молекулы (родитель = риг сцены); вершинный
 * шейдер сам разворачивает его в ориентированный бокс:
 *   p = uCenter + uRot·(position·uHalf).
 * Рисуются задние грани (работает и когда камера внутри бокса), depthTest
 * включён, а gl_FragDepth = первая точка изоповерхности — атомы закрывают
 * орбиталь попиксельно правильно, без текстуры глубины сцены.
 */
export function createOrbitalRaymarchMaterial(): THREE.ShaderMaterial {
  const atoms: THREE.Vector3[] = []
  for (let i = 0; i < ORBITAL_RAYMARCH_MAX_ATOMS; i++) atoms.push(new THREE.Vector3())
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
    side: THREE.BackSide,
    uniforms: {
      uCount: { value: 0 },
      uAtoms: { value: atoms },
      /** cᵢ·Nᵢ·psiScale — ψ нормирована так, что пик сильнейшей АО = 1 */
      uAmp: { value: new Float32Array(ORBITAL_RAYMARCH_MAX_ATOMS) },
      uZeta: { value: new Float32Array(ORBITAL_RAYMARCH_MAX_ATOMS) },
      uNormal: { value: new THREE.Vector3(0, 0, 1) },
      uIso: { value: 0.25 },
      uOpacity: { value: 1 },
      uCenter: { value: new THREE.Vector3() },
      uRot: { value: new THREE.Matrix3() },
      uHalf: { value: new THREE.Vector3(1, 1, 1) },
      uStep: { value: 0.05 },
      uPositive: { value: new THREE.Color(ORBITAL_PHASE_PALETTE.positive) },
      uNegative: { value: new THREE.Color(ORBITAL_PHASE_PALETTE.negative) },
    },
    vertexShader: /* glsl */ `
      uniform vec3 uCenter;
      uniform mat3 uRot;
      uniform vec3 uHalf;
      varying vec3 vLocal;
      varying vec3 vCam;
      varying vec3 vViewDirL;
      varying vec3 vLightL;
      void main() {
        vec3 p = uCenter + uRot * (position * uHalf);
        vLocal = p;
        // Камера и свет — в системе молекулы: обратная model-view на вершину
        // дешевле CPU-синхронизации и не отстаёт на кадр от рига камеры.
        mat4 inv = inverse(modelViewMatrix);
        vCam = (inv * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vViewDirL = normalize(mat3(inv) * vec3(0.0, 0.0, -1.0));
        vLightL = normalize(mat3(inv) * vec3(-0.35, 0.7, 0.62));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform mat4 projectionMatrix;
      uniform mat4 modelViewMatrix;
      uniform int uCount;
      uniform vec3 uAtoms[${ORBITAL_RAYMARCH_MAX_ATOMS}];
      uniform float uAmp[${ORBITAL_RAYMARCH_MAX_ATOMS}];
      uniform float uZeta[${ORBITAL_RAYMARCH_MAX_ATOMS}];
      uniform vec3 uNormal;
      uniform float uIso;
      uniform float uOpacity;
      uniform vec3 uCenter;
      uniform mat3 uRot;
      uniform vec3 uHalf;
      uniform float uStep;
      uniform vec3 uPositive;
      uniform vec3 uNegative;
      varying vec3 vLocal;
      varying vec3 vCam;
      varying vec3 vViewDirL;
      varying vec3 vLightL;

      const int MAX_STEPS = ${ORBITAL_RAYMARCH_MAX_STEPS};

      float psi(vec3 p) {
        float s = 0.0;
        for (int i = 0; i < ${ORBITAL_RAYMARCH_MAX_ATOMS}; i++) {
          if (i >= uCount) break;
          vec3 d = p - uAtoms[i];
          s += uAmp[i] * dot(uNormal, d) * exp(-uZeta[i] * length(d));
        }
        return s;
      }

      vec3 psiGrad(vec3 p) {
        vec3 g = vec3(0.0);
        for (int i = 0; i < ${ORBITAL_RAYMARCH_MAX_ATOMS}; i++) {
          if (i >= uCount) break;
          vec3 d = p - uAtoms[i];
          float r = max(length(d), 1e-5);
          float e = uAmp[i] * exp(-uZeta[i] * r);
          g += e * (uNormal - dot(uNormal, d) * uZeta[i] * d / r);
        }
        return g;
      }

      void main() {
        vec3 ro;
        vec3 rd;
        if (isOrthographic) {
          rd = vViewDirL;
          ro = vLocal - rd * (4.0 * length(uHalf) + 1.0);
        } else {
          ro = vCam;
          rd = normalize(vLocal - vCam);
        }

        // Луч в системе бокса (uRot ортонормирована: обратная = транспонированная).
        mat3 rt = transpose(uRot);
        vec3 roB = rt * (ro - uCenter);
        vec3 rdB = rt * rd;
        vec3 inv = 1.0 / (sign(rdB) * max(abs(rdB), vec3(1e-6)));
        vec3 ta = (-uHalf - roB) * inv;
        vec3 tb = (uHalf - roB) * inv;
        vec3 tmn = min(ta, tb);
        vec3 tmx = max(ta, tb);
        float tNear = max(max(max(tmn.x, tmn.y), tmn.z), 0.0);
        float tFar = min(min(tmx.x, tmx.y), tmx.z);
        if (tFar <= tNear) discard;

        // Шаг фиксирован размером бокса (≤ MAX_STEPS на диагональ); стартовый
        // сдвиг — по пиксельному шуму, чтобы не было «ступенек» слоёв.
        float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        float dt = uStep;
        float t = tNear + dt * jitter * 0.999;
        float prevV = psi(ro + rd * t);
        float prevF = abs(prevV) - uIso;
        float firstT = prevF >= 0.0 ? t : -1.0;
        vec4 acc = vec4(0.0);
        // Ближайший подход к изоповерхности снаружи — для сглаженного силуэта.
        float nearF = -1e9;
        float nearT = t;
        float nearV = prevV;

        for (int i = 0; i < MAX_STEPS; i++) {
          t += dt;
          if (t > tFar) break;
          vec3 p = ro + rd * t;
          float v = psi(p);
          float f = abs(v) - uIso;
          if ((f >= 0.0) != (prevF >= 0.0)) {
            float tc = t - dt * f / (f - prevF);
            vec3 pc = ro + rd * tc;
            bool entering = f >= 0.0;
            float sgn = entering ? sign(v) : sign(prevV);
            // Внешняя нормаль поверхности |ψ| = iso: против роста |ψ|.
            vec3 n = -normalize(psiGrad(pc) * sgn);
            vec3 phaseCol = sgn >= 0.0 ? uPositive : uNegative;
            float facing = min(abs(dot(n, rd)), 1.0);
            float fres = pow(1.0 - facing, 2.0);
            float diff = 0.5 + 0.5 * dot(n, vLightL);
            float spec = pow(max(dot(reflect(rd, n), vLightL), 0.0), 32.0);
            vec3 c = phaseCol * (0.3 + 0.7 * diff) + mix(phaseCol, vec3(1.0), 0.55) * (fres * 0.7 + spec * 0.4);
            // Передняя стенка лепестка плотнее задней: оболочка, а не туман.
            float a = uOpacity * (entering ? mix(0.3, 0.85, fres) : mix(0.14, 0.5, fres));
            acc.rgb += (1.0 - acc.a) * c * a;
            acc.a += (1.0 - acc.a) * a;
            if (firstT < 0.0) firstT = tc;
          }
          if (f < 0.0 && f > nearF) {
            nearF = f;
            nearT = t;
            nearV = v;
          }
          if (f > 0.0) {
            // Слабое свечение толщи лепестка — объём читается и под острым углом.
            vec3 phaseCol = v >= 0.0 ? uPositive : uNegative;
            float dens = min(f / uIso, 1.0) * 0.05 * uOpacity;
            acc.rgb += (1.0 - acc.a) * phaseCol * dens;
            acc.a += (1.0 - acc.a) * dens;
          }
          if (acc.a > 0.96) break;
          prevV = v;
          prevF = f;
        }

        if (firstT < 0.0) {
          // Луч прошёл по касательной между шагами: мягкая кромка вместо «зерна» на силуэте.
          float edge = 1.0 - clamp(-nearF / (0.2 * uIso), 0.0, 1.0);
          if (edge <= 0.0) discard;
          vec3 phaseCol = nearV >= 0.0 ? uPositive : uNegative;
          float a = edge * edge * 0.55 * uOpacity;
          acc = vec4(mix(phaseCol, vec3(1.0), 0.45) * a, a);
          firstT = nearT;
        }
        if (acc.a <= 0.002) discard;
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(ro + rd * firstT, 1.0);
        gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = acc;
      }
    `,
  })
}
