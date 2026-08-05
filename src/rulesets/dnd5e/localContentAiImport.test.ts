import { describe, expect, it, vi } from 'vitest'
import type { AiProviderRuntimeV1 } from '../../lib/aiProvider'
import { AiProviderRegistryV1 } from '../../lib/aiProvider'
import {
  dnd5eLocalContentAiErrorMessage,
  generateDnd5eLocalContentAiDraft,
  validateDnd5eLocalContentAiDraft,
} from './localContentAiImport'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eContentPackageAutomationCoverageV2 } from './contentPackageV2'
import { dnd5eContentDefinitionsFromPackageV2 } from './activities/dnd5eContentDefinitionProjection'
import { buildDnd5eCustomMonster } from './customMonsterWorkshop'
import { parseDnd5ePastedMonster } from './monsterStatBlockPaste'

function runtime(output: unknown): AiProviderRuntimeV1 {
  return {
    descriptor: {
      schemaVersion: 1,
      id: 'local-test',
      displayName: 'Local Test',
      description: 'Synthetic local test runtime.',
      transport: 'local-bridge',
      status: 'ready',
      dataBoundary: 'local-only',
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
      pricing: {
        mode: 'free-local',
        creditsPerMillionInput: 0,
        creditsPerMillionOutput: 0,
        minimumCredits: 0,
      },
    },
    listModels: async () => [{
      schemaVersion: 1,
      providerId: 'local-test',
      id: 'local-test:model',
      displayName: 'Test Model',
      contextWindowTokens: 32_768,
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
    }],
    generateStructured: vi.fn(async (request) => ({
      schemaVersion: 1 as const,
      jobId: request.jobId,
      providerId: 'local-test',
      modelId: 'local-test:model',
      output,
    })),
  }
}

function routedExternalRuntime(outputs: Record<string, unknown>): AiProviderRuntimeV1 {
  const modelIds = Object.keys(outputs)
  return {
    descriptor: {
      schemaVersion: 1,
      id: 'external-account',
      displayName: 'External Test',
      description: 'Synthetic routed API runtime.',
      transport: 'external-server',
      status: 'ready',
      dataBoundary: 'cloud-processing',
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
      pricing: {
        mode: 'external-account',
        creditsPerMillionInput: 0,
        creditsPerMillionOutput: 0,
        minimumCredits: 0,
      },
    },
    listModels: async () => modelIds.map((id) => ({
      schemaVersion: 1 as const,
      providerId: 'external-account',
      id,
      displayName: id.includes('luna') ? 'GPT-5.6 Luna' : id.includes('terra') ? 'GPT-5.6 Terra' : id,
      contextWindowTokens: 128_000,
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
    })),
    generateStructured: vi.fn(async (request, context) => ({
      schemaVersion: 1 as const,
      jobId: request.jobId,
      providerId: 'external-account',
      modelId: context.model?.id,
      output: outputs[context.model?.id ?? ''],
    })),
  }
}

const selection = {
  schemaVersion: 1 as const,
  providerId: 'local-test',
  modelId: 'local-test:model',
  allowPaidFallback: false,
  maxCreditsPerTask: 0,
}

