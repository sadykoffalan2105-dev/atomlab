/** Активное редактирование уравнения (+/-): burst или пауза после последнего изменения. */
export function isReactorCoeffEditing(coeffEditBurst: boolean, editIdle: boolean): boolean {
  return coeffEditBurst || !editIdle
}
