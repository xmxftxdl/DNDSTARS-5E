/** Canonical 2014 choice identifiers; labels contain no rule prose.
 * Source: https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment
 */
export const DND5E_TOOL_CHOICES = [
 ['alchemists-supplies','炼金工具'],['brewers-supplies','酿酒工具'],['calligraphers-supplies','书法工具'],['carpenters-tools','木匠工具'],['cartographers-tools','制图工具'],['cobblers-tools','鞋匠工具'],['cooks-utensils','厨师工具'],['glassblowers-tools','玻璃匠工具'],['jewelers-tools','珠宝匠工具'],['leatherworkers-tools','皮匠工具'],['masons-tools','泥瓦匠工具'],['painters-supplies','画家工具'],['potters-tools','陶匠工具'],['smiths-tools','铁匠工具'],['tinkers-tools','修补匠工具'],['weavers-tools','织布工具'],['woodcarvers-tools','木雕工具'],
 ['dice-set','骰子组'],['dragonchess-set','龙棋'],['playing-card-set','纸牌组'],['three-dragon-ante-set','三龙牌'],
 ['bagpipes','风笛'],['drum','鼓'],['dulcimer','扬琴'],['flute','长笛'],['lute','鲁特琴'],['lyre','里拉琴'],['horn','号角'],['pan-flute','排箫'],['shawm','肖姆管'],['viol','维奥尔琴'],
 ['disguise-kit','易容工具'],['forgery-kit','文书伪造工具'],['herbalism-kit','草药工具'],['navigators-tools','领航工具'],['poisoners-kit','制毒工具'],['thieves-tools','盗贼工具'],['vehicles-land','载具（陆地）'],['vehicles-water','载具（水上）'],
].map(([id,label])=>({id,label}))

/** The existing character-setup language list, with shared canonical identifiers. */
export const DND5E_LANGUAGE_CHOICES = [
 ['common','通用语'],['dwarvish','矮人语'],['elvish','精灵语'],['giant','巨人语'],['gnomish','侏儒语'],['goblin','地精语'],['halfling','半身人语'],['orc','兽人语'],
 ['abyssal','深渊语'],['celestial','天界语'],['draconic','龙语'],['undercommon','地底通用语'],['infernal','炼狱语'],['primordial','原初语'],['sylvan','木族语'],['deep-speech','深潜语'],
].map(([id,label])=>({id,label}))
