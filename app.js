// ==========================================
// 常數與預設資料
// ==========================================
const DEFAULT_THEME = 'theme-purple.css';
const MAX_HISTORY = 500;      // 歷史紀錄上限，避免無限成長
const MAX_POINTS = 1000000;   // 單張卡片/餘額上限

const defaultTasks = [
  { id: 1, icon: '🛏️', title: '離開床', desc: '當天第一次離開床', pts: 1 },
];

const defaultRewards = [
  { id: 1, icon: '🍿', title: '小確幸獎勵', desc: '小型娛樂 / 飲料 / 零食', pts: 10, mode: 'always' },
];

// ==========================================
// 安全讀寫 localStorage
// ==========================================
function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function loadJSON(key, fallback) {
  try {
    const raw = readStorage(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function loadCoins() {
  const n = Number(readStorage('coins'));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

// 清洗載入的資料，避免損毀資料讓整個頁面壞掉
function cleanCards(list, fallback, isReward) {
  if (!Array.isArray(list)) return fallback;
  return list
    .filter(c => c && typeof c === 'object' && Number.isFinite(Number(c.id)) && Number.isFinite(Number(c.pts)))
    .map(c => {
      const card = {
        id: Number(c.id),
        icon: String(c.icon ?? ''),
        title: String(c.title ?? ''),
        desc: String(c.desc ?? ''),
        pts: Math.trunc(Number(c.pts)),
      };
      if (isReward) card.mode = c.mode === 'once' ? 'once' : 'always';
      return card;
    });
}

function cleanHistory(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(h => h && typeof h === 'object')
    .map(h => ({
      time: String(h.time ?? ''),
      item: String(h.item ?? ''),
      amount: String(h.amount ?? ''),
      total: Number.isFinite(Number(h.total)) ? Number(h.total) : 0,
      type: h.type === 'minus' ? 'minus' : 'plus',
    }));
}

let currentCoins = loadCoins();
let historyData = cleanHistory(loadJSON('coinHistory', []));
let tasksData = cleanCards(loadJSON('tasksData', null), defaultTasks, false);
let rewardsData = cleanCards(loadJSON('rewardsData', null), defaultRewards, true);

let isDeleteTaskMode = false;
let isDeleteRewardMode = false;
let storageWarned = false;

// ==========================================
// 工具函式
// ==========================================
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function getFormattedTime() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${month}/${date} ${hours}:${minutes}`;
}

let toastTimer;
function showToast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    Object.assign(el.style, {
      position: 'fixed', left: '50%', bottom: '30px',
      transform: 'translateX(-50%)', padding: '10px 18px',
      borderRadius: '20px', fontSize: '14px', zIndex: '2000',
      background: 'var(--primary-color, #5a5acc)',
      color: 'var(--btn-primary-text, #ffffff)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      transition: 'opacity 0.2s', pointerEvents: 'none', opacity: '0'
    });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

// ==========================================
// 儲存與畫面更新
// ==========================================
function saveAll() {
  try {
    localStorage.setItem('coins', String(currentCoins));
    localStorage.setItem('coinHistory', JSON.stringify(historyData));
    localStorage.setItem('tasksData', JSON.stringify(tasksData));
    localStorage.setItem('rewardsData', JSON.stringify(rewardsData));
  } catch {
    if (!storageWarned) {
      storageWarned = true;
      alert('無法寫入瀏覽器儲存空間（可能是無痕模式或空間已滿），資料關閉頁面後會消失！');
    }
  }
}

function updateDisplay() {
  document.getElementById('coin-balance').textContent = currentCoins;
  saveAll();
}

function addHistory(item, signedAmount, type) {
  historyData.unshift({
    time: getFormattedTime(),
    item,
    amount: signedAmount,
    total: currentCoins,
    type
  });
  if (historyData.length > MAX_HISTORY) historyData.length = MAX_HISTORY;
}

// ==========================================
// 渲染
// ==========================================
function syncDeleteButtons() {
  document.getElementById('btn-delete-tasks')
    .classList.toggle('active-delete-mode', isDeleteTaskMode);
  document.getElementById('btn-delete-shop')
    .classList.toggle('active-delete-mode', isDeleteRewardMode);
}

function renderTasks() {
  const container = document.getElementById('tasks-container');
  container.innerHTML = '';
  container.classList.toggle('delete-mode', isDeleteTaskMode);

  tasksData.forEach(task => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <button class="card-delete-btn" data-action="delete" data-id="${task.id}" aria-label="刪除">&times;</button>
      <div>
        <div class="card-header">
          <div class="card-icon">${escapeHTML(task.icon || '📌')}</div>
          <div class="card-title">${escapeHTML(task.title)}</div>
        </div>
        <div class="card-desc">${escapeHTML(task.desc)}</div>
      </div>
      <div class="card-footer">
        <span class="pts-badge">+${task.pts} 🪙</span>
        <button class="btn-reload" data-action="earn" data-id="${task.id}">儲值</button>
      </div>
    `;
    container.appendChild(card);
  });
  syncDeleteButtons();
}

function renderRewards() {
  const container = document.getElementById('rewards-container');
  container.innerHTML = '';
  container.classList.toggle('delete-mode', isDeleteRewardMode);

  rewardsData.forEach(reward => {
    const card = document.createElement('div');
    card.className = 'game-card';
    const modeTag = reward.mode === 'once'
      ? '<span class="type-badge badge-once">單次</span>'
      : '<span class="type-badge badge-always">常態</span>';

    card.innerHTML = `
      <button class="card-delete-btn" data-action="delete" data-id="${reward.id}" aria-label="刪除">&times;</button>
      <div>
        <div class="card-header">
          <div class="card-icon">${escapeHTML(reward.icon || '🎁')}</div>
          <div class="card-title">${escapeHTML(reward.title)} ${modeTag}</div>
        </div>
        <div class="card-desc">${escapeHTML(reward.desc)}</div>
      </div>
      <div class="card-footer">
        <span class="pts-badge">-${reward.pts} 🪙</span>
        <button class="btn-redeem" data-action="redeem" data-id="${reward.id}">兌換</button>
      </div>
    `;
    container.appendChild(card);
  });
  syncDeleteButtons();
}

function renderHistory() {
  const historyList = document.getElementById('history-list-content');
  if (historyData.length === 0) {
    historyList.innerHTML = '<div class="history-empty">尚無歷史紀錄</div>';
    return;
  }

  historyList.innerHTML = historyData.map(item => `
    <div class="history-item">
      <div>
        <strong>${escapeHTML(item.item)}</strong>
        <span class="time">(${escapeHTML(item.time)})</span>
      </div>
      <div>
        <span class="${item.type}">${escapeHTML(item.amount)}</span>
        <span class="history-balance">(餘額: ${escapeHTML(item.total)})</span>
      </div>
    </div>
  `).join('');
}

// ==========================================
// 金幣操作（只傳 id，用 id 查資料，避免引號問題）
// ==========================================
function earnCoins(id) {
  const task = tasksData.find(t => t.id === id);
  if (!task) return;
  currentCoins += task.pts;
  addHistory(task.title, `+${task.pts}`, 'plus');
  updateDisplay();
  showToast(`+${task.pts} 🪙  ${task.title}`);
}

function redeemCoins(id) {
  const reward = rewardsData.find(r => r.id === id);
  if (!reward) return;

  if (currentCoins < reward.pts) {
    alert('累積金幣不足，無法兌換！快去完成任務賺取點數吧！');
    return;
  }

  currentCoins -= reward.pts;
  addHistory(reward.title, `-${reward.pts}`, 'minus');

  if (reward.mode === 'once') {
    rewardsData = rewardsData.filter(r => r.id !== id);
    renderRewards();
  }

  updateDisplay();
  showToast(`成功兌換【${reward.title}】！`);
}

// 手動修正點數
function correctCoins() {
  const input = prompt('請輸入修正後的總點數（須為 0 以上的整數）：', currentCoins);
  if (input === null) return;

  const text = input.trim();
  if (!/^\d+$/.test(text)) {
    alert('請輸入 0 以上的整數！');
    return;
  }

  const newTotal = Number(text);
  if (newTotal > MAX_POINTS * 100) {
    alert('數字太大了！');
    return;
  }

  const diff = newTotal - currentCoins;
  if (diff === 0) return;

  currentCoins = newTotal;
  addHistory('[手動修正]', diff > 0 ? `+${diff}` : `${diff}`, diff > 0 ? 'plus' : 'minus');
  updateDisplay();
}

// ==========================================
// 新增 / 刪除卡片
// ==========================================
function clearModalInputs() {
  document.getElementById('card-icon-input').value = '';
  document.getElementById('card-name-input').value = '';
  document.getElementById('card-desc-input').value = '';
  document.getElementById('card-pts-input').value = '';
  document.getElementById('card-mode-input').value = 'always';
}

function openAddTaskModal() {
  document.getElementById('card-type-input').value = 'task';
  document.getElementById('add-card-title').textContent = '新增任務卡';
  document.getElementById('reward-mode-group').style.display = 'none';
  clearModalInputs();
  document.getElementById('add-card-modal').style.display = 'flex';
}

function openAddRewardModal() {
  document.getElementById('card-type-input').value = 'reward';
  document.getElementById('add-card-title').textContent = '新增獎勵卡';
  document.getElementById('reward-mode-group').style.display = 'block';
  clearModalInputs();
  document.getElementById('add-card-modal').style.display = 'flex';
}

function closeAddCardModal() {
  document.getElementById('add-card-modal').style.display = 'none';
}

function submitNewCard() {
  const type = document.getElementById('card-type-input').value;
  const icon = document.getElementById('card-icon-input').value.trim() || (type === 'task' ? '📌' : '🎁');
  const title = document.getElementById('card-name-input').value.trim();
  const desc = document.getElementById('card-desc-input').value.trim();
  const pts = Number(document.getElementById('card-pts-input').value);

  if (!title || !Number.isInteger(pts) || pts <= 0 || pts > MAX_POINTS) {
    alert(`請完整填寫名稱，點數須為 1～${MAX_POINTS} 的整數！`);
    return;
  }

  // 用 Date.now() 當 id，若同毫秒重複則遞增避免撞號
  let newId = Date.now();
  const used = new Set([...tasksData, ...rewardsData].map(c => c.id));
  while (used.has(newId)) newId++;

  if (type === 'task') {
    tasksData.push({ id: newId, icon, title, desc, pts });
    renderTasks();
  } else {
    const mode = document.getElementById('card-mode-input').value === 'once' ? 'once' : 'always';
    rewardsData.push({ id: newId, icon, title, desc, pts, mode });
    renderRewards();
  }

  updateDisplay();
  closeAddCardModal();
}

function exitDeleteMode() {
  isDeleteTaskMode = false;
  isDeleteRewardMode = false;
  renderTasks();
  renderRewards();
}

function toggleDeleteMode(type, event) {
  if (event) event.stopPropagation();
  if (type === 'tasks') {
    isDeleteTaskMode = !isDeleteTaskMode;
    renderTasks();
  } else {
    isDeleteRewardMode = !isDeleteRewardMode;
    renderRewards();
  }
}

function deleteTask(id) {
  const task = tasksData.find(t => t.id === id);
  if (!task) return;
  if (!confirm(`確定要刪除任務卡【${task.title}】嗎？此動作無法復原。`)) return;
  tasksData = tasksData.filter(t => t.id !== id);
  renderTasks();
  updateDisplay();
}

function deleteReward(id) {
  const reward = rewardsData.find(r => r.id === id);
  if (!reward) return;
  if (!confirm(`確定要刪除獎勵卡【${reward.title}】嗎？此動作無法復原。`)) return;
  rewardsData = rewardsData.filter(r => r.id !== id);
  renderRewards();
  updateDisplay();
}

// ==========================================
// 彈出視窗
// ==========================================
function toggleHistoryModal(show) {
  const modal = document.getElementById('history-modal');
  if (show) renderHistory();
  modal.style.display = show ? 'flex' : 'none';
}

function toggleHelpModal(show) {
  document.getElementById('help-modal').style.display = show ? 'flex' : 'none';
}

function clearHistory() {
  if (confirm('確定要清空所有歷史紀錄嗎？（金幣數量不會被重置）')) {
    historyData = [];
    updateDisplay();
    renderHistory();
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => { m.style.display = 'none'; });
}

// ==========================================
// 主題切換
// ==========================================
function isValidTheme(name) {
  return typeof name === 'string' && /^theme-[a-z]+\.css$/.test(name);
}

function setActiveThemeButton(themeFile) {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeFile);
  });
}

