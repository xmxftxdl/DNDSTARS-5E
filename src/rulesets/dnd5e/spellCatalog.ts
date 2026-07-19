import type { Dnd5eClassId } from './classes'
import { DND5E_SRD_SPELL_NAMES_ZH } from './spellNamesZh'

export interface Dnd5eSrdSpellCatalogEntry {
  id: string
  name: string
  englishName: string
  level: number
  classes: readonly Dnd5eClassId[]
}

export interface Dnd5eWarlockMysticArcanumOption extends Dnd5eSrdSpellCatalogEntry {
  name: string
}

// Parsed from the official SRD 5.1 CC "Spell Lists" section (document pages 105-113).
// This index proves list membership only. A spell is not Headless-ready until spells.ts
// supplies its localized rules metadata and resolver shape.
const RAW_SRD_5_1_SPELL_CATALOG = `
acid-arrow|Acid Arrow|2|wizard
acid-splash|Acid Splash|0|sorcerer,wizard
aid|Aid|2|cleric,paladin
alarm|Alarm|1|ranger,wizard
alter-self|Alter Self|2|sorcerer,wizard
animal-friendship|Animal Friendship|1|bard,druid,ranger
animal-messenger|Animal Messenger|2|bard,druid,ranger
animal-shapes|Animal Shapes|8|druid
animate-dead|Animate Dead|3|cleric,wizard
animate-objects|Animate Objects|5|bard,sorcerer,wizard
antilife-shell|Antilife Shell|5|druid
antimagic-field|Antimagic Field|8|cleric,wizard
antipathy-sympathy|Antipathy/Sympathy|8|druid,wizard
arcane-eye|Arcane Eye|4|wizard
arcane-hand|Arcane Hand|5|wizard
arcane-lock|Arcane Lock|2|wizard
arcane-sword|Arcane Sword|7|bard,wizard
arcanists-magic-aura|Arcanist’s Magic Aura|2|wizard
astral-projection|Astral Projection|9|cleric,warlock,wizard
augury|Augury|2|cleric
awaken|Awaken|5|bard,druid
bane|Bane|1|bard,cleric
banishment|Banishment|4|cleric,paladin,sorcerer,warlock,wizard
barkskin|Barkskin|2|druid,ranger
beacon-of-hope|Beacon of Hope|3|cleric
bestow-curse|Bestow Curse|3|bard,cleric,wizard
black-tentacles|Black Tentacles|4|wizard
blade-barrier|Blade Barrier|6|cleric
bless|Bless|1|cleric,paladin
blight|Blight|4|druid,sorcerer,warlock,wizard
blindness-deafness|Blindness/Deafness|2|bard,cleric,sorcerer,wizard
blink|Blink|3|sorcerer,wizard
blur|Blur|2|sorcerer,wizard
branding-smite|Branding Smite|2|paladin
burning-hands|Burning Hands|1|sorcerer,wizard
call-lightning|Call Lightning|3|druid
calm-emotions|Calm Emotions|2|bard,cleric
chain-lightning|Chain Lightning|6|sorcerer,wizard
charm-person|Charm Person|1|bard,druid,sorcerer,warlock,wizard
chill-touch|Chill Touch|0|sorcerer,warlock,wizard
circle-of-death|Circle of Death|6|sorcerer,warlock,wizard
clairvoyance|Clairvoyance|3|bard,cleric,sorcerer,wizard
clone|Clone|8|wizard
cloudkill|Cloudkill|5|sorcerer,wizard
color-spray|Color Spray|1|sorcerer,wizard
command|Command|1|cleric,paladin
commune|Commune|5|cleric
commune-with-nature|Commune with Nature|5|druid,ranger
comprehend-languages|Comprehend Languages|1|bard,sorcerer,warlock,wizard
compulsion|Compulsion|4|bard
cone-of-cold|Cone of Cold|5|sorcerer,wizard
confusion|Confusion|4|bard,druid,sorcerer,wizard
conjure-animals|Conjure Animals|3|druid,ranger
conjure-celestial|Conjure Celestial|7|cleric
conjure-elemental|Conjure Elemental|5|druid,wizard
conjure-fey|Conjure Fey|6|druid,warlock
conjure-minor-elementals|Conjure Minor Elementals|4|druid,wizard
conjure-woodland-beings|Conjure Woodland Beings|4|druid,ranger
contact-other-plane|Contact Other Plane|5|warlock,wizard
contagion|Contagion|5|cleric,druid
contingency|Contingency|6|wizard
continual-flame|Continual Flame|2|cleric,wizard
control-water|Control Water|4|cleric,druid,wizard
control-weather|Control Weather|8|cleric,druid,wizard
counterspell|Counterspell|3|sorcerer,warlock,wizard
create-food-and-water|Create Food and Water|3|cleric,paladin
create-undead|Create Undead|6|cleric,warlock,wizard
create-or-destroy-water|Create or Destroy Water|1|cleric,druid
creation|Creation|5|sorcerer,wizard
cure-wounds|Cure Wounds|1|bard,cleric,druid,paladin,ranger
dancing-lights|Dancing Lights|0|bard,sorcerer,wizard
darkness|Darkness|2|sorcerer,warlock,wizard
darkvision|Darkvision|2|druid,ranger,sorcerer,wizard
daylight|Daylight|3|cleric,druid,paladin,ranger,sorcerer
death-ward|Death Ward|4|cleric,paladin
delayed-blast-fireball|Delayed Blast Fireball|7|sorcerer,wizard
demiplane|Demiplane|8|warlock,wizard
detect-evil-and-good|Detect Evil and Good|1|cleric,paladin
detect-magic|Detect Magic|1|bard,cleric,druid,paladin,ranger,sorcerer,wizard
detect-poison-and-disease|Detect Poison and Disease|1|cleric,druid,paladin,ranger
detect-thoughts|Detect Thoughts|2|bard,sorcerer,wizard
dimension-door|Dimension Door|4|bard,sorcerer,warlock,wizard
disguise-self|Disguise Self|1|bard,sorcerer,wizard
disintegrate|Disintegrate|6|sorcerer,wizard
dispel-evil-and-good|Dispel Evil and Good|5|cleric,paladin
dispel-magic|Dispel Magic|3|bard,cleric,druid,paladin,sorcerer,warlock,wizard
divination|Divination|4|cleric
divine-favor|Divine Favor|1|paladin
divine-word|Divine Word|7|cleric
dominate-beast|Dominate Beast|4|druid,sorcerer
dominate-monster|Dominate Monster|8|bard,sorcerer,warlock,wizard
dominate-person|Dominate Person|5|bard,sorcerer,wizard
dream|Dream|5|bard,warlock,wizard
druidcraft|Druidcraft|0|druid
earthquake|Earthquake|8|cleric,druid,sorcerer
eldritch-blast|Eldritch Blast|0|warlock
enhance-ability|Enhance Ability|2|bard,cleric,druid,sorcerer
enlarge-reduce|Enlarge/Reduce|2|sorcerer,wizard
entangle|Entangle|1|druid
enthrall|Enthrall|2|bard,warlock
etherealness|Etherealness|7|bard,cleric,sorcerer,warlock,wizard
expeditious-retreat|Expeditious Retreat|1|sorcerer,warlock,wizard
eyebite|Eyebite|6|bard,sorcerer,warlock,wizard
fabricate|Fabricate|4|wizard
faerie-fire|Faerie Fire|1|bard,druid
faithful-hound|Faithful Hound|4|wizard
false-life|False Life|1|sorcerer,wizard
fear|Fear|3|bard,sorcerer,warlock,wizard
feather-fall|Feather Fall|1|bard,sorcerer,wizard
feeblemind|Feeblemind|8|bard,druid,warlock,wizard
find-familiar|Find Familiar|1|wizard
find-steed|Find Steed|2|paladin
find-traps|Find Traps|2|cleric,druid,ranger
find-the-path|Find the Path|6|bard,cleric,druid
finger-of-death|Finger of Death|7|sorcerer,warlock,wizard
fire-bolt|Fire Bolt|0|sorcerer,wizard
fire-shield|Fire Shield|4|wizard
fire-storm|Fire Storm|7|cleric,druid,sorcerer
fireball|Fireball|3|sorcerer,wizard
flame-blade|Flame Blade|2|druid
flame-strike|Flame Strike|5|cleric
flaming-sphere|Flaming Sphere|2|druid,wizard
flesh-to-stone|Flesh to Stone|6|warlock,wizard
floating-disk|Floating Disk|1|wizard
fly|Fly|3|sorcerer,warlock,wizard
fog-cloud|Fog Cloud|1|druid,ranger,sorcerer,wizard
forbiddance|Forbiddance|6|cleric
forcecage|Forcecage|7|bard,warlock,wizard
foresight|Foresight|9|bard,druid,warlock,wizard
freedom-of-movement|Freedom of Movement|4|bard,cleric,druid,ranger
freezing-sphere|Freezing Sphere|6|wizard
gaseous-form|Gaseous Form|3|sorcerer,warlock,wizard
gate|Gate|9|cleric,sorcerer,wizard
geas|Geas|5|bard,cleric,druid,paladin,wizard
gentle-repose|Gentle Repose|2|cleric,wizard
giant-insect|Giant Insect|4|druid
glibness|Glibness|8|bard,warlock
globe-of-invulnerability|Globe of Invulnerability|6|sorcerer,wizard
glyph-of-warding|Glyph of Warding|3|bard,cleric,wizard
goodberry|Goodberry|1|druid,ranger
grease|Grease|1|wizard
greater-invisibility|Greater Invisibility|4|bard,sorcerer,wizard
greater-restoration|Greater Restoration|5|bard,cleric,druid
guardian-of-faith|Guardian of Faith|4|cleric
guards-and-wards|Guards and Wards|6|bard,wizard
guidance|Guidance|0|cleric,druid
guiding-bolt|Guiding Bolt|1|cleric
gust-of-wind|Gust of Wind|2|druid,sorcerer,wizard
hallow|Hallow|5|cleric
hallucinatory-terrain|Hallucinatory Terrain|4|bard,druid,warlock,wizard
harm|Harm|6|cleric
haste|Haste|3|sorcerer,wizard
heal|Heal|6|cleric,druid
healing-word|Healing Word|1|bard,cleric,druid
heat-metal|Heat Metal|2|bard,druid
hellish-rebuke|Hellish Rebuke|1|warlock
heroes-feast|Heroes’ Feast|6|cleric,druid
heroism|Heroism|1|bard,paladin
hideous-laughter|Hideous Laughter|1|bard,wizard
hold-monster|Hold Monster|5|bard,sorcerer,warlock,wizard
hold-person|Hold Person|2|bard,cleric,druid,sorcerer,warlock,wizard
holy-aura|Holy Aura|8|cleric
hunters-mark|Hunter's Mark|1|ranger
hypnotic-pattern|Hypnotic Pattern|3|bard,sorcerer,warlock,wizard
ice-storm|Ice Storm|4|druid,sorcerer,wizard
identify|Identify|1|bard,wizard
illusory-script|Illusory Script|1|bard,warlock,wizard
imprisonment|Imprisonment|9|warlock,wizard
incendiary-cloud|Incendiary Cloud|8|sorcerer,wizard
inflict-wounds|Inflict Wounds|1|cleric
insect-plague|Insect Plague|5|cleric,druid,sorcerer
instant-summons|Instant Summons|6|wizard
invisibility|Invisibility|2|bard,sorcerer,warlock,wizard
irresistible-dance|Irresistible Dance|6|bard,wizard
jump|Jump|1|druid,ranger,sorcerer,wizard
knock|Knock|2|bard,sorcerer,wizard
legend-lore|Legend Lore|5|bard,cleric,wizard
lesser-restoration|Lesser Restoration|2|bard,cleric,druid,paladin,ranger
levitate|Levitate|2|sorcerer,wizard
light|Light|0|bard,cleric,sorcerer,wizard
lightning-bolt|Lightning Bolt|3|sorcerer,wizard
locate-animals-or-plants|Locate Animals or Plants|2|bard,druid,ranger
locate-creature|Locate Creature|4|bard,cleric,druid,paladin,ranger,wizard
locate-object|Locate Object|2|bard,cleric,druid,paladin,ranger,wizard
longstrider|Longstrider|1|bard,druid,ranger,wizard
mage-armor|Mage Armor|1|sorcerer,wizard
mage-hand|Mage Hand|0|bard,sorcerer,warlock,wizard
magic-circle|Magic Circle|3|cleric,paladin,warlock,wizard
magic-jar|Magic Jar|6|wizard
magic-missile|Magic Missile|1|sorcerer,wizard
magic-mouth|Magic Mouth|2|bard,wizard
magic-weapon|Magic Weapon|2|paladin,wizard
magnificent-mansion|Magnificent Mansion|7|bard,wizard
major-image|Major Image|3|bard,sorcerer,warlock,wizard
mass-cure-wounds|Mass Cure Wounds|5|bard,cleric,druid
mass-heal|Mass Heal|9|cleric
mass-healing-word|Mass Healing Word|3|cleric
mass-suggestion|Mass Suggestion|6|bard,sorcerer,warlock,wizard
maze|Maze|8|wizard
meld-into-stone|Meld into Stone|3|cleric,druid
mending|Mending|0|bard,cleric,druid,sorcerer,wizard
message|Message|0|bard,sorcerer,wizard
meteor-swarm|Meteor Swarm|9|sorcerer,wizard
mind-blank|Mind Blank|8|bard,wizard
minor-illusion|Minor Illusion|0|bard,sorcerer,warlock,wizard
mirage-arcane|Mirage Arcane|7|bard,druid,wizard
mirror-image|Mirror Image|2|sorcerer,warlock,wizard
mislead|Mislead|5|bard,wizard
misty-step|Misty Step|2|sorcerer,warlock,wizard
modify-memory|Modify Memory|5|bard,wizard
moonbeam|Moonbeam|2|druid
move-earth|Move Earth|6|druid,sorcerer,wizard
nondetection|Nondetection|3|bard,ranger,wizard
pass-without-trace|Pass without Trace|2|druid,ranger
passwall|Passwall|5|wizard
phantasmal-killer|Phantasmal Killer|4|wizard
phantom-steed|Phantom Steed|3|wizard
planar-ally|Planar Ally|6|cleric
planar-binding|Planar Binding|5|bard,cleric,druid,wizard
plane-shift|Plane Shift|7|cleric,druid,sorcerer,warlock,wizard
plant-growth|Plant Growth|3|bard,druid,ranger
poison-spray|Poison Spray|0|druid,sorcerer,warlock,wizard
polymorph|Polymorph|4|bard,druid,sorcerer,wizard
power-word-kill|Power Word Kill|9|bard,sorcerer,warlock,wizard
power-word-stun|Power Word Stun|8|bard,sorcerer,warlock,wizard
prayer-of-healing|Prayer of Healing|2|cleric
prestidigitation|Prestidigitation|0|bard,sorcerer,warlock,wizard
prismatic-spray|Prismatic Spray|7|sorcerer,wizard
prismatic-wall|Prismatic Wall|9|wizard
private-sanctum|Private Sanctum|4|wizard
produce-flame|Produce Flame|0|druid
programmed-illusion|Programmed Illusion|6|bard,wizard
project-image|Project Image|7|bard,wizard
protection-from-energy|Protection from Energy|3|cleric,druid,ranger,sorcerer,wizard
protection-from-evil-and-good|Protection from Evil and Good|1|cleric,paladin,warlock,wizard
protection-from-poison|Protection from Poison|2|cleric,druid,paladin,ranger
purify-food-and-drink|Purify Food and Drink|1|cleric,druid,paladin
raise-dead|Raise Dead|5|bard,cleric,paladin
ray-of-enfeeblement|Ray of Enfeeblement|2|warlock,wizard
ray-of-frost|Ray of Frost|0|sorcerer,wizard
regenerate|Regenerate|7|bard,cleric,druid
reincarnate|Reincarnate|5|druid
remove-curse|Remove Curse|3|cleric,paladin,warlock,wizard
resilient-sphere|Resilient Sphere|4|wizard
resistance|Resistance|0|cleric,druid
resurrection|Resurrection|7|bard,cleric
reverse-gravity|Reverse Gravity|7|druid,sorcerer,wizard
revivify|Revivify|3|cleric,paladin
rope-trick|Rope Trick|2|wizard
sacred-flame|Sacred Flame|0|cleric
sanctuary|Sanctuary|1|cleric
scorching-ray|Scorching Ray|2|sorcerer,wizard
scrying|Scrying|5|bard,cleric,druid,warlock,wizard
secret-chest|Secret Chest|4|wizard
see-invisibility|See Invisibility|2|bard,sorcerer,wizard
seeming|Seeming|5|bard,sorcerer,wizard
sending|Sending|3|bard,cleric,wizard
sequester|Sequester|7|wizard
shapechange|Shapechange|9|druid,wizard
shatter|Shatter|2|bard,sorcerer,warlock,wizard
shield|Shield|1|sorcerer,wizard
shield-of-faith|Shield of Faith|1|cleric,paladin
shillelagh|Shillelagh|0|druid
shocking-grasp|Shocking Grasp|0|sorcerer,wizard
silence|Silence|2|bard,cleric,ranger
silent-image|Silent Image|1|bard,sorcerer,wizard
simulacrum|Simulacrum|7|wizard
sleep|Sleep|1|bard,sorcerer,wizard
sleet-storm|Sleet Storm|3|druid,sorcerer,wizard
slow|Slow|3|sorcerer,wizard
spare-the-dying|Spare the Dying|0|cleric
speak-with-animals|Speak with Animals|1|bard,druid,ranger
speak-with-dead|Speak with Dead|3|bard,cleric
speak-with-plants|Speak with Plants|3|bard,druid,ranger
spider-climb|Spider Climb|2|sorcerer,warlock,wizard
spike-growth|Spike Growth|2|druid,ranger
spirit-guardians|Spirit Guardians|3|cleric
spiritual-weapon|Spiritual Weapon|2|cleric
stinking-cloud|Stinking Cloud|3|bard,sorcerer,wizard
stone-shape|Stone Shape|4|cleric,druid,wizard
stoneskin|Stoneskin|4|druid,ranger,sorcerer,wizard
storm-of-vengeance|Storm of Vengeance|9|druid
suggestion|Suggestion|2|bard,sorcerer,warlock,wizard
sunbeam|Sunbeam|6|druid,sorcerer,wizard
sunburst|Sunburst|8|druid,sorcerer,wizard
symbol|Symbol|7|bard,cleric,wizard
telekinesis|Telekinesis|5|sorcerer,wizard
telepathic-bond|Telepathic Bond|5|wizard
teleport|Teleport|7|bard,sorcerer,wizard
teleportation-circle|Teleportation Circle|5|bard,sorcerer,wizard
thaumaturgy|Thaumaturgy|0|cleric
thunderwave|Thunderwave|1|bard,druid,sorcerer,wizard
time-stop|Time Stop|9|sorcerer,wizard
tiny-hut|Tiny Hut|3|bard,wizard
tongues|Tongues|3|bard,cleric,sorcerer,warlock,wizard
transport-via-plants|Transport via Plants|6|druid
tree-stride|Tree Stride|5|druid,ranger
true-polymorph|True Polymorph|9|bard,warlock,wizard
true-resurrection|True Resurrection|9|cleric,druid
true-seeing|True Seeing|6|bard,cleric,sorcerer,warlock,wizard
true-strike|True Strike|0|bard,sorcerer,warlock,wizard
unseen-servant|Unseen Servant|1|bard,warlock,wizard
vampiric-touch|Vampiric Touch|3|warlock,wizard
vicious-mockery|Vicious Mockery|0|bard
wall-of-fire|Wall of Fire|4|druid,sorcerer,wizard
wall-of-force|Wall of Force|5|wizard
wall-of-ice|Wall of Ice|6|wizard
wall-of-stone|Wall of Stone|5|druid,sorcerer,wizard
wall-of-thorns|Wall of Thorns|6|druid
warding-bond|Warding Bond|2|cleric
water-breathing|Water Breathing|3|druid,ranger,sorcerer,wizard
water-walk|Water Walk|3|cleric,druid,ranger,sorcerer
web|Web|2|sorcerer,wizard
weird|Weird|9|wizard
wind-walk|Wind Walk|6|druid
wind-wall|Wind Wall|3|druid,ranger
wish|Wish|9|sorcerer,wizard
word-of-recall|Word of Recall|6|cleric
zone-of-truth|Zone of Truth|2|bard,cleric,paladin
`.trim()

