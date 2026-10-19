const starter = [
  { id: 'T-101', name: 'Vegetable washing', category: 'Preparation', arrival: 0, burst: 8 },
  { id: 'T-102', name: 'Bottle labeling', category: 'Labeling', arrival: 1, burst: 5 },
  { id: 'T-103', name: 'Quality inspection', category: 'Quality control', arrival: 2, burst: 12 },
  { id: 'T-104', name: 'Food weighing', category: 'Preparation', arrival: 3, burst: 6 },
  { id: 'T-105', name: 'Sealing packages', category: 'Packaging', arrival: 4, burst: 15 },
  { id: 'T-106', name: 'Carton packing', category: 'Packaging', arrival: 5, burst: 9 }
];
let tasks = starter.map(t => ({ ...t })), scheduled = [], blocks = [], makespan = 0, counter = 107, mode = 'np';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Non-preemptive Shortest Job First ----------
   1. At the current time, collect tasks that have already arrived.
   2. Pick the one with the smallest burst time (tie: earlier arrival, then ID).
   3. Run it to completion (no interruption).
   4. If nothing has arrived yet, the line stays idle until the next arrival.
   Waiting = start - arrival | Turnaround = completion - arrival            */
function calculate() {
  if (mode === 'p') return calculatePreemptive();
  let pending = tasks.map(t => ({ ...t }));
  let clock = 0, order = 0;
  scheduled = [];
  blocks = [];

  const pick = (a, b) =>
    a.burst - b.burst ||
    a.arrival - b.arrival ||
    a.id.localeCompare(b.id, undefined, { numeric: true });

  while (pending.length) {
    let ready = pending.filter(t => t.arrival <= clock);

    if (!ready.length) {
      const next = Math.min(...pending.map(t => t.arrival));
      blocks.push({ idle: true, start: clock, end: next });
      clock = next;
      ready = pending.filter(t => t.arrival <= clock);
    }

    ready.sort(pick);
    const t = ready[0];
    pending = pending.filter(p => p !== t);

    const start = clock;
    const completion = start + t.burst;
    const row = {
      ...t,
      order: ++order,
      start,
      completion,
      waiting: start - t.arrival,
      turnaround: completion - t.arrival
    };
    scheduled.push(row);
    blocks.push({ idle: false, task: row, start, end: completion });
    clock = completion;
  }

  makespan = clock;
  render();
}

/* ---------- Preemptive Shortest Job First (Shortest Remaining Time First) ----------
   1. At every moment, collect tasks that have arrived and still have time left.
   2. Run the one with the least REMAINING time (tie: earlier arrival, then ID).
   3. Run until it finishes or until the next task arrives, then decide again,
      so a newly arrived shorter task can interrupt (preempt) the running one.
   4. If nothing is ready, the line stays idle until the next arrival.
   Start = first time the task runs | Turnaround = completion - arrival
   Waiting = turnaround - burst | Order = order of completion                 */
