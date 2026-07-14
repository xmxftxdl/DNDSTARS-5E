import { Crosshair, Shield, Sword } from 'lucide-react'
import { dnd5eArmorClass, dnd5eWeaponAttackProfile, fighterAttacksPerAttackAction } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'

export default function Dnd5eFighterCombatPanel({ character, canAct, targeting, pending, onAttack }: {
  character: Character
  canAct: boolean
  targeting: boolean
  pending: boolean
  onAttack: () => void
}) {
  const profile = dnd5eWeaponAttackProfile(character)
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_220px]">
      <div className="rounded-xl border border-white/10 bg-void-900/45 p-4">
        <div className="flex items-center gap-2">
          <Sword className="h-5 w-5 text-arcane-300" />
          <div>
            <h3 className="font-bold text-slate-100">武器攻击</h3>
            <p className="text-xs text-slate-500">D&D 5e 2014 · 动作</p>
          </div>
        </div>
        {profile ? (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="武器" value={profile.weaponName} />
            <Stat label="命中加值" value={`${profile.attackModifier >= 0 ? '+' : ''}${profile.attackModifier}`} />
            <Stat label="伤害" value={`${profile.damage.count}d${profile.damage.sides}${profile.damage.bonus >= 0 ? '+' : ''}${profile.damage.bonus}`} />
            <Stat label="攻击次数" value={`${fighterAttacksPerAttackAction(character.level)} 次／动作`} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-rose-300">没有装备可用的 5e 武器。</p>
        )}
        <button
          type="button"
          onClick={onAttack}
          disabled={!canAct || !profile || pending}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${targeting ? 'bg-amber-500 text-void-950' : 'bg-arcane-500/25 text-arcane-100 hover:bg-arcane-500/40'} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <Crosshair className="h-4 w-4" />
          {pending ? '等待 DM 结算…' : targeting ? '请点击地图上的目标' : '选择目标并攻击'}
        </button>
      </div>
      <div className="rounded-xl border border-white/10 bg-void-900/45 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Shield className="h-4 w-4 text-sky-300" />防护与装备</div>
        <dl className="mt-3 space-y-2 text-xs">
          <Equipment label="护甲等级" value={`${dnd5eArmorClass(character)}`} />
          <Equipment label="护甲" value={character.equipment?.armor?.name ?? '未装备'} />
          <Equipment label="副手" value={character.equipment?.offHand?.name ?? '未装备'} />
          <Equipment label="主武器" value={character.equipment?.mainWeapon?.name ?? '未装备'} />
        </dl>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/[0.04] px-3 py-2"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-0.5 font-semibold text-slate-200">{value}</div></div>
}

function Equipment({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-300">{value}</dd></div>
}