export const DND5E_SRD_SPELL_CATALOG: readonly Dnd5eSrdSpellCatalogEntry[] = RAW_SRD_5_1_SPELL_CATALOG
  .split('\n')
  .map((row) => {
    const [id, englishName, level, classIds] = row.split('|')
    return {
      id,
      name: DND5E_SRD_SPELL_NAMES_ZH[id] ?? englishName,
      englishName,
      level: Number(level),
      classes: classIds.split(',') as Dnd5eClassId[],
    }
  })

const catalogById = new Map(DND5E_SRD_SPELL_CATALOG.map((spell) => [spell.id, spell]))

export function getDnd5eSrdSpellCatalogEntry(id: string): Dnd5eSrdSpellCatalogEntry | undefined {
  return catalogById.get(id)
}

export function dnd5eSrdSpellCatalogForClass(classId: Dnd5eClassId): readonly Dnd5eSrdSpellCatalogEntry[] {
  return DND5E_SRD_SPELL_CATALOG.filter((spell) => spell.classes.includes(classId))
}

/**
 * SRD 5.1 魔法奥秘可以从任意职业法表选择戏法，或选择施法者当前能施放环级的法术。
 * 此目录只提供合法选项；是否已经接入地图 Headless 结算仍由 spells.ts 决定。
 */
export function dnd5eBardMagicalSecretsOptions(maxSpellLevel: number): readonly Dnd5eSrdSpellCatalogEntry[] {
  const maximum = Math.max(0, Math.min(9, Math.floor(maxSpellLevel)))
  return DND5E_SRD_SPELL_CATALOG
    .filter((spell) => spell.level <= maximum)
    .sort((left, right) => left.level - right.level || left.englishName.localeCompare(right.englishName))
}

export function dnd5eWarlockMysticArcanumOptions(level: number): readonly Dnd5eWarlockMysticArcanumOption[] {
  if (![6, 7, 8, 9].includes(level)) return []
  return dnd5eSrdSpellCatalogForClass('warlock')
    .filter((spell) => spell.level === level)
}
