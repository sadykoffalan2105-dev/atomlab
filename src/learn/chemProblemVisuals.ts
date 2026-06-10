/** Иллюстрации к тренажёру расчётных задач (public/learn/problems). */

export type ProblemPhotoSpec = {
  src: string
  altKey: string
  captionKey: string
}

export type ProblemVisual = {
  hero: ProblemPhotoSpec
  steps?: readonly ProblemPhotoSpec[]
}

const p = (file: string) => `/learn/problems/${file}`
const b = (file: string) => `/learn/balance/${file}`

export const CHEM_PROBLEM_VISUALS: Record<string, ProblemVisual> = {
  ar: {
    hero: {
      src: p('periodic-table.png'),
      altKey: 'learn.problems.photo.ar.hero.alt',
      captionKey: 'learn.problems.photo.ar.hero.caption',
    },
  },
  mr: {
    hero: {
      src: p('molecule-model.png'),
      altKey: 'learn.problems.photo.mr.hero.alt',
      captionKey: 'learn.problems.photo.mr.hero.caption',
    },
  },
  omega: {
    hero: {
      src: p('composition-chart.png'),
      altKey: 'learn.problems.photo.omega.hero.alt',
      captionKey: 'learn.problems.photo.omega.hero.caption',
    },
  },
  n: {
    hero: {
      src: p('lab-scale.png'),
      altKey: 'learn.problems.photo.n.hero.alt',
      captionKey: 'learn.problems.photo.n.hero.caption',
    },
  },
  N: {
    hero: {
      src: p('avogadro-particles.png'),
      altKey: 'learn.problems.photo.N.hero.alt',
      captionKey: 'learn.problems.photo.N.hero.caption',
    },
  },
  V: {
    hero: {
      src: b('oxygen-tank.png'),
      altKey: 'learn.problems.photo.V.hero.alt',
      captionKey: 'learn.problems.photo.V.hero.caption',
    },
  },
  rho: {
    hero: {
      src: p('density-lab.png'),
      altKey: 'learn.problems.photo.rho.hero.alt',
      captionKey: 'learn.problems.photo.rho.hero.caption',
    },
  },
  n_to_N_carbon: {
    hero: {
      src: p('carbon-sample.png'),
      altKey: 'learn.problems.photo.ex.nToN.alt',
      captionKey: 'learn.problems.photo.ex.nToN.caption',
    },
  },
  h_in_water: {
    hero: {
      src: b('water-drop.png'),
      altKey: 'learn.problems.photo.ex.hInWater.alt',
      captionKey: 'learn.problems.photo.ex.hInWater.caption',
    },
  },
  co2_molecules: {
    hero: {
      src: b('co2-hero.png'),
      altKey: 'learn.problems.photo.ex.co2N.alt',
      captionKey: 'learn.problems.photo.ex.co2N.caption',
    },
  },
  gas_ratio: {
    hero: {
      src: p('electrolysis.png'),
      altKey: 'learn.problems.photo.ex.gasRatio.alt',
      captionKey: 'learn.problems.photo.ex.gasRatio.caption',
    },
  },
  mass_table: {
    hero: {
      src: p('chem-lab-bench.png'),
      altKey: 'learn.problems.photo.ex.table.alt',
      captionKey: 'learn.problems.photo.ex.table.caption',
    },
  },
}

export function getProblemVisual(id: string): ProblemVisual | null {
  return CHEM_PROBLEM_VISUALS[id] ?? null
}
