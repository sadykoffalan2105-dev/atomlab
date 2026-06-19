/** Пружинный симулятор «болтания» жидкости при наклоне сосуда. */
export class SloshSimulator {
  private angleX = 0
  private angleZ = 0
  private velX = 0
  private velZ = 0
  private spring: number
  private damping: number

  constructor(spring = 9, damping = 0.82) {
    this.spring = spring
    this.damping = damping
  }

  update(tiltX: number, tiltZ: number, dt: number) {
    const ax = (tiltX - this.angleX) * this.spring - this.velX * this.damping
    const az = (tiltZ - this.angleZ) * this.spring - this.velZ * this.damping
    this.velX += ax * dt
    this.velZ += az * dt
    this.angleX += this.velX * dt
    this.angleZ += this.velZ * dt
    return {
      tiltX: this.angleX,
      tiltZ: this.angleZ,
      sloshX: this.angleX * 0.045,
      sloshZ: this.angleZ * 0.045,
    }
  }

  reset() {
    this.angleX = 0
    this.angleZ = 0
    this.velX = 0
    this.velZ = 0
  }
}
