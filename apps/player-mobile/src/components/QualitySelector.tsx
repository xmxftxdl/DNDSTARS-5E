import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MobileRenderQuality } from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'

const options: Array<{ value: MobileRenderQuality; label: string; detail: string }> = [
  { value: 'lite', label: '流畅', detail: 'DPR 1 · 30 FPS · 零预取' },
  { value: 'standard', label: '标准', detail: '动态 DPR · 视口外 1 圈' },
  { value: 'high', label: '高清', detail: 'DPR 2 · 视口外 2 圈' },
]

export function QualitySelector({ value, onChange }: { value: MobileRenderQuality; onChange: (value: MobileRenderQuality) => void }) {
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === option.value }}
          style={[styles.option, value === option.value && styles.selected]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[styles.label, value === option.value && styles.selectedText]}>{option.label}</Text>
          <Text style={styles.detail}>{option.detail}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 10 },
  option: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: 13 },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  label: { color: colors.text, fontSize: 14, fontWeight: '800' },
  selectedText: { color: '#c4b5fd' },
  detail: { color: colors.muted, fontSize: 11, marginTop: 4 },
})

