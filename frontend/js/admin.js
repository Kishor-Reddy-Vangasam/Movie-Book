/**
 * admin.js — MovieBook Admin Dashboard SPA
 * Sidebar navigation with CRUD tables and modal forms.
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const adminState = {
  user: null,
  token: null,
  currentSection: 'dashboard',
};

// ── Auth ───────────────────────────────────────────────────────────────────
function loadAdminAuth() {
  adminState.token = localStorage.getItem('mb_token');
  const u = localStorage.getItem('mb_user');
  adminState.user = u ? JSON.parse(u) : null;
}

// ── API Layer ──────────────────────────────────────────────────────────────
const api = {
  _request: async (method, path, body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (adminState.token) headers['Authorization'] = `Bearer ${adminState.token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, opts);
      const data = await res.json();
      if (res.status === 401) {
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => window.location.href = 'index.html#/login', 1500);
      }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { success: false, message: 'Network error' } };
    }
  },
  get:    (path)       => api._request('GET',    path),
  post:   (path, body) => api._request('POST',   path, body),
  put:    (path, body) => api._request('PUT',    path, body),
  delete: (path)       => api._request('DELETE', path),
};

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('fadeOut'); setTimeout(() => toast.remove(), 350); }, duration);
}

// ── Utilities ──────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return '—';
  try { return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return str; }
}
function formatCurrency(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }
function esc(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function statusBadge(status) {
  const map = {
    active: 'badge-success', confirmed: 'badge-success', latest: 'badge-info',
    blocked: 'badge-danger', cancelled: 'badge-danger',
    upcoming: 'badge-warning', pending: 'badge-warning',
    popular: 'badge-primary', completed: 'badge-primary',
    inactive: 'badge-gray', customer: 'badge-info', admin: 'badge-primary',
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${esc(status)}</span>`;
}

function loadingRow(cols) {
  return `<tr class="loading-row"><td colspan="${cols}"><div class="spinner"></div> Loading...</td></tr>`;
}
function emptyRow(cols, text = 'No data found') {
  return `<tr class="empty-row"><td colspan="${cols}"><span class="empty-icon">📭</span>${text}</td></tr>`;
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal(titleText, bodyHtml, footer = '') {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = titleText;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footer;
  overlay.classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

async function confirmDialog(message, onConfirm) {
  openModal('Confirm Action',
    `<div class="confirm-icon">⚠️</div><p class="confirm-message">${message}</p>
     <p style="text-align:center;color:var(--text-dim);font-size:0.85rem;margin-top:6px">This action cannot be undone.</p>`,
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="closeModal();(${onConfirm.toString()})()">Confirm</button>`
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function setActiveLink(section) {
  adminState.currentSection = section;
  document.querySelectorAll('.sidebar-link').forEach(l =>
    l.classList.toggle('active', l.dataset.section === section));
  document.querySelector('.topbar-title').textContent =
    section.charAt(0).toUpperCase() + section.slice(1);
}

function initSidebar() {
  document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
    link.addEventListener('click', () => {
      setActiveLink(link.dataset.section);
      loadSection(link.dataset.section);
    });
  });

  // Set user info
  if (adminState.user) {
    document.getElementById('sidebar-user-name').textContent = adminState.user.name || 'Admin';
    document.getElementById('sidebar-avatar').textContent = (adminState.user.name || 'A')[0].toUpperCase();
  }
}

async function loadSection(section) {
  const content = document.getElementById('admin-content');
  content.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:300px"><div class="spinner" style="width:36px;height:36px;border-width:3px"></div></div>`;

  const sections = {
    dashboard: renderDashboard,
    movies:    renderMovies,
    theatres:  renderTheatres,
    screens:   renderScreens,
    shows:     renderShows,
    bookings:  renderBookingsSection,
    users:     renderUsers,
  };

  if (sections[section]) await sections[section]();
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
async function renderDashboard() {
  const res = await api.get('/admin/dashboard/');
  if (!res.ok) {
    document.getElementById('admin-content').innerHTML =
      `<div style="text-align:center;padding:60px;color:var(--error)">Failed to load dashboard data.</div>`;
    return;
  }
  const d = res.data.data;

  const stats = [
    { label: 'Total Movies',    value: d.total_movies,    icon: '🎬', cls: 'stat-purple' },
    { label: 'Total Theatres',  value: d.total_theatres,  icon: '🏛',  cls: 'stat-blue'   },
    { label: 'Total Screens',   value: d.total_screens,   icon: '🖥',  cls: 'stat-cyan'   },
    { label: 'Total Shows',     value: d.total_shows,     icon: '🎭', cls: 'stat-pink'   },
    { label: 'Total Bookings',  value: d.total_bookings,  icon: '🎟️', cls: 'stat-green'  },
    { label: 'Total Users',     value: d.total_users,     icon: '👥', cls: 'stat-yellow' },
    { label: "Today's Revenue", value: formatCurrency(d.today_revenue),   icon: '💰', cls: 'stat-orange' },
    { label: 'Monthly Revenue', value: formatCurrency(d.monthly_revenue), icon: '📈', cls: 'stat-red'    },
  ];

  const topMoviesHtml = (d.top_movies || []).length
    ? (d.top_movies || []).map((m, i) => `
      <div class="top-movie-item">
        <div class="top-movie-rank">#${i + 1}</div>
        ${m.poster ? `<img src="${m.poster}" class="top-movie-poster" alt="">` : `<div class="table-poster-placeholder">🎬</div>`}
        <div class="top-movie-info">
          <div class="top-movie-title">${esc(m.title)}</div>
          <div class="top-movie-tickets">${m.tickets_sold} tickets sold</div>
        </div>
        <div class="top-movie-revenue">${formatCurrency(m.revenue)}</div>
      </div>`).join('')
    : `<div style="text-align:center;padding:32px;color:var(--text-muted)">No booking data yet</div>`;

  document.getElementById('admin-content').innerHTML = `
    <div class="stats-grid">
      ${stats.map(s => `<div class="stat-card ${s.cls}">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-info">
          <div class="stat-value">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>
      </div>`).join('')}
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <span style="font-size:1.2rem">🏆</span>
        <span class="section-card-title">Top Movies by Bookings</span>
      </div>
      <div class="top-movies-list">${topMoviesHtml}</div>
    </div>`;
}

// ── MOVIES ─────────────────────────────────────────────────────────────────
async function renderMovies() {
  const res = await api.get('/movies/');
  const movies = res.ok ? (res.data.data || []) : [];

  document.getElementById('admin-content').innerHTML = `
    <div class="section-card">
      <div class="section-card-header">
        <span>🎬</span>
        <span class="section-card-title">Movies (${movies.length})</span>
        <div class="table-search"><span class="table-search-icon">🔍</span>
          <input type="text" placeholder="Search movies..." oninput="filterTable(this, 'movies-tbody')"></div>
        <button class="btn btn-primary btn-sm" onclick="openAddMovieModal()">+ Add Movie</button>
      </div>
      <div class="table-container">
        <table>
          <thead><tr>
            <th>Poster</th><th>Title</th><th>Genre</th><th>Language</th>
            <th>Rating</th><th>Duration</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody id="movies-tbody">
            ${movies.length ? movies.map(movieRow).join('') : emptyRow(8)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function movieRow(m) {
  return `<tr>
    <td>${m.poster ? `<img src="${m.poster}" class="table-poster" alt="">` : `<div class="table-poster-placeholder">🎬</div>`}</td>
    <td><strong>${esc(m.title)}</strong><br><small style="color:var(--text-dim)">${esc(m.director || '')}</small></td>
    <td>${esc(m.genre)}</td>
    <td>${esc(m.language)}</td>
    <td>⭐ ${Number(m.rating || 0).toFixed(1)}</td>
    <td>${m.duration} min</td>
    <td>${statusBadge(m.status)}</td>
    <td><div class="action-btns">
      <button class="action-btn edit" title="Edit" onclick='openEditMovieModal(${JSON.stringify(m)})'>✏️</button>
      <button class="action-btn delete" title="Delete" onclick="deleteMovie('${m._id}')">🗑️</button>
    </div></td>
  </tr>`;
}

function openAddMovieModal() {
  openModal('Add Movie', movieForm({}),
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveMovie()">Add Movie</button>`);
}
function openEditMovieModal(m) {
  openModal('Edit Movie', movieForm(m),
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveMovie('${m._id}')">Save Changes</button>`);
}

function movieForm(m) {
  const statuses = ['latest', 'popular', 'upcoming'];
  return `<div class="form-grid">
    <div class="form-group"><label class="form-label">Title *</label>
      <input class="form-input" id="mf-title" value="${esc(m.title || '')}" placeholder="Movie title"></div>
    <div class="form-group"><label class="form-label">Director</label>
      <input class="form-input" id="mf-director" value="${esc(m.director || '')}" placeholder="Director name"></div>
    <div class="form-group"><label class="form-label">Genre *</label>
      <select class="form-select" id="mf-genre">
        ${['Action','Comedy','Drama','Horror','Romance','Thriller','Sci-Fi','Fantasy','Animation','Documentary'].map(g =>
          `<option value="${g}" ${m.genre === g ? 'selected' : ''}>${g}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Language *</label>
      <select class="form-select" id="mf-language">
        ${['English','Hindi','Tamil','Telugu','Malayalam','Kannada','Marathi'].map(l =>
          `<option value="${l}" ${m.language === l ? 'selected' : ''}>${l}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Duration (min) *</label>
      <input class="form-input" id="mf-duration" type="number" value="${m.duration || ''}" placeholder="120"></div>
    <div class="form-group"><label class="form-label">Rating (0-10)</label>
      <input class="form-input" id="mf-rating" type="number" step="0.1" min="0" max="10" value="${m.rating || ''}" placeholder="7.5"></div>
    <div class="form-group"><label class="form-label">Release Date</label>
      <input class="form-input" id="mf-release" type="date" value="${m.release_date || ''}"></div>
    <div class="form-group"><label class="form-label">Status</label>
      <select class="form-select" id="mf-status">
        ${statuses.map(s => `<option value="${s}" ${m.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select></div>
    <div class="form-group form-full"><label class="form-label">Description</label>
      <textarea class="form-textarea" id="mf-description" rows="3">${esc(m.description || '')}</textarea></div>
    <div class="form-group form-full"><label class="form-label">Poster URL</label>
      <input class="form-input" id="mf-poster" value="${esc(m.poster || '')}" placeholder="https://..."></div>
    <div class="form-group form-full"><label class="form-label">Banner URL</label>
      <input class="form-input" id="mf-banner" value="${esc(m.banner || '')}" placeholder="https://..."></div>
    <div class="form-group form-full"><label class="form-label">Trailer URL (YouTube embed)</label>
      <input class="form-input" id="mf-trailer" value="${esc(m.trailer || '')}" placeholder="https://www.youtube.com/embed/..."></div>
    <div class="form-group form-full"><label class="form-label">Cast (comma-separated)</label>
      <input class="form-input" id="mf-cast" value="${esc(Array.isArray(m.cast) ? m.cast.join(', ') : (m.cast || ''))}" placeholder="Actor 1, Actor 2"></div>
  </div>`;
}

async function saveMovie(movieId = null) {
  const title = document.getElementById('mf-title').value.trim();
  const genre = document.getElementById('mf-genre').value;
  const language = document.getElementById('mf-language').value;
  const duration = document.getElementById('mf-duration').value;
  if (!title || !genre || !language || !duration) { showToast('Please fill required fields', 'warning'); return; }

  const castVal = document.getElementById('mf-cast').value;
  const body = {
    title, genre, language,
    duration: parseInt(duration),
    rating: parseFloat(document.getElementById('mf-rating').value) || 0,
    director: document.getElementById('mf-director').value.trim(),
    description: document.getElementById('mf-description').value.trim(),
    release_date: document.getElementById('mf-release').value,
    poster: document.getElementById('mf-poster').value.trim(),
    banner: document.getElementById('mf-banner').value.trim(),
    trailer: document.getElementById('mf-trailer').value.trim(),
    cast: castVal ? castVal.split(',').map(s => s.trim()).filter(Boolean) : [],
    status: document.getElementById('mf-status').value,
  };

  const res = movieId ? await api.put(`/movies/${movieId}/`, body) : await api.post('/movies/', body);
  if (res.ok) {
    showToast(movieId ? 'Movie updated!' : 'Movie added!', 'success');
    closeModal();
    renderMovies();
  } else {
    showToast(res.data.message || 'Failed to save movie', 'error');
  }
}

async function deleteMovie(id) {
  confirmDialog('Delete this movie?', async () => {
    const res = await api.delete(`/movies/${id}/`);
    if (res.ok) { showToast('Movie deleted', 'success'); renderMovies(); }
    else showToast(res.data.message || 'Delete failed', 'error');
  });
}

// ── THEATRES ───────────────────────────────────────────────────────────────
async function renderTheatres() {
  const res = await api.get('/theatres/');
  const theatres = res.ok ? (res.data.data || []) : [];

  document.getElementById('admin-content').innerHTML = `
    <div class="section-card">
      <div class="section-card-header">
        <span>🏛</span>
        <span class="section-card-title">Theatres (${theatres.length})</span>
        <div class="table-search"><span class="table-search-icon">🔍</span>
          <input type="text" placeholder="Search theatres..." oninput="filterTable(this, 'theatres-tbody')"></div>
        <button class="btn btn-primary btn-sm" onclick="openAddTheatreModal()">+ Add Theatre</button>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Name</th><th>City</th><th>Location</th><th>Screens</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="theatres-tbody">
            ${theatres.length ? theatres.map(theatreRow).join('') : emptyRow(6)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function theatreRow(t) {
  return `<tr>
    <td><strong>${esc(t.name)}</strong></td>
    <td>${esc(t.city)}</td>
    <td>${esc(t.location)}</td>
    <td>${t.screens}</td>
    <td>${statusBadge(t.status)}</td>
    <td><div class="action-btns">
      <button class="action-btn edit" onclick='openEditTheatreModal(${JSON.stringify(t)})'>✏️</button>
      <button class="action-btn delete" onclick="deleteTheatre('${t._id}')">🗑️</button>
    </div></td>
  </tr>`;
}

function theatreForm(t) {
  return `<div class="form-grid">
    <div class="form-group form-full"><label class="form-label">Name *</label>
      <input class="form-input" id="tf-name" value="${esc(t.name || '')}" placeholder="PVR Cinemas"></div>
    <div class="form-group"><label class="form-label">City *</label>
      <input class="form-input" id="tf-city" value="${esc(t.city || '')}" placeholder="Mumbai"></div>
    <div class="form-group"><label class="form-label">Location</label>
      <input class="form-input" id="tf-location" value="${esc(t.location || '')}" placeholder="Phoenix Mall"></div>
    <div class="form-group form-full"><label class="form-label">Address</label>
      <input class="form-input" id="tf-address" value="${esc(t.address || '')}" placeholder="Full address"></div>
    <div class="form-group"><label class="form-label">Number of Screens</label>
      <input class="form-input" id="tf-screens" type="number" value="${t.screens || 1}" min="1"></div>
    <div class="form-group"><label class="form-label">Status</label>
      <select class="form-select" id="tf-status">
        <option value="active" ${t.status === 'active' ? 'selected' : ''}>Active</option>
        <option value="inactive" ${t.status === 'inactive' ? 'selected' : ''}>Inactive</option>
      </select></div>
  </div>`;
}

function openAddTheatreModal() {
  openModal('Add Theatre', theatreForm({}),
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveTheatre()">Add Theatre</button>`);
}
function openEditTheatreModal(t) {
  openModal('Edit Theatre', theatreForm(t),
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveTheatre('${t._id}')">Save Changes</button>`);
}

async function saveTheatre(id = null) {
  const name = document.getElementById('tf-name').value.trim();
  const city = document.getElementById('tf-city').value.trim();
  if (!name || !city) { showToast('Name and city are required', 'warning'); return; }
  const body = {
    name, city,
    location: document.getElementById('tf-location').value.trim(),
    address: document.getElementById('tf-address').value.trim(),
    screens: parseInt(document.getElementById('tf-screens').value) || 1,
    status: document.getElementById('tf-status').value,
  };
  const res = id ? await api.put(`/theatres/${id}/`, body) : await api.post('/theatres/', body);
  if (res.ok) { showToast(id ? 'Theatre updated!' : 'Theatre added!', 'success'); closeModal(); renderTheatres(); }
  else showToast(res.data.message || 'Failed', 'error');
}

async function deleteTheatre(id) {
  confirmDialog('Delete this theatre?', async () => {
    const res = await api.delete(`/theatres/${id}/`);
    if (res.ok) { showToast('Theatre deleted', 'success'); renderTheatres(); }
    else showToast(res.data.message || 'Delete failed', 'error');
  });
}

// ── SCREENS ────────────────────────────────────────────────────────────────
async function renderScreens() {
  const [screensRes, theatresRes] = await Promise.all([api.get('/screens/'), api.get('/theatres/')]);
  const screens = screensRes.ok ? (screensRes.data.data || []) : [];
  const theatres = theatresRes.ok ? (theatresRes.data.data || []) : [];
  const theatreMap = Object.fromEntries(theatres.map(t => [t._id, t]));

  document.getElementById('admin-content').innerHTML = `
    <div class="section-card">
      <div class="section-card-header">
        <span>🖥</span>
        <span class="section-card-title">Screens (${screens.length})</span>
        <div class="table-search"><span class="table-search-icon">🔍</span>
          <input type="text" placeholder="Search screens..." oninput="filterTable(this, 'screens-tbody')"></div>
        <button class="btn btn-primary btn-sm" onclick="openAddScreenModal(${JSON.stringify(theatres).replace(/"/g,'&quot;')})">+ Add Screen</button>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Theatre</th><th>Screen Name</th><th>Type</th><th>Rows</th><th>Seats/Row</th><th>Total Seats</th><th>Actions</th></tr></thead>
          <tbody id="screens-tbody">
            ${screens.length ? screens.map(s => screenRow(s, theatreMap)).join('') : emptyRow(7)}
          </tbody>
        </table>
      </div>
    </div>`;
  window._theatresList = theatres;
}

function screenRow(s, theatreMap) {
  const theatre = theatreMap[s.theatre_id] || {};
  return `<tr>
    <td>${esc(theatre.name || s.theatre_id)}</td>
    <td><strong>${esc(s.name)}</strong></td>
    <td>${esc(s.screen_type || 'Standard')}</td>
    <td>${s.rows}</td>
    <td>${s.seats_per_row}</td>
    <td>${s.total_seats}</td>
    <td><div class="action-btns">
      <button class="action-btn edit" onclick='openEditScreenModal(${JSON.stringify(s)})'>✏️</button>
      <button class="action-btn delete" onclick="deleteScreen('${s._id}')">🗑️</button>
    </div></td>
  </tr>`;
}

function screenForm(s, theatres) {
  const tList = theatres || window._theatresList || [];
  return `<div class="form-grid">
    <div class="form-group form-full"><label class="form-label">Theatre *</label>
      <select class="form-select" id="sf-theatre">
        ${tList.map(t => `<option value="${t._id}" ${s.theatre_id === t._id ? 'selected' : ''}>${esc(t.name)} — ${esc(t.city)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Screen Name *</label>
      <input class="form-input" id="sf-name" value="${esc(s.name || '')}" placeholder="Screen 1"></div>
    <div class="form-group"><label class="form-label">Screen Type</label>
      <select class="form-select" id="sf-type">
        ${['Standard','IMAX','4DX','Gold','Dolby'].map(t =>
          `<option value="${t}" ${s.screen_type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Rows *</label>
      <input class="form-input" id="sf-rows" type="number" value="${s.rows || 10}" min="1" max="26"></div>
    <div class="form-group"><label class="form-label">Seats per Row *</label>
      <input class="form-input" id="sf-spr" type="number" value="${s.seats_per_row || 10}" min="1" max="20"></div>
  </div>`;
}

function openAddScreenModal(theatres) {
  openModal('Add Screen', screenForm({}, theatres || window._theatresList),
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveScreen()">Add Screen</button>`);
}
function openEditScreenModal(s) {
  openModal('Edit Screen', screenForm(s, window._theatresList),
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveScreen('${s._id}')">Save Changes</button>`);
}

async function saveScreen(id = null) {
  const theatre_id = document.getElementById('sf-theatre').value;
  const name = document.getElementById('sf-name').value.trim();
  const rows = parseInt(document.getElementById('sf-rows').value) || 10;
  const spr = parseInt(document.getElementById('sf-spr').value) || 10;
  if (!theatre_id || !name) { showToast('Theatre and name are required', 'warning'); return; }
  const body = { theatre_id, name, rows, seats_per_row: spr, screen_type: document.getElementById('sf-type').value };
  const res = id ? await api.put(`/screens/${id}/`, body) : await api.post('/screens/', body);
  if (res.ok) { showToast(id ? 'Screen updated!' : 'Screen added!', 'success'); closeModal(); renderScreens(); }
  else showToast(res.data.message || 'Failed', 'error');
}

async function deleteScreen(id) {
  confirmDialog('Delete this screen?', async () => {
    const res = await api.delete(`/screens/${id}/`);
    if (res.ok) { showToast('Screen deleted', 'success'); renderScreens(); }
    else showToast(res.data.message || 'Delete failed', 'error');
  });
}

// ── SHOWS ──────────────────────────────────────────────────────────────────
async function renderShows() {
  const [showsRes, moviesRes, theatresRes, screensRes] = await Promise.all([
    api.get('/shows/'), api.get('/movies/'), api.get('/theatres/'), api.get('/screens/'),
  ]);
  const shows    = showsRes.ok    ? (showsRes.data.data    || []) : [];
  const movies   = moviesRes.ok   ? (moviesRes.data.data   || []) : [];
  const theatres = theatresRes.ok ? (theatresRes.data.data || []) : [];
  const screens  = screensRes.ok  ? (screensRes.data.data  || []) : [];
  const movieMap   = Object.fromEntries(movies.map(m => [m._id, m]));
  const theatreMap = Object.fromEntries(theatres.map(t => [t._id, t]));
  const screenMap  = Object.fromEntries(screens.map(s => [s._id, s]));
  window._movies = movies; window._theatres = theatres; window._screens = screens;

  document.getElementById('admin-content').innerHTML = `
    <div class="section-card">
      <div class="section-card-header">
        <span>🎭</span>
        <span class="section-card-title">Shows (${shows.length})</span>
        <div class="table-search"><span class="table-search-icon">🔍</span>
          <input type="text" placeholder="Search shows..." oninput="filterTable(this,'shows-tbody')"></div>
        <button class="btn btn-primary btn-sm" onclick="openAddShowModal()">+ Add Show</button>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Movie</th><th>Theatre</th><th>Screen</th><th>Date</th><th>Time</th><th>Price</th><th>Booked</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="shows-tbody">
            ${shows.length ? shows.map(s => showRow(s, movieMap, theatreMap, screenMap)).join('') : emptyRow(9)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function showRow(s, movieMap, theatreMap, screenMap) {
  const movie = movieMap[s.movie_id] || {};
  const theatre = theatreMap[s.theatre_id] || {};
  const screen = screenMap[s.screen_id] || {};
  return `<tr>
    <td>${esc(movie.title || s.movie_id)}</td>
    <td>${esc(theatre.name || s.theatre_id)}</td>
    <td>${esc(screen.name || s.screen_id)}</td>
    <td>${s.date}</td>
    <td>${s.start_time}</td>
    <td>₹${s.price}</td>
    <td>${(s.booked_seats || []).length}</td>
    <td>${statusBadge(s.status)}</td>
    <td><div class="action-btns">
      <button class="action-btn edit" onclick='openEditShowModal(${JSON.stringify(s)})'>✏️</button>
      <button class="action-btn delete" onclick="deleteShow('${s._id}')">🗑️</button>
    </div></td>
  </tr>`;
}

function showForm(s) {
  const movies = window._movies || [];
  const theatres = window._theatres || [];
  const screens = window._screens || [];
  return `<div class="form-grid">
    <div class="form-group form-full"><label class="form-label">Movie *</label>
      <select class="form-select" id="shf-movie">
        ${movies.map(m => `<option value="${m._id}" ${s.movie_id === m._id ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Theatre *</label>
      <select class="form-select" id="shf-theatre">
        ${theatres.map(t => `<option value="${t._id}" ${s.theatre_id === t._id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Screen *</label>
      <select class="form-select" id="shf-screen">
        ${screens.map(sc => `<option value="${sc._id}" ${s.screen_id === sc._id ? 'selected' : ''}>${esc(sc.name)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Date *</label>
      <input class="form-input" id="shf-date" type="date" value="${s.date || ''}"></div>
    <div class="form-group"><label class="form-label">Start Time *</label>
      <input class="form-input" id="shf-start" type="time" value="${s.start_time || ''}"></div>
    <div class="form-group"><label class="form-label">End Time</label>
      <input class="form-input" id="shf-end" type="time" value="${s.end_time || ''}"></div>
    <div class="form-group"><label class="form-label">Price (₹) *</label>
      <input class="form-input" id="shf-price" type="number" value="${s.price || ''}" placeholder="250"></div>
    <div class="form-group"><label class="form-label">Status</label>
      <select class="form-select" id="shf-status">
        <option value="active" ${s.status === 'active' ? 'selected' : ''}>Active</option>
        <option value="cancelled" ${s.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        <option value="completed" ${s.status === 'completed' ? 'selected' : ''}>Completed</option>
      </select></div>
  </div>`;
}

function openAddShowModal() {
  openModal('Add Show', showForm({}),
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveShow()">Add Show</button>`);
}
function openEditShowModal(s) {
  openModal('Edit Show', showForm(s),
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveShow('${s._id}')">Save Changes</button>`);
}

async function saveShow(id = null) {
  const body = {
    movie_id:   document.getElementById('shf-movie').value,
    theatre_id: document.getElementById('shf-theatre').value,
    screen_id:  document.getElementById('shf-screen').value,
    date:       document.getElementById('shf-date').value,
    start_time: document.getElementById('shf-start').value,
    end_time:   document.getElementById('shf-end').value,
    price:      parseFloat(document.getElementById('shf-price').value),
    status:     document.getElementById('shf-status').value,
  };
  if (!body.movie_id || !body.date || !body.start_time || !body.price) {
    showToast('Please fill required fields', 'warning'); return;
  }
  const res = id ? await api.put(`/shows/${id}/`, body) : await api.post('/shows/', body);
  if (res.ok) { showToast(id ? 'Show updated!' : 'Show added!', 'success'); closeModal(); renderShows(); }
  else showToast(res.data.message || 'Failed', 'error');
}

async function deleteShow(id) {
  confirmDialog('Delete this show?', async () => {
    const res = await api.delete(`/shows/${id}/`);
    if (res.ok) { showToast('Show deleted', 'success'); renderShows(); }
    else showToast(res.data.message || 'Delete failed', 'error');
  });
}

// ── BOOKINGS ───────────────────────────────────────────────────────────────
async function renderBookingsSection() {
  const res = await api.get('/bookings/');
  const bookings = res.ok ? (res.data.data || []) : [];

  document.getElementById('admin-content').innerHTML = `
    <div class="section-card">
      <div class="section-card-header">
        <span>🎟️</span>
        <span class="section-card-title">Bookings (${bookings.length})</span>
        <div class="table-search"><span class="table-search-icon">🔍</span>
          <input type="text" placeholder="Search bookings..." oninput="filterTable(this,'bookings-tbody')"></div>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Ref</th><th>Movie</th><th>Theatre</th><th>Date</th><th>Seats</th><th>Tickets</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="bookings-tbody">
            ${bookings.length ? bookings.map(bookingRow).join('') : emptyRow(9)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function bookingRow(b) {
  const movie = b.movie || {};
  const theatre = b.theatre || {};
  const show = b.show || {};
  return `<tr>
    <td><code style="font-size:0.78rem">${esc(b.booking_reference || '—')}</code></td>
    <td>${esc(movie.title || '—')}</td>
    <td>${esc(theatre.name || '—')}</td>
    <td>${show.date || formatDate(b.booking_date)}</td>
    <td><small>${(b.seat_numbers || []).join(', ')}</small></td>
    <td>${b.ticket_count}</td>
    <td>${formatCurrency(b.total_amount)}</td>
    <td>${statusBadge(b.status)}</td>
    <td><div class="action-btns">
      ${b.status === 'confirmed' ? `<button class="action-btn" title="Cancel" onclick="adminCancelBooking('${b._id}')">🚫</button>` : ''}
      <button class="action-btn view" title="View" onclick="adminViewBooking('${b._id}')">👁</button>
    </div></td>
  </tr>`;
}

async function adminCancelBooking(id) {
  confirmDialog('Cancel this booking and release seats?', async () => {
    const res = await api.post(`/bookings/${id}/cancel/`, {});
    if (res.ok) { showToast('Booking cancelled', 'success'); renderBookingsSection(); }
    else showToast(res.data.message || 'Failed', 'error');
  });
}

async function adminViewBooking(id) {
  const res = await api.get(`/bookings/${id}/`);
  if (!res.ok) { showToast('Booking not found', 'error'); return; }
  const b = res.data.data;
  const movie = b.movie || {};
  const theatre = b.theatre || {};
  const show = b.show || {};
  openModal('Booking Details', `
    <div style="display:grid;gap:10px">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Reference</span><strong>${esc(b.booking_reference)}</strong></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Movie</span><span>${esc(movie.title || '—')}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Theatre</span><span>${esc(theatre.name || '—')}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Date & Time</span><span>${show.date || '—'} ${show.start_time || ''}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Seats</span><span>${(b.seat_numbers || []).join(', ')}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Tickets</span><span>${b.ticket_count}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Total</span><strong>${formatCurrency(b.total_amount)}</strong></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Status</span>${statusBadge(b.status)}</div>
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Close</button>`);
}

// ── USERS ──────────────────────────────────────────────────────────────────
async function renderUsers() {
  const res = await api.get('/admin/users/');
  const users = res.ok ? (res.data.data || []) : [];

  document.getElementById('admin-content').innerHTML = `
    <div class="section-card">
      <div class="section-card-header">
        <span>👥</span>
        <span class="section-card-title">Users (${users.length})</span>
        <div class="table-search"><span class="table-search-icon">🔍</span>
          <input type="text" placeholder="Search users..." oninput="filterTable(this,'users-tbody')"></div>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody id="users-tbody">
            ${users.length ? users.map(userRow).join('') : emptyRow(6)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function userRow(u) {
  return `<tr>
    <td><div style="display:flex;align-items:center;gap:10px">
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0">${(u.name || 'U')[0].toUpperCase()}</div>
      <strong>${esc(u.name)}</strong>
    </div></td>
    <td>${esc(u.email)}</td>
    <td>${statusBadge(u.role)}</td>
    <td>${statusBadge(u.status)}</td>
    <td>${formatDate(u.created_at)}</td>
    <td><div class="action-btns">
      ${u.status === 'active' && u.role !== 'admin'
        ? `<button class="action-btn block" title="Block" onclick="toggleUserStatus('${u._id}','blocked')">🚫</button>`
        : u.status === 'blocked'
          ? `<button class="action-btn activate" title="Activate" onclick="toggleUserStatus('${u._id}','active')">✅</button>`
          : ''}
    </div></td>
  </tr>`;
}

async function toggleUserStatus(id, status) {
  const action = status === 'blocked' ? 'block' : 'activate';
  confirmDialog(`${action.charAt(0).toUpperCase() + action.slice(1)} this user?`, async () => {
    const res = await api.put(`/admin/users/${id}/`, { status });
    if (res.ok) { showToast(`User ${action}ed!`, 'success'); renderUsers(); }
    else showToast(res.data.message || 'Failed', 'error');
  });
}

// ── Table search filter ────────────────────────────────────────────────────
function filterTable(input, tbodyId) {
  const query = input.value.toLowerCase();
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
(async function init() {
  loadAdminAuth();

  // Guard: must be logged in as admin
  if (!adminState.token || !adminState.user) {
    showToast('Please login to access admin panel', 'error');
    setTimeout(() => window.location.href = 'index.html#/login', 1500);
    return;
  }
  if (adminState.user.role !== 'admin') {
    showToast('Admin access required', 'error');
    setTimeout(() => window.location.href = 'index.html', 1500);
    return;
  }

  initSidebar();

  // Expose global functions for onclick handlers
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.filterTable = filterTable;
  window.openAddMovieModal = openAddMovieModal;
  window.openEditMovieModal = openEditMovieModal;
  window.saveMovie = saveMovie;
  window.deleteMovie = deleteMovie;
  window.openAddTheatreModal = openAddTheatreModal;
  window.openEditTheatreModal = openEditTheatreModal;
  window.saveTheatre = saveTheatre;
  window.deleteTheatre = deleteTheatre;
  window.openAddScreenModal = openAddScreenModal;
  window.openEditScreenModal = openEditScreenModal;
  window.saveScreen = saveScreen;
  window.deleteScreen = deleteScreen;
  window.openAddShowModal = openAddShowModal;
  window.openEditShowModal = openEditShowModal;
  window.saveShow = saveShow;
  window.deleteShow = deleteShow;
  window.adminCancelBooking = adminCancelBooking;
  window.adminViewBooking = adminViewBooking;
  window.toggleUserStatus = toggleUserStatus;

  // Load dashboard by default
  await loadSection('dashboard');
})();
