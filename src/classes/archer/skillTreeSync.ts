import type { Character } from '../../types/character'
import {
  BASIC_SHOT_DEF,
  getArcherSkillDef,
  getSkillRank,
  isArcherLineClass,
  learnedSkillsForCharacter,
  skillToCombatSkill,
} from './skillTree'

export function syncArcherCombatSkills(c: Character): Character {
  if (!isArcherLineClass(c.charClass)) {
    return {
      ...c,
      combatSkills: c.combatSkills.filter((s) => !s.skillTreeId),
      skillRanks: undefined,
    }
  }

  const customSkills = c.combatSkills.filter((s) => !s.skillTreeId)
  const existingByTree = new Map(
    c.combatSkills.filter((s) => s.skillTreeId).map((s) => [s.skillTreeId!, s]),
  )

  const treeSkills = learnedSkillsForCharacter(c).map((def) => {
      const rank = getSkillRank(c, def.id)
      return skillToCombatSkill(def, rank, existingByTree.get(def.id))
    })

  const basicExisting = existingByTree.get('basicShot')
  const basic = skillToCombatSkill(BASIC_SHOT_DEF, 1, basicExisting)

  const synced = [basic, ...treeSkills].sort((a, b) => {
    if (a.skillTreeId === 'basicShot') return -1
    if (b.skillTreeId === 'basicShot') return 1
    const da = getArcherSkillDef(a.skillTreeId!)!
    const db = getArcherSkillDef(b.skillTreeId!)!
    if (da.unlockLevel !== db.unlockLevel) return da.unlockLevel - db.unlockLevel
    return da.name.localeCompare(db.name, 'zh')
  })

  return { ...c, combatSkills: [...synced, ...customSkills] }
}
