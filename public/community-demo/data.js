export const boards = [
  { name: 'DND', title: '龙与地下城', en: 'DUNGEONS & DRAGONS', glyph: '♜', color: '#c7aa80', tint: '#352b27', desc: '剑与魔法，和你的下一次大成功' },
  { name: 'COC', title: '克苏鲁的呼唤', en: 'CALL OF CTHULHU', glyph: '◉', color: '#8db7a7', tint: '#20322e', desc: '在不可名状中，寻找真相' },
  { name: '三角机构', title: '三角机构', en: 'TRIANGLE AGENCY', glyph: '△', color: '#d5a081', tint: '#372a28', desc: '日常工作，也可能有些异常' },
  { name: '匕首之心', title: '匕首之心', en: 'DAGGERHEART', glyph: '♧', color: '#baa0d6', tint: '#302638', desc: '希望与恐惧，共同书写故事' },
];
export const categories = ['全部', '规则讨论', '跑团战报', '网团招募区', '面团招募区', '原创分享', '新手求助'];
export const resourceTypes = ['全部', '模组', '怪物', '地图', 'Token', '音效', '插件'];
export const topics = [
  { id:'t1', board:'DND', category:'原创分享', title:'把一座废弃灯塔，变成一个完整的单夜冒险', author:'苔原', body:'海雾、失踪的守灯人，以及每晚准时亮起的灯。分享一个适合 3–5 级队伍的原创遭遇设计。\n\n这次尝试把线索拆成三条互不依赖的路径：港口的传言、礁石上的痕迹、灯塔内部的记录。玩家不需要通过某一次特定检定才能继续前进。\n\n主持准备：先确定守灯人真正想保护的东西，再给每个区域放一个可互动的细节。你们会怎样安排最后一幕？', supports:128, replies:24, featured:true, stamp:'2 小时前', time:6 },
  { id:'t2', board:'DND', category:'规则讨论', title:'隐形不等于消失：你们如何处理看不见的攻击目标？', author:'渡鸦', body:'聊聊桌上的判定习惯：已知位置、猜测格子和视线遮挡，应该怎样向玩家解释清楚？欢迎注明你使用的规则版本和房规。', supports:86, replies:42, stamp:'38 分钟前', time:9 },
  { id:'t3', board:'COC', category:'跑团战报', title:'调查员推开门的时候，我们都以为故事已经结束了', author:'午夜钟声', body:'一次没有战斗的终局，一封始终没有寄出的信。记录这个周末最难忘的三小时。\n\n这是一个原创故事的无剧透战报。最喜欢的时刻，是玩家主动决定留下来照顾那位陌生人。骰子给了结果，但选择留给了角色。', supports:64, replies:18, stamp:'1 小时前', time:8 },
  { id:'t4', board:'三角机构', category:'新手求助', title:'第一次当总经理：怎样让「异常」融入普通的工作日？', author:'第七办公室', body:'准备第一次开团，想从一台永远多印一页的打印机开始。你们会如何铺设线索，让玩家逐渐察觉异常？', supports:32, replies:12, stamp:'3 小时前', time:5 },
  { id:'t5', board:'匕首之心', category:'网团招募区', title:'招募｜周六晚上的森林来信，新手友好的短篇冒险', author:'风铃', body:'4 位玩家的小队，预计两次团完成。偏重角色互动与探索。\n\n时间：周六 20:00–23:00（北京时间）\n交流方式：语音，提供文字辅助\n开团前会一起确认主题边界与角色关系。\n\n演示招募，请勿提交真实联系方式。', supports:27, replies:9, stamp:'4 小时前', time:4 },
  { id:'t6', board:'DND', category:'新手求助', title:'DM 的第一份备团清单：哪些事情值得提前准备？', author:'小满', body:'整理了地图、怪物、角色动机和备用名字。还有哪些容易忽略、却会在桌上用到的小东西？', supports:19, replies:16, stamp:'5 小时前', time:3 },
  { id:'t7', board:'COC', category:'原创分享', title:'一张旧报纸，六条互相矛盾的目击证词', author:'纸页', body:'分享一个原创手递资料的写作思路。把真实线索和人物偏见分开，让调查员从多份记录中拼出事件。', supports:45, replies:7, stamp:'昨天', time:2 },
  { id:'t8', board:'匕首之心', category:'规则讨论', title:'在失败之后，把故事交还给玩家', author:'晨星', body:'一次检定没能达成目标，并不意味着场景停下来。分享几种让后果推动故事的主持方式。', supports:36, replies:11, stamp:'昨天', time:1 },
];
export const resources = [
  {id:'r1',title:'雾港最后的灯塔',subtitle:'THE LAST LIGHT',board:'DND',type:'模组',author:'苔原',body:'一个关于海雾、承诺与守望的单夜冒险。包含场景结构、三个线索入口与主持提示。',version:'5e · 2014 / 2024 需主持适配',detail:'3–5 级 · 3–5 人 · 3 小时',color:'#2a3c40',art:'tower',saved:146},
  {id:'r2',title:'暮色林地 · 遗忘的祭坛',subtitle:'THE FORGOTTEN GROVE',board:'DND',type:'地图',author:'渡鸦',body:'林间古老祭坛，提供方格与无方格版本的展示构想。适合野外遭遇与仪式场景。',version:'系统无关 · 30 × 20 格',detail:'地图概念 · 网格示意',color:'#243c32',art:'map',saved:218},
  {id:'r3',title:'苔石守望者',subtitle:'MOSSBOUND SENTINEL',board:'DND',type:'怪物',author:'石匠',body:'守护遗迹的沉默造物。外观、行为动机与遭遇钩子示例，数值待实测。',version:'DND 5e · 概念草稿',detail:'构装体 · 遗迹守卫',color:'#393c2c',art:'monster',saved:92},
  {id:'r4',title:'雨夜来电',subtitle:'A CALL AFTER MIDNIGHT',board:'COC',type:'模组',author:'午夜钟声',body:'停电之后，一部断线的电话响起。现代都市背景的原创调查开场。',version:'COC 7版 · 概念草稿',detail:'现代 · 2–4 人 · 调查',color:'#293947',art:'tower',saved:84},
  {id:'r5',title:'异常事务档案：B-07',subtitle:'INCIDENT REPORT / B-07',board:'三角机构',type:'模组',author:'第七办公室',body:'你们被派去回收一个从未存在过的部门。包含事件简报与场景灵感。',version:'三角机构 · 概念草稿',detail:'办公室 · 轻度怪诞',color:'#4b3431',art:'file',saved:57},
  {id:'r6',title:'月下归途',subtitle:'A PATH THROUGH HOPE',board:'匕首之心',type:'地图',author:'风铃',body:'一条通向古树的小径，以及沿途尚未熄灭的灯火。适合叙事探索。',version:'系统无关 · 场景概念',detail:'森林 · 月夜 · 场景',color:'#3b3049',art:'map',saved:73},
  {id:'r7',title:'酒馆里的陌生人',subtitle:'FACES BY THE FIRE',board:'DND',type:'Token',author:'纸页',body:'六位原创酒馆常客的头像与角色动机展示。',version:'系统无关 · 头像概念',detail:'NPC · 圆形 Token',color:'#493c2d',art:'monster',saved:41},
  {id:'r8',title:'夜雨与远方的钟声',subtitle:'SOUNDS OF THE CITY',board:'COC',type:'音效',author:'晨星',body:'都市调查的氛围音效编排方案。此演示不包含音频文件。',version:'系统无关 · 编排示例',detail:'环境音 · 无人声',color:'#263b41',art:'file',saved:35},
  {id:'r9',title:'主持人的场景书签',subtitle:'SCENE BOOKMARKS',board:'DND',type:'插件',author:'渡鸦',body:'将地点、人物与场景笔记连接起来的插件设计稿。此演示不提供可安装程序。',version:'星痕 · 兼容性待验证',detail:'工具 · 权限待审核',color:'#353046',art:'file',saved:62},
];
