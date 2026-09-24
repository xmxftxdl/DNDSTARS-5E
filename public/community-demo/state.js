export const STORAGE_KEY = 'astral-community-demo-v1';
export const SELF = '旅人';
export function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function initialState() {
  return { balance: 0, checkinDays: [], supported: [], saved: [], posts: [], resources: [], replies: {}, ledger: [] };
}
export function checkIn(state, day = dayKey()) {
  if (state.checkinDays.includes(day)) return { state, message: '今天已经签到，明天再来领取。' };
  return { state: { ...state, balance: state.balance + 2, checkinDays: [...state.checkinDays, day], ledger: [{ reason: '每日签到', amount: 2, day }, ...state.ledger] }, message: '签到成功，获得 2 钱币。' };
}
export function supportTopic(state, topic, day = dayKey()) {
  if (topic.author === SELF) return { state, message: '不能支持自己的主题。' };
  if (state.supported.includes(topic.id)) return { state, message: '已经支持过这个主题。' };
  if (state.balance < 1) return { state, message: '钱币不足，先签到领取 2 钱币吧。' };
  return { state: { ...state, balance: state.balance - 1, supported: [...state.supported, topic.id], ledger: [{ reason: `支持主题：${topic.title}`, amount: -1, day }, ...state.ledger] }, message: '已支持，消耗 1 钱币。支持不直接产生 AI 点数。' };
}
export function loadState(storage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!value || !Number.isSafeInteger(value.balance) || value.balance < 0) return initialState();
    if (!['checkinDays', 'supported', 'saved', 'posts', 'resources', 'ledger'].every(key => Array.isArray(value[key]))) return initialState();
    if (!value.posts.every(p => typeof p.id === 'string' && typeof p.title === 'string' && typeof p.body === 'string' && typeof p.author === 'string' && typeof p.board === 'string' && typeof p.category === 'string')) return initialState();
    if (!value.resources.every(r => typeof r.id === 'string' && typeof r.title === 'string' && typeof r.body === 'string' && typeof r.type === 'string' && typeof r.board === 'string' && typeof r.author === 'string')) return initialState();
    return { ...initialState(), ...value, replies: value.replies && typeof value.replies === 'object' ? value.replies : {} };
  } catch { return initialState(); }
}
