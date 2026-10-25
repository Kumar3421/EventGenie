/* ============================================
   EventGenie — GenAI Event Planning Assistant
   Application Logic (app.js)
   ============================================ */

// ===== STATE =====
let appState = {
  currentView: 'hero', // hero | setup | dashboard
  eventType: null,     // wedding | birthday | community
  eventData: null,     // Form data
  budget: {
    items: [],
    total: 0
  },
  timeline: [],
  vendors: [],
  aiMessages: [],
  ideas: []
};

// Persist state
function saveState() {
  try {
    localStorage.setItem('eventgenie_state', JSON.stringify(appState));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem('eventgenie_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        appState = parsed;
        if (appState.currentView === 'dashboard' && appState.eventData) {
          showDashboard();
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse saved state from localStorage:', err);
  }
}

// ===== NAVIGATION =====
function goHome() {
  appState.currentView = 'hero';
  document.getElementById('heroSection').style.display = '';
  document.getElementById('setupSection').classList.remove('active');
  document.getElementById('dashboardSection').classList.remove('active');
  updateNavLinks();
}

function selectEventType(type) {
  appState.eventType = type;
  appState.currentView = 'setup';

  const configs = {
    wedding: { icon: '💒', title: 'Plan Your Wedding', subtitle: 'Tell us about your special day.' },
    birthday: { icon: '🎂', title: 'Plan Your Birthday Party', subtitle: 'Let\'s make this birthday unforgettable.' },
    community: { icon: '🎪', title: 'Plan Your Community Event', subtitle: 'Create a meaningful gathering for your community.' }
  };
  const cfg = configs[type];

  document.getElementById('setupIcon').textContent = cfg.icon;
  document.getElementById('setupIcon').style.background =
    type === 'wedding' ? 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(192,132,252,0.15))' :
    type === 'birthday' ? 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(244,114,182,0.15))' :
    'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(34,211,238,0.15))';
  document.getElementById('setupTitle').textContent = cfg.title;
  document.getElementById('setupSubtitle').textContent = cfg.subtitle;

  // Placeholders based on type
  const nameInput = document.getElementById('eventName');
  nameInput.placeholder = type === 'wedding' ? "e.g. Mark & Veronica's Wedding" :
    type === 'birthday' ? "e.g. Emma's 30th Birthday Bash" :
    "e.g. Annual Neighborhood Block Party";

  document.getElementById('heroSection').style.display = 'none';
  document.getElementById('setupSection').classList.add('active');
  document.getElementById('dashboardSection').classList.remove('active');
  window.scrollTo(0, 0);
  updateNavLinks();
}

function submitSetup(e) {
  e.preventDefault();
  const eventDate = document.getElementById('eventDate').value;
  const today = new Date();
  today.setHours(0,0,0,0);
  const selected = new Date(eventDate);
  if (selected < today) {
    alert('Please select a future date for your event.');
    return;
  }

  appState.eventData = {
    name: document.getElementById('eventName').value,
    date: eventDate,
    guests: parseInt(document.getElementById('guestCount').value),
    budget: parseFloat(document.getElementById('totalBudget').value),
    location: document.getElementById('eventLocation').value || 'TBD',
    theme: document.getElementById('eventTheme').value || '',
    notes: document.getElementById('specialNotes').value || ''
  };
  appState.budget.total = appState.eventData.budget;

  // Generate default data
  generateDefaultBudget();
  generateDefaultTimeline();
  generateDefaultVendors();

  // Initialize AI
  appState.aiMessages = [{
    role: 'bot',
    text: getWelcomeMessage()
  }];

  generateIdeasData();
  saveState();
  showDashboard();
}

function showDashboard() {
  appState.currentView = 'dashboard';
  document.getElementById('heroSection').style.display = 'none';
  document.getElementById('setupSection').classList.remove('active');
  document.getElementById('dashboardSection').classList.add('active');

  // Set header
  const icons = { wedding: '💒', birthday: '🎂', community: '🎪' };
  document.getElementById('dashEventIcon').textContent = icons[appState.eventType];
  document.getElementById('dashEventType').textContent = capitalize(appState.eventType);
  document.getElementById('dashEventLabel').className = 'event-label ' + appState.eventType;
  document.getElementById('dashEventName').textContent = appState.eventData.name;

  updateNavLinks();
  updateCountdown();
  renderStats();
  renderBudget();
  renderTimeline();
  renderVendors();
  renderAiMessages();
  renderIdeas();

  // Start countdown timer
  if (window._cdInterval) clearInterval(window._cdInterval);
  window._cdInterval = setInterval(updateCountdown, 1000);

  window.scrollTo(0, 0);
}

function updateNavLinks() {
  const nav = document.getElementById('navLinks');
  if (appState.currentView === 'dashboard') {
    nav.innerHTML = `
      <button class="nav-link active" data-tab="budget" onclick="switchTab('budget')">💰 Budget</button>
      <button class="nav-link" data-tab="timeline" onclick="switchTab('timeline')">📅 Timeline</button>
      <button class="nav-link" data-tab="vendors" onclick="switchTab('vendors')">🏪 Vendors</button>
      <button class="nav-link" data-tab="ai" onclick="switchTab('ai')">🤖 AI</button>
    `;
  } else {
    nav.innerHTML = '';
  }
}

// ===== TABS =====
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(tb => {
    tb.classList.remove('active');
    tb.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.nav-link').forEach(nl => nl.classList.remove('active'));

  const activeContent = document.getElementById('tab-' + tabId);
  if (activeContent) activeContent.classList.add('active');

  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-selected', 'true');
  }

  const navBtn = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
  if (navBtn) navBtn.classList.add('active');
}

