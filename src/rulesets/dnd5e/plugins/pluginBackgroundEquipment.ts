import type {Dnd5ePluginBackgroundStartingEquipmentDefinition,Dnd5ePluginBackgroundStartingEquipmentPicker,Dnd5ePluginBackgroundStartingEquipmentGrant,PluginBackgroundEquipmentDependencies} from '../pluginApi'

export function createPluginBackgroundEquipmentNormalizer(dependencies: PluginBackgroundEquipmentDependencies) {
  const {validId,normalizeBackgroundEquipmentGrant,normalizeBackgroundTemplateId,DND5E_EQUIPMENT_SLOTS}=dependencies
  return function normalizeBackgroundStartingEquipment(
  pluginId: string,
  backgroundId: string,
  value: Dnd5ePluginBackgroundStartingEquipmentDefinition | undefined,
): Dnd5ePluginBackgroundStartingEquipmentDefinition | undefined {
  if (value == null) return undefined
  const fixedGrants = [...(value.fixedGrants ?? [])]
  const groups = [...(value.groups ?? [])]
  if (fixedGrants.length > 64 || groups.length > 16) {
    throw new Error(`Invalid plugin background starting equipment: ${backgroundId}`)
  }
  const groupIds = new Set<string>()
  return {
    ...(fixedGrants.length ? {
      fixedGrants: fixedGrants.map((entry, index) =>
        normalizeBackgroundEquipmentGrant(pluginId, entry, `${backgroundId}:fixed:${index}`)),
    } : {}),
    ...(groups.length ? {
      groups: groups.map((group, groupIndex) => {
        if (!group || !validId(group.id) || groupIds.has(group.id) ||
          typeof group.label !== 'string' || !group.label.trim() || group.label.length > 160 ||
          !Array.isArray(group.options) || group.options.length < 1 || group.options.length > 32) {
          throw new Error(`Invalid plugin background equipment group: ${backgroundId}:${groupIndex}`)
        }
        groupIds.add(group.id)
        const optionIds = new Set<string>()
        return {
          id: group.id,
          label: group.label.trim(),
          options: group.options.map((option, optionIndex) => {
            if (!option || !validId(option.id) || optionIds.has(option.id) ||
              typeof option.label !== 'string' || !option.label.trim() || option.label.length > 160 ||
              (option.description != null && (typeof option.description !== 'string' || option.description.length > 2_000)) ||
              !Array.isArray(option.grants) || option.grants.length > 32 ||
              (option.pickers != null && (!Array.isArray(option.pickers) || option.pickers.length > 8))) {
              throw new Error(`Invalid plugin background equipment option: ${backgroundId}:${group.id}:${optionIndex}`)
            }
            optionIds.add(option.id)
            const pickerIds = new Set<string>()
            const pickers = option.pickers?.map((
              choice: Dnd5ePluginBackgroundStartingEquipmentPicker,
              pickerIndex: number,
            ) => {
              if (!choice || !validId(choice.id) || pickerIds.has(choice.id) ||
                typeof choice.label !== 'string' || !choice.label.trim() || choice.label.length > 160 ||
                (choice.equipSlot != null && !DND5E_EQUIPMENT_SLOTS.includes(choice.equipSlot))) {
                throw new Error(`Invalid plugin background equipment picker: ${backgroundId}:${group.id}:${pickerIndex}`)
              }
              pickerIds.add(choice.id)
              if ('equipmentIds' in choice) {
                const equipmentIds = [...new Set(choice.equipmentIds ?? [])]
                if (equipmentIds.length < 1 || equipmentIds.length > 64 ||
                  equipmentIds.some((entry) => typeof entry !== 'string' || !validId(entry)) ||
                  !equipmentIds.includes(choice.defaultEquipmentId)) {
                  throw new Error(`Invalid plugin background equipment picker options: ${backgroundId}:${group.id}:${choice.id}`)
                }
                return {
                  id: choice.id,
                  label: choice.label.trim(),
                  equipmentIds,
                  defaultEquipmentId: choice.defaultEquipmentId,
                  ...(choice.equipSlot ? { equipSlot: choice.equipSlot } : {}),
                }
              }
              const templateIds = [...new Set((choice.templateIds ?? []).map((entry: string, index: number) =>
                normalizeBackgroundTemplateId(pluginId, entry, `${backgroundId}:${group.id}:${choice.id}:${index}`)))]
              const defaultTemplateId = normalizeBackgroundTemplateId(
                pluginId,
                choice.defaultTemplateId,
                `${backgroundId}:${group.id}:${choice.id}:default`,
              )
              if (templateIds.length < 1 || templateIds.length > 64 || !templateIds.includes(defaultTemplateId)) {
                throw new Error(`Invalid plugin background template picker options: ${backgroundId}:${group.id}:${choice.id}`)
              }
              return {
                id: choice.id,
                label: choice.label.trim(),
                templateIds,
                defaultTemplateId,
                ...(choice.equipSlot ? { equipSlot: choice.equipSlot } : {}),
              }
            })
            return {
              id: option.id,
              label: option.label.trim(),
              ...(option.description?.trim() ? { description: option.description.trim() } : {}),
              grants: option.grants.map((entry: Dnd5ePluginBackgroundStartingEquipmentGrant, grantIndex: number) => normalizeBackgroundEquipmentGrant(
                pluginId,
                entry,
                `${backgroundId}:${group.id}:${option.id}:${grantIndex}`,
              )),
              ...(pickers?.length ? { pickers } : {}),
            }
          }),
        }
      }),
    } : {}),
  }
}
}
