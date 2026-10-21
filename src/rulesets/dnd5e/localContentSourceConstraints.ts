import { dnd5eSourceSaveDamageIssues } from './localContentSourceSaveDamage'
import { dnd5eSourceReductionProgressionIssues } from './localContentSourceDiceProgression'

/** Conservative source checks for explicit immunity and roll-scope clauses.
 * This is not general semantic certification and never rewrites generated rules.
 */
export function dnd5eLocalContentSourceConstraintIssues(source:string,contentJson:string,targetKind:string):string[]{
  let content:any
  try{content=JSON.parse(contentJson)}catch{return []}
  if(content==null||typeof content!=='object')return []
  if(targetKind==='subclass')return dnd5eSourceReductionProgressionIssues(source,content)
  if(targetKind!=='spell')return []
  if(!Array.isArray(content.spells)||content.spells.length!==1)return []
  const abilities:Record<string,string>={'力量':'str','敏捷':'dex','体质':'con','智力':'int','感知':'wis','魅力':'cha'}
  const text=source.replace(/\s+/g,'')
  const clauses=[...text.matchAll(/(力量|敏捷|体质|智力|感知|魅力)(?:值)?(?:为)?(\d+)(?:或更低|或以下)的?生物不受(?:该|此|这个|本)?法术(?:的)?影响/g)]
  const activeAreas=(Array.isArray(content.activities)?content.activities:[]).filter((activity:any)=>activity?.target?.kind==='area'&&
    activity.legacySource?.kind==='spell'&&activity.legacySource.id===content.spells[0].id&&
    (activity.invocation?.kind==null||activity.invocation.kind==='active')&&
    (activity.checks?.length||activity.outcomes?.some((outcome:any)=>outcome.operations?.some((operation:any)=>operation.kind!=='manual-adjudication'))))
  const issues=clauses.flatMap(clause=>{
    const threshold=Number(clause[2]),ability=abilities[clause[1]]
    if(threshold<0||threshold>=30)return []
    return activeAreas.filter((activity:any)=>activity.target.minimumAbilityScores?.[ability]!==threshold+1)
      .map((activity:any)=>`原文明示${clause[1]}值${threshold}或更低的生物不受法术影响；Activity ${String(activity.id)} 必须保留 target.minimumAbilityScores:{${ability}:${threshold+1}}，当前配置缺失或改变了此资格限制。`)
  })
  // Conservative initial instantaneous-area clauses only. A runtime safety
  // limit is not a printed target limit; do not rewrite the generated draft.
  const abilityNames = '(?:力量|敏捷|体质|智力|感知|魅力)'
  const allAreaSave = new RegExp(`(?:区域内的?(?:所有|每个)生物|在该线中的生物|除你之外[，,]在你周围\\d+(?:英尺|尺)范围内的生物)必须进行(?:一|1)次${abilityNames}豁免`).test(text)
  if (/持续时间[:：]?(?:立即|瞬间)/.test(text) && allAreaSave) {
    const patterns = (Array.isArray(content.activityPatterns) ? content.activityPatterns : []).filter((pattern:any) =>
      pattern?.source?.kind === 'spell' && pattern.source.id === content.spells[0].id &&
      pattern.pattern === 'roll-effect' && pattern.check?.kind === 'save' && pattern.target?.kind === 'area')
    for (const activity of [...activeAreas, ...patterns]) {
      if (activity.target.selection === 'choose-any') {
        issues.push(`原文明示初始瞬发区域内所有符合条件的生物进行豁免；Activity ${String(activity.id)} 不应改为 target.selection:choose-any。`)
      }
      if (activity.target.maximumTargets != null && activity.target.selection !== 'choose-one') {
        issues.push(`原文明示初始瞬发区域内所有符合条件的生物进行豁免；Activity ${String(activity.id)} 不应添加 target.maximumTargets:${String(activity.target.maximumTargets)}，须省略原文不存在的数量上限。`)
      }
    }
  }
  // A narrow explicit rolled-type mixed-dice clause. Separate damage operations
  // would round resistance twice and create multiple damage reaction windows.
  if (/选择一颗d8投出的数字来决定它的伤害类型/i.test(text) && /2d8\+1d6点伤害/i.test(text)) {
    const casts=(Array.isArray(content.activities)?content.activities:[]).filter((activity:any)=>
      activity?.legacySource?.kind==='spell'&&activity.legacySource.id===content.spells[0].id&&
      activity.checks?.some((check:any)=>check.kind==='attack-roll'))
    if (!casts.length) issues.push('原文的混合骰伤害及远程法术攻击缺少可结算 Activity。')
    for (const activity of casts) {
      for (const check of activity.checks.filter((check:any)=>check.kind==='attack-roll')) {
        if (check.rollMode!=='host-derived'||check.delivery!=='ranged') issues.push(`Activity ${activity.id} 的远程法术攻击必须保留 delivery:ranged 和 rollMode:host-derived，不能固定 normal 忽略实时优势劣势。`)
      }
      if (activity.target?.kind!=='creature'||activity.target.includeSelf!==true) issues.push(`Activity ${activity.id} 原文允许选择范围内生物，未排除施法者；需保留 target.includeSelf:true，重复目标由连锁历史排除。`)
      const damagingOutcomes=(activity.outcomes??[]).filter((outcome:any)=>outcome.operations?.some((operation:any)=>operation.kind==='damage'))
      if (!damagingOutcomes.length) issues.push(`Activity ${activity.id} 缺少原文的2d8+1d6混合伤害。`)
      for (const outcome of damagingOutcomes) {
        const damage=outcome.operations.filter((operation:any)=>operation.kind==='damage')
        if (damage.length!==1||damage[0].amount?.kind!=='add') issues.push(`Activity ${activity.id} 同一次命中的2d8+1d6必须用一个damage操作及add公式结算；拆成多次伤害会错误重复抗性取整、减伤和专注豁免。升环仅增加d6时将d6放在add.values第一项。`)
      }
    }
  }
  // Recognize an explicit source-grounded enemy terrain clause, including PDF
  // line breaks. This guards one omitted condition, not all area semantics.
  const groundedEnemyTerrain = text.match(/当你(?:在|处于)地面上时[，,]你周围(\d+)(?:英尺|尺)的地面对于你的敌人而言是困难地形/)
  if (groundedEnemyTerrain) {
    const radiusFeet = Number(groundedEnemyTerrain[1])
    const activities = (Array.isArray(content.activities) ? content.activities : []).filter((activity:any) =>
      activity?.legacySource?.kind === 'spell' && activity.legacySource.id === content.spells[0].id)
    const groundedArea = activities.some((activity:any) => {
      const targets = [activity.target, ...(activity.choices ?? []).flatMap((choice:any) =>
        (choice.options ?? []).map((option:any) => option.targetOverride))]
      return targets.some((target:any) => target?.kind === 'area' && target.origin === 'self' &&
        target.relation === 'enemy' && target.radiusFeet === radiusFeet) &&
        (activity.outcomes ?? []).some((outcome:any) => (outcome.operations ?? []).some((operation:any) =>
          operation.kind === 'create-persistent-area' && operation.anchorMode === 'source-token' &&
          operation.movementCostMultiplier === 2 && operation.movementRequiresGroundedSource === true))
    })
    if (!groundedArea) issues.push(`原文明示仅在施法者处于地面时，其周围${radiusFeet}尺地面才对敌人成为困难地形；需保留 self/enemy 区域及对应半径、source-token 锚定、movementCostMultiplier:2 和 movementRequiresGroundedSource:true，不能省略持续地面接触条件。`)
  }
  // Only recognize the complete, explicit list. A mere mention of concentration
  // elsewhere in the source must not restrict a separate saving-throw effect.
  const concentrationPenalty=text.match(/投掷(?:一|1)个[dD](4|6|8|10|12|20)[，,。]?每次(?:它|目标|该生物)进行攻击检定[、，,]属性检定和(?:因为)?维持专注进行体质豁免检定时[，,]?(?:它|目标|该生物)?都?要?从结果上减去这个数值/)
  if(concentrationPenalty){
    const sides=Number(concentrationPenalty[1])
    const expected=['attack','ability-check','concentration-save']
    const modifiers=activeAreas.flatMap((activity:any)=>(Array.isArray(activity.effects)?activity.effects:[])
      .flatMap((effect:any)=>(Array.isArray(effect?.modifiers)?effect.modifiers:[])
        .filter((modifier:any)=>modifier?.kind==='roll-dice')
        .map((modifier:any)=>({activityId:activity.id,dice:modifier.dice}))))
    const candidates=modifiers.filter(({dice}:any)=>dice?.direction==='subtract'&&dice?.count===1&&dice?.sides===sides)
    if(!candidates.length)issues.push(`原文明示每次攻击检定、属性检定及维持专注的体质豁免减去1d${sides}；缺少对应的 roll-dice 减值。`)
    for(const {activityId,dice} of candidates){
      const scopes=Array.isArray(dice.appliesTo)?dice.appliesTo:[]
      if(expected.some(scope=>!scopes.includes(scope))||scopes.some((scope:string)=>!expected.includes(scope))){
        issues.push(`原文将1d${sides}减值限定于攻击检定、属性检定及维持专注的体质豁免；Activity ${String(activityId)} 的 dice.appliesTo 必须为 attack、ability-check、concentration-save，不能扩大为普通 saving-throw。`)
      }
    }
  }
  const meleeWeaponRider = text.match(/近战武器攻击(?:在)?(?:击中|命中)(?:时)?(?:会)?造成额外(\d+)[dD](\d+)/)
  if (meleeWeaponRider) {
    const count=Number(meleeWeaponRider[1]),sides=Number(meleeWeaponRider[2])
    const candidates=(Array.isArray(content.activities)?content.activities:[]).filter((activity:any)=>
      ['attack-hit','on-hit'].includes(activity?.invocation?.event) &&
      (activity.outcomes??[]).some((outcome:any)=>(outcome.operations??[]).some((operation:any)=>
        operation.kind==='damage'&&operation.amount?.kind==='dice'&&operation.amount.count===count&&operation.amount.sides===sides)))
    if(candidates.some((activity:any)=>{
      const requirements=activity.requirements??[]
      return !requirements.some((predicate:any)=>predicate.kind==='attack-category'&&predicate.category==='weapon') ||
        !requirements.some((predicate:any)=>predicate.kind==='attack-mode'&&
          predicate.modes?.includes('melee')&&predicate.modes?.includes('unarmed'))
    })) issues.push('原文明示近战武器攻击命中增伤；2014规则包含徒手打击且排除近战法术攻击。对应触发需同时保留 attack-category:weapon 与 attack-mode.modes:[melee,unarmed]，不能仅用 mode:melee。')
  }
  // "Move the area N feet to another space" measures displacement from
  // that area. A caster-centered placement cap is an additional restriction.
  const areaMove=text.match(/你可以(?:将)?移动[^。；;，,]{1,12}?(\d+)(?:英尺|尺)(?:至|到)(?:你可以看见的)?另一个空间/)
  if(areaMove&&!/(?:始终|必须|不能离开)[^。；;]{0,24}(?:距离你|以你为中心|你周围)/.test(text)){
    const distance=Number(areaMove[1])
    for(const activity of Array.isArray(content.activities)?content.activities:[]){
      if(activity?.legacySource?.kind!=='spell'||activity.legacySource.id!==content.spells[0].id||
        activity.target?.kind!=='area'||activity.target.origin!=='point')continue
      const relocation=(activity.outcomes??[]).flatMap((outcome:any)=>outcome?.operations??[])
        .some((operation:any)=>operation?.kind==='relocate-granting-area'&&operation.maximumFeet?.kind==='constant'&&operation.maximumFeet.value===distance)
      if(relocation&&activity.target.placeRangeFeet!=null&&activity.target.rangeOrigin!=='granting-area'){
        issues.push(`原文明示移动区域${distance}尺至另一个空间；Activity ${String(activity.id)} 的选点距离应从所属区域当前位置计算，不能额外限制为施法者周围。请核对 target.rangeOrigin:granting-area。`)
      }
    }
  }
  const light=text.match(/照亮周围(\d+)(?:英尺|尺)半径的区域[，,]并在外围(\d+)(?:英尺|尺)范围内产生微弱的亮光/)
  if(light){
    for(const activity of Array.isArray(content.activities)?content.activities:[]){
      if(activity?.legacySource?.kind!=='spell'||activity.legacySource.id!==content.spells[0].id)continue
      const lights=(activity.effects??[]).flatMap((effect:any)=>effect?.modifiers??[]).filter((modifier:any)=>modifier?.kind==='emitted-light')
      if(lights.some((modifier:any)=>modifier.brightRadiusFeet!==Number(light[1])||modifier.dimRadiusFeet!==Number(light[2])))
        issues.push(`原文明示明亮${light[1]}尺及外围额外微光${light[2]}尺；Activity ${String(activity.id)} 的 emitted-light 距离不符，dimRadiusFeet 是额外距离而非总半径。`)
    }
  }
  const baseDice=[...text.matchAll(/受到(\d+)[dD](\d+)点[^。；;，,]{1,5}伤害/g)]
  const tiers=[...text.matchAll(/(\d+)级[（(](\d+)[dD](\d+)[）)]/g)]
  if(content.spells[0].level===0&&baseDice.length===1&&tiers.length>=2){
    const baseCount=Number(baseDice[0][1]),sides=Number(baseDice[0][2])
    if(tiers.every(row=>Number(row[3])===sides))for(const pattern of Array.isArray(content.activityPatterns)?content.activityPatterns:[]){
      if(pattern?.source?.kind!=='spell'||pattern.source.id!==content.spells[0].id||pattern.pattern!=='roll-effect'||
        pattern.result?.kind!=='damage'||pattern.result.amount?.kind!=='dice'||pattern.result.amount.sides!==sides)continue
      const tables=(pattern.scaling??[]).filter((scale:any)=>scale?.basis==='custom-table'&&scale.classId==null)
      if(tables.length!==1)continue
      const table=Array.isArray(tables[0].table)?tables[0].table:[]
      for(const row of [{level:1,count:baseCount},...tiers.map(tier=>({level:Number(tier[1]),count:Number(tier[2])}))]){
        const step=table.filter((step:any)=>Number.isInteger(step?.level)&&step.level<=row.level).sort((a:any,b:any)=>a.level-b.level).at(-1)?.value??0
        if(!Number.isFinite(step)||pattern.result.amount.count+step!==row.count)
          issues.push(`原文戏法在${row.level}级应为${row.count}d${sides}；Activity pattern ${String(pattern.id)} 的 custom-table.value 是新增步数，不能直接填最终骰数。`)
      }
    }
  }
  issues.push(...dnd5eSourceSaveDamageIssues(source,content))
  return issues
}
