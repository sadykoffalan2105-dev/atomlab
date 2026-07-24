import * as THREE from 'three'

/** GLSL plasma conduit: flowing energy along the bond axis. */
export function createPlasmaBondMaterial(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uStress: { value: 0 },
      uOpacity: { value: 0.92 },
      uColor: { value: new THREE.Color(color) },
      uHot: { value: new THREE.Color('#ffffff') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vNormalW;
      void main() {
        vAlong = position.y + 0.5;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uGlow;
      uniform float uStress;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform vec3 uHot;
      varying float vAlong;
      varying vec3 vNormalW;

      void main() {
        float flow = fract(vAlong * 5.0 - uTime * (1.8 + uGlow * 3.5));
        float ribbon = smoothstep(0.15, 0.45, flow) * (1.0 - smoothstep(0.55, 0.9, flow));
        float rim = pow(1.0 - abs(dot(normalize(vNormalW), vec3(0.0, 0.0, 1.0))), 1.6);
        float pulse = 0.55 + 0.45 * sin(uTime * (3.0 + uGlow * 6.0) + vAlong * 12.0);
        vec3 col = mix(uColor, uHot, clamp(uGlow * 0.85 + uStress, 0.0, 1.0));
        float alpha = uOpacity * (0.35 + ribbon * 0.55 + rim * 0.35 + uGlow * 0.25) * pulse;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `,
  })
}
