import EquipmentTab from '../character/EquipmentTab'

/** 地图角色坞中的紧凑物品栏；使用行为由 MapsPage 接入战斗权威事务。 */
export default function MapInventoryPanel({
  charId,
  pending,
  onUseItem,
}: {
  charId: string
  pending?: boolean
  onUseItem?: (instanceId: string) => boolean | void
}) {
  return <EquipmentTab charId={charId} compact pending={pending} onUseItem={onUseItem} />
}