function calculatePreemptive() {
  const rem = new Map(tasks.map(t => [t.id, t.burst]));
  const first = new Map(), done = new Map();
  const slices = [];
  let clock = 0, left = tasks.length;
  blocks = [];

  const pick = (a, b) =>
    rem.get(a.id) - rem.get(b.id) ||
    a.arrival - b.arrival ||
    a.id.localeCompare(b.id, undefined, { numeric: true });

  while (left) {
    const ready = tasks.filter(t => t.arrival <= clock && rem.get(t.id) > 0);
    if (!ready.length) {
      const next = Math.min(...tasks.filter(t => rem.get(t.id) > 0).map(t => t.arrival));
      blocks.push({ idle: true, start: clock, end: next });
      clock = next;
      continue;
    }
    ready.sort(pick);
    const t = ready[0];
    const arrivals = tasks.filter(x => x.arrival > clock).map(x => x.arrival);
    const until = Math.min(clock + rem.get(t.id), arrivals.length ? Math.min(...arrivals) : Infinity);
    if (!first.has(t.id)) first.set(t.id, clock);
    rem.set(t.id, rem.get(t.id) - (until - clock));
    slices.push({ t, start: clock, end: until });
    clock = until;
    if (rem.get(t.id) === 0) { done.set(t.id, clock); left--; }
  }

  scheduled = tasks.map(t => ({
    ...t,
    start: first.get(t.id),
    completion: done.get(t.id),
    turnaround: done.get(t.id) - t.arrival,
    waiting: done.get(t.id) - t.arrival - t.burst
  })).sort((a, b) => a.completion - b.completion || a.id.localeCompare(b.id, undefined, { numeric: true }));
  scheduled.forEach((r, i) => r.order = i + 1);

  // Gantt: merge back-to-back slices of the same task, keep idle gaps
  const byId = new Map(scheduled.map(r => [r.id, r]));
  const timeline = [...blocks.map(b => ({ ...b })), ...slices.map(s => ({ idle: false, task: byId.get(s.t.id), start: s.start, end: s.end }))]
    .sort((a, b) => a.start - b.start);
  blocks = [];
  timeline.forEach(b => {
    const last = blocks[blocks.length - 1];
    if (last && !b.idle && !last.idle && last.task === b.task && last.end === b.start) last.end = b.end;
    else blocks.push(b);
  });

  makespan = clock;
  render();
}

function metrics() {
  const n = scheduled.length || 1;
  return {
    total: tasks.length,
    burst: scheduled.reduce((s, t) => s + t.burst, 0),
    wait: scheduled.reduce((s, t) => s + t.waiting, 0) / n,
    turn: scheduled.reduce((s, t) => s + t.turnaround, 0) / n
  };
}

function render() {
  saveData();
  const m = metrics();
  $('total').textContent = m.total;
  $('avgWait').textContent = m.wait.toFixed(1);
  $('avgTurn').textContent = m.turn.toFixed(1);
  $('totalBurst').textContent = m.burst;
  $('reportWait').textContent = m.wait.toFixed(1) + ' ms';
  $('reportTurn').textContent = m.turn.toFixed(1) + ' ms';
  const max = Math.max(1, ...scheduled.map(t => t.burst));

  $('queue').innerHTML = scheduled.map(t => `<div class="queue-row"><span class="order">${t.order}</span><div><div class="task-name">${esc(t.name)}</div><div class="task-category">${esc(t.category)} · arrives ${t.arrival} ms</div></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, t.burst / max * 100)}%"></div></div><div class="queue-time">${t.burst} ms</div></div>`).join('') || '<p>No tasks yet. Add a task to begin.</p>';

  $('tasksTable').innerHTML = tasks.map(t => `<tr><td><span class="id-pill">${esc(t.id)}</span></td><td><b>${esc(t.name)}</b></td><td><span class="cat-pill">${esc(t.category)}</span></td><td>${t.arrival} ms</td><td>${t.burst} ms</td><td><button class="delete" data-delete="${esc(t.id)}">Remove ×</button></td></tr>`).join('') || '<tr><td colspan="6">No production tasks added.</td></tr>';

  $('scheduleTable').innerHTML = scheduled.map(t => `<tr><td><span class="id-pill">#${t.order}</span></td><td><b>${esc(t.name)}</b></td><td>${t.arrival} ms</td><td>${t.burst} ms</td><td>${t.start} ms</td><td>${t.waiting} ms</td><td>${t.turnaround} ms</td><td>${t.completion} ms</td></tr>`).join('') || '<tr><td colspan="8">No schedule to display.</td></tr>';

  $('gantt').innerHTML = blocks.map(b => b.idle
    ? `<div class="gantt-block gantt-idle" style="flex:${b.end - b.start}" title="Idle: ${b.start}–${b.end} ms"><b>Idle</b><span>${b.start}–${b.end} ms</span></div>`
    : `<div class="gantt-block" style="flex:${b.end - b.start}" title="${esc(b.task.name)}: ${b.start}–${b.end} ms"><b>${esc(b.task.name)}</b><span>${b.start}–${b.end} ms</span></div>`
  ).join('') || '<p>Add tasks to generate timeline.</p>';

  $('timeline').innerHTML = `<span>0 ms</span><span>${Math.round(makespan * .25)} ms</span><span>${Math.round(makespan * .5)} ms</span><span>${Math.round(makespan * .75)} ms</span><span>${makespan} ms</span>`;
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2500);
}

