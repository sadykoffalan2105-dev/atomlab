/** Активное редактирование уравнения (+/-): burst, пауза или visualHold после отпускания. */
export function isReactorCoeffEditing(
  coeffEditBurst: boolean,
  editIdle: boolean,
  visualHold = false,
): boolean {
  return coeffEditBurst || !editIdle || visualHold
}
