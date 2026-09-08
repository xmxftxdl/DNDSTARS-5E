import { dnd5eInventoryItemTemplate } from '../rulesets/dnd5e/items'
import type { Dnd5eShopOffer } from '../rulesets/dnd5e/shops'
import type {
  Dnd5eInventoryIconId,
  Dnd5eInventoryItemTemplate,
  Dnd5eMagicItemKind,
} from '../types/inventory'
import { dnd5eItemActionIcon } from './dnd5eActionIcons'

function shopOfferMagicItemKind(icon: Dnd5eInventoryIconId): Dnd5eMagicItemKind {
  if (icon === 'magic-ring') return 'ring'
  if (icon === 'magic-wand') return 'wand'
  if (icon === 'magic-staff') return 'staff'
  if (icon === 'magic-rod') return 'rod'
  if (icon === 'magic-scroll') return 'scroll'
  if (icon === 'magic-potion' || icon === 'healing-potion') return 'potion'
  if (icon === 'ammunition') return 'ammunition'
  if (icon === 'armor' || icon === 'light-armor' || icon === 'medium-armor' || icon === 'heavy-armor' || icon === 'shield') return 'armor'
  if (['weapon', 'sword', 'dagger', 'club', 'staff', 'hammer', 'sickle', 'spear', 'polearm', 'trident', 'flail', 'bow', 'crossbow', 'sling', 'dart', 'whip', 'blowgun', 'net', 'axe'].includes(icon)) return 'weapon'
  return 'wondrous-item'
}

export function dnd5eShopOfferIconSpec(
  offer: Dnd5eShopOffer,
  liveTemplate: Dnd5eInventoryItemTemplate | undefined = dnd5eInventoryItemTemplate(offer.templateId),
) {
  return dnd5eItemActionIcon(liveTemplate ?? {
    id: offer.templateId,
    name: offer.name,
    englishName: offer.englishName,
    category: offer.category,
    icon: offer.icon,
    ...(offer.rarity ? {
      magicItem: {
        kind: shopOfferMagicItemKind(offer.icon),
        rarity: offer.rarity,
        attunement: 'none',
        automation: 'dm-adjudication',
      },
    } : {}),
  })
}