// ===== COUNTDOWN =====
function updateCountdown() {
  if (!appState.eventData || !appState.eventData.date) return;
  const target = new Date(appState.eventData.date + 'T00:00:00');

  // Guard against invalid dates
  if (isNaN(target.getTime())) {
    document.getElementById('cdDays').textContent = '--';
    document.getElementById('cdHours').textContent = '--';
    document.getElementById('cdMins').textContent = '--';
    document.getElementById('cdSecs').textContent = '--';
    return;
  }

  const now = new Date();
  const diff = target - now;

  if (diff <= 0) {
    document.getElementById('cdDays').textContent = '🎉';
    document.getElementById('cdHours').textContent = '';
    document.getElementById('cdMins').textContent = '';
    document.getElementById('cdSecs').textContent = '';
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  document.getElementById('cdDays').textContent = days;
  document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
  document.getElementById('cdMins').textContent = String(mins).padStart(2, '0');
  document.getElementById('cdSecs').textContent = String(secs).padStart(2, '0');
}

// ===== STATS =====
function renderStats() {
  const spent = appState.budget.items.reduce((s, i) => s + i.amount, 0);
  const remaining = appState.budget.total - spent;
  const vendorsDone = appState.vendors.filter(v => v.booked).length;
  const timelineDone = appState.timeline.filter(t => t.completed).length;

  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">💰 Total Budget</div>
      <div class="stat-value">$${formatNum(appState.budget.total)}</div>
      <div class="stat-change positive">${appState.eventData.guests} guests</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">📊 Spent</div>
      <div class="stat-value">$${formatNum(spent)}</div>
      <div class="stat-change ${remaining >= 0 ? 'positive' : 'negative'}">$${formatNum(Math.abs(remaining))} ${remaining >= 0 ? 'remaining' : 'over budget'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">🏪 Vendors</div>
      <div class="stat-value">${vendorsDone}/${appState.vendors.length}</div>
      <div class="stat-change positive">booked</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">📅 Milestones</div>
      <div class="stat-value">${timelineDone}/${appState.timeline.length}</div>
      <div class="stat-change positive">completed</div>
    </div>
  `;
}

// ===== BUDGET =====
function generateDefaultBudget() {
  const total = appState.eventData.budget;
  const type = appState.eventType;

  const templates = {
    wedding: [
      { name: 'Venue & Catering', icon: '🏛️', pct: 0.40, color: '#818cf8' },
      { name: 'Photography & Video', icon: '📸', pct: 0.12, color: '#c084fc' },
      { name: 'Flowers & Décor', icon: '💐', pct: 0.10, color: '#f472b6' },
      { name: 'Attire & Beauty', icon: '👗', pct: 0.08, color: '#fb923c' },
      { name: 'Music & Entertainment', icon: '🎵', pct: 0.08, color: '#34d399' },
      { name: 'Invitations & Stationery', icon: '💌', pct: 0.03, color: '#22d3ee' },
      { name: 'Wedding Rings', icon: '💍', pct: 0.05, color: '#f59e0b' },
      { name: 'Transportation', icon: '🚗', pct: 0.04, color: '#a78bfa' },
      { name: 'Miscellaneous', icon: '📦', pct: 0.10, color: '#64748b' }
    ],
    birthday: [
      { name: 'Venue Rental', icon: '🏠', pct: 0.25, color: '#818cf8' },
      { name: 'Food & Drinks', icon: '🍕', pct: 0.30, color: '#fb923c' },
      { name: 'Cake & Desserts', icon: '🎂', pct: 0.10, color: '#f472b6' },
      { name: 'Decorations', icon: '🎈', pct: 0.10, color: '#c084fc' },
      { name: 'Entertainment', icon: '🎤', pct: 0.10, color: '#34d399' },
      { name: 'Party Favors', icon: '🎁', pct: 0.05, color: '#22d3ee' },
      { name: 'Invitations', icon: '✉️', pct: 0.03, color: '#f59e0b' },
      { name: 'Miscellaneous', icon: '📦', pct: 0.07, color: '#64748b' }
    ],
    community: [
      { name: 'Venue & Permits', icon: '📋', pct: 0.25, color: '#818cf8' },
      { name: 'Food & Beverages', icon: '🍽️', pct: 0.25, color: '#34d399' },
      { name: 'Equipment & Rentals', icon: '🎪', pct: 0.15, color: '#22d3ee' },
      { name: 'Marketing & Outreach', icon: '📢', pct: 0.10, color: '#fb923c' },
      { name: 'Entertainment', icon: '🎶', pct: 0.08, color: '#c084fc' },
      { name: 'Safety & Insurance', icon: '🛡️', pct: 0.07, color: '#f472b6' },
      { name: 'Supplies', icon: '📦', pct: 0.05, color: '#f59e0b' },
      { name: 'Contingency', icon: '🔒', pct: 0.05, color: '#64748b' }
    ]
  };

  appState.budget.items = templates[type].map(t => ({
    id: uid(),
    name: t.name,
    icon: t.icon,
    amount: Math.round(total * t.pct),
    color: t.color
  }));
}

function renderBudget() {
  const items = appState.budget.items;
  const total = appState.budget.total;
  const spent = items.reduce((s, i) => s + i.amount, 0);
  const pct = total > 0 ? Math.round((spent / total) * 100) : 0;

  document.getElementById('budgetUsedBadge').textContent = pct + '% allocated';
  document.getElementById('donutValue').textContent = '$' + formatNum(total);

  // Bars
  const barsEl = document.getElementById('budgetBars');
  barsEl.innerHTML = items.map(item => {
    const itemPct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
    return `
      <div class="budget-bar-container">
        <div class="budget-bar-label">
          <span>${escapeHtml(item.icon)} ${escapeHtml(item.name)}</span>
          <span>$${formatNum(item.amount)} (${itemPct}%)</span>
        </div>
        <div class="budget-bar">
          <div class="budget-bar-fill" style="width:${itemPct}%;background:${item.color};"></div>
        </div>
      </div>
    `;
  }).join('');

  // Donut
  drawDonut(items, total);

  // Legend
  const legendEl = document.getElementById('budgetLegend');
  legendEl.innerHTML = items.map(i => `
    <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;">
      <div style="width:10px;height:10px;border-radius:50%;background:${i.color};"></div>
      <span style="color:var(--text-secondary);">${escapeHtml(i.name)}</span>
    </div>
  `).join('');

  // Items list
  const listEl = document.getElementById('budgetItemsList');
  listEl.innerHTML = items.map(item => `
    <li class="budget-item">
      <div class="budget-item-left">
        <div class="budget-item-icon" style="background:${item.color}22;color:${item.color};">${escapeHtml(item.icon)}</div>
        <span class="budget-item-name">${escapeHtml(item.name)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="budget-item-amount">$${formatNum(item.amount)}</span>
        <button class="btn btn-ghost btn-sm" onclick="editBudgetItem('${escapeHtml(item.id)}')" title="Edit" aria-label="Edit ${escapeHtml(item.name)}">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBudgetItem('${escapeHtml(item.id)}')" title="Delete" aria-label="Delete ${escapeHtml(item.name)}">🗑️</button>
      </div>
    </li>
  `).join('');
}

function drawDonut(items, total) {
  const canvas = document.getElementById('budgetDonut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 260;
  const cx = size / 2, cy = size / 2, radius = 104, lineWidth = 24;

  canvas.width = size * 2;
  canvas.height = size * 2;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, size, size);

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  let startAngle = -Math.PI / 2;
  items.forEach(item => {
    const sliceAngle = total > 0 ? (item.amount / total) * Math.PI * 2 : 0;
    if (sliceAngle <= 0) return;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.strokeStyle = item.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    startAngle += sliceAngle + 0.02; // small gap
  });
}

function openAddBudgetItem() {
  document.getElementById('modalTitle').innerHTML = '<span>➕ Add Expense</span><button class="modal-close" onclick="closeModalDirect()">✕</button>';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" id="newBudgetName" placeholder="e.g. DJ Services">
    </div>
    <div class="form-group">
      <label class="form-label">Amount ($)</label>
      <input class="form-input" id="newBudgetAmount" type="number" placeholder="e.g. 1500">
    </div>
    <div class="form-group">
      <label class="form-label">Icon (emoji)</label>
      <input class="form-input" id="newBudgetIcon" placeholder="e.g. 🎵" value="📦">
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="addBudgetItem()">Add Expense</button>
  `;
  openModal();
}

function addBudgetItem() {
  const name = document.getElementById('newBudgetName').value.trim();
  const amount = parseFloat(document.getElementById('newBudgetAmount').value);
  const icon = document.getElementById('newBudgetIcon').value || '📦';
  if (!name || isNaN(amount)) return alert('Please fill in name and amount.');

  const colors = ['#818cf8','#c084fc','#f472b6','#fb923c','#34d399','#22d3ee','#f59e0b'];
  appState.budget.items.push({
    id: uid(),
    name,
    icon,
    amount: Math.round(amount),
    color: colors[appState.budget.items.length % colors.length]
  });
  saveState();
  renderBudget();
  renderStats();
  closeModalDirect();
}

function editBudgetItem(id) {
  const item = appState.budget.items.find(i => i.id === id);
  if (!item) return;
  document.getElementById('modalTitle').innerHTML = '<span>✏️ Edit Expense</span><button class="modal-close" onclick="closeModalDirect()">✕</button>';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" id="editBudgetName" value="${item.name}">
    </div>
    <div class="form-group">
      <label class="form-label">Amount ($)</label>
      <input class="form-input" id="editBudgetAmount" type="number" value="${item.amount}">
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="saveBudgetEdit('${id}')">Save</button>
  `;
  openModal();
}

function saveBudgetEdit(id) {
  const item = appState.budget.items.find(i => i.id === id);
  if (!item) return;
  item.name = document.getElementById('editBudgetName').value.trim();
  item.amount = Math.round(parseFloat(document.getElementById('editBudgetAmount').value)) || 0;
  saveState();
  renderBudget();
  renderStats();
  closeModalDirect();
}

function deleteBudgetItem(id) {
  appState.budget.items = appState.budget.items.filter(i => i.id !== id);
  saveState();
  renderBudget();
  renderStats();
}

// ===== TIMELINE =====
function generateDefaultTimeline() {
  const eventDate = new Date(appState.eventData.date);
  const type = appState.eventType;
  const now = new Date();

  const templates = {
    wedding: [
      { title: 'Set budget & guest list', desc: 'Define your overall budget and start your guest list draft.', monthsBefore: 12 },
      { title: 'Book venue', desc: 'Research and secure your ceremony & reception venue.', monthsBefore: 10 },
      { title: 'Hire photographer & videographer', desc: 'Interview and book your photo/video team.', monthsBefore: 8 },
      { title: 'Choose wedding party attire', desc: 'Select wedding dress, suits, and bridesmaid dresses.', monthsBefore: 7 },
      { title: 'Book caterer & cake', desc: 'Schedule tastings and finalize your menu.', monthsBefore: 6 },
      { title: 'Send invitations', desc: 'Mail out or send digital invitations.', monthsBefore: 3 },
      { title: 'Final fittings & rehearsal', desc: 'Complete final dress fittings and rehearsal dinner.', monthsBefore: 1 },
      { title: 'Final vendor confirmations', desc: 'Confirm all vendor details, timelines, and payments.', monthsBefore: 0.5 },
      { title: '🎉 Wedding Day!', desc: 'The big day! Relax and enjoy every moment.', monthsBefore: 0 }
    ],
    birthday: [
      { title: 'Pick a theme & date', desc: 'Choose a fun theme and lock in the date.', monthsBefore: 2 },
      { title: 'Book venue', desc: 'Reserve your party location.', monthsBefore: 1.5 },
      { title: 'Plan menu & order cake', desc: 'Finalize food, drinks, and the birthday cake.', monthsBefore: 1 },
      { title: 'Send invitations', desc: 'Send out invites via mail or digital.', monthsBefore: 1 },
      { title: 'Buy decorations & supplies', desc: 'Get balloons, banners, tableware, and party favors.', monthsBefore: 0.5 },
      { title: 'Arrange entertainment', desc: 'Book DJ, games, or special activities.', monthsBefore: 0.5 },
      { title: 'Final preparations', desc: 'Confirm headcount, finalize setup plan.', monthsBefore: 0.1 },
      { title: '🎂 Party Day!', desc: 'Time to celebrate!', monthsBefore: 0 }
    ],
    community: [
      { title: 'Define purpose & goals', desc: 'Clarify the event mission, target audience, and success metrics.', monthsBefore: 4 },
      { title: 'Secure venue & permits', desc: 'Book location and obtain necessary permits.', monthsBefore: 3 },
      { title: 'Recruit volunteers', desc: 'Build your team and assign roles.', monthsBefore: 2.5 },
      { title: 'Plan activities & agenda', desc: 'Design the event schedule and activities.', monthsBefore: 2 },
      { title: 'Launch marketing campaign', desc: 'Start promoting through social media, flyers, and local media.', monthsBefore: 1.5 },
      { title: 'Arrange food & equipment', desc: 'Coordinate catering, rentals, and technical equipment.', monthsBefore: 1 },
      { title: 'Final logistics review', desc: 'Run through the day-of plan with your team.', monthsBefore: 0.25 },
      { title: '🎪 Event Day!', desc: 'Make an impact in your community!', monthsBefore: 0 }
    ]
  };

  appState.timeline = templates[type].map((t, idx) => {
    const dueDate = new Date(eventDate);
    dueDate.setMonth(dueDate.getMonth() - t.monthsBefore);
    const completed = dueDate < now;
    return {
      id: uid(),
      title: t.title,
      desc: t.desc,
      date: dueDate.toISOString().slice(0, 10),
      completed,
      order: idx
    };
  });
}

function renderTimeline() {
  const list = document.getElementById('timelineList');
  const sorted = [...appState.timeline].sort((a, b) => new Date(a.date) - new Date(b.date));
  const done = sorted.filter(t => t.completed).length;

  document.getElementById('timelineProgress').textContent = `${done} / ${sorted.length} done`;

  list.innerHTML = sorted.map(t => `
    <div class="timeline-item ${t.completed ? 'completed' : ''}" onclick="toggleTimeline('${escapeHtml(t.id)}')" tabindex="0" role="button" aria-pressed="${t.completed}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleTimeline('${escapeHtml(t.id)}');}">
      <div class="timeline-date">${formatDate(t.date)}</div>
      <div class="timeline-title">${escapeHtml(t.title)}</div>
      <div class="timeline-desc">${escapeHtml(t.desc)}</div>
      <span class="timeline-status ${t.completed ? 'status-done' : new Date(t.date) < new Date() ? 'status-pending' : 'status-upcoming'}">
        ${t.completed ? '✓ Done' : new Date(t.date) < new Date() ? '⏳ Overdue' : '◷ Upcoming'}
      </span>
    </div>
  `).join('');
}

function toggleTimeline(id) {
  const item = appState.timeline.find(t => t.id === id);
  if (item) {
    item.completed = !item.completed;
    saveState();
    renderTimeline();
    renderStats();
  }
}

function openAddTimelineItem() {
  document.getElementById('modalTitle').innerHTML = '<span>📅 Add Milestone</span><button class="modal-close" onclick="closeModalDirect()" aria-label="Close">✕</button>';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Title</label>
      <input class="form-input" id="newTimeTitle" placeholder="e.g. Book florist">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-input" id="newTimeDesc" placeholder="Brief description">
    </div>
    <div class="form-group">
      <label class="form-label">Due Date</label>
      <input class="form-input" id="newTimeDate" type="date">
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="addTimelineItem()">Add Milestone</button>
  `;
  openModal();
}

function addTimelineItem() {
  const title = document.getElementById('newTimeTitle').value.trim();
  const desc = document.getElementById('newTimeDesc').value.trim();
  const date = document.getElementById('newTimeDate').value;
  if (!title || !date) return alert('Please fill in title and date.');
  appState.timeline.push({ id: uid(), title, desc, date, completed: false, order: appState.timeline.length });
  saveState();
  renderTimeline();
  renderStats();
  closeModalDirect();
}

// ===== VENDORS =====
function generateDefaultVendors() {
  const type = appState.eventType;
  const templates = {
    wedding: [
      { name: 'Venue Coordinator', category: 'Venue', cost: 'Included', priority: 'high' },
      { name: 'Head Caterer', category: 'Food & Beverage', cost: 'Per guest', priority: 'high' },
      { name: 'Wedding Photographer', category: 'Photography', cost: '$2,000 - $5,000', priority: 'high' },
      { name: 'Videographer', category: 'Video', cost: '$1,500 - $4,000', priority: 'medium' },
      { name: 'Florist', category: 'Décor', cost: '$800 - $3,000', priority: 'medium' },
      { name: 'DJ / Band', category: 'Entertainment', cost: '$1,000 - $3,000', priority: 'medium' },
      { name: 'Wedding Planner', category: 'Coordination', cost: '$1,500 - $5,000', priority: 'low' },
      { name: 'Cake Baker', category: 'Food', cost: '$300 - $1,000', priority: 'medium' },
      { name: 'Hair & Makeup Artist', category: 'Beauty', cost: '$200 - $600', priority: 'medium' },
      { name: 'Transportation Service', category: 'Logistics', cost: '$300 - $800', priority: 'low' }
    ],
    birthday: [
      { name: 'Venue Manager', category: 'Venue', cost: '$200 - $1,000', priority: 'high' },
      { name: 'Caterer / Restaurant', category: 'Food', cost: 'Per guest', priority: 'high' },
      { name: 'Cake Baker', category: 'Desserts', cost: '$50 - $300', priority: 'medium' },
      { name: 'DJ / Playlist Curator', category: 'Music', cost: '$200 - $800', priority: 'medium' },
      { name: 'Balloon Artist / Decorator', category: 'Décor', cost: '$100 - $500', priority: 'low' },
      { name: 'Photographer', category: 'Photography', cost: '$200 - $800', priority: 'low' },
      { name: 'Entertainer / Magician', category: 'Entertainment', cost: '$150 - $500', priority: 'low' }
    ],
    community: [
      { name: 'Venue / Park Authority', category: 'Venue', cost: 'Varies', priority: 'high' },
      { name: 'Catering Service', category: 'Food', cost: 'Per person', priority: 'high' },
      { name: 'Sound & AV Team', category: 'Technical', cost: '$300 - $1,500', priority: 'high' },
      { name: 'Security Team', category: 'Safety', cost: '$200 - $800', priority: 'medium' },
      { name: 'Tent & Equipment Rental', category: 'Rentals', cost: '$500 - $2,000', priority: 'medium' },
      { name: 'Graphic Designer', category: 'Marketing', cost: '$100 - $500', priority: 'low' },
      { name: 'Local Band / Performer', category: 'Entertainment', cost: '$300 - $1,000', priority: 'medium' },
      { name: 'Cleanup Crew', category: 'Logistics', cost: '$100 - $400', priority: 'low' }
    ]
  };

  appState.vendors = templates[type].map(v => ({
    id: uid(),
    name: v.name,
    category: v.category,
    cost: v.cost,
    priority: v.priority,
    booked: false
  }));
}

function renderVendors() {
  const grid = document.getElementById('vendorGrid');
  const booked = appState.vendors.filter(v => v.booked).length;
  document.getElementById('vendorProgress').textContent = `${booked} / ${appState.vendors.length} booked`;

  grid.innerHTML = appState.vendors.map(v => `
    <div class="vendor-card ${v.booked ? 'checked' : ''}" onclick="toggleVendor('${escapeHtml(v.id)}')" tabindex="0" role="button" aria-pressed="${v.booked}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleVendor('${escapeHtml(v.id)}');}">
      <div class="vendor-checkbox">${v.booked ? '✓' : ''}</div>
      <div class="vendor-info">
        <div class="vendor-name">${escapeHtml(v.name)}</div>
        <div class="vendor-category">${escapeHtml(v.category)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span class="vendor-cost">${escapeHtml(v.cost)}</span>
          <span class="vendor-priority priority-${v.priority}">${escapeHtml(v.priority)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleVendor(id) {
  const vendor = appState.vendors.find(v => v.id === id);
  if (vendor) {
    vendor.booked = !vendor.booked;
    saveState();
    renderVendors();
    renderStats();
  }
}

function openAddVendor() {
  document.getElementById('modalTitle').innerHTML = '<span>🏪 Add Vendor</span><button class="modal-close" onclick="closeModalDirect()">✕</button>';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Vendor Name</label>
      <input class="form-input" id="newVendorName" placeholder="e.g. Blue Sky Photography">
    </div>
    <div class="form-group">
      <label class="form-label">Category</label>
      <input class="form-input" id="newVendorCategory" placeholder="e.g. Photography">
    </div>
    <div class="form-group">
      <label class="form-label">Estimated Cost</label>
      <input class="form-input" id="newVendorCost" placeholder="e.g. $1,500">
    </div>
    <div class="form-group">
      <label class="form-label">Priority</label>
      <select class="form-select" id="newVendorPriority">
        <option value="high">High</option>
        <option value="medium" selected>Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="addVendor()">Add Vendor</button>
  `;
  openModal();
}

function addVendor() {
  const name = document.getElementById('newVendorName').value.trim();
  const category = document.getElementById('newVendorCategory').value.trim();
  const cost = document.getElementById('newVendorCost').value.trim();
  const priority = document.getElementById('newVendorPriority').value;
  if (!name) return alert('Please enter a vendor name.');
  appState.vendors.push({ id: uid(), name, category: category || 'General', cost: cost || 'TBD', priority, booked: false });
  saveState();
  renderVendors();
  renderStats();
  closeModalDirect();
}

// ===== AI CHAT =====
function getWelcomeMessage() {
  const type = appState.eventType;
  const name = appState.eventData.name;
  const theme = appState.eventData.theme;
  const msgs = {
    wedding: `Hello! 🎊 I'm your AI wedding planner for **${name}**. ${theme ? `I love your "${theme}" theme idea!` : ''} I can help with:\n\n• 🎨 Theme & color palette suggestions\n• 🍽️ Menu & catering ideas\n• 📍 Seating arrangements\n• 💐 Floral design concepts\n• 🎵 Music & entertainment picks\n\nWhat would you like to brainstorm?`,
    birthday: `Hey there! 🎉 I'm your AI party planner for **${name}**. ${theme ? `"${theme}" sounds like an awesome vibe!` : ''} I can help with:\n\n• 🎨 Theme & decoration ideas\n• 🎮 Games & activities\n• 🍰 Food & cake concepts\n• 🎁 Party favor suggestions\n• 📸 Photo booth ideas\n\nWhat are you thinking?`,
    community: `Welcome! 🌟 I'm your AI event strategist for **${name}**. ${theme ? `"${theme}" — great concept!` : ''} I can help with:\n\n• 📋 Event programming & agenda\n• 📣 Marketing & outreach strategy\n• 🤝 Volunteer coordination\n• 🎯 Engagement activities\n• 📊 Impact measurement\n\nHow can I help?`
  };
  return msgs[type];
}

function renderAiMessages() {
  const container = document.getElementById('aiMessages');
  container.innerHTML = appState.aiMessages.map(msg => `
    <div class="ai-message ${msg.role === 'user' ? 'user' : ''}">
      <div class="ai-avatar ${msg.role === 'bot' ? 'bot' : 'user-av'}">${msg.role === 'bot' ? '✨' : '👤'}</div>
      <div class="ai-bubble">${formatMarkdown(msg.text)}</div>
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

function sendAiMessage() {
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;

  appState.aiMessages.push({ role: 'user', text });
  input.value = '';
  renderAiMessages();

  // Show typing indicator
  const container = document.getElementById('aiMessages');
  const typingEl = document.createElement('div');
  typingEl.className = 'ai-message';
  typingEl.innerHTML = `
    <div class="ai-avatar bot">✨</div>
    <div class="ai-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>
  `;
  container.appendChild(typingEl);
  container.scrollTop = container.scrollHeight;

  // Simulate AI response
  setTimeout(() => {
    const response = generateAiResponse(text);
    appState.aiMessages.push({ role: 'bot', text: response });
    saveState();
    container.removeChild(typingEl);
    renderAiMessages();
  }, 1200 + Math.random() * 800);
}

function generateAiResponse(query) {
  const type = appState.eventType;
  const q = query.toLowerCase();
  const theme = appState.eventData.theme ? appState.eventData.theme.toLowerCase() : '';
  const budget = appState.eventData.budget;
  const guests = appState.eventData.guests;
  const location = appState.eventData.location;

  // Contextual AI responses based on event type and query
  if (q.includes('theme') || q.includes('color') || q.includes('style') || q.includes('decor')) {
    return getThemeResponse(type, theme, budget);
  }
  if (q.includes('food') || q.includes('menu') || q.includes('cater') || q.includes('cake') || q.includes('drink')) {
    return getFoodResponse(type, guests, budget);
  }
  if (q.includes('music') || q.includes('entertainment') || q.includes('dj') || q.includes('band') || q.includes('game')) {
    return getEntertainmentResponse(type, budget);
  }
  if (q.includes('budget') || q.includes('cost') || q.includes('save') || q.includes('cheap') || q.includes('money')) {
    return getBudgetResponse(type, budget, guests);
  }
  if (q.includes('venue') || q.includes('location') || q.includes('place')) {
    return getVenueResponse(type, guests, location);
  }
  if (q.includes('invite') || q.includes('guest') || q.includes('rsvp')) {
    return getGuestResponse(type, guests);
  }
  if (q.includes('photo') || q.includes('video') || q.includes('capture')) {
    return getPhotoResponse(type);
  }
  if (q.includes('flower') || q.includes('floral') || q.includes('bouquet')) {
    return getFloralResponse(type, theme);
  }
  if (q.includes('favor') || q.includes('gift') || q.includes('thank')) {
    return getFavorResponse(type, theme, guests);
  }
  if (q.includes('timeline') || q.includes('schedule') || q.includes('when') || q.includes('plan')) {
    return getTimelineResponse(type);
  }
  if (q.includes('stress') || q.includes('relax') || q.includes('overwhelm') || q.includes('help')) {
    return getStressResponse(type);
  }

  // Default creative response
  return getDefaultResponse(type, theme);
}

function getThemeResponse(type, theme, budget) {
  if (type === 'wedding') {
    const themes = [
      { name: 'Enchanted Garden', colors: 'Sage green, blush pink, gold', desc: 'Lush greenery, fairy lights, floral arches, and natural wood elements. Perfect for outdoor ceremonies.' },
      { name: 'Modern Minimalist', colors: 'White, charcoal, brushed gold', desc: 'Clean lines, geometric accents, monochrome florals, and sleek table settings.' },
      { name: 'Romantic Vintage', colors: 'Dusty rose, ivory, antique gold', desc: 'Lace details, candlelight, old-world charm with heirloom-style décor.' },
      { name: 'Celestial Night', colors: 'Navy, silver, deep purple', desc: 'Star-themed ceiling, constellation table numbers, mercury glass, and cosmic accents.' },
      { name: 'Coastal Chic', colors: 'Ocean blue, sand, coral', desc: 'Driftwood centerpieces, sea glass accents, and breezy, elegant coastal vibes.' }
    ];
    const pick = themes[Math.floor(Math.random() * themes.length)];
    return `🎨 Here's a beautiful theme idea:\n\n**${pick.name}**\n🎨 Colors: ${pick.colors}\n\n${pick.desc}\n\n${theme ? `This would pair beautifully with your "${theme}" vision! ` : ''}With a budget of **$${formatNum(budget)}**, I'd allocate about 10-15% to décor to make this stunning.\n\nWant me to dive deeper into any specific aspect — centerpieces, lighting, or table settings?`;
  }
  if (type === 'birthday') {
    const themes = [
      { name: 'Neon Glow Party', desc: 'UV lights, neon signs, glow sticks, fluorescent body paint, and electric-colored cocktails. Perfect for adult parties!' },
      { name: 'Tropical Paradise', desc: 'Palm leaves, tropical flowers, tiki torches, Hawaiian shirts welcome, pineapple centerpieces, and fruity drinks.' },
      { name: 'Retro Arcade', desc: 'Classic game stations, pixel art decorations, 80s music, joystick-shaped cookies, and high-score leaderboards.' },
      { name: 'Elegant Garden Tea', desc: 'Floral china, tiered cake stands, lace tablecloths, finger sandwiches, and a beautiful dessert spread.' },
      { name: 'Space Adventure', desc: 'Galaxy projector, planet decorations, astronaut photo booth, cosmic cupcakes, and star-shaped everything.' }
    ];
    const pick = themes[Math.floor(Math.random() * themes.length)];
    return `🎈 How about this theme:\n\n**${pick.name}**\n\n${pick.desc}\n\n${theme ? `This could be a cool twist on your "${theme}" idea! ` : ''}Would you like decoration specifics or activity ideas for this theme?`;
  }
  // community
  const themes = [
    { name: 'Festival of Cultures', desc: 'Celebrate diversity with cultural booths, world cuisine, traditional performances, and interactive craft stations.' },
    { name: 'Green & Clean Initiative', desc: 'Eco-friendly setup with recycled décor, tree planting, sustainability workshops, and zero-waste food stations.' },
    { name: 'Community Carnival', desc: 'Game booths, face painting, live music stage, food trucks, and a community art wall.' }
  ];
  const pick = themes[Math.floor(Math.random() * themes.length)];
  return `🎪 Great theme concept:\n\n**${pick.name}**\n\n${pick.desc}\n\n${theme ? `This aligns well with your "${theme}" vision. ` : ''}Want me to plan the activities schedule or booth layouts?`;
}

function getFoodResponse(type, guests, budget) {
  const perPerson = Math.round(budget * 0.3 / guests);
  if (type === 'wedding') {
    return `🍽️ Here are some menu ideas for **${guests} guests** (~$${perPerson}/person for food):\n\n**Cocktail Hour**\n• Bruschetta trio & artisan cheese board\n• Mini crab cakes with remoulade\n• Vegetable spring rolls\n\n**Dinner Options**\n• Herb-crusted chicken with roasted vegetables\n• Pan-seared salmon with lemon butter\n• Vegetarian: Wild mushroom risotto\n\n**Dessert**\n• 3-tier wedding cake (classic or naked style)\n• Dessert bar: macarons, mini tarts, chocolate truffles\n\n💡 **Budget Tip**: Buffet-style saves 20-30% vs. plated service, and guests love the variety!\n\nWant me to suggest specific dietary accommodation options?`;
  }
  if (type === 'birthday') {
    return `🍕 Party food ideas for **${guests} guests**:\n\n**Casual & Fun**\n• DIY taco/nacho bar\n• Mini slider station\n• Pizza & flatbread spread\n\n**Sweet Treats**\n• Custom cake with themed decorations\n• Dessert table: cupcakes, cake pops, cookies\n• Candy bar with takeaway bags\n\n**Drinks**\n• Signature cocktail/mocktail station\n• Infused water & lemonade bar\n\n💡 **Budget Tip**: Food trucks are trendy AND cost-effective for parties!\n\nWant specific recipes or cake design ideas?`;
  }
  return `🍽️ Catering ideas for **${guests} attendees**:\n\n**Options by Budget**\n• 💰 Food trucks (variety, crowd-pleasing)\n• 💰💰 Buffet catering (flexible portions)\n• 💰💰💰 Plated meals (formal events)\n\n**Popular Choices**\n• BBQ station with sides\n• International food court style\n• Healthy options: grain bowls, salads\n\n💡 **Tip**: Partner with local restaurants for sponsorship — they get exposure, you save budget!\n\nNeed help with dietary accommodations or portion planning?`;
}

function getEntertainmentResponse(type, budget) {
  if (type === 'wedding') {
    return `🎵 Entertainment ideas:\n\n**Music**\n• Live band for reception ($2,000-$5,000)\n• DJ with lighting package ($1,000-$2,500)\n• String quartet for ceremony ($600-$1,500)\n• Acoustic duo for cocktail hour\n\n**Fun Activities**\n• Photo booth with props & instant prints\n• Dancing shoes station (flip flops for guests)\n• Sparkler send-off\n• Lawn games during cocktail hour\n\n**Unique Touches**\n• First dance choreography lessons\n• Live artist painting the reception\n• Fireworks finale\n\n💡 Many DJs offer ceremony + reception packages for better value!`;
  }
  if (type === 'birthday') {
    return `🎮 Entertainment ideas:\n\n**Activities**\n• Karaoke machine rental\n• Photo booth with themed props\n• Game tournaments (board games, video games)\n• Trivia about the birthday person\n\n**Live Entertainment**\n• DJ with dance floor lighting\n• Comedian or improv troupe\n• Caricature artist\n• Magic show\n\n**Unique Ideas**\n• Mixology / cocktail-making class\n• Murder mystery dinner\n• Paint & sip session\n• Outdoor movie screening\n\nWhat vibe are you going for — high energy or relaxed?`;
  }
  return `🎶 Community event entertainment:\n\n**Main Stage**\n• Local bands & performers\n• Open mic / talent show\n• Dance performances\n\n**Interactive**\n• Photo booth with community props\n• DIY craft stations\n• Cooking demonstrations\n• Sports tournaments\n\n**Family-Friendly**\n• Face painting & balloon artists\n• Bounce houses & games\n• Scavenger hunt around the venue\n\n💡 **Tip**: Reach out to local schools and arts programs — they often perform for free for exposure!`;
}

function getBudgetResponse(type, budget, guests) {
  const perGuest = Math.round(budget / guests);
  return `💰 Smart budget strategies for your **$${formatNum(budget)}** budget (**$${perGuest}/guest**):\n\n**Top Money-Saving Tips**\n1. 📅 Choose off-peak dates (weekdays or non-holiday weekends save 20-40%)\n2. 🌸 Use in-season flowers — saves 30% on florals\n3. 📸 Book mid-career photographers — amazing quality, lower rates\n4. 🍽️ Brunch or lunch events cost 30% less than dinner\n5. ✉️ Go digital with invitations — save $200-500\n\n**Where to Splurge**\n• Venue (sets the entire tone)\n• Photography (memories last forever)\n• Food quality (guests always remember the food)\n\n**Where to Save**\n• DIY centerpieces & favors\n• Spotify playlist instead of DJ\n• Borrow décor from friends/family\n\nWant me to create a detailed budget optimization plan?`;
}

function getVenueResponse(type, guests, location) {
  return `📍 Venue recommendations for **${guests} guests** in **${location}**:\n\n**Venue Types to Consider**\n${type === 'wedding' ? '• 🏛️ Historic estates & mansions\n• 🌿 Botanical gardens\n• 🍷 Wineries & vineyards\n• 🏖️ Beachfront venues\n• 🏨 Boutique hotels' :
  type === 'birthday' ? '• 🏠 Private dining rooms\n• 🎳 Entertainment venues\n• 🏖️ Rooftop bars\n• 🌳 Park pavilions\n• 🎨 Art gallery spaces' :
  '• 🏛️ Community centers\n• 🌳 Public parks\n• 📚 Library event spaces\n• ⛪ Houses of worship\n• 🏫 School auditoriums'}\n\n**Key Questions to Ask**\n✅ What's included (tables, chairs, AV)?\n✅ Catering restrictions?\n✅ Setup/teardown time?\n✅ Parking capacity?\n✅ Rain backup plan?\n\n💡 **Tip**: Visit venues at the same time of day as your event to check lighting!\n\nWant me to help draft venue inquiry emails?`;
}

function getGuestResponse(type, guests) {
  return `👥 Guest management for **${guests} guests**:\n\n**Invitation Timeline**\n• Save-the-dates: 6-8 months before\n• Formal invitations: 6-8 weeks before\n• RSVP deadline: 3 weeks before\n\n**Smart Tips**\n• Expect 15-20% decline rate — invite accordingly\n• Use digital RSVP (saves time & money)\n• Create a wedding website with all details\n• Consider a B-list for last-minute additions\n\n**Seating Strategy**\n• Mix friend groups to encourage mingling\n• Keep families together\n• Place elderly near exits & restrooms\n• Put the fun tables near the dance floor\n\nNeed help with invitation wording or seating charts?`;
}

function getPhotoResponse(type) {
  return `📸 Photography & video tips:\n\n**Must-Have Shots**\n${type === 'wedding' ? '• Getting ready moments\n• First look reaction\n• Ceremony emotions\n• Ring exchange close-up\n• Group formals\n• Reception highlights\n• Sparkler exit' :
  type === 'birthday' ? '• Birthday person arrival/surprise\n• Cake cutting & candle blowing\n• Group photos\n• Candid moments\n• Activity highlights\n• Gift opening reactions' :
  '• Event setup transformation\n• Crowd shots\n• Speaker/performer highlights\n• Community interactions\n• Volunteer team photos\n• Impact moments'}\n\n**Budget-Friendly Ideas**\n• Disposable cameras on each table\n• Photo sharing hashtag for guests\n• Ring light selfie station\n• Polaroid guest book\n\n💡 Golden hour (1 hour before sunset) creates the most magical photos!`;
}

function getFloralResponse(type, theme) {
  return `💐 Floral design ideas${theme ? ` for your "${theme}" theme` : ''}:\n\n**Trending Arrangements**\n• Wildflower meadow style (casual, romantic)\n• Monochrome white & green (modern, elegant)\n• Dried flower accents (boho, sustainable)\n• Tropical statement pieces (bold, colorful)\n\n**Budget-Smart Floral Tips**\n• Use seasonal flowers — 30-40% cheaper\n• Repurpose ceremony florals at reception\n• Mix real flowers with quality faux\n• Greenery-heavy designs are affordable & stunning\n• Potted plants as centerpieces (guests take home!)\n\n**In-Season by Time of Year**\n🌸 Spring: Peonies, ranunculus, tulips\n☀️ Summer: Dahlias, sunflowers, hydrangeas\n🍂 Fall: Chrysanthemums, marigolds, roses\n❄️ Winter: Amaryllis, anemones, holly\n\nWant specific arrangement sketches or color combinations?`;
}

function getFavorResponse(type, theme, guests) {
  const budget = Math.round(appState.eventData.budget * 0.03 / guests);
  return `🎁 Party favor ideas (~$${budget}/guest):\n\n**Popular Picks**\n${type === 'wedding' ? '• Personalized candles with your names & date\n• Mini succulents in custom pots\n• Custom cookie boxes\n• Small bottles of local honey or olive oil\n• Seed packets ("Watch our love grow")' :
  type === 'birthday' ? '• Custom candy bags\n• Mini photo frames with party pics\n• Themed keychains or magnets\n• DIY bath bombs or lip balm\n• Small potted plants' :
  '• Branded tote bags\n• Seed packets for community gardens\n• Custom stickers or pins\n• Reusable water bottles\n• Local artisan products'}\n\n**DIY Options (Budget-Friendly)**\n• Mason jar treats\n• Homemade jam or cookies\n• Printed thank-you cards with a personal note\n\n💡 Skip favors that get thrown away — edible or useful items have the highest appreciation rate!`;
}

function getTimelineResponse(type) {
  return `📅 Planning timeline tips:\n\n**Phase 1 — Foundation** (ASAP)\n✅ Lock in budget & date\n✅ Book venue (most important!)\n✅ Start guest list\n\n**Phase 2 — Build** (3-6 months out)\n✅ Book major vendors\n✅ Choose theme & colors\n✅ Plan menu\n\n**Phase 3 — Details** (1-3 months out)\n✅ Finalize decorations\n✅ Send invitations\n✅ Confirm all bookings\n\n**Phase 4 — Final Week**\n✅ Confirm headcount\n✅ Create day-of timeline\n✅ Pack emergency kit\n✅ Delegate tasks to helpers\n\n💡 Check the **Timeline** tab — I've already created a customized timeline for you!\n\nWant me to adjust any milestones?`;
}

function getStressResponse(type) {
  return `🧘 Take a deep breath — you've got this! Here's how to stay calm:\n\n**Stress-Busting Tips**\n1. 📋 Trust your checklist — that's what it's for!\n2. 🤝 Delegate tasks — you don't have to do everything\n3. 📅 Set "planning-free" days for yourself\n4. 💬 Communicate openly with your partner/team\n5. 🎯 Focus on what matters: celebrating with loved ones\n\n**Remember**\n• No event is 100% perfect — and that's okay!\n• Guests won't notice small imperfections\n• The best events feel authentic, not over-produced\n• Your enjoyment sets the tone for everyone\n\n**Quick Win**\n✨ Look at your timeline — you've already accomplished so much! Check off completed items to see your progress.\n\nI'm here anytime you need help or encouragement! 💪`;
}

function getDefaultResponse(type, theme) {
  const responses = [
    `That's a great thought! For your **${capitalize(type)}**${theme ? ` with a "${theme}" theme` : ''}, here are some ideas:\n\n• Consider creating a signature cocktail/mocktail that matches your theme\n• Set up a memorable photo opportunity area\n• Plan a surprise element — guests love unexpected moments!\n• Create a custom playlist that tells your story\n\nWhat specific aspect would you like me to dive deeper into?`,
    `I love your enthusiasm! Here's what I'd suggest for a standout **${capitalize(type)}**:\n\n• **Personalization** is key — add touches that reflect your personality\n• **Lighting** transforms any venue — string lights, candles, uplighting\n• **Interactive elements** keep guests engaged all night\n• **A great timeline** ensures everything flows smoothly\n\nTell me more about what you're envisioning, and I'll get specific! 🎯`,
    `Great question! For your **${capitalize(type)}** with **${appState.eventData.guests} guests**, I'd focus on:\n\n🎨 **Experience Design**: Think about the guest journey from arrival to departure\n🎵 **Atmosphere**: Music, lighting, and scent create lasting memories\n🍽️ **Food Moments**: Surprise courses or interactive food stations\n📸 **Memory Makers**: Unique photo ops and keepsakes\n\nWhich of these resonates most with you? I'll create a detailed plan!`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ===== AI IDEAS =====
function generateIdeasData() {
  const type = appState.eventType;
  const theme = appState.eventData.theme || '';

  const allIdeas = {
    wedding: [
      { tag: '🎨 Theme', title: 'Interactive Table Centerpieces', text: 'Use terrariums, puzzle boxes, or conversation-starter cards as centerpieces that double as guest activities.' },
      { tag: '📸 Memory', title: 'Time Capsule Guest Book', text: 'Have guests write letters for you to open on anniversaries. Provide beautiful stationery and sealing wax.' },
      { tag: '🍽️ Food', title: 'Late-Night Snack Station', text: 'Set up a gourmet comfort food bar at 10pm — mini burgers, grilled cheese, or a pizza oven. Guests go crazy for this!' },
      { tag: '🎵 Fun', title: 'First Dance Flashmob', text: 'Secretly coordinate with your wedding party to join your first dance midway through. Create a choreographed surprise!' },
      { tag: '💐 Décor', title: 'Living Flower Wall', text: 'Create a lush flower wall photo backdrop that doubles as décor. Add your hashtag in neon for maximum impact.' },
      { tag: '✨ Unique', title: 'Drone Light Show', text: 'Replace fireworks with an eco-friendly drone light show that spells out your initials in the sky.' },
      { tag: '🎁 Favor', title: 'Charity Donation Favors', text: 'Instead of traditional favors, donate to a cause meaningful to you. Give guests a beautiful card explaining the impact.' },
      { tag: '🎨 DIY', title: 'Custom Scent Bar', text: 'Set up a perfume/cologne blending station where guests create their own signature scent as a memorable favor.' }
    ],
    birthday: [
      { tag: '🎮 Activity', title: 'Memory Lane Photo Timeline', text: 'Create a photo timeline from birth to now along the venue walls. Add fun captions and let guests add notes.' },
      { tag: '🎨 Theme', title: 'Decade-Themed Rooms', text: 'Each room represents a decade of life with music, photos, and décor from that era.' },
      { tag: '🍕 Food', title: 'DIY Food Station', text: 'Set up build-your-own stations: tacos, ice cream sundaes, or pizza. Interactive and delicious!' },
      { tag: '📸 Memory', title: 'Video Message Booth', text: 'Set up a video recording booth where guests leave birthday messages. Compile into a surprise video.' },
      { tag: '🎵 Fun', title: 'Lip Sync Battle', text: 'Organize a lip sync battle with props and costumes. Give out silly awards for best performance.' },
      { tag: '✨ Unique', title: 'Surprise Celebrity Video', text: 'Book a personalized celebrity video message (via Cameo) to play during the party.' },
      { tag: '🎁 Favor', title: 'Custom Spotify Playlist Cards', text: 'Create QR code cards linking to a curated playlist of songs that define each year of their life.' },
      { tag: '🎨 DIY', title: 'Art Canvas Activity', text: 'Set up easels where guests each paint a section of a large canvas — becomes a unique art piece!' }
    ],
    community: [
      { tag: '🤝 Engage', title: 'Community Mural Project', text: 'Set up a large canvas where attendees contribute to a collaborative mural that stays in the community.' },
      { tag: '📢 Outreach', title: 'Social Media Challenge', text: 'Create a viral challenge related to your cause. Award prizes for the most creative entries.' },
      { tag: '🍽️ Food', title: 'International Food Court', text: 'Invite families from different cultures to share their traditional dishes. Celebrate diversity through food!' },
      { tag: '🎵 Stage', title: 'Open Mic & Talent Show', text: 'Give community members a platform to perform — singing, poetry, comedy, dance. Everyone has hidden talents!' },
      { tag: '🌱 Impact', title: 'Tree Planting Ceremony', text: 'Plant a community tree or garden as a lasting symbol of the event. Add a plaque with the date.' },
      { tag: '📸 Memory', title: 'Community Time Capsule', text: 'Collect items, letters, and photos to seal in a time capsule. Set a date to open it in 10-25 years.' },
      { tag: '🎯 Activity', title: 'Skill-Sharing Workshops', text: 'Organize 30-minute workshops where community members teach each other skills — cooking, coding, crafts.' },
      { tag: '✨ Unique', title: 'Wishes Lantern Release', text: 'Have attendees write wishes on eco-friendly paper lanterns for a magical evening release ceremony.' }
    ]
  };

  appState.ideas = allIdeas[type] || allIdeas.wedding;
}

function generateIdeas() {
  generateIdeasData();
  // Shuffle
  appState.ideas.sort(() => Math.random() - 0.5);
  renderIdeas();
}

function renderIdeas() {
  const grid = document.getElementById('ideasGrid');
  const tagColors = {
    '🎨': 'badge-purple', '📸': 'badge-pink', '🍽️': 'badge-orange', '🎵': 'badge-green',
    '💐': 'badge-pink', '✨': 'badge-purple', '🎁': 'badge-orange', '🎮': 'badge-green',
    '🤝': 'badge-green', '📢': 'badge-orange', '🌱': 'badge-green', '🎯': 'badge-purple',
    '🍕': 'badge-orange'
  };

  grid.innerHTML = appState.ideas.map(idea => {
    const emoji = idea.tag.split(' ')[0];
    const colorClass = tagColors[emoji] || 'badge-purple';
    return `
      <div class="idea-card">
        <span class="idea-tag ${colorClass}">${idea.tag}</span>
        <h4>${idea.title}</h4>
        <p>${idea.text}</p>
      </div>
    `;
  }).join('');
}

// ===== MODAL =====
function openModal() {
  document.getElementById('modalOverlay').classList.add('active');
}
function closeModal(e) {
  if (e.target === document.getElementById('modalOverlay')) {
    closeModalDirect();
  }
}
function closeModalDirect() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// ===== EXPORT =====
function exportPlan() {
  const data = appState;
  const spent = data.budget.items.reduce((s, i) => s + i.amount, 0);
  const remaining = data.budget.total - spent;
  const vendorsDone = data.vendors.filter(v => v.booked).length;
  const timelineDone = data.timeline.filter(t => t.completed).length;

  let text = `═══════════════════════════════════════\n`;
  text += `  EventGenie — Event Plan Export\n`;
  text += `═══════════════════════════════════════\n\n`;
  text += `📌 Event: ${data.eventData.name}\n`;
  text += `📅 Date: ${formatDate(data.eventData.date)}\n`;
  text += `📍 Location: ${data.eventData.location}\n`;
  text += `👥 Guests: ${data.eventData.guests}\n`;
  text += `🎨 Theme: ${data.eventData.theme || 'TBD'}\n\n`;

  text += `───── 💰 BUDGET ─────\n`;
  text += `Total: $${formatNum(data.budget.total)}\n`;
  text += `Allocated: $${formatNum(spent)}\n`;
  text += `Remaining: $${formatNum(remaining)}\n\n`;
  data.budget.items.forEach(item => {
    text += `  ${item.icon} ${item.name}: $${formatNum(item.amount)}\n`;
  });

  text += `\n───── 📅 TIMELINE ─────\n`;
  text += `Progress: ${timelineDone}/${data.timeline.length}\n\n`;
  [...data.timeline].sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    text += `  ${t.completed ? '✅' : '⬜'} [${formatDate(t.date)}] ${t.title}\n`;
    text += `     ${t.desc}\n`;
  });

  text += `\n───── 🏪 VENDORS ─────\n`;
  text += `Booked: ${vendorsDone}/${data.vendors.length}\n\n`;
  data.vendors.forEach(v => {
    text += `  ${v.booked ? '✅' : '⬜'} ${v.name} (${v.category}) — ${v.cost} [${v.priority}]\n`;
  });

  text += `\n═══════════════════════════════════════\n`;
  text += `  Generated by EventGenie on ${new Date().toLocaleDateString()}\n`;
  text += `═══════════════════════════════════════\n`;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `EventGenie_${data.eventData.name.replace(/\s+/g, '_')}_Plan.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function resetPlan() {
  if (confirm('Are you sure you want to reset? All planning data will be lost.')) {
    localStorage.removeItem('eventgenie_state');
    appState = {
      currentView: 'hero',
      eventType: null,
      eventData: null,
      budget: { items: [], total: 0 },
      timeline: [],
      vendors: [],
      aiMessages: [],
      ideas: []
    };
    if (window._cdInterval) clearInterval(window._cdInterval);
    goHome();
  }
}

// ===== UTILITIES =====
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatNum(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  return n.toLocaleString('en-US');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMarkdown(text) {
  if (!text) return '';
  // Sanitize first to protect against script injection
  const safe = escapeHtml(text);
  // Transform safe markdown patterns
  return safe
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^• (.*)$/gm, '<span style="display:block;padding-left:16px;position:relative;">• $1</span>')
    .replace(/^(\d+)\. (.*)$/gm, '<span style="display:block;padding-left:16px;">$1. $2</span>')
    .replace(/^([✅⬜✓]) (.*)$/gm, '<span style="display:block;padding-left:16px;">$1 $2</span>')
    .replace(/\n/g, '<br>');
}

// ===== ACCESSIBILITY & KEYBOARD =====
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModalDirect();
    }
  });

  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', () => {
    loadState();
  });
}

// Export module for automated testing (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    appState,
    escapeHtml,
    capitalize,
    formatNum,
    formatDate,
    formatMarkdown,
    uid
  };
}
