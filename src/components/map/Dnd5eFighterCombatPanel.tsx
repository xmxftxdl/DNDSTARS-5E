import { Crosshair, HeartPulse, Shield, Sword, Zap } from 'lucide-react'
import {
  FIGHTER_RESOURCE_KEYS,
  dnd5eArmorClass,
  dnd5eWeaponAttackProfile,
  fighterAttacksPerAttackAction,
  fighterResourceState,
} from '../../rulesets/dnd5e'
import type { Dnd5eFighterFeatureId } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'

export default function Dnd5eFighterCombatPanel({ character, canAct, targeting, pending, onAttack, onFeature }: {
  character: Character
  canAct: boolean
  targeting: boolean
  pending: boolean
  onAttack: () => void
  onFeature: (feature: Dnd5eFighterFeatureId) => void
}) {
  const profile = dnd5eWeaponAttackProfile(character)
  const secondWind = fighterResourceState(character, FIGHTER_RESOURCE_KEYS.secondWind)
  const actionSurge = fighterResourceState(character, FIGHTER_RESOURCE_KEYS.actionSurge)
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
            {profile.criticalThreshold < 20 && <Stat label="重击范围" value={`${profile.criticalThreshold}–20`} />}
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
      <div className="rounded-xl border border-white/10 bg-void-900/45 p-4 md:col-span-2">
        <div className="text-sm font-semibold text-slate-200">战士特性</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <FeatureButton
            icon={HeartPulse}
            name="回气"
            detail={`附赠动作 · 恢复 1d10＋${character.level} HP · ${secondWind.current}/${secondWind.max}`}
            disabled={!canAct || pending || character.currentHp <= 0 || character.currentHp >= character.maxHp || secondWind.current < 1}
            onClick={() => onFeature('second-wind')}
          />
          <FeatureButton
            icon={Zap}
            name="动作如潮"
            detail={character.level < 2 ? '2级解锁' : `本回合额外获得一个动作 · ${actionSurge.current}/${actionSurge.max}`}
            disabled={!canAct || pending || character.level < 2 || actionSurge.current < 1}
            onClick={() => onFeature('action-surge')}
          />
        </div>
        {character.level >= 9 && <p className="mt-3 text-xs text-slate-500">不屈资源已记录；将在 5e 豁免请求链接入后开放重骰按钮。</p>}
      </div>
    </div>
  )
}

function FeatureButton({ icon: Icon, name, detail, disabled, onClick }: {
  icon: React.ComponentType<{ className?: string }>
  name: string
  detail: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40">
      <Icon className="h-5 w-5 shrink-0 text-arcane-300" />
      <span><span className="block text-sm font-bold text-slate-200">{name}</span><span className="mt-0.5 block text-xs text-slate-500">{detail}</span></span>
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/[0.04] px-3 py-2"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-0.5 font-semibold text-slate-200">{value}</div></div>
}

function Equipment({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-300">{value}</dd></div>
}
