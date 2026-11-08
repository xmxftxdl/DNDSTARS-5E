export async function buildTempestuousLandingActors(args:{roomId:string;memberId:string;hostMemberId:string}){
 const {normalizeCharacter,projectDnd5eAuthorityCharacterPatch}=await import('../../../store/characters.ts');
 const {applyDnd5eSpellAdvancement,buildDnd5eSpellAdvancementPlanFromSelections}=await import('../../../rulesets/dnd5e/spellAdvancement.ts');
 const {applyDnd5eContentBuildChoicesV1,dnd5eCharacterKnownLanguagesV1}=await import('../../../rulesets/dnd5e/buildChoices.ts');
 const {dnd5ePluginSubclassDefinition,dnd5eCharacterHasPluginFeature,dnd5ePluginFeatureCurrentEnvelopeFullV1}=await import('../../../rulesets/dnd5e/pluginApi.ts');
 const {dnd5ePluginSubclassCurrentEnvelopeFullV1}=await import('../../../rulesets/dnd5e/plugins/pluginContentCatalog.ts');
 const {restoreClassResources}=await import('../../../lib/classResources.ts');
 const {syncDnd5eHitPoints}=await import('../../../rulesets/dnd5e/hitPoints.ts');
 const {applyDnd5eInventoryMutation}=await import('../../../rulesets/dnd5e/items.ts');
 const {dnd5eEffectiveCharacterMovementProfile}=await import('../../../rulesets/dnd5e/characterMovement.ts');
 const subclassId='local.xge.repaired.archer93:storm-sorcery',featureId=subclassId+'.tempestuous-magic';
 let c=normalizeCharacter({id:'storm',name:'Storm Landing',roomId:args.roomId,roomMemberId:args.memberId,charClass:'术士',hitPointMaximumMode:'fixed',level:1,dnd5eClassLevels:{sorcerer:1},abilities:{str:10,dex:12,con:14,int:10,wis:10,cha:16},dnd5eClassChoices:{classes:{sorcerer:{subclass:subclassId,selections:{'class-skills':['arcana','persuasion']}}}}});
 const plan=buildDnd5eSpellAdvancementPlanFromSelections({classId:'sorcerer',fromClassLevel:0,toClassLevel:1,subclassId,selections:c.dnd5eClassChoices!.classes!.sorcerer!.selections});
 if(!plan)throw Error('Actual initial Sorcerer spell plan required');
 const cantrips=plan.cantripOptions.slice(0,plan.targetCantripCount).map(s=>s.id),knownSpells=[...plan.spellOptions.filter(s=>s.id==='mage-armor'),...plan.spellOptions.filter(s=>s.id!=='mage-armor')].slice(0,plan.targetKnownSpellCount).map(s=>s.id);
 const learned=applyDnd5eSpellAdvancement(c,plan,{cantrips,knownSpells},subclassId);if(!learned.ok)throw Error(learned.reason);c=learned.character;
 const sub=dnd5ePluginSubclassDefinition(subclassId);if(!sub)throw Error('Actual registered original subclass required');
 const built=applyDnd5eContentBuildChoicesV1({character:c,contentId:sub.id,advancements:sub.advancements?.filter(a=>a.level<=1)});if(!built.ok)throw Error(built.reason);c=built.character;
 const pouch=applyDnd5eInventoryMutation([c],{type:'grant',characterId:c.id,templateId:'srd-5.1:item:component-pouch',quantity:1});if(!pouch.ok)throw Error(pouch.reason);c=pouch.characters[0];
 c=projectDnd5eAuthorityCharacterPatch(syncDnd5eHitPoints(restoreClassResources(c,'long-rest')),{});
 const companion=projectDnd5eAuthorityCharacterPatch(syncDnd5eHitPoints(restoreClassResources(normalizeCharacter({id:'companion',name:'Landing Spare',roomId:args.roomId,roomMemberId:args.hostMemberId,charClass:'战士',hitPointMaximumMode:'fixed',level:1,dnd5eClassLevels:{fighter:1},abilities:{str:10,dex:10,con:14,int:10,wis:10,cha:10}}),'long-rest')),{});
 const languages=dnd5eCharacterKnownLanguagesV1(c),profile=dnd5eEffectiveCharacterMovementProfile(c);
 if(!languages.includes('primordial')||!knownSpells.includes('mage-armor')||c.dnd5ePluginFeatureIds?.length||!dnd5eCharacterHasPluginFeature(c,featureId)||!dnd5ePluginFeatureCurrentEnvelopeFullV1(featureId)||!dnd5ePluginSubclassCurrentEnvelopeFullV1(subclassId)||profile.flySpeed)throw Error('True Sor1 initial source, MageArmor and no permanent flight required');
 const map={id:'landing-map',name:'Actual ten-foot landing',width:2000,height:1500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'storm-token',characterId:c.id,type:'player' as const,dnd5eSide:'player' as const,label:c.name,x:575,y:375,size:1,color:'#6ac',emoji:'S',hp:c.currentHp,maxHp:c.maxHp},{id:'companion-token',characterId:companion.id,type:'player' as const,dnd5eSide:'player' as const,label:companion.name,x:975,y:725,size:1,color:'#ac6',emoji:'C',hp:companion.currentHp,maxHp:companion.maxHp}]};
 return{characters:[c,companion],map,proof:{level:1,initialBuildGrant:true,noCopiedFeatureIds:true,languages,knownSpells,subclassId,featureId,currentFull:true,baseFly:profile.flySpeed??0,baseHp:c.currentHp,baseResources:c.classResources}};
}
