import type { ReactNode } from 'react'
import type { CyberTaskDef } from '../../../../../learn/learnCyberDashboard'
import sceneStyles from './CyberMiniScenes.module.css'

function SceneWrap({
  children,
  static: isStatic,
}: {
  children: ReactNode
  static?: boolean
}) {
  return (
    <div className={`${sceneStyles.scene} ${isStatic ? sceneStyles.sceneStatic : ''}`}>
      <div className={sceneStyles.sceneGlow} aria-hidden />
      {children}
    </div>
  )
}

function Scene1({ static: isStatic }: { static?: boolean }) {
  return (
    <SceneWrap static={isStatic}>
      <div className={sceneStyles.crystalCluster}>
        <div className={sceneStyles.molecule}>
          <span className={sceneStyles.molBond} />
          <span className={sceneStyles.molCore} />
          <span className={sceneStyles.molOrbit} />
          <span className={`${sceneStyles.molDot} ${sceneStyles.molDotA}`} />
          <span className={`${sceneStyles.molDot} ${sceneStyles.molDotB}`} />
          <span className={`${sceneStyles.molDot} ${sceneStyles.molDotC}`} />
        </div>
        <div className={sceneStyles.lattice3d}>
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={sceneStyles.latticeNode} />
          ))}
        </div>
      </div>
    </SceneWrap>
  )
}

function Scene2({ static: isStatic }: { static?: boolean }) {
  return (
    <SceneWrap static={isStatic}>
      <div className={sceneStyles.synthBench}>
        <div className={sceneStyles.robotArmL}>
          <span className={sceneStyles.armSeg} />
          <span className={sceneStyles.armSeg} />
          <span className={sceneStyles.armTip} />
        </div>
        <div className={sceneStyles.robotArmR}>
          <span className={sceneStyles.armSeg} />
          <span className={sceneStyles.armSeg} />
          <span className={sceneStyles.armTip} />
        </div>
        <div className={sceneStyles.vacuumChamber}>
          <span className={sceneStyles.chamberGlass} />
          <span className={sceneStyles.chamberLabel}>Vacuum</span>
          <span className={sceneStyles.chamberMol} />
        </div>
        <div className={`${sceneStyles.erlenmeyer} ${sceneStyles.flaskL}`}>
          <span className={sceneStyles.flaskLiquid} />
          {[0, 1, 2].map((i) => (
            <span key={i} className={sceneStyles.bubble} style={{ ['--bi' as string]: i }} />
          ))}
        </div>
        <div className={`${sceneStyles.erlenmeyer} ${sceneStyles.flaskR}`}>
          <span className={sceneStyles.flaskLiquidGreen} />
          {[1, 2].map((i) => (
            <span key={i} className={sceneStyles.bubble} style={{ ['--bi' as string]: i + 2 }} />
          ))}
        </div>
      </div>
    </SceneWrap>
  )
}

function Scene3({ static: isStatic }: { static?: boolean }) {
  return (
    <SceneWrap static={isStatic}>
      <div className={sceneStyles.techPanel}>
        <div className={sceneStyles.techTile}>
          <span className={sceneStyles.techIconEnergy} />
        </div>
        <div className={sceneStyles.techTile}>
          <span className={sceneStyles.techIconChip} />
        </div>
        <div className={sceneStyles.techTile}>
          <span className={sceneStyles.techIconFactory} />
        </div>
        <span className={sceneStyles.energyWave} />
      </div>
    </SceneWrap>
  )
}

function Scene4({ static: isStatic }: { static?: boolean }) {
  return (
    <SceneWrap static={isStatic}>
      <div className={sceneStyles.pipeRow}>
        <div className={sceneStyles.reactorTank}>
          <span className={sceneStyles.tankGlass} />
          <span className={sceneStyles.liquid} />
          <span className={sceneStyles.tankGlow} />
        </div>
        <span className={sceneStyles.pipeH} />
        <div className={sceneStyles.reactorTank}>
          <span className={sceneStyles.tankGlass} />
          <span className={`${sceneStyles.liquid} ${sceneStyles.liquidCyan}`} />
        </div>
        <span className={sceneStyles.pipeH} />
        <div className={sceneStyles.reactorTank}>
          <span className={sceneStyles.tankGlass} />
          <span className={sceneStyles.liquid} />
        </div>
      </div>
    </SceneWrap>
  )
}

function Scene5({ static: isStatic }: { static?: boolean }) {
  return (
    <SceneWrap static={isStatic}>
      <div className={sceneStyles.mixBench}>
        <div className={sceneStyles.beaker}>
          <span className={sceneStyles.beakerLiquid} />
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={sceneStyles.bubble} style={{ ['--bi' as string]: i }} />
          ))}
        </div>
        <div className={sceneStyles.atomModel}>
          <span className={sceneStyles.orbitRing} />
          <span className={sceneStyles.nucleus} />
          <span className={sceneStyles.electron} />
        </div>
        <div className={sceneStyles.mixIcons}>
          <span className={sceneStyles.mixIcon} title="salt" />
          <span className={sceneStyles.mixIconSoil} />
        </div>
      </div>
    </SceneWrap>
  )
}

function Scene6({ static: isStatic }: { static?: boolean }) {
  return (
    <SceneWrap static={isStatic}>
      <div className={sceneStyles.formulaPanel}>
        <div className={sceneStyles.periodicSnippet}>
          {['H', 'He', 'Li', 'C', 'N', 'O'].map((el) => (
            <span key={el} className={sceneStyles.ptCell}>
              {el}
            </span>
          ))}
        </div>
        <div className={sceneStyles.formulaList}>
          <span>H₂O</span>
          <span>CO₂</span>
          <span>NaCl</span>
        </div>
        <div className={sceneStyles.ch4Model}>
          <span className={sceneStyles.ch4Bond} />
          <span className={sceneStyles.ch4Bond} />
          <span className={sceneStyles.ch4Bond} />
          <span className={sceneStyles.ch4Bond} />
          <span className={sceneStyles.ch4C}>C</span>
          <span className={`${sceneStyles.ch4H} ${sceneStyles.ch4H1}`} />
          <span className={`${sceneStyles.ch4H} ${sceneStyles.ch4H2}`} />
          <span className={`${sceneStyles.ch4H} ${sceneStyles.ch4H3}`} />
          <span className={`${sceneStyles.ch4H} ${sceneStyles.ch4H4}`} />
        </div>
      </div>
    </SceneWrap>
  )
}

export function CyberMiniScene({
  task,
  animate,
}: {
  task: CyberTaskDef
  animate: boolean
}) {
  const isStatic = !animate
  switch (task.id) {
    case 'task1':
      return <Scene1 static={isStatic} />
    case 'task2':
      return <Scene2 static={isStatic} />
    case 'task3':
      return <Scene3 static={isStatic} />
    case 'task4':
      return <Scene4 static={isStatic} />
    case 'task5':
      return <Scene5 static={isStatic} />
    case 'task6':
      return <Scene6 static={isStatic} />
    default:
      return null
  }
}
