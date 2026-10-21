/** Raw persisted server snapshots; shape validation precedes this Host-only helper. */
export function recordSceneTransitionSightings(input: {
  beforeMaps?: any
  afterMaps: any
  beforeCharacters?: any
  afterCharacters: any
  beforeGeometry?: any
  afterGeometry?: any
  clock?: { worldMinute?: number; worldSecondRemainder?: number }
  observe: (input: any) => { map: any; characters: any[] }
}): { maps: any; characters: any }
