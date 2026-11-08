import type { Character } from '../../types/character'
import { dnd5eSrdFeatDefinition } from '../../rulesets/dnd5e/feats'
import { dnd5ePluginFeatDefinition } from '../../rulesets/dnd5e/plugins/pluginContentCatalog'

export default function AcquiredFeatsPanel({ character }: { character: Character }) {
  const featIds = [...new Set(character.dnd5eFeatIds ?? [])]
  return (
    <section className="glass rounded-2xl border border-amber-300/15 p-5" aria-label="已获得专长">
      <h3 className="text-lg font-bold text-amber-100">已获得专长</h3>
      {featIds.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">暂无已获得的专长。</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {featIds.map((id) => {
            const feat = dnd5ePluginFeatDefinition(id) ?? dnd5eSrdFeatDefinition(id)
            return (
              <article key={id} className="rounded-xl border border-amber-300/15 bg-amber-500/[0.04] p-4">
                <h4 className="font-semibold text-amber-100">{feat?.name ?? id}</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {feat ? feat.description || feat.summary : '对应规则包未加载，暂时无法显示专长说明。'}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
