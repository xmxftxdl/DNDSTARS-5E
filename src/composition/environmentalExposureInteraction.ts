export type EnvironmentalExposureRoll = (input: {
  mapId: string; targetId: string; characterId?: string; targetName: string;
  label: string; mode: 'normal' | 'advantage' | 'disadvantage';
}) => Promise<number[]>
let interaction: EnvironmentalExposureRoll | undefined
export function registerEnvironmentalExposureInteraction(owner: EnvironmentalExposureRoll) {
  interaction = owner
  return () => { if (interaction === owner) interaction = undefined }
}
export function getEnvironmentalExposureInteraction() {
  if (!interaction) throw Error('请先打开当前地图，再结算气候暴露。')
  return interaction
}
