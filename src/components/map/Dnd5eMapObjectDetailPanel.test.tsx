import { normalizeDnd5eMapObjectStateV1 } from '../../rulesets/dnd5e/mapObjectState'
import type { Token } from '../../store/maps'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Dnd5eMapObjectDetailPanel from './Dnd5eMapObjectDetailPanel'

describe('Dnd5eMapObjectDetailPanel', () => {
  it('shows registered physical item selection and the converted holy water count',()=>{
    const html=renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel,{
      token:{id:'water',label:'Water',x:25,y:25,size:1,type:'obstacle',color:'',emoji:'',dnd5eObjectState:{schemaVersion:1,
        inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:2,receiptId:'conversion:cast:water'}}},
      onUpdate:()=>undefined,onDelete:()=>undefined,onClose:()=>undefined,
    }))
    expect(html).toContain('地图物件物品种类')
    expect(html).toContain('地图物件物品数量')
    expect(html).toContain('value="srd-5.1:item:holy-water-flask" selected=""')
    expect(html).toContain('当前物品：')
    expect(html).toContain('物品仍留在地图上')
  })
  it('exposes all corpse sizes without describing a general creature corpse as animatable', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: { id: 'dragon', label: 'Corpse', x: 25, y: 25, size: 1, type: 'obstacle', color: '', emoji: '',
        dnd5eObjectState: { schemaVersion: 1, remains: { kind: 'creature-corpse', creatureSize: 'gargantuan', creatureType: 'dragon' } } },
      onUpdate: () => undefined, onDelete: () => undefined, onClose: () => undefined,
    }))
    expect(html).toContain('尸体原体型')
    expect(html).toContain('其他生物尸体')
    for (const size of ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']) expect(html).toContain(`value="${size}"`)
    expect(html).toContain('不会据此推断为小型或中型类人生物')
    expect(html).not.toContain('会在原格生成一具僵尸')
  })
  it('shows ground strike damage without claiming untracked terrain was destroyed', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: { id: 'stone', label: 'Stone', x: 25, y: 75, size: 1, type: 'obstacle', color: '', emoji: '', hp: 14,
        dnd5eObjectState: { schemaVersion: 1, groundImpact: { actionId: 'a', operationId: 'o', surfaceId: 'ground', damage: 6, x: 25, y: 75, elevationFeet: 0 } } },
      onUpdate: () => undefined, onDelete: () => undefined, onClose: () => undefined,
    }))
    expect(html).toContain('最近撞地')
    expect(html).toContain('地表未记录耐久，不自动改变地形')
  })
  it('distinguishes unrecorded object weight from an explicit fractional weight', () => {
    for (const weightPounds of [undefined, 0.5]) {
      const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
        token: { id: 'stone', label: 'Stone', x: 100, y: 100, color: '#777', emoji: 'S', size: 1, type: 'obstacle',
          dnd5eObjectState: { schemaVersion: 1, weightPounds } },
        onUpdate: () => undefined, onDelete: () => undefined, onClose: () => undefined,
      }))
      const weightInput = html.match(/<input[^>]*aria-label="地图物件重量（磅）"[^>]*>/)?.[0]
      expect(weightInput).toContain(`value="${weightPounds ?? ''}"`)
      expect(weightInput).toContain('placeholder="未记录"')
    }
  })
  it('shows classified vegetation and retains the magic exclusion after reload', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: { id: 'tree', label: 'Tree', x: 100, y: 100, color: '#777', emoji: 'T', size: 1, type: 'obstacle',
        dnd5eObjectState: { schemaVersion: 1, vegetation: 'dead', magical: true } },
      onUpdate: () => undefined, onDelete: () => undefined, onClose: () => undefined,
    }))
    expect(html).toContain('value="dead-vegetation" selected=""')
    expect(html).toContain('植物已枯死；实体与耐久保留。')
    expect(html).toContain('此物体具有魔法性质')
  })
  it('让 DM 从地图 UI 看见食物种类与全部污染状态', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: {
        id: 'object', label: '污染餐桌', x: 100, y: 100, color: '#94a3b8', emoji: '🪨',
        size: 2, type: 'obstacle',
        dnd5eObjectState: {
          schemaVersion: 1,
          consumable: { kind: 'food', contaminants: ['poison', 'disease'] },
        },
      },
      onUpdate: () => undefined,
      onDelete: () => undefined,
      onClose: () => undefined,
    }))

    expect(html).toContain('地图物件用途')
    expect(html).toContain('地图物件体型')
    expect(html).toContain('大型（2×2 格）')
    expect(html).toContain('非魔法食物')
    expect(html).toContain('毒素污染')
    expect(html).toContain('疾病污染')
    expect(html).toContain('当前：毒素、疾病')
    expect(html).toContain('物件耐久与法术属性')
    expect(html).toContain('地图物件当前耐久')
    expect(html).toContain('地图物件最大耐久')
    expect(html).toContain('魔法物件（不受粉碎音波的物件伤害）')
    expect(html).toContain('被穿戴或携带（不属于无人持有物件）')
  })

  it('让 DM 把地图物件标记为操纵死尸可识别的遗骸', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: {
        id: 'bones', label: '骨骸堆', x: 100, y: 100, color: '#94a3b8', emoji: '🦴',
        size: 1, type: 'obstacle',
        dnd5eObjectState: { schemaVersion: 1, remains: { kind: 'bone-pile' } },
      },
      onUpdate: () => undefined,
      onDelete: () => undefined,
      onClose: () => undefined,
    }))
    expect(html).toContain('骨骸堆（操纵死尸 → 骷髅）')
    expect(html).toContain('操纵死尸遗骸目标')
    expect(html).toContain('在原格生成一具骷髅')
  })

  it('显示造物术材质、升环尺寸、持续时间与材料禁用规则', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: {
        id: 'created', label: '宝石镶嵌木箱', x: 100, y: 100, color: '#a78bfa', emoji: '📦',
        size: 5, type: 'obstacle',
        dnd5eObjectState: {
          schemaVersion: 1,
          creation: {
            schemaVersion: 1,
            sourceTokenId: 'caster-token', sourceCharacterId: 'caster', sourceActionId: 'cast-1',
            slotLevel: 9, objectDescription: '宝石镶嵌木箱', materials: ['plant', 'gemstone'],
            edgeFeet: 25, createdWorldMinute: 100, expiresAtWorldMinute: 110,
            cannotBeSpellMaterial: true,
          },
        },
      },
      onUpdate: () => undefined,
      onDelete: () => undefined,
      onClose: () => undefined,
    }))
    expect(html).toContain('造物术制造物')
    expect(html).toContain('9 环 · 立方边长：25 尺')
    expect(html).toContain('植物材料、宝石')
    expect(html).toContain('持续：10 分钟')
    expect(html).toContain('不能作为其他法术的材料成分')
    expect(html).toContain('5×5 格')
  })

  it('让 DM 在地图物件详情中配置造水／枯水术的敞开容器和水量', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: {
        id: 'cistern', label: '敞口蓄水池', x: 100, y: 100, color: '#22d3ee', emoji: '🪣',
        size: 2, type: 'obstacle',
        dnd5eObjectState: {
          schemaVersion: 1,
          consumable: { kind: 'drink', contaminants: [] },
          waterContainer: { schemaVersion: 1, open: true, capacityGallons: 50, waterGallons: 20 },
        },
      },
      onUpdate: () => undefined,
      onDelete: () => undefined,
      onClose: () => undefined,
    }))
    expect(html).toContain('储水容器')
    expect(html).toContain('储水容器敞开')
    expect(html).toContain('储水容器容量（加仑）')
    expect(html).toContain('储水容器当前水量（加仑）')
    expect(html).toContain('当前：20/50 加仑 · 敞开')
  })
})


