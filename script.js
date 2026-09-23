const STORAGE_KEY = 'class-task-board-v1';
const THEME_KEY = 'class-task-board-theme';
const columns = [
  { id: 'todo', label: '待办' },
  { id: 'doing', label: '进行中' },
  { id: 'done', label: '完成' },
];
const priorities = { high: '高优先级', medium: '中优先级', low: '低优先级' };
const board = document.querySelector('#board');
const searchInput = document.querySelector('#task-search');
const dialog = document.querySelector('#task-dialog');
const form = document.querySelector('#task-form');
const titleInput = document.querySelector('#task-title');
const descriptionInput = document.querySelector('#task-description');
const statusInput = document.querySelector('#task-status');
const priorityInput = document.querySelector('#task-priority');
let editingId = null;
let draggedId = null;
let activeCardId = null;

function loadTasks() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(task => task && typeof task.id === 'string' && typeof task.title === 'string' && columns.some(col => col.id === task.status)) : [];
  } catch { return []; }
}
let tasks = loadTasks();

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function makeId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function makeButton(text, label, onClick, className = '') {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = text; button.setAttribute('aria-label', label);
  button.className = className; button.addEventListener('click', event => { event.stopPropagation(); onClick(); });
  return button;
}
function setCardActions(id) {
  activeCardId = id;
  document.querySelectorAll('.card').forEach(card => {
    const visible = card.dataset.id === id;
    card.classList.toggle('actions-visible', visible);
    const actions = card.querySelector('.card-actions');
    actions.setAttribute('aria-hidden', String(!visible));
    actions.querySelectorAll('button').forEach(button => { button.tabIndex = visible ? 0 : -1; });
  });
}
function getDropBeforeId(cards, clientY) {
  const candidates = [...cards.querySelectorAll('.card:not(.dragging)')];
  const nextCard = candidates.find(card => clientY < card.getBoundingClientRect().top + card.offsetHeight / 2);
  return nextCard?.dataset.id || null;
}
function moveTask(id, status, beforeId = null) {
  const fromIndex = tasks.findIndex(item => item.id === id);
  if (fromIndex < 0 || beforeId === id) return false;
  const [task] = tasks.splice(fromIndex, 1);
  task.status = status;
  if (beforeId) {
    const beforeIndex = tasks.findIndex(item => item.id === beforeId);
    if (beforeIndex >= 0) tasks.splice(beforeIndex, 0, task);
    else tasks.push(task);
  } else {
    const lastIndex = tasks.reduce((found, item, index) => item.status === status ? index : found, -1);
    tasks.splice(lastIndex + 1, 0, task);
  }
  return true;
}
function renderCard(task) {
  const card = document.createElement('article');
  const priority = priorities[task.priority] ? task.priority : 'medium';
  card.className = `card priority-${priority}`; card.draggable = true; card.dataset.id = task.id;
  card.tabIndex = 0; card.setAttribute('role', 'group'); card.setAttribute('aria-label', `${task.title}，点击显示编辑和删除操作`);
  card.addEventListener('dragstart', event => { draggedId = task.id; card.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id); });
  card.addEventListener('dragend', () => { draggedId = null; card.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); });
  card.addEventListener('click', () => setCardActions(activeCardId === task.id ? null : task.id));
  card.addEventListener('keydown', event => {
    if (event.target !== card) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setCardActions(activeCardId === task.id ? null : task.id); }
    if (event.key === 'Escape') setCardActions(null);
  });
  const top = document.createElement('div'); top.className = 'card-top';
  const badge = document.createElement('span'); badge.className = `priority ${priorities[task.priority] ? task.priority : 'medium'}`; badge.textContent = priorities[task.priority] || priorities.medium; top.append(badge);
  const heading = document.createElement('h3'); heading.textContent = task.title;
  card.append(top, heading);
  if (task.description) { const description = document.createElement('p'); description.textContent = task.description; card.append(description); }
  const actions = document.createElement('div'); actions.className = 'card-actions'; actions.setAttribute('aria-hidden', 'true');
  actions.append(makeButton('编辑', `编辑${task.title}`, () => openEditor(task)));
  actions.append(makeButton('删除', `删除${task.title}`, () => {
    if (!confirm(`确定删除“${task.title}”吗？`)) return;
    tasks = tasks.filter(item => item.id !== task.id); save(); render();
  }, 'delete'));
  actions.querySelectorAll('button').forEach(button => { button.tabIndex = -1; });
  card.append(actions); return card;
}
function render() {
  activeCardId = null;
  board.replaceChildren();
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleTasks = query ? tasks.filter(task => task.title.toLocaleLowerCase().includes(query) || String(task.description || '').toLocaleLowerCase().includes(query)) : tasks;
  for (const column of columns) {
    const section = document.createElement('section'); section.className = `column ${column.id}`; section.dataset.status = column.id;
    const heading = document.createElement('div'); heading.className = 'column-head';
    const dot = document.createElement('span'); dot.className = 'dot';
    const label = document.createElement('h2'); label.textContent = column.label;
    const count = document.createElement('span'); count.className = 'count';
    const items = visibleTasks.filter(task => task.status === column.id); count.textContent = items.length;
    heading.append(dot, label, count); section.append(heading);
    const cards = document.createElement('div'); cards.className = 'cards';
    if (items.length) items.forEach(task => cards.append(renderCard(task)));
    else { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = query ? '没有匹配的任务' : '拖动任务到这里'; cards.append(empty); }
    section.append(cards);
    section.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; section.classList.add('drag-over'); });
    section.addEventListener('dragleave', event => { if (!section.contains(event.relatedTarget)) section.classList.remove('drag-over'); });
    section.addEventListener('drop', event => {
      event.preventDefault(); section.classList.remove('drag-over');
      const id = draggedId || event.dataTransfer.getData('text/plain');
      const beforeId = getDropBeforeId(cards, event.clientY);
      if (moveTask(id, column.id, beforeId)) { save(); render(); }
    });
    board.append(section);
  }
  document.querySelector('#total-count').textContent = tasks.length;
  document.querySelector('#active-count').textContent = tasks.filter(task => task.status === 'doing').length;
  document.querySelector('#done-count').textContent = tasks.filter(task => task.status === 'done').length;
}
function openEditor(task = null) {
  setCardActions(null);
  editingId = task?.id || null;
  document.querySelector('#dialog-title').textContent = task ? '编辑任务' : '新建任务';
  titleInput.value = task?.title || ''; descriptionInput.value = task?.description || '';
  statusInput.value = task?.status || 'todo'; priorityInput.value = task?.priority || 'medium';
  dialog.showModal(); titleInput.focus();
}
document.querySelector('#add-task').addEventListener('click', () => openEditor());
searchInput.addEventListener('input', render);
searchInput.addEventListener('keydown', event => { if (event.key === 'Escape' && searchInput.value) { searchInput.value = ''; render(); } });
document.addEventListener('click', event => { if (!event.target.closest('.card')) setCardActions(null); });
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
document.querySelector('#cancel-dialog').addEventListener('click', () => dialog.close());
form.addEventListener('submit', event => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) { titleInput.setCustomValidity('请填写任务标题'); titleInput.reportValidity(); return; }
  titleInput.setCustomValidity('');
  const data = { title, description: descriptionInput.value.trim(), status: statusInput.value, priority: priorityInput.value };
  if (editingId) { const task = tasks.find(item => item.id === editingId); if (task) Object.assign(task, data); }
  else tasks.unshift({ id: makeId(), ...data });
  save(); render(); dialog.close();
});
titleInput.addEventListener('input', () => titleInput.setCustomValidity(''));
const themeButton = document.querySelector('#theme-toggle');
function setTheme(theme) { document.body.classList.toggle('dark', theme === 'dark'); themeButton.textContent = theme === 'dark' ? '☀ 浅色模式' : '☾ 深色模式'; localStorage.setItem(THEME_KEY, theme); }
setTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light');
themeButton.addEventListener('click', () => setTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));
render();

