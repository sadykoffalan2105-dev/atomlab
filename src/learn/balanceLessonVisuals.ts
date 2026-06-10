/** Фотореалистичные иллюстрации к тренажёру коэффициентов (public/learn/balance). */

export type BalancePhotoSpec = {
  src: string
  altKey: string
  captionKey: string
}

export type BalanceLessonVisual = {
  hero: BalancePhotoSpec
  /** По одному фото на каждый шаг объяснения (fallback → hero). */
  steps: readonly BalancePhotoSpec[]
}

const p = (file: string) => `/learn/balance/${file}`

export const BALANCE_LESSON_VISUALS: Record<string, BalanceLessonVisual> = {
  h2_o2_h2o: {
    hero: {
      src: p('h2o-hero.png'),
      altKey: 'learn.balance.photo.h2o.hero.alt',
      captionKey: 'learn.balance.photo.h2o.hero.caption',
    },
    steps: [
      {
        src: p('oxygen-tank.png'),
        altKey: 'learn.balance.photo.h2o.s1.alt',
        captionKey: 'learn.balance.photo.h2o.s1.caption',
      },
      {
        src: p('water-drop.png'),
        altKey: 'learn.balance.photo.h2o.s2.alt',
        captionKey: 'learn.balance.photo.h2o.s2.caption',
      },
      {
        src: p('h2o-hero.png'),
        altKey: 'learn.balance.photo.h2o.s3.alt',
        captionKey: 'learn.balance.photo.h2o.s3.caption',
      },
      {
        src: p('water-drop.png'),
        altKey: 'learn.balance.photo.h2o.s4.alt',
        captionKey: 'learn.balance.photo.h2o.s4.caption',
      },
    ],
  },
  fe_o2_fe2o3: {
    hero: {
      src: p('rust-hero.png'),
      altKey: 'learn.balance.photo.rust.hero.alt',
      captionKey: 'learn.balance.photo.rust.hero.caption',
    },
    steps: [
      {
        src: p('iron-nail.png'),
        altKey: 'learn.balance.photo.rust.s1.alt',
        captionKey: 'learn.balance.photo.rust.s1.caption',
      },
      {
        src: p('rust-hero.png'),
        altKey: 'learn.balance.photo.rust.s2.alt',
        captionKey: 'learn.balance.photo.rust.s2.caption',
      },
      {
        src: p('oxygen-tank.png'),
        altKey: 'learn.balance.photo.rust.s3.alt',
        captionKey: 'learn.balance.photo.rust.s3.caption',
      },
      {
        src: p('iron-nail.png'),
        altKey: 'learn.balance.photo.rust.s4.alt',
        captionKey: 'learn.balance.photo.rust.s4.caption',
      },
    ],
  },
  n2_h2_nh3: {
    hero: {
      src: p('nh3-hero.png'),
      altKey: 'learn.balance.photo.nh3.hero.alt',
      captionKey: 'learn.balance.photo.nh3.hero.caption',
    },
    steps: [
      {
        src: p('fertilizer.png'),
        altKey: 'learn.balance.photo.nh3.s1.alt',
        captionKey: 'learn.balance.photo.nh3.s1.caption',
      },
      {
        src: p('h2o-hero.png'),
        altKey: 'learn.balance.photo.nh3.s2.alt',
        captionKey: 'learn.balance.photo.nh3.s2.caption',
      },
      {
        src: p('nh3-hero.png'),
        altKey: 'learn.balance.photo.nh3.s3.alt',
        captionKey: 'learn.balance.photo.nh3.s3.caption',
      },
    ],
  },
  c_o2_co2: {
    hero: {
      src: p('co2-hero.png'),
      altKey: 'learn.balance.photo.co2.hero.alt',
      captionKey: 'learn.balance.photo.co2.hero.caption',
    },
    steps: [
      {
        src: p('co2-hero.png'),
        altKey: 'learn.balance.photo.co2.s1.alt',
        captionKey: 'learn.balance.photo.co2.s1.caption',
      },
      {
        src: p('co2-hero.png'),
        altKey: 'learn.balance.photo.co2.s2.alt',
        captionKey: 'learn.balance.photo.co2.s2.caption',
      },
      {
        src: p('oxygen-tank.png'),
        altKey: 'learn.balance.photo.co2.s3.alt',
        captionKey: 'learn.balance.photo.co2.s3.caption',
      },
    ],
  },
  al_o2_al2o3: {
    hero: {
      src: p('al2o3-hero.png'),
      altKey: 'learn.balance.photo.al2o3.hero.alt',
      captionKey: 'learn.balance.photo.al2o3.hero.caption',
    },
    steps: [
      {
        src: p('al2o3-hero.png'),
        altKey: 'learn.balance.photo.al2o3.s1.alt',
        captionKey: 'learn.balance.photo.al2o3.s1.caption',
      },
      {
        src: p('aluminum-oxide.png'),
        altKey: 'learn.balance.photo.al2o3.s2.alt',
        captionKey: 'learn.balance.photo.al2o3.s2.caption',
      },
      {
        src: p('oxygen-tank.png'),
        altKey: 'learn.balance.photo.al2o3.s3.alt',
        captionKey: 'learn.balance.photo.al2o3.s3.caption',
      },
    ],
  },
  s_o2_so2: {
    hero: {
      src: p('so2-hero.png'),
      altKey: 'learn.balance.photo.so2.hero.alt',
      captionKey: 'learn.balance.photo.so2.hero.caption',
    },
    steps: [
      {
        src: p('sulfur-powder.png'),
        altKey: 'learn.balance.photo.so2.s1.alt',
        captionKey: 'learn.balance.photo.so2.s1.caption',
      },
      {
        src: p('so2-hero.png'),
        altKey: 'learn.balance.photo.so2.s2.alt',
        captionKey: 'learn.balance.photo.so2.s2.caption',
      },
    ],
  },
  o3_o2: {
    hero: {
      src: p('ozone-hero.png'),
      altKey: 'learn.balance.photo.ozone.hero.alt',
      captionKey: 'learn.balance.photo.ozone.hero.caption',
    },
    steps: [
      {
        src: p('ozone-hero.png'),
        altKey: 'learn.balance.photo.ozone.s1.alt',
        captionKey: 'learn.balance.photo.ozone.s1.caption',
      },
      {
        src: p('lightning.png'),
        altKey: 'learn.balance.photo.ozone.s2.alt',
        captionKey: 'learn.balance.photo.ozone.s2.caption',
      },
      {
        src: p('oxygen-tank.png'),
        altKey: 'learn.balance.photo.ozone.s3.alt',
        captionKey: 'learn.balance.photo.ozone.s3.caption',
      },
    ],
  },
}

export function getBalanceLessonVisual(lessonId: string): BalanceLessonVisual | null {
  return BALANCE_LESSON_VISUALS[lessonId] ?? null
}

export function getBalanceStepPhoto(lessonId: string, stepIndex: number): BalancePhotoSpec | null {
  const visual = getBalanceLessonVisual(lessonId)
  if (!visual) return null
  return visual.steps[stepIndex] ?? visual.hero
}