it('authors object AC and defenses while preserving unrelated object state', () => {
 let token: Token = {id:'chest',label:'Chest',type:'obstacle',x:25,y:25,size:1,color:'',emoji:'',hp:20,maxHp:20,
  dnd5eObjectState:{schemaVersion:1,locked:true,weightPounds:5}}
 const input = (label: string) => {
  const tree = Dnd5eMapObjectDetailPanel({ token, onUpdate: patch => {token={...token,...patch}}, onDelete:()=>{}, onClose:()=>{} })
  const find = (node: any): any => {
   if (!node || typeof node !== 'object') return undefined
   if (Array.isArray(node)) {for(const child of node){const match=find(child);if(match)return match}return undefined}
   if (node.props?.['aria-label']===label)return node
   return find(node.props?.children)
  }
  const result=find(tree)
  expect(result, label).toBeDefined()
  return result.props
 }
 expect(input('地图物件护甲等级').value).toBe('')
 expect(input('地图物件伤害阈值').disabled).toBe(true)
 input('地图物件护甲等级').onChange({target:{value:'17'}})
 input('地图物件伤害阈值').onChange({target:{value:'5'}})
 input('物件光耀抗性').onChange({target:{checked:true}})
 input('物件火焰易伤').onChange({target:{checked:true}})
 expect(normalizeDnd5eMapObjectStateV1(JSON.parse(JSON.stringify(token.dnd5eObjectState)))).toMatchObject({
  locked:true,weightPounds:5,combatProfile:{armorClass:17,damageThreshold:5,damageResistances:['radiant'],damageVulnerabilities:['fire']}})
 expect(input('物件光耀抗性').checked).toBe(true)
 const before=structuredClone(token)
 input('地图物件护甲等级').onChange({target:{value:'0'}})
 input('地图物件伤害阈值').onChange({target:{value:'-1'}})
 expect(token).toEqual(before)
 input('物件光耀抗性').onChange({target:{checked:false}})
 expect(input('物件光耀抗性').checked).toBe(false)
 input('地图物件护甲等级').onChange({target:{value:''}})
 expect(token.dnd5eObjectState?.combatProfile).toBeUndefined()
 expect(token.dnd5eObjectState?.locked).toBe(true)
})

it('shows the saved scene feature classification to the DM', () => {
 const html=renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel,{
  token:{id:'tree',label:'Tree',x:100,y:100,color:'#777',emoji:'',size:1,type:'obstacle',dnd5eObjectState:{schemaVersion:1,naturalFeature:'tree'}},
  onUpdate:()=>undefined,onDelete:()=>undefined,onClose:()=>undefined,
 }))
 expect(html).toContain('地图自然地物')
 expect(html).toContain('value="tree" selected=""')
 expect(html).toContain('草丛／灌木')
})