describe('natural-language local content AI import', () => {
  it('returns a preview draft without installing or executing it', async () => {
    const registry = new AiProviderRegistryV1()
    const provider = runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: 'Draft',
        features: [{
          id: 'steady-focus', name: 'Steady Focus', summary: 'Summary',
          description: 'Concise paraphrase.', automation: 'manual',
        }],
      }),
      assumptions: ['Converted feet without changing the value.'],
      unsupported: ['An ambiguous reaction trigger needs DM review.'],
    })
    registry.register(provider)
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: 'Synthetic rule source.',
      registry,
      selection,
    })
    expect(result).toMatchObject({
      provider: { id: 'local-test', dataBoundary: 'local-only' },
      model: { id: 'local-test:model' },
      estimatedCredits: 0,
      fallback: false,
      draft: {
        assumptions: expect.any(Array),
        unsupported: expect.any(Array),
      },
    })
    expect(provider.generateStructured).toHaveBeenCalledOnce()
    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 16_384 }),
      expect.any(Object),
    )
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.features).toContainEqual(expect.objectContaining({
      id: 'steady-focus',
      automation: 'manual',
    }))
  })

  it('uses Luna first and upgrades to Terra only when the Host rejects an empty draft', async () => {
    const lunaId = 'external:gpt-5.6-luna'
    const terraId = 'external:synthesis:gpt-5.6-terra'
    const provider = routedExternalRuntime({
      [lunaId]: {
        schemaVersion: 1,
        contentJson: JSON.stringify({
          name: '空草稿', version: '1.0.0', races: [], backgrounds: [], features: [], feats: [],
          spells: [], items: [], abilityGenerationMethods: [], headlessActions: [], subclasses: [], monsters: [],
        }),
        assumptions: [],
        unsupported: [],
      },
      [terraId]: {
        schemaVersion: 1,
        contentJson: JSON.stringify({
          name: '升级草稿', version: '1.0.0',
          features: [{
            id: 'ember-focus', name: '余烬专注', summary: '受到火焰伤害后保持专注。',
            description: '由 DM 核对触发条件。', automation: 'manual',
          }],
        }),
        assumptions: [],
        unsupported: [],
      },
    })
    const registry = new AiProviderRegistryV1()
    registry.register(provider)

    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: '新增一个名为余烬专注的自定义特性。',
      registry,
      selection: {
        schemaVersion: 1,
        providerId: 'external-account',
        modelId: terraId,
        allowPaidFallback: false,
        maxCreditsPerTask: 0,
      },
    })

    expect(provider.generateStructured).toHaveBeenCalledTimes(2)
    expect(vi.mocked(provider.generateStructured).mock.calls.map((call) => call[1].model?.id))
      .toEqual([lunaId, terraId])
    expect(result).toMatchObject({
      model: { id: terraId, name: 'GPT-5.6 Terra' },
      routing: {
        primary: { modelId: lunaId, tier: 'luna' },
        fallback: { modelId: terraId, tier: 'terra' },
        fallbackUsed: true,
        fallbackReason: 'empty-content',
      },
    })
    expect(result.draft.assumptions.join('\n')).toContain('已自动升级到 GPT-5.6 Terra 重试')
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.features).toContainEqual(expect.objectContaining({ id: 'ember-focus' }))
  })

  it('does not call Terra when the Luna draft passes the Host gate', async () => {
    const lunaId = 'external:gpt-5.6-luna'
    const terraId = 'external:synthesis:gpt-5.6-terra'
    const validDraft = {
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: 'Luna 草稿', version: '1.0.0',
        features: [{
          id: 'steady-focus', name: '稳定专注', summary: '保持稳定。',
          description: '由 DM 核对。', automation: 'manual',
        }],
      }),
      assumptions: [],
      unsupported: [],
    }
    const provider = routedExternalRuntime({ [lunaId]: validDraft, [terraId]: validDraft })
    const registry = new AiProviderRegistryV1()
    registry.register(provider)
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: '新增稳定专注特性。',
      registry,
      selection: {
        schemaVersion: 1,
        providerId: 'external-account',
        modelId: terraId,
        allowPaidFallback: false,
        maxCreditsPerTask: 0,
      },
    })

    expect(provider.generateStructured).toHaveBeenCalledOnce()
    expect(vi.mocked(provider.generateStructured).mock.calls[0][1].model?.id).toBe(lunaId)
    expect(result).toMatchObject({
      model: { id: lunaId },
      routing: { fallbackUsed: false },
    })
  })

  it('uses the selected spell interface and rejects a model that returns the wrong collection', async () => {
    const provider = runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '错误分类',
        features: [{
          id: 'frost-bolt', name: '霜箭', summary: '错误分类。',
          description: '应当是法术。', automation: 'manual',
        }],
      }),
      assumptions: [],
      unsupported: [],
    })
    const registry = new AiProviderRegistryV1()
    registry.register(provider)

    await expect(generateDnd5eLocalContentAiDraft({
      sourceText: '一个名为霜箭的法术。',
      registry,
      selection,
      targetKind: 'spell',
    })).rejects.toThrow('模型没有生成所选“法术”内容')

    expect(vi.mocked(provider.generateStructured).mock.calls[0][0].userPrompt).toContain('DM 选择的分析接口：法术')
  })

  it('imports a selected declarative class through the V2 Host gate', async () => {
    const provider = runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '职业草稿',
        classes: [{
          schemaVersion: 1,
          id: 'rune-warden',
          name: '符文守卫',
          summary: '使用符文保护同伴的自定义职业。',
          hitDie: 10,
          primaryAbilities: ['str'],
          savingThrows: ['str', 'con'],
          armorProficiencies: ['轻甲', '中甲', '盾牌'],
          weaponProficiencies: ['简易武器', '军用武器'],
          skills: { choiceCount: 2, options: 'any' },
          features: [],
        }],
      }),
      assumptions: [],
      unsupported: [],
    })
    const registry = new AiProviderRegistryV1()
    registry.register(provider)

    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: '创建符文守卫职业。',
      registry,
      selection,
      targetKind: 'class',
    })
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)

    expect(result.targetKind).toBe('class')
    expect(prepared.package.content.classes).toEqual([
      expect.objectContaining({ id: 'rune-warden', hitDie: 10 }),
    ])
    expect(dnd5eContentDefinitionsFromPackageV2(prepared.package)).toContainEqual(
      expect.objectContaining({ kind: 'class', payload: expect.objectContaining({ id: 'rune-warden' }) }),
    )
  })

  it('rejects malformed model output before it reaches the package parser', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({ schemaVersion: 1, contentJson: '{}' }))
    await expect(generateDnd5eLocalContentAiDraft({
      sourceText: 'Synthetic rule source.',
      registry,
      selection,
    })).rejects.toThrow('provider-output-invalid')
  })

  it('uses the Host monster compiler when AI misclassifies one stat block as manual features', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: 'DM 本地规则',
        version: '1.0.0',
        races: [], backgrounds: [],
        features: [{
          id: 'ilifa-staff-strike',
          name: '法杖敲击',
          summary: '近战攻击。',
          description: '模型错误地把怪物动作放进了普通特性。',
          automation: 'manual',
        }],
        feats: [], spells: [], items: [], abilityGenerationMethods: [],
        headlessActions: [], subclasses: [], monsters: [],
      }),
      assumptions: [],
      unsupported: [],
    }))
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: `Ilifa
Medium humanoid, neutral
Armor Class 14
Hit Points 36 (8d8)
Speed 30 ft.
STR DEX CON INT WIS CHA
16 (+3) 12 (+1) 10 (+0) 11 (+0) 13 (+1) 14 (+2)
Senses passive Perception 11
Languages Common
Challenge 2 (450 XP)
不屈战志。当生命值低于10时，其造成的所有伤害额外增加1d6。
Actions
Staff Strike. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 7 (1d6 + 4) bludgeoning damage.`,
      registry,
      selection,
    })
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.features).toEqual([])
    expect(prepared.package.content.monsters).toEqual([
      expect.objectContaining({
        id: 'room-monster:ilifa',
        name: 'Ilifa',
        actions: [expect.objectContaining({
          name: 'Staff Strike',
          automation: 'headless',
          attack: expect.objectContaining({ toHit: 6 }),
        })],
        headlessMechanics: [expect.objectContaining({
          schemaVersion: 2,
          trigger: { event: 'after-dealt-damage' },
          predicates: expect.objectContaining({ hpBelow: 10 }),
          automation: 'full',
        })],
      }),
    ])
    expect(dnd5eContentPackageAutomationCoverageV2(prepared.package).categories['monster-mechanic'])
      .toMatchObject({ total: 2, full: 2, partial: 0, manual: 0 })
    expect(result.draft.assumptions.join('\n')).toContain('Host 已把单一怪物属性块编译为 monsters[0]')
  })

  it('replaces an invalid bare AI monster id with a room-monster id for Chinese AC and HP labels', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '伊利法本地怪物',
        version: '1.0.0',
        races: [], backgrounds: [], features: [], feats: [], spells: [], items: [],
        abilityGenerationMethods: [], headlessActions: [], subclasses: [],
        monsters: [{
          id: 'ilifa-commander-phantom',
          slug: 'ilifa-commander-phantom',
          name: '伊利法统领虚体',
          size: 'Medium',
          armorClass: 14,
          hitPoints: 35,
          skills: {},
          challenge: '3',
        }],
      }),
      assumptions: [],
      unsupported: [],
    }))
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: `伊利法统领虚体
中型类人生物（红龙裔），守序中立
AC：14（法师护甲）
HP：35（5d8+10）
速度：30尺
力量18，敏捷12，体质14，智力16，感知10，魅力19
技能：说服+6，察觉+2，洞悉+2，隐匿+3，运动+6
挑战等级：3
动作
法杖敲击：近战武器攻击，单一目标，命中+6，伤害：8（1d6+4）钝击伤害`,
      registry,
      selection,
    })
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.monsters).toEqual([
      expect.objectContaining({
        id: 'room-monster:ilifa-commander-phantom',
        slug: 'ilifa-commander-phantom',
        size: '中型',
        creatureType: '类人生物（红龙裔）',
        alignment: '守序中立',
        armorClass: { value: 14, note: '法师护甲' },
        hitPoints: { average: 35, dice: '5d8+10' },
        challenge: { rating: '3', xp: 700 },
        skills: [
          expect.objectContaining({ key: 'persuasion', bonus: 6 }),
          expect.objectContaining({ key: 'perception', bonus: 2 }),
          expect.objectContaining({ key: 'insight', bonus: 2 }),
          expect.objectContaining({ key: 'stealth', bonus: 3 }),
          expect.objectContaining({ key: 'athletics', bonus: 6 }),
        ],
      }),
    ])
    expect(result.draft.assumptions.join('\n')).toContain('未通过 Host 校验')
  })

  it('Host-compiles an invalid namespaced monster even when the AI adds a shorthand manifest', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '伊利法本地怪物',
        version: '1.0.0',
        manifest: { publisher: 'Local Test' },
        races: [], backgrounds: [], features: [], feats: [], spells: [], items: [],
        abilityGenerationMethods: [], headlessActions: [], subclasses: [],
        monsters: [{
          id: 'room-monster:ilifa-commanding-wraith',
          slug: 'ilifa-commanding-wraith',
          name: '伊利法统领虚体',
          size: 'Medium',
          creatureType: '',
          alignment: '',
          armorClass: 14,
          hitPoints: 35,
          skills: {},
          senses: {},
          challenge: '3',
        }],
      }),
      assumptions: [],
      unsupported: [],
    }))
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: `伊利法统领虚体
中型类人生物（红龙裔），守序中立
AC：14（法师护甲）
HP：35（5d8+10）
速度：30尺
力量18，敏捷12，体质14，智力16，感知10，魅力19
感官：被动察觉12
语言：通用语，龙语
挑战等级：3
动作
法杖敲击：近战武器攻击，命中+6，伤害：8（1d6+4）钝击伤害`,
      registry,
      selection,
    })
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.monsters).toEqual([expect.objectContaining({
      id: 'room-monster:ilifa-commanding-wraith',
      size: '中型',
      creatureType: '类人生物（红龙裔）',
      alignment: '守序中立',
      armorClass: { value: 14, note: '法师护甲' },
      hitPoints: { average: 35, dice: '5d8+10' },
      senses: expect.any(Array),
      challenge: { rating: '3', xp: 700 },
    })])
    expect(result.draft.assumptions.join('\n')).toContain('未通过 Host 校验')
  })

  it('merges valid AI monster traits that were split at Chinese soft wraps', async () => {
    const sourceText = `伊利法统领虚体
中型类人生物（红龙裔），守序中立
AC：14（法师护甲）
HP：35（5d8+10）
速度：30尺
力量18，敏捷12，体质14，智力16，感知10，魅力19
挑战等级：3
吐息武器：他可以使用动作呼出破坏性的能
量。使用吐息时，他15尺锥状内的每个生物都必须进行一次敏捷豁免（dc14），豁免失
败者将受到2d6点伤害。豁免成功则伤害减 半。
动作
法杖敲击：近战武器攻击，命中+6，伤害：8（1d6+4）钝击伤害`
    const parsed = parseDnd5ePastedMonster(sourceText)
    parsed.draft.slug = 'ilifa-commander-phantom'
    parsed.draft.id = 'room-monster:ilifa-commander-phantom'
    const validMonster = buildDnd5eCustomMonster(parsed.draft)
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: '伊利法本地怪物', version: '1.0.0', races: [], backgrounds: [], features: [], feats: [],
        spells: [], items: [], abilityGenerationMethods: [], headlessActions: [], subclasses: [],
        monsters: [{
          ...validMonster,
          traits: [
            { name: '吐息武器', description: '他可以使用动作呼出破坏性的能', automation: 'dm-adjudication' },
            { name: '量', description: '使用吐息时，他15尺锥状内的每个生物都必须进行一次敏捷豁免（dc14），豁免失', automation: 'dm-adjudication' },
            { name: '败者将受到2d6点伤害', description: '豁免成功则伤害减 半。', automation: 'dm-adjudication' },
          ],
        }],
      }),
      assumptions: [],
      unsupported: [],
    }))

    const result = await generateDnd5eLocalContentAiDraft({ sourceText, registry, selection })
    const content = JSON.parse(result.draft.contentJson) as { monsters: Array<{ traits: Array<{ name: string; description: string }> }> }
    expect(content.monsters[0].traits).toEqual([expect.objectContaining({
      name: '吐息武器',
      description: '他可以使用动作呼出破坏性的能量。使用吐息时，他15尺锥状内的每个生物都必须进行一次敏捷豁免（dc14），豁免失败者将受到2d6点伤害。豁免成功则伤害减半。',
    })])
    expect(result.draft.assumptions.join('\n')).toContain('中文换行误拆的 2 个怪物特性片段')
  })

  it('bounds the draft envelope', () => {
    expect(validateDnd5eLocalContentAiDraft({
      schemaVersion: 1,
      contentJson: '{}',
      assumptions: [],
      unsupported: [],
    })).toBe(true)
    expect(validateDnd5eLocalContentAiDraft({
      schemaVersion: 1,
      contentJson: '{}',
      assumptions: new Array(101).fill('x'),
      unsupported: [],
    })).toBe(false)
  })

  it('shows the concrete upstream HTTP 400 reason when the Bridge provides it', () => {
    expect(dnd5eLocalContentAiErrorMessage(new Error(
      "provider-execution-failed:upstream-400:Unsupported parameter: 'max_tokens'. | unsupported_parameter",
    ))).toBe(
      "模型 API 拒绝了转换请求（HTTP 400）：Unsupported parameter: 'max_tokens'. | unsupported_parameter",
    )
    expect(dnd5eLocalContentAiErrorMessage(new Error(
      'provider-execution-failed:upstream-400',
    ))).toContain('重启 Local AI Bridge')
  })
})
