import { boards, topics, resources, categories, resourceTypes } from './data.js';
import { STORAGE_KEY, SELF, loadState, checkIn, supportTopic, dayKey } from './state.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state = loadState({ getItem: key => localStorage.getItem(key) });
let view = 'forum', board = '全部', category = '全部', query = '', sort = 'recommended', openTopic = null;
let toastTimer;
let directory = true;
const allTopics = () => [...state.posts, ...topics].map(topic => topic.category === '开团招募' ? { ...topic, category: '网团招募区' } : topic);
const allResources = () => [...state.resources, ...resources];
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4000); }
function save(next) { state = next; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { toast('浏览器存储不可用，本次操作仅在当前页面保留。'); } render(); }
function modal(title, content) { $('#modal-title').textContent = title; $('#modal-body').innerHTML = content; if (!$('#modal').open) $('#modal').showModal(); }
function closeModal() { $('#modal').close(); openTopic = null; }
function setView(next) { view = next; directory = next === 'forum'; section = null; if (directory) board = '全部'; category = '全部'; query = ''; $('#search').value = ''; render(); }
const forumSections = [
  { name: '招募区', glyph: '⚑', description: '寻找你的下一桌冒险。主持招募、玩家找团，一起把故事开场。', categories: ['网团招募区', '面团招募区'] },
  { name: '新手区', glyph: '✧', description: '第一次接触跑团？从这里开始，提问、交流，认识你的第一位团友。', categories: ['新手求助'] },
  { name: '跑团交流区', glyph: '☷', description: '分享桌上的精彩时刻，交流主持经验、角色故事和原创灵感。', categories: ['跑团战报', '原创分享'] },
  { name: '规则研讨区', glyph: '⚄', description: '讨论规则与玩法，分享理解与房规。发帖时请注明使用的版本。', categories: ['规则讨论'], rules: true },
  { name: '工具与资源区', glyph: '▧', description: '为下一场冒险准备模组、怪物、地图与工具，也让你的创作被更多人看见。', resources: true },
];
let section = null;
function directoryPage() {
  return `<div class="forum-directory"><div class="directory-band"><strong>TRPG 讨论区</strong><span>主题 / 讨论 · 最新帖子</span></div>${forumSections.map((s,index) => {
    const entries = (s.resources ? allResources() : allTopics().filter(t => s.rules ? true : s.categories.includes(t.category))).filter(t => !query || [t.title,t.body,t.author,s.name].join(' ').toLowerCase().includes(query.toLowerCase()));
    const latest = s.resources ? entries[0] : entries.toSorted((a,b) => b.time-a.time)[0];
    const replies = s.resources ? null : entries.reduce((sum,t) => sum+(t.replies || 0)+(state.replies[t.id]?.length || 0),0);
    const links = s.resources ? resourceTypes.filter(c=>c!=='全部').map(c=>`<button data-resource-type="${c}">${c}</button>`).join('') : s.rules ? boards.map(b=>`<button data-board="${b.name}">${b.name}</button>`).join('') : s.categories.map(c=>`<button data-section-filter="${c}">${c}</button>`).join('');
    return `<section class="forum-row"><span class="forum-icon" aria-hidden="true">${s.glyph}</span><div class="forum-description"><h3><button data-section="${index}">${s.name}</button></h3><p>${s.description}</p><div class="forum-sublinks"><span>子版块</span>${links}</div></div><div class="forum-count">${s.resources ? `<span>资源: ${entries.length}</span><span>分类: ${resourceTypes.length - 1}</span>` : `<span>帖子: ${entries.length + replies}</span><span>主题: ${entries.length}</span>`}</div><div class="forum-latest">${latest ? `<div class="latest-by"><strong>${s.resources ? '最新资源' : '最新帖子'}</strong> 由 <span>${esc(latest.author)}</span></div><div class="latest-subject"><span>在</span><button ${s.resources ? 'data-resource' : 'data-topic'}="${esc(latest.id)}" title="${esc(latest.title)}">${esc(latest.title)}</button></div><div class="latest-time">于 ${esc(latest.stamp || '演示投稿（时间未记录）')}</div>` : `<div class="latest-by"><strong>${s.resources ? '最新资源' : '最新帖子'}</strong></div><div class="latest-time">暂无内容，期待你的分享。</div>`}</div></section>`;
  }).join('')}</div><div class="directory-bottom"><span>统计基于当前演示内容，非真实社区活跃数据。</span><button class="text-button" data-section="all">查看全部主题 →</button></div>`;
}
function artwork(resource) {
  const type = ['map','tower','monster','file'].includes(resource.art) ? resource.art : 'file';
  const shapes = {
    map: '<path d="M0 22H420M0 54H420M0 86H420M0 118H420M0 150H420M0 182H420M36 0V220M72 0V220M108 0V220M144 0V220M180 0V220M216 0V220M252 0V220M288 0V220M324 0V220M360 0V220M396 0V220" opacity=".15"/><path d="m0 170 70-40 44 10 41-40 55 9 63-63 52 18 95-40" stroke-width="20" opacity=".2"/><path d="m0 170 70-40 44 10 41-40 55 9 63-63 52 18 95-40" stroke-width="2"/><circle cx="245" cy="98" r="35"/><circle cx="245" cy="98" r="26"/><path d="M222 72 268 124M267 72 223 125M245 58V138M205 98H285"/>',
    tower: '<circle cx="295" cy="48" r="27" fill="currentColor" opacity=".12"/><path d="m0 192 76-36 61 9 85-29 81 23 117-50V220H0" fill="currentColor" opacity=".13"/><path d="m230 158 9-80h35l9 80M231 78h50l-26-23ZM246 51V30M236 101h42M239 112h37M254 157v-24h10v26M0 188q90-22 165 0t160 0 110 0"/><path d="m239 82-99 15M275 82l113 15" opacity=".35"/>',
    monster: '<path d="m263 33-35 23 3 39-27 34 15 68h93l16-67-29-33 3-42Z" fill="currentColor" opacity=".13"/><path d="m263 33-35 23 3 39 32 22 36-20 3-42ZM231 95l-27 34 15 68h93l16-67-29-33M263 117v72M230 140l21-9M275 131l23 10M245 74l10 3M276 77l10-3M232 54l-15-30M294 55l18-29" stroke-width="2"/><circle cx="266" cy="110" r="82" opacity=".2"/>',
    file: '<path d="M194 25h120v173H194ZM204 39h100v144H204M220 58h65M220 75h65M220 92h40M220 156h65"/><path d="m236 137 21-33 20 33Z"/><circle cx="260" cy="117" r="54" opacity=".2"/><path d="M321 46h13v166H213v-8" opacity=".4"/>',
  };
  return `<div class="resource-cover" style="--cover:${esc(resource.color || '#353046')}"><svg viewBox="0 0 420 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="color:#c1b394" fill="none" stroke="currentColor" stroke-width="1">${shapes[type]}</svg><div class="cover-label"><small>${esc(resource.subtitle || 'COMMUNITY CREATION')}</small><strong>${esc(resource.title)}</strong></div></div>`;
}
function supportButton(topic) { const done = state.supported.includes(topic.id); return `<button class="support ${done ? 'selected' : ''}" data-support="${esc(topic.id)}" ${done || topic.author === SELF ? 'disabled' : ''}>${done ? '✦ 已支持' : '✧ 支持 · 1 币'} <span>${(topic.supports || 0) + Number(done)}</span></button>`; }
function bookmark(id) { const saved = state.saved.includes(id); return `<button class="bookmark ${saved ? 'selected' : ''}" data-save="${esc(id)}" aria-label="${saved ? '取消收藏' : '收藏'}" aria-pressed="${saved}">${saved ? '★' : '☆'}</button>`; }
function topicCard(topic) { return `<article class="topic"><span class="avatar ${topic.board === 'COC' ? 'green' : topic.board === '三角机构' ? 'orange' : ''}">${esc(topic.author.slice(0,1))}</span><div class="topic-main"><div class="topic-meta"><span class="tag">${esc(topic.board)}</span><span>${esc(topic.category)}</span>${topic.featured ? '<span class="tag gold">精选</span>' : ''}<span>· ${esc(topic.author)} · ${esc(topic.stamp || '刚刚')}</span></div><button class="topic-title" data-topic="${esc(topic.id)}">${esc(topic.title)}</button><p class="topic-summary">${esc(topic.body.split('\n')[0])}</p><div class="topic-bottom">${supportButton(topic)}<button data-topic="${esc(topic.id)}">◌ ${(topic.replies || 0) + (state.replies[topic.id]?.length || 0)} 条讨论</button>${bookmark(topic.id)}</div></div></article>`; }
function resourceCard(resource) { return `<article class="resource"><button class="resource-cover" data-resource="${esc(resource.id)}" aria-label="查看资源：${esc(resource.title)}">${artwork(resource)}</button><div class="resource-info"><div class="topic-meta"><span class="tag">${esc(resource.board)}</span><span>${esc(resource.type)}</span>${resource.pending ? '<span class="pending">投稿待审核</span>' : '<span>示例作品</span>'}</div><h3><button data-resource="${esc(resource.id)}">${esc(resource.title)}</button></h3><p>${esc(resource.detail || resource.body)}</p><div class="resource-footer"><span>${esc(resource.author)}</span><span>· ${esc(resource.version || '版本待确认')}</span>${bookmark(resource.id)}</div></div></article>`; }
function matches(item) { return (board === '全部' || item.board === board) && (!query || [item.title,item.body,item.author,item.board].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())); }
function rewardPage() { return `<div class="reward-intro">一枚钱币，是对好内容的一次认真支持。<br>签到与社区支持使用钱币；AI 奖励由平台审核贡献后另行发放。</div><div class="reward-grid"><div class="reward-tile"><h3>◈ 我的钱币</h3><strong>${state.balance}</strong><p>每天签到 +2 · 支持主题 −1<br>同一主题限支持一次，不能支持自己。</p><button class="primary" data-action="checkin" ${state.checkinDays.includes(dayKey()) ? 'disabled' : ''}>${state.checkinDays.includes(dayKey()) ? '今日已签到' : '签到领取 2 钱币'}</button></div><div class="reward-tile"><h3>✧ AI 奖励</h3><strong>待开放</strong><p>优质主题、资源创作、答疑与维护均可进入贡献审核。支持数是参考，不自动兑换点数。</p><span class="tag">演示版不发放 AI 点数</span></div></div><div class="reward-rule"><h3>01 / 支持创作，钱币消耗而不转账</h3><p>每次支持扣除 1 钱币，作者获得支持记录与曝光。钱币不转入作者余额，也不按支持数产生 AI 点数，避免小号互刷套取奖励。</p></div><div class="reward-rule"><h3>02 / 好作品与真实参与，都值得奖励</h3><p>原创资源、优质主题、被采纳的答疑、有效问题反馈与持续维护，可以获得贡献认可；精选和 AI 奖励由审核决定，上传不立即发奖。</p></div><div class="reward-rule"><h3>03 / 正式上线的防刷方案</h3><p>签到需验证账户，由服务器按北京时间记账；账户与日期唯一，同一用户与主题支持唯一。新账号设观察期，异常注册与互相支持进入风控复核。奖励设用户及平台预算上限，并保留申诉渠道。</p><p>共享网络仅作风险信号，不单靠 IP 封禁。AI 奖励审核考虑原创性、实际使用和维护，支持量不作为唯一指标。</p></div><div class="inline-note">当前是本地交互原型，没有注册服务、真实审核或防刷后端。本地时间与存储可被修改，不能作为生产账本。</div><h3 class="saved-heading">我的钱币明细</h3>${state.ledger.length ? `<table class="ledger"><thead><tr><th>日期（北京时间）</th><th>事项</th><th>钱币</th></tr></thead><tbody>${state.ledger.map(entry => `<tr><td>${esc(entry.day)}</td><td>${esc(entry.reason)}</td><td>${entry.amount > 0 ? '+' : ''}${esc(entry.amount)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">暂无收支记录，第一次签到从这里开始。</div>'}`; }
function render() {
  document.body.classList.toggle('directory-mode', directory && view === 'forum');
  $('#balance').textContent = state.balance; $('#wallet-top').textContent = `◈ ${state.balance}`;
  const signed = state.checkinDays.includes(dayKey()); $('#checkin').disabled = signed; $('#checkin').textContent = signed ? '今日已签到 · 明天见' : '每日签到 ＋2 钱币';
  document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  $('#board-nav').innerHTML = boards.map(b => `<button class="side-link ${board === b.name ? 'active' : ''}" data-board="${b.name}"><span style="color:${b.color}">${b.glyph}</span><span>${b.name === 'DND' ? 'DND · 龙与地下城' : b.name === 'COC' ? 'COC · 克苏鲁' : b.name}</span></button>`).join('');
  document.querySelector('[data-board="全部"]').classList.toggle('active', board === '全部');
  $('#board-cards').innerHTML = boards.map(b => `<button class="board-card ${board === b.name ? 'active' : ''}" data-board="${b.name}" style="--tint:${b.tint};--color:${b.color}" aria-pressed="${board === b.name}"><span class="sigil">${b.glyph}</span><strong>${b.name === 'DND' ? 'DND · 龙与地下城' : b.name === 'COC' ? 'COC · 克苏鲁' : b.title}</strong><small>${b.en}</small><p>${b.desc}</p></button>`).join('');
  const isResources = view === 'resources', isRewards = view === 'rewards';
  $('#section-title').textContent = isRewards ? '贡献与奖励' : view === 'saved' ? '我的收藏' : `${board === '全部' ? '' : board + ' · '}${isResources ? '资源宝库' : '社区广场'}`;
  $('#section-eyebrow').textContent = isResources ? 'THE CREATOR’S VAULT' : isRewards ? 'GIVE SOMETHING BACK' : view === 'saved' ? 'YOUR COLLECTION' : 'THE COMMON ROOM';
  $('#section-action').textContent = isResources ? '＋ 上传资源' : '＋ 发布主题'; $('#section-action').dataset.action = isResources ? 'upload' : 'compose'; $('#section-action').hidden = isRewards || view === 'saved';
  $('.search-row').style.display = isRewards ? 'none' : 'flex';
  $('#sort').hidden = view === 'saved';
  const choices = isResources ? resourceTypes : categories;
  $('#filters').innerHTML = isRewards || view === 'saved' ? '' : choices.map(c => `<button data-filter="${c}" class="${c === category ? 'active' : ''}">${c}</button>`).join('');
  $('#board-cards').hidden = true;
  if (directory && view === 'forum') {
    $('#section-title').textContent = '星痕论坛';
    $('#section-eyebrow').textContent = 'COMMUNITY / 论坛首页';
    $('#filters').innerHTML = '';
    $('#sort').hidden = true;
    $('#feed').innerHTML = directoryPage();
    return;
  }
  if (view === 'forum' && section) $('#section-title').textContent = section.name;
  if (!isRewards) $('#filters').insertAdjacentHTML('afterbegin','<button data-view="forum" class="directory-back">← 论坛首页</button>');
  if (isRewards) { $('#feed').innerHTML = rewardPage(); return; }
  if (view === 'saved') {
    const posts = allTopics().filter(t => state.saved.includes(t.id) && matches(t)); const items = allResources().filter(r => state.saved.includes(r.id) && matches(r));
    $('#feed').innerHTML = posts.map(topicCard).join('') + (items.length ? `<div class="resource-grid">${items.map(resourceCard).join('')}</div>` : '') || '<div class="empty">这里还没有收藏。<br>点击主题或资源旁的 ☆，把灵感留在这里。</div>'; return;
  }
  if (isResources) {
    let items = allResources().filter(r => matches(r) && (category === '全部' || r.type === category));
    if (sort === 'popular') items = items.toSorted((a,b) => (b.saved || 0) - (a.saved || 0));
    $('#sort').options[2].textContent = '最多收藏';
    $('#feed').innerHTML = items.length ? `<div class="resource-grid">${items.map(resourceCard).join('')}</div>` : '<div class="empty">还没有符合条件的资源。<br>换个分类，或成为第一位创作者。</div>'; return;
  }
  $('#sort').options[2].textContent = '最多支持';
  const items = allTopics().filter(t => matches(t) && (!section || section.rules || section.categories.includes(t.category)) && (category === '全部' || t.category === category)).sort((a,b) => sort === 'latest' ? b.time - a.time : sort === 'popular' ? (b.supports || 0) + Number(state.supported.includes(b.id)) - (a.supports || 0) - Number(state.supported.includes(a.id)) : Number(!!b.featured) - Number(!!a.featured) || b.time - a.time);
  $('#feed').innerHTML = items.map(topicCard).join('') || '<div class="empty">还没有符合条件的主题。<br>换个关键词，或分享你的第一个故事。</div>';
}
function showTopic(id) {
  const t = allTopics().find(item => item.id === id); if (!t) return; openTopic = id;
  const replies = state.replies[id] || [];
  modal(t.title, `<div class="topic-meta"><span class="tag">${esc(t.board)}</span><span>${esc(t.category)} · ${esc(t.author)}</span></div><p>${esc(t.body)}</p><div class="topic-bottom">${supportButton(t)}${bookmark(t.id)}</div><h3 class="saved-heading">讨论 · 本地演示回复</h3>${replies.length ? replies.map(reply => `<div class="reply"><strong>${esc(SELF)}</strong><p>${esc(reply)}</p></div>`).join('') : '<p class="muted">示例列表中的讨论数为展示数据；你写下的回复会保存在此浏览器。</p>'}<form id="reply-form"><label class="field">分享你的看法<textarea name="reply" maxlength="2000" required placeholder="补充经验，或提出一个好问题…"></textarea></label><div class="form-actions"><button class="primary" type="submit">发表回复</button></div></form>`);
}
function showResource(id) {
  const r = allResources().find(item => item.id === id); if (!r) return;
  modal(r.title, `${artwork(r)}<p><span class="tag">${esc(r.board)}</span> ${esc(r.type)} · ${esc(r.author)}</p><p>${esc(r.body)}</p><p>适用版本：${esc(r.version || '待确认')}<br>内容：${esc(r.detail || '待补充')}<br>授权：${esc(r.license || '本站原创演示文案与矢量封面；不含完整可用资源包')}</p>${r.fileName ? `<p>投稿文件：${esc(r.fileName)}（仅保存文件名，文件未上传）</p>` : ''}<div class="inline-note">${r.pending ? '本地投稿已进入待审核状态，不发放钱币或 AI 点数。' : '这是资源页面演示。可收藏和下载示例说明，不会安装插件或导入游戏房间。'}</div><div class="form-actions">${bookmark(r.id)}<button class="secondary" data-download="${esc(r.id)}">下载示例说明</button></div>`);
}
function composer(upload = false) {
  openTopic = null;
  modal(upload ? '分享一份冒险资源' : '向篝火旁的人讲个故事', `<form id="publish-form" data-kind="${upload ? 'resource' : 'topic'}"><div class="inline-note">${upload ? '资源投稿演示：保存介绍和文件名，不上传文件、不发放奖励。' : '本地发帖演示：内容仅在当前浏览器可见，不会公开发布。'}</div><div class="form-grid"><label class="field">规则分区<select name="board">${boards.map(b => `<option ${b.name === board ? 'selected' : ''}>${b.name}</option>`).join('')}</select></label><label class="field">${upload ? '资源类型' : '主题分类'}<select name="category">${(upload ? resourceTypes : categories).filter(c => c !== '全部').map(c => `<option ${c === category ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div><label class="field">标题<input name="title" maxlength="80" required placeholder="一个清楚、具体的标题"></label><label class="field">${upload ? '资源介绍' : '正文'}<textarea name="body" required maxlength="10000" placeholder="分享你的创意、经历与细节…"></textarea></label>${upload ? '<div class="form-grid"><label class="field">适用规则与版本<input name="version" required maxlength="80" placeholder="例如：DND 5e 2024"></label><label class="field">内容规格<input name="detail" required maxlength="120" placeholder="例如：4 人 · 3 小时"></label></div><label class="field">原创声明或授权来源<input name="license" required maxlength="300" placeholder="原创 / 授权链接及允许范围"></label><label class="field">选择文件（仅演示，限 20 MB）<input type="file" name="file" required></label><label class="check-label"><input type="checkbox" required>我确认拥有分享权限，且不包含私人团务或未经允许的个人资料。</label>' : ''}<div class="form-actions"><button type="button" class="secondary" data-action="close">取消</button><button class="primary" type="submit">${upload ? '提交本地审核队列' : '发布到本地演示'}</button></div></form>`);
}
document.addEventListener('click', event => {
  const el = event.target.closest('button'); if (!el || el.disabled) return;
  if (el.dataset.view) { setView(el.dataset.view); return; }
  if (el.dataset.section || el.dataset.sectionFilter || el.dataset.resourceType) {
    directory = false; section = null; board = '全部'; query = ''; $('#search').value = ''; category = '全部';
    if (el.dataset.resourceType) { view = 'resources'; category = el.dataset.resourceType; }
    else if (el.dataset.sectionFilter) { view = 'forum'; category = el.dataset.sectionFilter; }
    else { const chosen = forumSections[Number(el.dataset.section)]; view = chosen?.resources ? 'resources' : 'forum'; section = chosen?.resources ? null : chosen || null; }
    render(); return;
  }
  if (el.dataset.board) { directory = false; section = null; board = el.dataset.board; if (view === 'rewards' || view === 'saved') view = 'forum'; category = '全部'; render(); return; }
  if (el.dataset.filter) { category = el.dataset.filter; render(); return; }
  if (el.dataset.topic) { showTopic(el.dataset.topic); return; }
  if (el.dataset.resource) { showResource(el.dataset.resource); return; }
  if (el.dataset.support) { const t = allTopics().find(item => item.id === el.dataset.support); if (!t) return; const result = supportTopic(state,t); save(result.state); toast(result.message); if (openTopic) showTopic(openTopic); return; }
  if (el.dataset.save) { const id = el.dataset.save; const exists = state.saved.includes(id); save({ ...state, saved: exists ? state.saved.filter(item => item !== id) : [...state.saved,id] }); toast(exists ? '已取消收藏。' : '已加入我的收藏。'); if (openTopic) showTopic(openTopic); else if ($('#modal').open) showResource(id); return; }
  if (el.dataset.download) { const r = allResources().find(item => item.id === el.dataset.download); const blob = new Blob([JSON.stringify({ demo:true,title:r.title,system:r.board,type:r.type,description:r.body,notice:'仅为演示说明，不是可导入的 VTT 资源包。' },null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'astral-resource-demo.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); return; }
  switch (el.dataset.action) {
    case 'close': closeModal(); break;
    case 'checkin': { const result = checkIn(state); save(result.state); toast(result.message); break; }
    case 'compose': composer(); break;
    case 'upload': composer(true); break;
    case 'rules': modal('篝火旁的约定','<p>尊重不同规则与不同的玩法。讨论规则时注明版本，涉及剧情时提前提醒剧透。</p><p>分享作品时注明作者、来源和授权；转载与翻译需拥有相应权限。请不要公开私人团务与其他人的个人信息。</p><p>支持用于表达认可，不进行互刷或批量注册。奖励审核应提供原因与申诉入口。</p>'); break;
    case 'references': modal('设计参考','<p>规则分区参考中文跑团社区的组织方式；讨论区与资源库分开，资源提供类型、版本和作者信息。</p><p><a class="reference-link" href="https://www.goddessfantasy.net/bbs/index.php" target="_blank" rel="noreferrer">纯美苹果园 ↗</a>（本次页面访问受限，未复用内容）</p><p><a class="reference-link" href="https://www.dndbeyond.com/forums" target="_blank" rel="noreferrer">D&D Beyond Forums ↗</a>：规则讨论、主持经验、原创与招募分区。</p><p><a class="reference-link" href="https://pages.roll20.net/dmsguild" target="_blank" rel="noreferrer">DMsGuild × Roll20 ↗</a>：冒险、怪物与地图等内容进入 VTT 的资源组织思路。</p><p>本演示的帖子、人物、资源介绍和矢量封面均为演示创作，非外站搬运。</p>'); break;
  }
});
document.addEventListener('submit', event => {
  const form = event.target; event.preventDefault(); const fields = new FormData(form);
  if (form.id === 'reply-form') { const reply = String(fields.get('reply')).trim(); if (!reply) { toast('请先写下回复内容。'); return; } const id = openTopic; save({...state,replies:{...state.replies,[id]:[...(state.replies[id] || []),reply]}}); showTopic(id); toast('回复已保存到本地。'); return; }
  if (form.id !== 'publish-form') return;
  const title = String(fields.get('title')).trim(), body = String(fields.get('body')).trim(); if (!title || !body) { toast('标题和正文不能只包含空格。'); return; }
  const base = {id:crypto.randomUUID(),title,body,board:String(fields.get('board')),author:SELF};
  if (form.dataset.kind === 'resource') { const file = fields.get('file'); if (!file || file.size > 20 * 1024 * 1024) { toast('请选择不超过 20 MB 的文件。'); return; } const version = String(fields.get('version')).trim(), detail = String(fields.get('detail')).trim(), license = String(fields.get('license')).trim(); if (!version || !detail || !license) { toast('请填写版本、内容规格和授权说明。'); return; } save({...state,resources:[{...base,type:String(fields.get('category')),version,detail,license,fileName:file.name,pending:true,art:'file',color:'#353046'},...state.resources]}); closeModal(); board=base.board; setView('resources'); toast('资源介绍已进入本地审核队列；没有上传文件或发放奖励。'); }
  else { save({...state,posts:[{...base,category:String(fields.get('category')),supports:0,replies:0,stamp:'刚刚',time:Date.now()},...state.posts]}); closeModal(); board=base.board; sort='latest'; $('#sort').value=sort; setView('forum'); directory = false; board = base.board; render(); toast('主题已发布到本地演示。'); }
});
$('#search').addEventListener('input', e => {query=e.target.value.trim();render();});
$('#sort').addEventListener('change', e => {sort=e.target.value;render();});
$('#modal').addEventListener('close', () => {openTopic=null;});
window.addEventListener('storage', e => {if(e.key === STORAGE_KEY){state=loadState(localStorage);render();}});
window.addEventListener('focus', render);
render();
