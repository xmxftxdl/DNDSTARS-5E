import { useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MobileInventoryEntry } from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'
import { assignMobileItemQuickbar, MOBILE_ITEM_QUICKBAR_SLOT_COUNT, parseMobileItemQuickbar, reconcileMobileItemQuickbar } from '../services/itemQuickbarModel'

const SLOT_COUNT = MOBILE_ITEM_QUICKBAR_SLOT_COUNT

export function MobileItemQuickbar({
  characterId,
  entries,
  assetBaseUrl,
  onUse,
  onOpenBag,
}: {
  characterId: string
  entries: MobileInventoryEntry[]
  assetBaseUrl: string
  onUse: (entry: MobileInventoryEntry) => void
  onOpenBag: () => void
}) {
  const [slots, setSlots] = useState<string[]>([])
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const storageKey = `stars.mobile.item-quickbar:${characterId}`
  const byId = useMemo(() => new Map(entries.filter((entry) => entry.quantity > 0).map((entry) => [entry.instanceId, entry])), [entries])

  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!active) return
      setSlots(parseMobileItemQuickbar(raw))
    })
    return () => { active = false }
  }, [storageKey])

  useEffect(() => {
    setSlots((current) => {
      const next = reconcileMobileItemQuickbar(current, new Set(byId.keys()))
      if (next.every((id, index) => id === current[index])) return current
      void AsyncStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }, [byId, storageKey])

  const assign = (instanceId: string) => {
    if (editingSlot == null) return
    setSlots((current) => {
      const next = assignMobileItemQuickbar(current, editingSlot, instanceId)
      void AsyncStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
    setEditingSlot(null)
  }
  const clear = () => {
    if (editingSlot == null) return
    setSlots((current) => {
      const next = Array.from({ length: SLOT_COUNT }, (_, index) => current[index] ?? '')
      next[editingSlot] = ''
      void AsyncStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
    setEditingSlot(null)
  }

  return <>
    <View style={styles.bar}>
      {Array.from({ length: SLOT_COUNT }, (_, index) => {
        const entry = byId.get(slots[index] ?? '')
        return <Pressable
          accessibilityRole="button"
          accessibilityLabel={entry ? `使用${entry.item.name}` : `设置物品快捷格 ${index + 1}`}
          key={index}
          style={[styles.slot, entry && styles.slotFilled]}
          onPress={() => entry ? onUse(entry) : setEditingSlot(index)}
          onLongPress={() => setEditingSlot(index)}
          delayLongPress={420}
        >
          {entry ? <ItemArtwork entry={entry} assetBaseUrl={assetBaseUrl} /> : <Text style={styles.empty}>＋</Text>}
          <Text style={styles.slotNumber}>{index + 1}</Text>
          {entry && <View style={styles.quantity}><Text style={styles.quantityText}>{entry.quantity}</Text></View>}
        </Pressable>
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="打开背包" style={[styles.slot, styles.bag]} onPress={onOpenBag}>
        <Text style={styles.bagIcon}>▦</Text><Text style={styles.bagText}>背包</Text>
      </Pressable>
    </View>
    <Modal visible={editingSlot != null} transparent animationType="fade" supportedOrientations={['landscape-left', 'landscape-right']} onRequestClose={() => setEditingSlot(null)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingSlot(null)} />
        <View style={styles.picker}>
          <View style={styles.pickerHead}><View><Text style={styles.pickerTitle}>设置第 {(editingSlot ?? 0) + 1} 个快捷格</Text><Text style={styles.pickerHint}>轻点使用，长按可重新分配。所有结算仍交给 Host。</Text></View><Pressable onPress={() => setEditingSlot(null)}><Text style={styles.close}>×</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.inventory}>
            {entries.filter((entry) => entry.quantity > 0).map((entry) => <Pressable key={entry.instanceId} style={styles.entry} onPress={() => assign(entry.instanceId)}>
              <View style={styles.entryArtwork}><ItemArtwork entry={entry} assetBaseUrl={assetBaseUrl} /></View>
              <View style={{ flex: 1 }}><Text style={styles.entryName}>{entry.item.name}</Text><Text numberOfLines={2} style={styles.entryMeta}>数量 {entry.quantity}{entry.equippedSlot ? ` · 已装备` : ''}{entry.attuned ? ' · 已同调' : ''}</Text></View>
            </Pressable>)}
            {entries.length === 0 && <Text style={styles.noItems}>背包中还没有物品。</Text>}
          </ScrollView>
          <View style={styles.pickerActions}><Pressable style={styles.clear} onPress={clear}><Text style={styles.clearText}>清空这一格</Text></Pressable><Pressable style={styles.openBag} onPress={() => { setEditingSlot(null); onOpenBag() }}><Text style={styles.openBagText}>打开完整背包</Text></Pressable></View>
        </View>
      </View>
    </Modal>
  </>
}

function ItemArtwork({ entry, assetBaseUrl }: { entry: MobileInventoryEntry; assetBaseUrl: string }) {
  const icon = entry.item.icon?.trim()
  const uri = icon?.startsWith('/') ? `${assetBaseUrl.replace(/\/$/, '')}${icon}` : /^https?:\/\//.test(icon ?? '') ? icon : ''
  return uri
    ? <Image source={{ uri }} style={styles.image} resizeMode="cover" />
    : <Text numberOfLines={1} adjustsFontSizeToFit style={styles.glyph}>{icon || (entry.item.magicItem ? '✦' : '◆')}</Text>
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 78, right: 8, bottom: 70, height: 48, flexDirection: 'row', gap: 4, padding: 4, borderRadius: 13, borderWidth: 1, borderColor: '#6f54aa99', backgroundColor: '#080811ed' },
  slot: { flex: 1, minWidth: 34, maxWidth: 54, borderRadius: 9, borderWidth: 1, borderColor: '#ffffff17', backgroundColor: '#11111d', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  slotFilled: { borderColor: '#8b5cf688', backgroundColor: '#211936' }, bag: { borderColor: '#fbbf2466', backgroundColor: '#2b200d' },
  empty: { color: '#555063', fontSize: 17 }, slotNumber: { position: 'absolute', left: 3, top: 1, color: '#787287', fontSize: 6, fontWeight: '900' }, quantity: { position: 'absolute', right: 2, bottom: 2, minWidth: 14, borderRadius: 8, backgroundColor: '#050508d9', alignItems: 'center', paddingHorizontal: 3 }, quantityText: { color: '#fff', fontSize: 7, fontWeight: '900' }, image: { width: '100%', height: '100%' }, glyph: { color: '#fcd34d', fontSize: 19, fontWeight: '900', width: '82%', textAlign: 'center' }, bagIcon: { color: '#fde68a', fontSize: 17, lineHeight: 18 }, bagText: { color: '#fde68a', fontSize: 6, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: '#000000bb', alignItems: 'center', justifyContent: 'center', padding: 18 }, picker: { width: '84%', maxWidth: 680, maxHeight: '82%', borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#0b0b14', overflow: 'hidden' }, pickerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, pickerTitle: { color: colors.text, fontSize: 16, fontWeight: '900' }, pickerHint: { color: colors.muted, fontSize: 9, marginTop: 3 }, close: { color: colors.muted, fontSize: 26 }, inventory: { padding: 12, gap: 7 }, entry: { minHeight: 54, flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 13, padding: 8 }, entryArtwork: { width: 38, height: 38, overflow: 'hidden', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07070d' }, entryName: { color: colors.text, fontSize: 11, fontWeight: '900' }, entryMeta: { color: colors.muted, fontSize: 8, marginTop: 2 }, noItems: { color: colors.muted, padding: 24, textAlign: 'center' }, pickerActions: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, clear: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 11, padding: 10, alignItems: 'center' }, clearText: { color: '#fecdd3', fontSize: 10, fontWeight: '900' }, openBag: { flex: 1, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, borderRadius: 11, padding: 10, alignItems: 'center' }, openBagText: { color: colors.text, fontSize: 10, fontWeight: '900' },
})
