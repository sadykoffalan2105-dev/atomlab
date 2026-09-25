/**
 * Материалы сцены реактора (научный маршрут): матовые шары, тонкие матовые связи
 * и символы элементов внутри шаров. Свет — свой, «студийный» в пространстве вида:
 * новых источников света в сцене нет (иначе перекомпиляция всех освещённых
 * материалов лаборатории = рывок), и вид не зависит от точечного света реактора.
 *
 * Почему шары круглые у краёв широкого кадра. Перспектива растягивает шар вне оси
 * камеры в эллипс (≈ 1/cos θ: у краёв кадра 16:9 при fov 56–60° это +20–40 %).
 * Отодвинуть группу от камеры в k раз и во столько же увеличить её не помогает:
 * гомотетия с центром в камере сохраняет каждый луч, силуэт шара — тот же конус.
 * Поэтому шар проецируется «ортографически вокруг своего центра»: центр — в честной
 * перспективе (молекулы и подписи стоят на местах), а смещения вершин по x/y —
 * с масштабом глубины центра, без вклада глубины вершины. Глубина вершины при этом
 * настоящая — пересечения шаров и связей и заслонение остаются верными.
 */
import * as THREE from 'three'
import { SYMBOL_ATLAS_COLS } from './stageAtomSymbols'

/**
 * Общая часть вершинного шейдера: центр экземпляра в пространстве вида, его радиус,
 * клип-координаты точки «центр + смещение» без перспективного растяжения.
 */
const SCREEN_ALIGNED_GLSL = /* glsl */ `
  // Клип-координаты: центр в перспективе, смещение xy — в масштабе глубины центра,
  // z — глубина точки centerV.z + offZ (настоящая).
  vec4 screenAligned(vec3 centerV, vec2 offXY, float offZ) {
    vec4 clip = projectionMatrix * vec4(centerV, 1.0);
    if (projectionMatrix[2][3] == 0.0) {
      // ортографическая камера — искажения нет, обычная проекция
      return projectionMatrix * vec4(centerV + vec3(offXY, offZ), 1.0);
    }
    clip.x += projectionMatrix[0][0] * offXY.x;
    clip.y += projectionMatrix[1][1] * offXY.y;
    float zv = min(centerV.z + offZ, -1e-4);
    float ndcZ = (projectionMatrix[2][2] * zv + projectionMatrix[3][2]) / -zv;
    clip.z = ndcZ * clip.w;
    return clip;
  }
`

/** Направление «ключевого» света в пространстве вида: сверху-слева-спереди. */
const KEY_DIR = new THREE.Vector3(-0.42, 0.62, 0.66).normalize()

/**
 * Матовые шары: полуламберт + мягкое небо/земля, широкий слабый блик (без clearcoat
 * и глянцевой «точки»), тонкий светлый ободок у силуэта. instanceColor — цвет CPK,
 * aRim — оттенок ободка (у катиона теплее, у аниона холоднее).
 */
