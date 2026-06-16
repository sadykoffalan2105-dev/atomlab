import * as THREE from 'three'

const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i);
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));
    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = p * 2.05 + vec3(1.3, 2.1, 0.7);
      a *= 0.48;
    }
    return v;
  }
`

function parseAccent(accentHex: string) {
  const color = new THREE.Color(accentHex.startsWith('#') ? accentHex : `#${accentHex}`)
  const violet = color.clone().lerp(new THREE.Color('#7b5cff'), 0.28)
  const deep = color.clone().multiplyScalar(0.22)
  return { color, violet, deep }
}

/** Непрерывный объём дыма — основа облака (не точки). */
export function createAtomVolumetricCloudMaterial(
  accentHex: string,
  seed: number,
  layer: 'core' | 'outer' | 'wisp',
): THREE.ShaderMaterial {
  const { color, violet, deep } = parseAccent(accentHex)
  const opacityMul = layer === 'core' ? 1 : layer === 'outer' ? 0.65 : 0.42

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: color },
      uViolet: { value: violet },
      uDeep: { value: deep },
      uTime: { value: 0 },
      uSeed: { value: seed },
      uOpacityMul: { value: opacityMul },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vNormal;
      void main() {
        vLocalPos = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uViolet;
      uniform vec3 uDeep;
      uniform float uTime;
      uniform float uSeed;
      uniform float uOpacityMul;
      varying vec3 vLocalPos;
      varying vec3 vNormal;

      ${NOISE_GLSL}

      void main() {
        vec3 flow = vec3(uTime * 0.04, uTime * 0.025, uTime * 0.032);
        vec3 p = vLocalPos * 1.35 + flow + vec3(uSeed * 0.05);

        float n1 = fbm(p);
        float n2 = fbm(p * 1.85 + vec3(2.4, 0.8, uSeed));
        float n3 = fbm(p * 3.2 + vec3(0.0, uTime * 0.06, 1.7));
        float smoke = n1 * 0.45 + n2 * 0.35 + n3 * 0.28;

        float r = length(vLocalPos);
        float warp = fbm(vLocalPos * 2.4 + vec3(uSeed)) * 0.35;
        float envelope = smoothstep(1.05 + warp, 0.08, r);
        envelope *= smoothstep(0.04, 0.22, smoke + n3 * 0.5);

        vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(vLocalPos, 1.0)).xyz);
        float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 1.15);

        vec3 col = mix(uDeep, mix(uColor, uViolet, smoke + 0.1), 0.5 + smoke * 0.5);
        float alpha = envelope * (0.14 + smoke * 0.22 + fresnel * 0.38) * uOpacityMul;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(col * (0.7 + fresnel * 0.65), alpha);
      }
    `,
  })
}

/** Данные мягких спрайтов-струй дыма. */
export function buildSmokeSpriteLayout(
  count: number,
  spread: number,
  seed: number,
): { position: THREE.Vector3; scale: number; opacity: number; rot: number }[] {
  const out: { position: THREE.Vector3; scale: number; opacity: number; rot: number }[] = []
  const rnd = (n: number) => {
    const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  for (let i = 0; i < count; i++) {
    const u = rnd(i + 1)
    const v = rnd(i + 17)
    const w = rnd(i + 43)
    const theta = u * Math.PI * 2
    const phi = Math.acos(2 * v - 1)
    const rad = spread * (0.08 + Math.pow(w, 0.62) * 1.05)
    const wx = rnd(i + 91) * 2 - 1
    const wy = rnd(i + 113) * 2 - 1
    const wz = rnd(i + 137) * 2 - 1
    out.push({
      position: new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * rad + wx * spread * 0.22,
        Math.sin(phi) * Math.sin(theta) * rad + wy * spread * 0.18,
        Math.cos(phi) * rad + wz * spread * 0.2,
      ),
      scale: spread * (0.35 + rnd(i + 201) * 0.75),
      opacity: 0.12 + rnd(i + 307) * 0.22,
      rot: rnd(i + 401) * Math.PI * 2,
    })
  }
  return out
}

export function smokeVolumeLayers(lite: boolean): {
  scale: number
  offset: [number, number, number]
  layer: 'core' | 'outer' | 'wisp'
  seed: number
  stretch: [number, number, number]
}[] {
  const layers: {
    scale: number
    offset: [number, number, number]
    layer: 'core' | 'outer' | 'wisp'
    seed: number
    stretch: [number, number, number]
  }[] = [
    { scale: 1, offset: [0, 0, 0], layer: 'core', seed: 1.2, stretch: [1, 0.92, 1.05] },
    { scale: 0.82, offset: [0.08, -0.05, 0.06], layer: 'core', seed: 4.7, stretch: [1.12, 0.78, 0.95] },
    { scale: 1.18, offset: [-0.06, 0.07, -0.04], layer: 'outer', seed: 8.3, stretch: [0.88, 1.08, 1.15] },
    { scale: 1.35, offset: [0.04, 0.02, 0.09], layer: 'outer', seed: 12.1, stretch: [1.05, 0.85, 0.9] },
    { scale: 1.05, offset: [-0.09, -0.08, 0.05], layer: 'wisp', seed: 16.9, stretch: [1.2, 0.7, 1.1] },
    { scale: 0.95, offset: [0.1, 0.04, -0.07], layer: 'wisp', seed: 21.4, stretch: [0.75, 1.15, 0.88] },
  ]
  return lite ? layers.slice(0, 3) : layers
}

/** @deprecated */
export function createAtomSmokeMaterial(accentHex: string): THREE.ShaderMaterial {
  return createAtomVolumetricCloudMaterial(accentHex, Math.random() * 100, 'core')
}

export function smokePuffOffsets(lite: boolean): [number, number, number, number][] {
  return smokeVolumeLayers(lite).map((l) => [...l.offset, l.scale] as [number, number, number, number])
}