function initTheme() {
  const themeLink = document.getElementById('theme-style');
  if (!themeLink) return;

  const buttons = document.querySelectorAll('.theme-btn');

  // 主題檔載入失敗（例如檔案不存在）時退回預設主題
  themeLink.addEventListener('error', () => {
    themeLink.setAttribute('href', DEFAULT_THEME);
    setActiveThemeButton(DEFAULT_THEME);
    try { localStorage.removeItem('user-selected-theme'); } catch {}
  });

  // 頁面載入時若已儲存的主題檔其實沒載入成功，退回預設
  const saved = readStorage('user-selected-theme');
  if (isValidTheme(saved)) {
    if (!themeLink.sheet && saved !== DEFAULT_THEME) {
      themeLink.setAttribute('href', DEFAULT_THEME);
      setActiveThemeButton(DEFAULT_THEME);
    } else {
      setActiveThemeButton(saved);
    }
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const selected = button.dataset.theme;
      if (!isValidTheme(selected)) return;
      themeLink.setAttribute('href', selected);
      setActiveThemeButton(selected);
      try { localStorage.setItem('user-selected-theme', selected); } catch {}
    });
  });
}

// ==========================================
// 初始化（只用一個 DOMContentLoaded）
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  updateDisplay();
  renderTasks();
  renderRewards();
  initTheme();

  // 卡片按鈕：事件代理
  document.getElementById('tasks-container').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'earn') earnCoins(id);
    else if (btn.dataset.action === 'delete') deleteTask(id);
  });

  document.getElementById('rewards-container').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'redeem') redeemCoins(id);
    else if (btn.dataset.action === 'delete') deleteReward(id);
  });

  // 點空白處退出刪除模式
  document.addEventListener('click', event => {
    if (!isDeleteTaskMode && !isDeleteRewardMode) return;
    if (event.target.closest('.btn-toggle-delete')) return;
    if (event.target.closest('.card-delete-btn')) return;
    exitDeleteMode();
  });

  // 點彈窗背景或按 Esc 關閉彈窗
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('pointerdown', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });
});
