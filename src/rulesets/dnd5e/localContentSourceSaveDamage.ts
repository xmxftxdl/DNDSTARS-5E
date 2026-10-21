/** Narrow source contradiction detector, not general semantic certification. */
export function dnd5eSourceSaveDamageIssues(source: string, content: any): string[] {
  const text=source.replace(/\s+/g,'')
  const abilities:Record<string,string>={力量:'str',敏捷:'dex',体质:'con',智力:'int',感知:'wis',魅力:'cha'}
  const types:Record<string,string>={强酸:'acid',酸蚀:'acid',钝击:'bludgeoning',寒冷:'cold',火焰:'fire',力场:'force',闪电:'lightning',黯蚀:'necrotic',暗蚀:'necrotic',穿刺:'piercing',毒素:'poison',心灵:'psychic',光耀:'radiant',挥砍:'slashing',雷鸣:'thunder'}
  const clauses=[...text.matchAll(/必须通过(?:一|1)次(力量|敏捷|体质|智力|感知|魅力)豁免(?:检定)?[，,]否则受到(\d+)[dD](\d+)点?(强酸|酸蚀|钝击|寒冷|火焰|力场|闪电|黯蚀|暗蚀|穿刺|毒素|心灵|光耀|挥砍|雷鸣)伤害/g)]
  const spellId=content.spells?.[0]?.id
  const issues:string[]=[]
  for(const clause of clauses){
    const [abilityName,,,typeName]=clause.slice(1)
    // Multiple stages and a separate success clause require semantic review.
    // Do not guess which stage an arbitrary success operation belongs to.
    if([...text.matchAll(new RegExp(`${abilityName}豁免`,'g'))].length!==1 ||
      /(?:豁免|检定)成功[^。；;]{0,50}(?:伤害|减半|一半)/.test(text))continue
    const ability=abilities[abilityName],damageType=types[typeName]
    for(const activity of Array.isArray(content.activities)?content.activities:[]){
      if(activity?.legacySource?.kind!=='spell'||activity.legacySource.id!==spellId)continue
      const checks=new Set((Array.isArray(activity.checks)?activity.checks:[])
        .filter((check:any)=>check?.kind==='saving-throw'&&check.ability===ability).map((check:any)=>check.id))
      if(!checks.size)continue
      for(const outcome of Array.isArray(activity.outcomes)?activity.outcomes:[]){
        const conditions=outcome?.when?.kind==='all'?outcome.when.conditions:[outcome?.when]
        if(!Array.isArray(conditions))continue
        const succeeds=conditions.some((c:any)=>c?.kind==='check'&&checks.has(c.checkId)&&['success','critical-success'].includes(c.result))
        if(!succeeds&&outcome?.when?.kind!=='always')continue
        const damage=(Array.isArray(outcome.operations)?outcome.operations:[]).some((op:any)=>op?.kind==='damage'&&
          ['target','all-targets'].includes(op.target)&&op.damageType===damageType&&!(op.amount?.kind==='constant'&&op.amount.value===0))
        if(damage)issues.push(`原文明示通过${abilityName}豁免否则受到${typeName}伤害，未声明成功伤害；Activity ${String(activity.id)} 的 outcome ${String(outcome.id)} 不应在该豁免成功时造成${damageType}伤害。`)
      }
    }
    for(const pattern of Array.isArray(content.activityPatterns)?content.activityPatterns:[]){
      if(pattern?.source?.kind!=='spell'||pattern.source.id!==spellId||pattern.pattern!=='roll-effect'||
        pattern.check?.kind!=='save'||pattern.check.ability!==ability||pattern.result?.kind!=='damage'||pattern.result.damageType!==damageType)continue
      if(pattern.saveSuccess==='half')issues.push(`原文明示通过${abilityName}豁免否则受到${typeName}伤害，未声明成功减半；Activity pattern ${String(pattern.id)} 的 saveSuccess:half 与原文不符。`)
    }
  }
  return [...new Set(issues)]
}