function view(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $(name === 'tasks' ? 'tasksView' : name === 'schedule' ? 'scheduleView' : name === 'reports' ? 'reportsView' : 'overview').classList.remove('hidden');
  document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  const labels = { overview: 'Production overview', tasks: 'Production tasks', schedule: 'SJF schedule', reports: 'Reports & export' };
  $('crumb').textContent = labels[name];
  $('title').innerHTML = labels[name] + '<span>.</span>';
}

document.querySelectorAll('.nav').forEach(b => b.addEventListener('click', () => view(b.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => view(b.dataset.goto)));

function openModal() { $('modal').classList.remove('hidden'); $('taskName').focus(); }
function closeModal() { $('modal').classList.add('hidden'); $('taskForm').reset(); }

$('addTop').onclick = openModal;
$('addInline').onclick = openModal;
$('close').onclick = closeModal;
$('cancel').onclick = closeModal;
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

$('taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('taskName').value.trim(),
    category = $('category').value,
    arrival = Number($('arrival').value),
    burst = Number($('burst').value);
  if (!name || !Number.isFinite(arrival) || arrival < 0 || !Number.isFinite(burst) || burst < 1) {
    toast('Enter a task name, arrival time (0 or more) and burst time (at least 1).');
    return;
  }
  tasks.push({ id: 'T-' + counter++, name, category, arrival, burst });
  calculate();
  closeModal();
  view('tasks');
  toast('Task added and SJF schedule updated.');
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-delete]');
  if (!b) return;
  tasks = tasks.filter(t => t.id !== b.dataset.delete);
  calculate();
  toast('Task removed.');
});

$('runHero').onclick = () => { calculate(); view('schedule'); toast('SJF schedule recalculated.'); };
$('recalculate').onclick = () => { calculate(); toast('Schedule refreshed using non-preemptive SJF.'); };
$('theme').onclick = () => document.body.classList.toggle('dark');

$('csv').onclick = () => {
  const head = ['Order', 'Task ID', 'Production Task', 'Category', 'Arrival Time (ms)', 'Burst Time (ms)', 'Start Time (ms)', 'Waiting Time (ms)', 'Turnaround Time (ms)', 'Completion Time (ms)'];
  const rows = scheduled.map(t => [t.order, t.id, t.name, t.category, t.arrival, t.burst, t.start, t.waiting, t.turnaround, t.completion]);
  const csv = [head, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'FreshFlow_SJF_Production_Report.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV report downloaded.');
};

