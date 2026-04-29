import { useState } from 'react'
import { PeriodicTableGrid } from '../components/lab/PeriodicTableGrid'
import { ElementDetailModal } from '../components/lab/ElementDetailModal'
import pageStyles from './PeriodicTablePage.module.css'

/** Полноэкранная таблица: клик по ячейке — карточка со всеми данными элемента. */
export function PeriodicTablePage() {
  const [detailZ, setDetailZ] = useState<number | null>(null)

  return (
    <div className={pageStyles.page}>
      <p className={pageStyles.headIntro}>
        Свойства элементов, в том числе валентность и строение атомов, периодически меняются с ростом заряда ядра.
      </p>
      <p className={pageStyles.lead}>
        Справочная таблица. Нажмите на элемент — откроется окно с полными данными. В лаборатории (⊞) тот же стиль
        связан с 3D-моделью в центре сцены.
      </p>
      <div className={pageStyles.tableWrap}>
        <PeriodicTableGrid mode="static" onPickElement={setDetailZ} />
      </div>
      <ElementDetailModal z={detailZ} onClose={() => setDetailZ(null)} />
    </div>
  )
}