export function makeStageAtomMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'stage-atom-matte',
    toneMapped: false,
    uniforms: {
      uKeyDir: { value: KEY_DIR.clone() },
      uAmbient: { value: 0.34 },
      uSky: { value: 0.3 },
      uKey: { value: 0.62 },
      uSpec: { value: 0.09 },
      uShine: { value: 14 },
      uRim: { value: 0.32 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aRim;
      varying vec3 vN;
      varying vec3 vColor;
      varying vec3 vRim;
      ${SCREEN_ALIGNED_GLSL}
      void main() {
        mat4 mvi = modelViewMatrix * instanceMatrix;
        vec3 c = (mvi * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float r = length(mvi[0].xyz);
        // Единичная сфера: position == normal. Шар «смотрит» в камеру — нормаль в пространстве вида.
        vec3 off = normal * r;
        gl_Position = screenAligned(c, off.xy, off.z);
        vN = normal;
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        vRim = aRim;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uKeyDir;
      uniform float uAmbient;
      uniform float uSky;
      uniform float uKey;
      uniform float uSpec;
      uniform float uShine;
      uniform float uRim;
      varying vec3 vN;
      varying vec3 vColor;
      varying vec3 vRim;
      void main() {
        vec3 N = normalize(vN);
        float ndv = clamp(N.z, 0.0, 1.0);
        // полуламберт: терминатор мягкий, тень не проваливается в чёрное
        float ndl = dot(N, uKeyDir);
        float diff = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
        diff *= diff;
        float sky = N.y * 0.5 + 0.5;
        vec3 col = vColor * (uAmbient + uSky * sky + uKey * diff);
        // широкий слабый блик — матовая поверхность (roughness ~0.55), не «лак»
        vec3 H = normalize(uKeyDir + vec3(0.0, 0.0, 1.0));
        float spec = pow(max(dot(N, H), 0.0), uShine) * uSpec;
        col += vec3(spec);
        // ободок: светлая тонкая кромка отделяет шар от тёмного фона
        float fres = pow(1.0 - ndv, 3.0);
        col = mix(col, vRim, fres * uRim);
        // лёгкое затемнение самого края — чёткий силуэт без чёрной обводки
        col *= 1.0 - 0.22 * pow(1.0 - ndv, 8.0);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

/** Тонкие матовые связи: обычная перспектива (концы в центрах шаров), тот же свет. */
export function makeStageBondMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'stage-bond-matte',
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uKeyDir: { value: KEY_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      void main() {
        vec4 p = instanceMatrix * vec4(position, 1.0);
        // масштаб цилиндра одинаков по x и z — направление нормали сохраняется
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uKeyDir;
      varying vec3 vN;
      void main() {
        vec3 N = normalize(vN);
        float diff = clamp(dot(N, uKeyDir) * 0.5 + 0.5, 0.0, 1.0);
        float sky = N.y * 0.5 + 0.5;
        vec3 col = uColor * (0.42 + 0.22 * sky + 0.46 * diff * diff);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

/**
 * Символы внутри шаров: квадрат на экземпляр атома (та же матрица, что у шара),
 * развёрнут к экрану, стоит перед передней точкой шара — depthTest сам прячет
 * буквы заслонённых атомов. На шаре меньше ~10 px радиуса символ гаснет.
 * aCell — клетка атласа, aInk — 1: тёмные буквы со светлым ореолом, 0: белые с тёмным.
 */
export function makeStageSymbolMaterial(atlas: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'stage-atom-symbols',
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    premultipliedAlpha: true,
    uniforms: {
      uAtlas: { value: atlas },
      uCols: { value: SYMBOL_ATLAS_COLS },
      /** сторона квадрата подписи в радиусах шара */
      uSize: { value: 1.45 },
      /** высота холста, CSS px — для порога «мелкий шар» */
      uViewportH: { value: 800 },
      uMinPx: { value: 10 },
    },
    vertexShader: /* glsl */ `
      attribute float aCell;
      attribute float aInk;
      uniform float uCols;
      uniform float uSize;
      uniform float uViewportH;
      uniform float uMinPx;
      varying vec2 vUv;
      varying float vInk;
      varying float vFade;
      ${SCREEN_ALIGNED_GLSL}
      void main() {
        mat4 mvi = modelViewMatrix * instanceMatrix;
        vec3 c = (mvi * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float r = length(mvi[0].xyz);
        float depth = max(1e-4, -c.z);
        float rPx = r * projectionMatrix[1][1] / depth * 0.5 * uViewportH;
        // узкий переход: полупрозрачная «тень» буквы на мелком шаре читается хуже, чем её отсутствие
        vFade = aCell < 0.0 ? 0.0 : smoothstep(uMinPx * 0.94, uMinPx * 1.06, rPx);
        vInk = aInk;
        float col = mod(aCell, uCols);
        float row = floor(aCell / uCols);
        vUv = vec2((col + uv.x) / uCols, 1.0 - (row + 1.0 - uv.y) / uCols);
        if (vFade <= 0.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }
        // чуть перед передней точкой шара (у шара она на c.z + r)
        gl_Position = screenAligned(c, position.xy * (uSize * r), r * 1.04);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      varying vec2 vUv;
      varying float vInk;
      varying float vFade;
      void main() {
        vec4 t = texture2D(uAtlas, vUv);
        float fill = t.r;
        float halo = t.g * mix(0.42, 0.22, vInk);
        vec3 ink = mix(vec3(1.0), vec3(0.055, 0.075, 0.13), vInk);
        vec3 haloCol = mix(vec3(0.02, 0.035, 0.08), vec3(1.0), vInk);
        float a = fill + halo * (1.0 - fill);
        if (a * vFade < 0.004) discard;
        // премультиплицированный альфа-канал: буквы поверх ореола
        vec3 rgb = ink * fill + haloCol * halo * (1.0 - fill);
        gl_FragColor = vec4(rgb * vFade, a * vFade);
      }
    `,
  })
}
