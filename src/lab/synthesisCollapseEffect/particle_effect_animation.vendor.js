// Вспомогательные функции
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

/**
 * Запускает "WOW" эффект коллапса атомов и взрыва.
 */
export function start_elements_collapse_animation(
    atoms_array,
    scene,
    camera,
    renderer,
    {
        // ⏱ ТАЙМИНГИ (Новые параметры!)
        atom_collapse_time = 1.5,  // Сколько секунд атомы летят в центр
        atom_delay_max = 0.5,      // Максимальная задержка старта для атомов (чтобы летели не синхронно)
        burst_time = 1.5,          // Сколько секунд длится сам взрыв и разлет частиц
        hold_after_grow = 1.0,     // Сколько секунд эффект держится на максимальном размере
        fade_out = 0.8,            // Сколько секунд длится затухание в конце
        
        // 📏 РАЗМЕРЫ И ГУСТОТА
        end_scale = 1.5,           // Финальный размер центральной сферы
        particles_per_sec = 250,   // Густота искр
        max_particles = 1500,      // Лимит искр на экране
        
        // ✨ УПРАВЛЕНИЕ ИСКРАМИ
        particle_base_size = 60.0, 
        particle_speed = 6.0,      
        particle_stretch = 4.0,    
        particle_colors = [        
            0xffffff, 0xaaddff, 0x4488ff, 0xffaa00, 0xffffff  
        ],

        // 🌟 СВЕЧЕНИЕ ЯДРА
        core_gradient = [
            { stop: 0.0, color: 'rgba(255, 255, 255, 1.0)' },
            { stop: 0.1, color: 'rgba(255, 255, 255, 0.9)' },
            { stop: 0.3, color: 'rgba(100, 180, 255, 0.7)' },
            { stop: 0.6, color: 'rgba(30, 80, 255, 0.2)' },
            { stop: 1.0, color: 'rgba(0, 0, 0, 0.0)' }
        ]
    } = {}
) {
    return new Promise((resolve) => {
        const clock = new THREE.Clock();

        // --- 1. Подготовка Частиц ---
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(max_particles * 3);
        const velocities = new Float32Array(max_particles * 3);
        const colors = new Float32Array(max_particles * 3);
        const randomScale = new Float32Array(max_particles * 2);
        const birthTimes = new Float32Array(max_particles);
        const lifetimes = new Float32Array(max_particles);

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('randomScale', new THREE.BufferAttribute(randomScale, 2));
        geometry.setDrawRange(0, 0);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uOpacityMul: { value: 1.0 },
                uPointSize: { value: particle_base_size }
            },
            vertexShader: `
                attribute vec3 color;
                attribute vec3 velocity;
                attribute vec2 randomScale;
                uniform float uPointSize;
                varying vec3 vColor;
                varying vec2 vScale;
                varying vec2 vDirection;
                
                void main() {
                    vColor = color;
                    vScale = randomScale;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    vec4 nextProjected = projectionMatrix * modelViewMatrix * vec4(position + velocity * 0.1, 1.0);
                    vec2 dir = (nextProjected.xy / nextProjected.w) - (gl_Position.xy / gl_Position.w);
                    if (length(dir) < 0.0001) dir = vec2(0.0, 1.0);
                    else dir = normalize(dir);
                    vDirection = dir;
                    gl_PointSize = (uPointSize * max(vScale.x, vScale.y) / -mvPosition.z);
                }
            `,
            fragmentShader: `
                uniform float uOpacityMul;
                varying vec3 vColor;
                varying vec2 vScale;
                varying vec2 vDirection;
                
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float c = vDirection.x;
                    float s = vDirection.y;
                    mat2 rot = mat2(c, s, -s, c);
                    vec2 rotatedUv = rot * uv;
                    vec2 scaledUv = rotatedUv / vScale;
                    float dist = length(scaledUv);
                    if (dist > 0.5) discard;
                    
                    float alpha = pow(1.0 - (dist * 2.0), 3.0) * uOpacityMul; 
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        // --- 2. Генерация текстуры свечения ---
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        core_gradient.forEach(g => gradient.addColorStop(g.stop, g.color));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        
        const glowTex = new THREE.CanvasTexture(canvas);
        const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        glowMat.opacity = 0; // прозрачность спрайта — это material.opacity, а не sprite.opacity
        const glow = new THREE.Sprite(glowMat);
        glow.scale.setScalar(0.0001); // на старте не должно быть видно вообще ничего
        scene.add(glow);

        const flashMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        flashMat.opacity = 0;
        const shockwaveFlash = new THREE.Sprite(flashMat);
        shockwaveFlash.scale.setScalar(0.0001);
        scene.add(shockwaveFlash);

        function resetParticle(i, time) {
            positions[i * 3] = (Math.random() - 0.5) * 0.05;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
            
            const colorObj = new THREE.Color(particle_colors[Math.floor(Math.random() * particle_colors.length)]);
            colors[i * 3] = colorObj.r; colors[i * 3 + 1] = colorObj.g; colors[i * 3 + 2] = colorObj.b;
            
            const speed = (particle_speed * 0.5) + Math.random() * particle_speed; 
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(Math.random() * 2 - 1);
            
            velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
            velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
            velocities[i * 3 + 2] = Math.cos(phi) * speed;

            randomScale[i * 2] = 0.5 + Math.random() * particle_stretch; 
            randomScale[i * 2 + 1] = 0.1 + Math.random() * 0.2; 
            birthTimes[i] = time;
            lifetimes[i] = 0.2 + Math.random() * 0.5;
        }

        // --- 3. Подготовка атомов ---
        const atomData = atoms_array.map(atom => ({
            obj: atom,
            startPos: atom.position.clone(),
            startScale: atom.scale.clone(),
            delay: THREE.MathUtils.randFloat(0, atom_delay_max),
            duration: atom_collapse_time
        }));

        let elapsed = 0;
        let spawnAccumulator = 0;
        let activeCount = 0;
        let phase = 'collapse';
        let rafId = null;

        clock.getDelta();

        // Обновленные фазы таймлайна
        const collapseEnd = atom_collapse_time + atom_delay_max;
        const burstEnd = collapseEnd + burst_time;
        const holdEnd = burstEnd + hold_after_grow;
        const fadeEnd = holdEnd + fade_out;

        // --- 4. Цикл анимации ---
        function animate() {
            const dt = clock.getDelta();
            elapsed += dt;

            if (elapsed >= fadeEnd) {
                scene.remove(points); scene.remove(glow); scene.remove(shockwaveFlash);
                geometry.dispose(); material.dispose(); glowMat.dispose(); glowTex.dispose(); flashMat.dispose();
                resolve();
                return;
            }

            let burstScale = 0;
            let fadeMul = 1;
            let needsAttribUpdate = false;
            
            const collapseMaxScale = 0.2; 

            if (elapsed < collapseEnd) {
                phase = 'collapse';

                // Реальный прогресс "долёта" атомов до центра — берём МИНИМАЛЬНЫЙ t
                // среди всех атомов (а не общий elapsed/collapseEnd), потому что у каждого
                // атома свой delay и он долетает в своё время. Пока хоть один атом не
                // долетел — свечения в центре быть не должно.
                let minAtomT = 1;

                atomData.forEach(data => {
                    let t = clamp01((elapsed - data.delay) / data.duration);
                    if (t < minAtomT) minAtomT = t;
                    const easeT = easeInOutCubic(t);
                    data.obj.position.lerpVectors(data.startPos, new THREE.Vector3(0, 0, 0), easeT);
                    data.obj.scale.lerpVectors(data.startScale, new THREE.Vector3(0, 0, 0), easeT);
                });

                // Свечение появляется только в последние 15% полёта САМОГО МЕДЛЕННОГО атома
                if (minAtomT > 0.85) {
                    burstScale = ((minAtomT - 0.85) / 0.15) * collapseMaxScale;
                } else {
                    burstScale = 0.0;
                }

            } else if (elapsed < burstEnd) {
                phase = 'burst';
                atomData.forEach(data => data.obj.visible = false);

                const burstGrowT = clamp01((elapsed - collapseEnd) / burst_time);
                burstScale = collapseMaxScale + easeOutCubic(burstGrowT) * (end_scale - collapseMaxScale);
                spawnAccumulator += particles_per_sec * (0.05 + 0.95 * burstGrowT) * dt;

                if (burstGrowT < 0.3) {
                    const flashT = burstGrowT / 0.3;
                    shockwaveFlash.scale.setScalar(20 * easeOutCubic(flashT)); 
                    shockwaveFlash.opacity = 1.0 - easeInOutCubic(flashT);     
                } else {
                    shockwaveFlash.opacity = 0;
                }

            } else if (elapsed < holdEnd) {
                phase = 'hold';
                burstScale = end_scale;
                spawnAccumulator += particles_per_sec * dt;

            } else {
                phase = 'fadeout';
                const fadeT = clamp01((elapsed - holdEnd) / fade_out);
                fadeMul = 1 - easeInOutCubic(fadeT);
                burstScale = end_scale * fadeMul;
            }

            while (spawnAccumulator >= 1 && activeCount < max_particles) {
                resetParticle(activeCount, elapsed);
                activeCount++; spawnAccumulator -= 1;
                needsAttribUpdate = true;
            }
            
            for (let i = 0; i < activeCount; i++) {
                const age = elapsed - birthTimes[i];
                if (age > lifetimes[i]) { 
                    resetParticle(i, elapsed); needsAttribUpdate = true; continue; 
                }
                positions[i*3] += velocities[i*3] * dt;
                positions[i*3+1] += velocities[i*3+1] * dt;
                positions[i*3+2] += velocities[i*3+2] * dt;
            }
            
            geometry.attributes.position.needsUpdate = true;
            if (needsAttribUpdate) {
                geometry.attributes.color.needsUpdate = true;
                geometry.attributes.velocity.needsUpdate = true;
                geometry.attributes.randomScale.needsUpdate = true;
            }
            geometry.setDrawRange(0, activeCount);
            
            material.uniforms.uOpacityMul.value = phase === 'fadeout' ? fadeMul : 1;

            glow.scale.setScalar(5 * burstScale); 
            glowMat.opacity = Math.min(burstScale, 1);

            renderer.render(scene, camera);
            rafId = requestAnimationFrame(animate);
        }

        animate();
    });
}