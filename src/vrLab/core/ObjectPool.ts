/** Пул объектов — zero-GC переиспользование в drag/pour/VFX. */
export class ObjectPool<T> {
  private free: T[] = []
  private factory: () => T

  constructor(factory: () => T, initialSize = 16) {
    this.factory = factory
    for (let i = 0; i < initialSize; i++) this.free.push(factory())
  }

  acquire(): T {
    return this.free.pop() ?? this.factory()
  }

  release(obj: T) {
    this.free.push(obj)
  }

  get size() {
    return this.free.length
  }
}
