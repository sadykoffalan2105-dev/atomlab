import * as THREE from 'three'

/**
 * ATOMLAB Cinema — шейдер химической связи.
 *
 * Связь — не палочка, а поток энергии между атомами. По оси бегут светящиеся
 * жгуты; при натяжении (uStress) поток разгоняется, цвет уходит в белый, а в
 * оболочке появляются разрывы — связь визуально «трещит» перед разрывом.
 */
export function createBondMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      /** 0..1 — натяжение перед разрывом */
      uStress: { value: 0 },
      /** 0..1 — общая яркость/прозрачность */
      uOpacity: { value: 0.9 },
      /** 0..1 — «свежая» связь: волна образования пробегает от центра к краям */
      uForm: { value: 1 },
      uColor: { value: new THREE.Color(color) },
      uHot: { value: new THREE.Color('#ffffff') },
    },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vAlong = position.y + 0.5;
        vUv = uv;
        vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-viewPos.xyz);
        gl_Position = projectionMatrix * viewPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uStress;
      uniform float uOpacity;
      uniform float uForm;
      uniform vec3 uColor;
      uniform vec3 uHot;
      varying float vAlong;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        // Жгуты энергии вдоль связи; при натяжении поток ускоряется.
        float speed = 1.6 + uStress * 5.0;
        float flow = fract(vAlong * 4.0 - uTime * speed);
        float ribbon = smoothstep(0.12, 0.42, flow) * (1.0 - smoothstep(0.5, 0.88, flow));

        // Кромка цилиндра — объём вместо плоской ленты.
        float rim = pow(1.0 - clamp(dot(normalize(vNormalV), normalize(vViewDir)), 0.0, 1.0), 1.5);

        float pulse = 0.6 + 0.4 * sin(uTime * (3.0 + uStress * 14.0) + vAlong * 10.0);

        // Волна образования: свет расходится из центра связи к атомам.
        float formWave = smoothstep(0.0, 0.35, uForm - abs(vAlong - 0.5) * 1.6);

        // Разрывы перед разрушением: шум выедает оболочку.
        float tear = 1.0;
        if (uStress > 0.62) {
          float n = hash(floor(vec2(vUv.x * 18.0, vAlong * 26.0 + uTime * 9.0)));
          tear = step(( uStress - 0.62) / 0.38 * 0.75, n);
        }

        vec3 col = mix(uColor, uHot, clamp(uStress * 1.25, 0.0, 1.0));
        float alpha = uOpacity * formWave * tear * (0.28 + ribbon * 0.5 + rim * 0.42 + uStress * 0.3) * pulse;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `,
  })
}
