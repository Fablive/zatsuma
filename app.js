/* Zatsuma – app machinery. Ships clean: no data baked in.
   Open with ?demo=1 to play with seeded sample data (kept in a separate storage key). */

const DEMO = new URLSearchParams(location.search).has('demo');
const LS_KEY = DEMO ? 'zatsuma-demo' : 'zatsuma-v1';

const CAT_COLOURS = ['#e62d64', '#ec008b', '#119fe0', '#2d5be6', '#6a4fd8', '#00a887', '#94c11f', '#ffce4e'];
const CAT_EMOJI = ['🎨','💬','🎤','💼','✍️','📚','🛍️','🎁','💐','🏠','🚗','✈️','🍽️','☕','💻','📈','🧘','💅','🐾','🎬','🎵','🌿','✨','💎'];
const DONUT_C = 2 * Math.PI * 38;
/* VALUE is its own built-in category – leaf green, no user category needed.
   Icon is a drawn leaf (Fab's pick – crisper than any emoji at row size). */
const VALUE_CAT = { id: '__value', name: 'Value', color: '#5a9e3d',
  icon: `<svg viewBox="0 0 24 24" style="width:22px;height:22px;display:block">
    <path d="M20 4 C10 4 4 10 4 18 C4 19 4.4 20 5 20 C5.5 20 6 19.6 6.3 19 C8 15 11 11.5 15 9.5 C11.5 12.5 9 16 8 19.5 C8.6 19.8 9.3 20 10 20 C16 20 20 13 20 4 Z" fill="#5a9e3d"/>
  </svg>` };

/* ---------- data ---------- */