$('print').onclick = () => {
  const m = metrics();
  const rows = scheduled.map(t => `<tr><td>${t.order}</td><td>${esc(t.id)}</td><td>${esc(t.name)}</td><td>${esc(t.category)}</td><td>${t.arrival}</td><td>${t.burst}</td><td>${t.start}</td><td>${t.waiting}</td><td>${t.turnaround}</td><td>${t.completion}</td></tr>`).join('');
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups to print or save report.'); return; }
  w.document.write(`<!doctype html><html><head><title>FreshFlow SJF Report</title><style>body{font:14px Arial;color:#203327;padding:28px}h1{color:#26734b}p{color:#66756a}.metrics{display:flex;gap:24px;margin:22px 0}.metric{padding:13px;border:1px solid #dce8dc;border-radius:8px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #dce5dc;padding:9px;text-align:left;font-size:12px}th{background:#eaf5ec}.note{margin-top:24px;font-size:12px}@media print{body{padding:0}}</style></head><body><h1>FreshFlow</h1><h2>Food Processing & Packaging — SJF Report</h2><p>Generated: ${new Date().toLocaleString()}</p><div class="metrics"><div class="metric">Total tasks<br><strong>${m.total}</strong></div><div class="metric">Average waiting<br><strong>${m.wait.toFixed(2)} ms</strong></div><div class="metric">Average turnaround<br><strong>${m.turn.toFixed(2)} ms</strong></div><div class="metric">Processing time<br><strong>${m.burst} ms</strong></div></div><table><thead><tr><th>Order</th><th>ID</th><th>Task</th><th>Category</th><th>Arrival</th><th>Burst</th><th>Start</th><th>Waiting</th><th>Turnaround</th><th>Completion</th></tr></thead><tbody>${rows}</tbody></table><p class="note">${mode === 'p' ? 'Method: preemptive Shortest Job First (Shortest Remaining Time First). At every moment the arrived task with the least remaining time runs, and a newly arrived shorter task can interrupt the running one. Start = first time the task runs; Turnaround = completion − arrival; Waiting = turnaround − burst. Order = completion order. Times are in ms.' : 'Method: non-preemptive Shortest Job First (SJF). When the line is free, the arrived task with the shortest burst time runs to completion. Waiting = start − arrival; Turnaround = completion − arrival. Times are in ms.'}</p><script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
};

/* ---------- Per-user saved data ----------
   Each user's tasks (and chosen scheduling mode) are saved in this browser's
   localStorage under their username, so they are still there after log out / log in. */
const storageKey = 'ff_data_' + String((window.ffUser && window.ffUser.username) || 'guest').toLowerCase();

function saveData() {
  try { localStorage.setItem(storageKey, JSON.stringify({ tasks, counter, mode })); } catch (e) {}
}

(function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(storageKey));
    if (!d || !Array.isArray(d.tasks)) return;
    const ok = t => t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.category === 'string' &&
      Number.isFinite(t.arrival) && t.arrival >= 0 && Number.isFinite(t.burst) && t.burst >= 1;
    tasks = d.tasks.filter(ok);
    const maxId = Math.max(106, ...tasks.map(t => parseInt(String(t.id).replace(/\D/g, ''), 10) || 0));
    counter = Math.max(Number(d.counter) || 0, maxId + 1);
    if (d.mode === 'p' || d.mode === 'np') mode = d.mode;
  } catch (e) {}
})();

calculate();


/* ---------- Logged-in user (login happens on login.html) ---------- */
(function () {
  const u = window.ffUser || { username: 'user', name: 'Production Manager' };
  $('userName').textContent = u.name;
  $('userSub').textContent = '@' + u.username;
  $('userInit').textContent = u.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  toast('Welcome, ' + u.name + '!');
})();

$('logout').onclick = () => {
  try { sessionStorage.removeItem('ff_session'); } catch (e) {}
  window.name = '';
  location.replace('login.html');
};


/* ---------- Scheduling mode switch (Non-preemptive SJF / Preemptive SJF) ---------- */
function applyMode() {
  const p = mode === 'p';
  document.querySelectorAll('#modeSwitch button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  $('modeLabel').textContent = p ? 'Preemptive SJF (SRTF)' : 'Non-preemptive SJF';
  $('factType').textContent = p ? 'Preemptive' : 'Non-preemptive';
  $('schedDesc').textContent = p
    ? 'Among arrived tasks, the shortest remaining time runs next; a shorter new arrival can interrupt (preemptive).'
    : 'Among arrived tasks, the shortest burst time runs next (non-preemptive).';
  $('insSmall').textContent = p ? 'SRTF METHOD' : 'SJF METHOD';
  $('insTitle').textContent = p ? 'Shortest remaining time' : 'Shortest job first';
  $('insText').textContent = p
    ? 'At every moment the scheduler runs the arrived task with the least remaining time. If a new task arrives with a shorter remaining time, it interrupts the running task, which resumes later.'
    : 'Whenever the line is free, the scheduler looks at the tasks that have already arrived and runs the one with the shortest burst time. A running task is never interrupted.';
}

document.querySelectorAll('#modeSwitch button').forEach(b => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  applyMode();
  calculate();
  toast(mode === 'p' ? 'Preemptive SJF (SRTF) schedule applied.' : 'Non-preemptive SJF schedule applied.');
}));

applyMode();   // show the saved scheduling mode on load