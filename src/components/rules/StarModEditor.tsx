import { useState } from 'react'
import { readStarModArchive, writeStarModArchive, type StarModPackage } from '../../domain/packages/starmodArchive'
import { localizeEntry, validateCompendiumEntries, type CompendiumEntry } from '../../domain/packages/compendium'
import { parseDnd5eContentPackageV2 } from '../../rulesets/dnd5e/contentPackageV2'
import { legacyPackageCompendium, readDnd5eStarMod, readLegacyDnd5eStarMod } from '../../rulesets/dnd5e/starModAdapter'

type Draft = { baseVersion: string; baseContent: string; entry: CompendiumEntry; name: string; description: string }
const fields: Partial<Record<CompendiumEntry['type'], string>> = {
  Class:'classes', Subclass:'subclasses', Species:'races', Background:'backgrounds', Feat:'feats', Spell:'spells',
  Item:'items', Monster:'monsters', Feature:'features', AbilityGeneration:'abilityGenerationMethods',
}
const control = 'w-full rounded-lg border border-white/15 bg-black/30 p-2 text-sm text-slate-100'

/** Edits stay in a separate local draft until explicitly validated and applied by the Host. */
export default function StarModEditor({ bytes, onApply, onClose }: {
  bytes: ArrayBuffer; onApply(file: File): Promise<void>; onClose(): void
}) {
  const [pkg, setPackage] = useState<StarModPackage | null>(null)
  const [selected, select] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [rules, setRules] = useState('')
  const [version, setVersion] = useState('')
  const [notice, setNotice] = useState('点击载入，查看模块内容及本机保存的覆盖草稿。')
  const [busy, setBusy] = useState(false)
  const key = (p: StarModPackage, e: CompendiumEntry) => `starscar:override:v1:${p.manifest.packageId}:${e.type}:${e.id}`
  const choose = (p: StarModPackage, index: number) => {
    const entry = p.entries[index]
    select(index)
    if (!entry) { setDraft(null); return }
    const text = localizeEntry(entry,p.localizations,'zh-CN')
    let saved: Draft | null = null
    try { saved = JSON.parse(localStorage.getItem(key(p,entry)) ?? 'null') as Draft | null } catch { /* damaged draft is replaced only on explicit save */ }
    if (saved && (saved.entry?.id !== entry.id || saved.entry?.type !== entry.type || saved.entry?.sourcePackageId !== entry.sourcePackageId)) saved = null
    const value = saved ?? {baseVersion:p.manifest.version,baseContent:JSON.stringify([entry,text]),entry:structuredClone(entry),...text}
    setDraft(value); setRules(JSON.stringify(value.entry.rulesData,null,2))
    setNotice(saved?.baseVersion !== undefined && (saved.baseVersion !== p.manifest.version || saved.baseContent !== JSON.stringify([entry,text]))
      ? '原包版本已变化。请核对规则差异，再保存覆盖草稿；不会自动覆盖新版内容。' : saved ? '已恢复独立保存的本地覆盖草稿。' : '正在查看原包；编辑不会直接改变已启用规则。')
  }
  const load = async () => {
    try {
      const value = await readStarModArchive(bytes)
      setPackage(value); setVersion(value.manifest.version); choose(value,0)
    } catch(error) { setNotice(String(error)) }
  }
  const saveDraft = () => {
    if (!pkg || !draft) return
    try {
      const entry = {...draft.entry,rulesData:JSON.parse(rules)}
      validateCompendiumEntries([entry],pkg.manifest.packageId)
      const base = pkg.entries[selected]
      const next = {...draft,entry,baseVersion:pkg.manifest.version,baseContent:JSON.stringify([base,localizeEntry(base,pkg.localizations,'zh-CN')])}
      localStorage.setItem(key(pkg,entry),JSON.stringify(next)); setDraft(next)
      setNotice('覆盖草稿已保存在本机；原包尚未修改。')
    } catch(error) { setNotice(String(error)) }
  }
  const exportValue = async () => {
    if (!pkg || !draft) throw new Error('请先载入模块')
    let next = structuredClone(pkg)
    const changes = pkg.entries.flatMap((base,index) => {
      const edit: Draft | null = index === selected ? {...draft,entry:{...draft.entry,rulesData:JSON.parse(rules)}}
        : JSON.parse(localStorage.getItem(key(pkg,base)) ?? 'null') as Draft | null
      if (!edit) return []
      if(edit.baseVersion !== pkg.manifest.version || edit.baseContent !== JSON.stringify([base,localizeEntry(base,pkg.localizations,'zh-CN')])) throw new Error(`请先核对 ${base.id} 的更新冲突并保存覆盖草稿`)
      if(edit.entry.id !== base.id || edit.entry.type !== base.type || edit.entry.sourcePackageId !== base.sourcePackageId) throw new Error('覆盖条目身份不匹配')
      validateCompendiumEntries([edit.entry],pkg.manifest.packageId)
      return [{index,edit}]
    })
    if (next.compatibility != null) {
      const legacy = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(next.compatibility)).buffer)
      if (!legacy) throw new Error('旧格式兼容数据无效')
      for(const {edit} of changes) {
        const entry=edit.entry, field=fields[entry.type]
        const content = legacy.content as unknown as Record<string, Record<string, unknown>[]>
        const source = entry.rulesData as Record<string, unknown>
        const list = field ? content[field] : undefined
        const index = list?.findIndex(v => (v.id ?? v.slug) === (source.id ?? source.slug)) ?? -1
        if (!list || index < 0) throw new Error('此嵌套条目请通过工坊对应职业或怪物编辑器修改')
        list[index] = {...source,name:edit.name,description:edit.description}
      }
      legacy.manifest.version = version
      const checked = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(legacy)).buffer)
      if (!checked) throw new Error('修改后的规则未通过校验')
      next = legacyPackageCompendium(checked)
    } else {
      next.manifest.version = version
      for(const {index,edit} of changes) {
        const entry=edit.entry
        next.entries = next.entries.map((v,i) => i === index ? {...entry,version} : v)
        next.localizations = {...next.localizations,'zh-CN':{...next.localizations['zh-CN'],[`${entry.localizationKey}.name`]:edit.name,[`${entry.localizationKey}.description`]:edit.description}}
      }
      if (!next.manifest.localizations.includes('zh-CN')) next.manifest.localizations = [...next.manifest.localizations,'zh-CN']
    }
    const output = await writeStarModArchive(next)
    if (!await readLegacyDnd5eStarMod(output)) await readDnd5eStarMod(output)
    return new File([output],`${next.manifest.packageId}.starmod`,{type:'application/zip'})
  }
  const finish = async (apply: boolean) => {
    setBusy(true)
    try {
      const file = await exportValue()
      if (apply) await onApply(file)
      else {
        const url = URL.createObjectURL(file), link = document.createElement('a')
        link.href=url; link.download=file.name; link.click(); URL.revokeObjectURL(url)
      }
      setNotice(apply ? '已提交安装流程，请查看模块管理器结果。' : '已导出覆盖后的模块；原始归档保持不变。')
    } catch(error) { setNotice(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <section className="my-4 space-y-3 rounded-xl border border-violet-400/30 bg-slate-950 p-4" aria-label="模块覆盖编辑器">
    <div className="flex justify-between"><strong>模块内容与本地覆盖</strong><button onClick={onClose} disabled={busy}>关闭</button></div>
    <p className="text-sm text-slate-400" role="status">{notice}</p>
    {!pkg && <button onClick={() => void load()}>载入内容</button>}
    {pkg && <><p className="text-xs text-slate-400">{pkg.manifest.name} · {pkg.manifest.license} · {pkg.manifest.contentSource}</p>
      <select className={control} value={selected} onChange={e => choose(pkg,Number(e.target.value))} aria-label="选择条目">{pkg.entries.map((e,i) => <option value={i} key={`${e.type}:${e.id}`}>{e.type} · {localizeEntry(e,pkg.localizations,'zh-CN').name}</option>)}</select>
      {draft && <><label className="block">显示名称<input className={control} value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})}/></label>
        <label className="block">规则说明<textarea className={control} rows={5} value={draft.description} onChange={e => setDraft({...draft,description:e.target.value})}/></label>
        <label className="block">导出版本<input className={control} value={version} onChange={e => setVersion(e.target.value)}/></label>
        <details><summary>结构化规则数据</summary><textarea aria-label="结构化规则数据" className={`${control} font-mono`} rows={14} value={rules} onChange={e => setRules(e.target.value)}/></details>
        <div className="flex flex-wrap gap-4"><button disabled={busy} onClick={saveDraft}>保存本地覆盖</button>
          <button disabled={busy} onClick={() => {localStorage.removeItem(key(pkg,draft.entry));choose(pkg,selected)}}>恢复原包条目</button>
          <button disabled={busy} onClick={() => void finish(false)}>导出 .starmod</button><button disabled={busy} onClick={() => void finish(true)}>校验并应用</button></div>
      </>}
    </>}
  </section>
}