let db = load();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY));
    if (d && d.categories && d.entries && d.goals) return d;
  } catch (e) {}
  return { categories: [], entries: [], goals: {} };
}
function save() { localStorage.setItem(LS_KEY, JSON.stringify(db)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

if (DEMO && !db.entries.length && !db.categories.length) {
  const mk = monthKey(new Date());
  const d = n => `${mk}-${String(n).padStart(2, '0')}`;
  const [studio, coaching, speaking] = [
    { id: uid(), name: 'Studio', color: '#e62d64', icon: '🎨' },
    { id: uid(), name: 'Coaching', color: '#119fe0', icon: '💬' },
    { id: uid(), name: 'Speaking', color: '#ffce4e', icon: '🎤' },
  ];
  db.categories = [studio, coaching, speaking];
  db.entries = [
    { id: uid(), amount: 5200, kind: 'money', catId: studio.id, date: d(2) },
    { id: uid(), amount: 2180, kind: 'money', catId: studio.id, date: d(3) },
    { id: uid(), amount: 3958, kind: 'money', catId: coaching.id, date: d(1) },
    { id: uid(), amount: 2500, kind: 'money', catId: coaching.id, date: d(4) },
    { id: uid(), amount: 4612, kind: 'money', catId: speaking.id, date: d(4) },
    { id: uid(), amount: 320, kind: 'value', catId: coaching.id, date: d(3) },
  ];
  db.goals = { [mk]: 20000 };
  save();
}

/* ---------- helpers ---------- */

function monthKey(dt) { return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; }
function monthDate(key) { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1); }
function monthLabel(key) {
  return monthDate(key).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
}
function shiftMonth(key, delta) {
  const d = monthDate(key); d.setMonth(d.getMonth() + delta); return monthKey(d);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmt(n) { return n.toLocaleString('en-GB', { maximumFractionDigits: 2 }); }
function parseAmount(s) {
  const n = parseFloat(String(s).replace(/,/g, '').trim());
  return isFinite(n) && n > 0 ? n : null;
}
function cat(id) { return db.categories.find(c => c.id === id); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function entriesInMonth(mk) { return db.entries.filter(e => e.date.startsWith(mk)); }
function entriesInRange(from, to) { return db.entries.filter(e => e.date >= from && e.date <= to); }
function sum(list) { return list.reduce((t, e) => t + e.amount, 0); }
function moneyOf(list) { return list.filter(e => e.kind === 'money'); }
function valueOf(list) { return list.filter(e => e.kind === 'value'); }

/* per-category money totals, descending */
function catTotals(list) {
  const map = {};
  for (const e of list) map[e.catId] = (map[e.catId] || 0) + e.amount;
  return Object.entries(map)
    .map(([id, total]) => ({ cat: cat(id), total }))
    .filter(x => x.cat)
    .sort((a, b) => b.total - a.total);
}

/* ---------- view state ---------- */

const viewParam = new URLSearchParams(location.search).get('view');
let view = ['home', 'entries', 'goals', 'reports', 'more'].includes(viewParam) ? viewParam : 'home';
let curMonth = monthKey(new Date());
let rep = { type: 'month', anchor: monthKey(new Date()), from: '', to: '' };

const $view = document.getElementById('view');
const $sheet = document.getElementById('sheet');
const $scrim = document.getElementById('scrim');

/* ---------- render ---------- */

function render() {
  document.querySelectorAll('nav.tabs .tab').forEach(t =>
    t.classList.toggle('on', t.dataset.view === view));
  if (view === 'home') renderHome();
  else if (view === 'entries') renderEntries();
  else if (view === 'goals') renderGoals();
  else if (view === 'more') renderMore();
  else renderReports();
}

function monthNavHTML() {
  return `<div class="monthnav">
    <button data-act="prev-month" aria-label="previous month">‹</button>
    <div class="label">${monthLabel(curMonth)}</div>
    <button data-act="next-month" aria-label="next month">›</button>
  </div>`;
}

/* ----- HOME ----- */

function renderHome() {
  const list = entriesInMonth(curMonth);
  const money = sum(moneyOf(list));
  const value = sum(valueOf(list));
  const total = money + value;
  const goal = db.goals[curMonth];
  const left = goal ? Math.max(0, goal - total) : 0;
  /* value counts toward the total and gets its own leaf-green slice */
  const totals = catTotals(moneyOf(list));
  if (value > 0) totals.push({ cat: VALUE_CAT, total: value });

  /* donut segments */
  let segs = '', off = 0;
  for (const { cat: c, total: t } of totals) {
    const len = (t / total) * DONUT_C;
    segs += `<circle r="38" cx="50" cy="50" fill="none" stroke="${c.color}" stroke-width="13"
      stroke-dasharray="${len} ${DONUT_C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 50 50)"/>`;
    off += len;
  }

  const goalArea = goal
    ? `<div class="goalchip"><button class="chip" data-act="edit-goal">GOAL <b>${fmt(goal)}</b>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3l4 4L8 20l-5 1 1-5L17 3z"/></svg>
      </button></div>`
    : `<div class="goalsetter">
        <div class="gs-label">SET A GOAL FOR ${monthLabel(curMonth).split(' ')[0]}</div>
        <div class="gs-row">
          <input id="gs-amt" inputmode="decimal" placeholder="0">
          <button class="btn small" data-act="set-goal-inline">SET</button>
        </div>
      </div>`;

  let cheer;
  if (!db.entries.length && !goal) {
    cheer = `<div class="cheer neutral">Tap + to add the first money that found you 🍊</div>`;
  } else if (!goal) {
    cheer = total > 0 ? `<div class="cheer">${fmt(total)} tracked this month – beautiful ✨</div>` : '';
  } else if (total >= goal) {
    cheer = `<div class="cheer">Goal reached – ${fmt(total)}! 🎉</div>`;
  } else if (total / goal >= 0.75) {
    cheer = `<div class="cheer">Only ${fmt(left)} to go – you can do this! 💥</div>`;
  } else if (total / goal >= 0.5) {
    cheer = `<div class="cheer">Past halfway – ${fmt(left)} to go! 🔥</div>`;
  } else {
    cheer = `<div class="cheer">${fmt(left)} to go – watch it roll in 🍊</div>`;
  }

  $view.innerHTML = `<div class="screen">
    ${monthNavHTML()}
    ${goalArea}
    <div class="donut-wrap"><div class="donut-box">
      <svg class="donut" viewBox="0 0 100 100">
        <circle r="38" cx="50" cy="50" fill="none" stroke="#f1ece1" stroke-width="13"/>
        ${segs}
      </svg>
      <div class="donut-centre"><div class="amt">${fmt(total)}</div></div>
    </div></div>
    <div class="legend">${totals.map(({ cat: c }) =>
      `<span><i style="background:${c.color}"></i>${esc(c.name)}</span>`).join('')}</div>
    <div class="stats">
      <div class="stat money"><div class="k">MONEY</div><div class="v">${fmt(money)}</div></div>
      <div class="stat value"><div class="k">VALUE</div><div class="v">${fmt(value)}</div></div>
      ${goal ? `<div class="stat left"><div class="k">LEFT TO GO</div><div class="v">${fmt(left)}</div></div>` : ''}
    </div>
    ${cheer}
  </div>`;
}

/* ----- ENTRIES ----- */

function renderEntries() {
  const list = entriesInMonth(curMonth).slice().sort((a, b) => b.date.localeCompare(a.date));
  let body;
  if (!list.length) {
    body = `<div class="empty">No entries for ${monthLabel(curMonth).toLowerCase()} yet.<br>Tap + to add one 🍊</div>`;
  } else {
    body = '';
    let lastDay = '';
    for (const e of list) {
      if (e.date !== lastDay) {
        lastDay = e.date;
        const d = new Date(e.date + 'T12:00');
        body += `<div class="daysep">${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric' }).toUpperCase()}</div>`;
      }
      const c = e.kind === 'value' ? VALUE_CAT : (cat(e.catId) || { name: '?', color: '#ccc', icon: '❓' });
      body += `<div class="entryrow" data-entry="${e.id}">
        <div class="ei" style="background:${c.color}26">${c.icon}</div>
        <div class="en"><div class="nm">${esc(c.name)}</div></div>
        <div class="ev ${e.kind}">${fmt(e.amount)}</div>
      </div>`;
    }
  }
  $view.innerHTML = `<div class="screen">${monthNavHTML()}<div style="height:10px"></div>${body}</div>`;
}

/* ----- GOALS ----- */

function renderGoals() {
  const keys = new Set(Object.keys(db.goals));
  for (const e of db.entries) keys.add(e.date.slice(0, 7));
  keys.add(monthKey(new Date()));
  const months = [...keys].sort().reverse();

  const rows = months.map(mk => {
    const goal = db.goals[mk];
    const total = sum(entriesInMonth(mk));
    if (!goal) {
      return `<div class="goalrow nogoal" data-goal-month="${mk}">
        <div class="gr-top"><span class="gm">${monthLabel(mk)}</span>
        <span class="gn"><b>${fmt(total)}</b> · no goal</span></div>
      </div>`;
    }
    const pct = Math.min(100, (total / goal) * 100);
    return `<div class="goalrow" data-goal-month="${mk}">
      <div class="gr-top"><span class="gm">${monthLabel(mk)}</span>
      <span class="gn"><b>${fmt(total)}</b> / ${fmt(goal)}</span></div>
      <div class="bar"><i class="${total >= goal ? 'done' : ''}" style="width:${pct}%"></i></div>
    </div>`;
  }).join('');

  $view.innerHTML = `<div class="screen">
    <div class="screen-title">GOALS</div>
    <div class="addgoal"><button class="btn small ghost" data-act="add-goal">+ SET A GOAL</button></div>
    ${rows || '<div class="empty">No goals yet – set one and watch the money roll in 🍊</div>'}
  </div>`;
}

/* ----- MORE ----- */

const MORE_LINKS = [
  { label: 'All my content, for free', sub: 'YouTube · @stopfckingabout', href: 'https://youtube.com/@stopfckingabout' },
  { label: 'Meet Fab 🐧', sub: 'fabriziacosta.com', href: 'https://fabriziacosta.com' },
];

function renderMore() {
  const startRow = `
    <button class="morerow" data-act="show-start">
      <div class="mr-text"><span class="mr-label">Start here</span><span class="mr-sub">How Zatsuma works</span></div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </button>`;
  const rows = MORE_LINKS.map(l => `
    <a class="morerow" href="${l.href}" target="_blank" rel="noopener">
      <div class="mr-text"><span class="mr-label">${l.label}</span><span class="mr-sub">${l.sub}</span></div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M7 7h10v10"/></svg>
    </a>`).join('');

  $view.innerHTML = `<div class="screen">
    <div class="screen-title">MORE FROM FAB</div>
    ${startRow}
    ${rows}
  </div>`;
}

/* ----- REPORTS ----- */

function repRange() {
  const a = monthDate(rep.anchor);
  const y = a.getFullYear(), m = a.getMonth();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (rep.type === 'month') {
    return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: monthLabel(rep.anchor) };
  }
  if (rep.type === 'quarter') {
    const q = Math.floor(m / 3);
    return { from: iso(new Date(y, q * 3, 1)), to: iso(new Date(y, q * 3 + 3, 0)), label: `Q${q + 1} ${y}` };
  }
  if (rep.type === 'year') {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  }
  if (rep.type === 'all') {
    return { from: '0000-01-01', to: '9999-12-31', label: 'ALL TIME' };
  }
  return { from: rep.from || '0000-01-01', to: rep.to || '9999-12-31', label: 'CUSTOM' };
}

function renderReports() {
  const { from, to, label } = repRange();
  const list = entriesInRange(from, to);
  const money = sum(moneyOf(list));
  const value = sum(valueOf(list));
  const totals = catTotals(moneyOf(list));
  if (value > 0) totals.push({ cat: VALUE_CAT, total: value });
  totals.sort((a, b) => b.total - a.total);
  const max = totals.length ? totals[0].total : 1;

  const chips = ['month', 'quarter', 'year', 'all', 'custom'].map(t =>
    `<button class="${rep.type === t ? 'on' : ''}" data-rep-type="${t}">${t.toUpperCase()}</button>`).join('');

  const nav = ['month', 'quarter', 'year'].includes(rep.type)
    ? `<div class="monthnav">
        <button data-act="rep-prev" aria-label="previous">‹</button>
        <div class="label">${label}</div>
        <button data-act="rep-next" aria-label="next">›</button>
      </div>`
    : rep.type === 'custom'
      ? `<div class="customrange">
          <input type="date" id="rep-from" value="${rep.from}">
          <input type="date" id="rep-to" value="${rep.to}">
        </div>`
      : `<div class="monthnav"><div class="label">${label}</div></div>`;

  const bars = totals.map(({ cat: c, total }) =>
    `<div class="catbar">
      <div class="cb-top">
        <span class="cb-name"><i style="background:${c.color}"></i>${esc(c.name)}</span>
        <span class="cb-amt">${fmt(total)}</span>
      </div>
      <div class="bar"><i style="width:${(total / max) * 100}%;background:${c.color}"></i></div>
    </div>`).join('');

  $view.innerHTML = `<div class="screen">
    <div class="screen-title">REPORTS</div>
    <div class="chips">${chips}</div>
    ${nav}
    <div class="stats">
      <div class="stat"><div class="k">TOTAL</div><div class="v">${fmt(money + value)}</div></div>
      <div class="stat money"><div class="k">MONEY</div><div class="v">${fmt(money)}</div></div>
      <div class="stat value"><div class="k">VALUE</div><div class="v">${fmt(value)}</div></div>
    </div>
    <div class="catbars">${bars || '<div class="empty">Nothing in this period yet.</div>'}</div>
    ${list.length ? `<div class="exportrow"><button class="btn ghost small" data-act="export">EXPORT CSV</button></div>` : ''}
  </div>`;
}

function exportCSV() {
  const { from, to, label } = repRange();
  const list = entriesInRange(from, to).slice().sort((a, b) => a.date.localeCompare(b.date));
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['date', 'type', 'category', 'amount']]
    .concat(list.map(e => [e.date, e.kind,
      e.kind === 'value' ? 'Value' : (cat(e.catId) || { name: '' }).name, e.amount]))
    .map(r => r.map(q).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' }));
  a.download = `zatsuma-${label.toLowerCase().replace(/\s+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- bottom sheets ---------- */

function openSheet(html) {
  $sheet.innerHTML = html;
  $scrim.classList.add('open');
  $sheet.classList.add('open');
}
function closeSheet() {
  $scrim.classList.remove('open');
  $sheet.classList.remove('open');
}

/* ----- entry sheet (add + edit) ----- */

let sheetState = null;

function openEntrySheet(entry) {
  sheetState = {
    mode: entry ? 'edit' : 'add',
    id: entry ? entry.id : null,
    kind: entry ? entry.kind : 'money',
    catId: entry ? entry.catId : (db.categories[0] ? db.categories[0].id : null),
    newCat: { color: CAT_COLOURS[0], icon: CAT_EMOJI[0] },
    showNewCat: !db.categories.length,
  };
  openSheet(`
    <div class="sheet-head">${entry ? 'EDIT ENTRY' : 'ADD ENTRY'}</div>
    <div class="seg">
      <button class="money" data-kind="money">MONEY</button>
      <button class="value" data-kind="value">VALUE</button>
    </div>
    <input class="amt-input" id="e-amt" inputmode="decimal" placeholder="0"
      value="${entry ? entry.amount : ''}">
    <div class="hint" id="kind-hint"></div>
    <div id="catsec">
    <div class="sheet-label">CATEGORY</div>
    <div class="catgrid" id="catgrid"></div>
    <div class="newcat" id="newcat" hidden>
      <div class="sheet-label" style="margin-top:0">NEW CATEGORY</div>
      <input class="name-input" id="nc-name" placeholder="Name" maxlength="24">
      <div class="sheet-label">COLOUR</div>
      <div class="swatches" id="nc-swatches"></div>
      <div class="sheet-label">ICON</div>
      <div class="emojigrid" id="nc-emoji"></div>
      <div class="sheet-actions" style="margin-top:14px">
        <button class="btn small" data-act="create-cat">ADD CATEGORY</button>
      </div>
    </div>
    </div>
    <div class="sheet-label">DATE</div>
    <input type="date" class="date-input" id="e-date" value="${entry ? entry.date : todayStr()}">
    <div class="sheet-actions">
      <button class="btn" data-act="save-entry">SAVE</button>
      ${entry ? '<button class="btn danger" data-act="delete-entry">DELETE</button>' : ''}
    </div>
  `);
  refreshEntrySheet();
  if (!entry) setTimeout(() => document.getElementById('e-amt').focus(), 280);
}

function refreshEntrySheet() {
  const s = sheetState;
  $sheet.querySelectorAll('.seg button').forEach(b =>
    b.classList.toggle('on', b.dataset.kind === s.kind));
  document.getElementById('kind-hint').textContent = s.kind === 'value'
    ? 'Value that came to you – gifts, vouchers, discounts, freebies'
    : 'Money that found you';

  /* VALUE is its own category – no picker needed */
  document.getElementById('catsec').hidden = s.kind === 'value';

  const grid = document.getElementById('catgrid');
  grid.innerHTML = db.categories.map(c => {
    const on = c.id === s.catId;
    return `<button class="catchip" data-cat="${c.id}"
      style="${on ? `background:${c.color};border-color:${c.color};color:#fff` : `border-color:${c.color}55`}">
      ${c.icon} ${esc(c.name)}</button>`;
  }).join('') + `<button class="catchip new" data-act="toggle-newcat">+ NEW</button>`;

  const nc = document.getElementById('newcat');
  nc.hidden = !s.showNewCat;
  if (s.showNewCat) {
    document.getElementById('nc-swatches').innerHTML = CAT_COLOURS.map(c =>
      `<button class="swatch ${c === s.newCat.color ? 'on' : ''}" data-colour="${c}" style="background:${c}"></button>`).join('');
    document.getElementById('nc-emoji').innerHTML = CAT_EMOJI.map(e =>
      `<button class="${e === s.newCat.icon ? 'on' : ''}" data-emoji="${e}">${e}</button>`).join('');
  }
}

function saveEntry() {
  const amount = parseAmount(document.getElementById('e-amt').value);
  const date = document.getElementById('e-date').value;
  if (!amount) { document.getElementById('e-amt').focus(); return; }
  const isValue = sheetState.kind === 'value';
  if (!isValue && !sheetState.catId) { sheetState.showNewCat = true; refreshEntrySheet(); return; }
  if (!date) return;
  const catId = isValue ? null : sheetState.catId;
  if (sheetState.mode === 'edit') {
    const e = db.entries.find(x => x.id === sheetState.id);
    Object.assign(e, { amount, date, kind: sheetState.kind, catId });
  } else {
    db.entries.push({ id: uid(), amount, kind: sheetState.kind, catId, date });
  }
  save();
  curMonth = date.slice(0, 7);
  closeSheet();
  render();
}

/* ----- goal sheet ----- */

function openGoalSheet(mk) {
  const existing = db.goals[mk];
  openSheet(`
    <div class="sheet-head">${existing ? 'EDIT GOAL' : 'SET A GOAL'}</div>
    <div class="sheet-label">MONTH</div>
    <input type="month" class="month-input" id="g-month" value="${mk}">
    <div class="sheet-label">GOAL</div>
    <input class="amt-input" id="g-amt" inputmode="decimal" placeholder="0" value="${existing || ''}">
    <div class="sheet-actions">
      <button class="btn" data-act="save-goal">SAVE</button>
      ${existing ? '<button class="btn danger" data-act="delete-goal">REMOVE</button>' : ''}
    </div>
  `);
  setTimeout(() => document.getElementById('g-amt').focus(), 280);
}

function saveGoal() {
  const mk = document.getElementById('g-month').value;
  const amount = parseAmount(document.getElementById('g-amt').value);
  if (!mk || !amount) return;
  db.goals[mk] = amount;
  save();
  closeSheet();
  render();
}

/* ---------- events ---------- */

document.querySelector('nav.tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab');
  if (t) { view = t.dataset.view; render(); }
});

document.getElementById('fab').addEventListener('click', () => openEntrySheet());
document.getElementById('more-btn').addEventListener('click', () => { view = 'more'; render(); });
$scrim.addEventListener('click', closeSheet);

$view.addEventListener('click', e => {
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'prev-month') { curMonth = shiftMonth(curMonth, -1); render(); }
    if (a === 'next-month') { curMonth = shiftMonth(curMonth, 1); render(); }
    if (a === 'edit-goal') openGoalSheet(curMonth);
    if (a === 'add-goal') openGoalSheet(monthKey(new Date()));
    if (a === 'set-goal-inline') {
      const amount = parseAmount(document.getElementById('gs-amt').value);
      if (amount) { db.goals[curMonth] = amount; save(); render(); }
    }
    if (a === 'rep-prev' || a === 'rep-next') {
      const step = a === 'rep-prev' ? -1 : 1;
      const by = rep.type === 'month' ? 1 : rep.type === 'quarter' ? 3 : 12;
      rep.anchor = shiftMonth(rep.anchor, step * by);
      render();
    }
    if (a === 'export') exportCSV();
    if (a === 'show-start') renderStart();
    return;
  }
  const row = e.target.closest('[data-entry]');
  if (row) { openEntrySheet(db.entries.find(x => x.id === row.dataset.entry)); return; }
  const gr = e.target.closest('[data-goal-month]');
  if (gr) openGoalSheet(gr.dataset.goalMonth);
});

$view.addEventListener('change', e => {
  if (e.target.id === 'rep-from') { rep.from = e.target.value; render(); }
  if (e.target.id === 'rep-to') { rep.to = e.target.value; render(); }
});

$view.addEventListener('click', e => {
  const chip = e.target.closest('[data-rep-type]');
  if (chip) {
    rep.type = chip.dataset.repType;
    if (rep.type === 'custom' && !rep.from) {
      rep.from = `${curMonth}-01`;
      rep.to = todayStr();
    }
    render();
  }
});

$sheet.addEventListener('click', e => {
  const kind = e.target.closest('[data-kind]');
  if (kind) { sheetState.kind = kind.dataset.kind; refreshEntrySheet(); return; }

  const catBtn = e.target.closest('[data-cat]');
  if (catBtn) { sheetState.catId = catBtn.dataset.cat; refreshEntrySheet(); return; }

  const sw = e.target.closest('[data-colour]');
  if (sw) { sheetState.newCat.color = sw.dataset.colour; refreshEntrySheet(); return; }

  const em = e.target.closest('[data-emoji]');
  if (em) { sheetState.newCat.icon = em.dataset.emoji; refreshEntrySheet(); return; }

  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;
  if (a === 'toggle-newcat') {
    sheetState.showNewCat = !sheetState.showNewCat;
    refreshEntrySheet();
    if (sheetState.showNewCat) document.getElementById('nc-name').focus();
  }
  if (a === 'create-cat') {
    const name = document.getElementById('nc-name').value.trim();
    if (!name) { document.getElementById('nc-name').focus(); return; }
    const c = { id: uid(), name, color: sheetState.newCat.color, icon: sheetState.newCat.icon };
    db.categories.push(c);
    save();
    sheetState.catId = c.id;
    sheetState.showNewCat = false;
    refreshEntrySheet();
  }
  if (a === 'save-entry') saveEntry();
  if (a === 'delete-entry') {
    db.entries = db.entries.filter(x => x.id !== sheetState.id);
    save();
    closeSheet();
    render();
  }
  if (a === 'save-goal') saveGoal();
  if (a === 'delete-goal') {
    delete db.goals[document.getElementById('g-month').value];
    save();
    closeSheet();
    render();
  }
});

/* ---------- login gate ----------
   Local mode: the account (email, name, country, consent) is stored on the
   device, and the app itself (all money/value entries) never leaves it either
   way. Alongside that, a copy of the account fields only (never entries) is
   sent to Supabase so Fab has one central signup list. Insert-only from the
   browser via the anon key + RLS – the public key can add a row but can never
   read the list back. */

const SUPABASE_URL = 'https://lmkqxqnlbrxqvesnokra.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxta3F4cW5sYnJ4cXZlc25va3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyODIxMzQsImV4cCI6MjA5ODg1ODEzNH0.FkA85XMCA4IJc8oyG1wQw-mxeOHPd-Y8Pxj1V0RJeuo';

function recordSignup(payload) {
  fetch(`${SUPABASE_URL}/rest/v1/zatsuma_accounts`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(payload),
  }).catch(() => {}); // best-effort; never blocks the local flow
}

const ACC_KEY = 'zatsuma-account-v1';
function account() {
  try { return JSON.parse(localStorage.getItem(ACC_KEY)); } catch (e) { return null; }
}

const PRIV_KEY = 'zatsuma-privacy-ack-v1';
function privacyAcked() { return !!localStorage.getItem(PRIV_KEY); }

const START_KEY = 'zatsuma-start-seen-v1';
function startSeen() { return !!localStorage.getItem(START_KEY); }

function renderStart() {
  const gate = document.getElementById('gate');
  gate.innerHTML = `
    ${document.querySelector('header .logo').outerHTML.replace('class="logo"', 'class="glogo"')}
    <div class="gpriv-title">START HERE</div>
    <div class="gpriv-body">
      <p>Money finds you in all kinds of ways, so tap the + any time it happens. Pick MONEY for cash in, or VALUE for something worth money that isn't cash, like a gifted collab or a freebie.</p>
      <p>Give each entry a category, its own name, colour and little icon, so the donut on HOME tells the story of your month at a glance. Set a goal and watch LEFT TO GO shrink as you go.</p>
      <p><b>ENTRIES</b> is your full list day by day.</p>
      <p><b>GOALS</b> tracks every month's target.</p>
      <p><b>REPORTS</b> breaks it down by month, quarter, year or any custom stretch, and exports to CSV whenever you want it.</p>
    </div>
    <button class="btn" id="start-go">GOT IT, LET'S GO</button>
  `;
  gate.hidden = false;
  document.getElementById('start-go').addEventListener('click', () => {
    localStorage.setItem(START_KEY, new Date().toISOString());
    gate.hidden = true;
  });
}

function renderPrivacy() {
  const gate = document.getElementById('gate');
  gate.innerHTML = `
    ${document.querySelector('header .logo').outerHTML.replace('class="logo"', 'class="glogo"')}
    <div class="gpriv-title">BEFORE YOU DIVE IN</div>
    <div class="gpriv-body">
      <p>Quick thing, because it matters to me: all I ever get is your email, name and country. That's it. That's the bit that just says "you exist."</p>
      <p>Every entry, every goal, every number you type into Zatsuma stays on your phone. It's stored locally in your browser. I don't receive it, I don't store it, I can't see it.</p>
    </div>
    <button class="btn" id="priv-go">GOT IT, LET'S GO</button>
    <div class="gnote">Track whatever you like – it's yours and only yours 🍊</div>
  `;
  gate.hidden = false;
  document.getElementById('priv-go').addEventListener('click', () => {
    localStorage.setItem(PRIV_KEY, new Date().toISOString());
    renderStart();
  });
}

function renderGate() {
  const gate = document.getElementById('gate');
  gate.innerHTML = `
    ${document.querySelector('header .logo').outerHTML.replace('class="logo"', 'class="glogo"')}
    <div class="gword">ZATSUMA</div>
    <div class="gtag">track your open flow of money</div>
    <div class="gdots"><span></span><span></span><span></span><span></span></div>
    <input type="email" id="acc-email" placeholder="your@email.com" autocomplete="email">
    <input type="text" id="acc-name" placeholder="your name" autocomplete="name">
    <input type="text" id="acc-country" placeholder="your country" autocomplete="country-name">
    <label class="consent"><input type="checkbox" id="acc-consent"> Send me Fab's emails 🐧</label>
    <div class="gerr" id="acc-err"></div>
    <button class="btn" id="acc-go">COME ON IN</button>
    <div class="gnote">No passwords here – soon this will email you a magic login link.</div>
  `;
  gate.hidden = false;
  document.getElementById('acc-go').addEventListener('click', () => {
    const email = document.getElementById('acc-email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      document.getElementById('acc-err').textContent = 'That email doesn’t look right yet';
      return;
    }
    const name = document.getElementById('acc-name').value.trim();
    if (!name) {
      document.getElementById('acc-err').textContent = 'Add your name too';
      return;
    }
    const country = document.getElementById('acc-country').value.trim();
    const consent = document.getElementById('acc-consent').checked;
    localStorage.setItem(ACC_KEY, JSON.stringify({ email, name, country, consent, createdAt: new Date().toISOString() }));
    recordSignup({ email, name, country, consent });
    renderPrivacy();
  });
}

if (!DEMO) {
  if (!account()) renderGate();
  else if (!privacyAcked()) renderPrivacy();
  else if (!startSeen()) renderStart();
}
render();
