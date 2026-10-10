import photosJson from './elementPhotos.json'

/**
 * Настоящее фото образца элемента (уменьшенная копия с Wikimedia Commons).
 * Данные собирает scripts/build-element-photos.mts; картинки в репозитории не храним.
 */
export type ElementPhoto = {
  /** Миниатюра ~500 px */
  thumb: string
  /** ~960 px для экранов высокой плотности (есть, только если оригинал шире) */
  thumb2x?: string
  /** Страница файла на Commons (обязательна для подписи CC BY / BY-SA) */
  page: string
  author: string
  /** Короткое имя лицензии: «CC BY-SA 3.0», «FAL», «Public domain»… */
  license: string
  licenseUrl?: string
}

/** Почему фото нет: подпись в карточке вместо снимка. */
export type ElementNoPhotoReason = 'accelerator' | 'traces' | 'gas' | 'noFreePhoto'

const PHOTOS = photosJson as Readonly<Record<string, ElementPhoto | null>>

/** Fr и Fm: видимого образца никогда не было; Rn — бесцветный газ. */
const NO_PHOTO_REASON: Readonly<Record<string, ElementNoPhotoReason>> = {
  Fr: 'traces',
  Fm: 'traces',
  Rn: 'gas',
}

export function getElementPhoto(symbol: string): ElementPhoto | null {
  return PHOTOS[symbol] ?? null
}

/** Для элементов без фото: Md и тяжелее (Z ≥ 101) — считанные атомы на ускорителе. */
export function getElementNoPhotoReason(symbol: string, z: number): ElementNoPhotoReason {
  return NO_PHOTO_REASON[symbol] ?? (z >= 101 ? 'accelerator' : 'noFreePhoto')
}
