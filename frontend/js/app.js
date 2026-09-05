/**
 * app.js — MovieBook Customer SPA
 * Hash-based routing: #/ #/login #/register #/movie/:id #/book/:id #/profile #/bookings
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  user: null,
  token: null,
  movies: [],
  currentGenre: 'All',
  searchQuery: '',
};

// ── API Layer ──────────────────────────────────────────────────────────────
const api = {
  _request: async (method, path, body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, opts);
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { success: false, message: 'Network error. Check your connection.' } };
    }
  },
  get:    (path)         => api._request('GET',    path),
  post:   (path, body)   => api._request('POST',   path, body),
  put:    (path, body)   => api._request('PUT',    path, body),
  delete: (path)         => api._request('DELETE', path),
};

// ── Auth helpers ───────────────────────────────────────────────────────────
function loadAuth() {
  state.token = localStorage.getItem('mb_token');
  const u = localStorage.getItem('mb_user');
  state.user = u ? JSON.parse(u) : null;
}
function saveAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('mb_token', token);
  localStorage.setItem('mb_user', JSON.stringify(user));
}
function clearAuth() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('mb_token');
  localStorage.removeItem('mb_user');
}
function isLoggedIn() { return !!state.token && !!state.user; }

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fadeOut');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ── Render helpers ─────────────────────────────────────────────────────────
function setApp(html) {
  document.getElementById('app').innerHTML = html;
}

function showLoading(container = '#app') {
  document.querySelector(container).innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:300px;">
      <div class="loader-ring"></div>
    </div>`;
}

function emptyState(icon, text, sub = '') {
  return `<div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
    <div class="empty-state-text">${text}</div>
    ${sub ? `<div class="empty-state-sub">${sub}</div>` : ''}
  </div>`;
}

function formatDate(str) {
  if (!str) return '—';
  try { return new Date(str).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return str; }
}
function formatCurrency(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }
function starRating(r) { return `⭐ ${Number(r || 0).toFixed(1)}`; }

function moviePoster(movie, cls = 'movie-poster') {
  if (movie.poster) return `<img src="${movie.poster}" alt="${movie.title}" class="${cls}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="movie-poster-placeholder" style="display:none;">🎬</div>`;
  return `<div class="movie-poster-placeholder">🎬</div>`;
}

// ── Navbar ─────────────────────────────────────────────────────────────────
function renderNavbar() {
  const nav = document.getElementById('navbar');
  const user = state.user;
  nav.innerHTML = `
    <div class="nav-brand" onclick="navigate('/')">
      <div class="nav-brand-icon">🎬</div>
      <span class="nav-brand-text">MovieBook</span>
    </div>
    <nav class="nav-links">
      <button class="nav-link" onclick="navigate('/')">Home</button>
      <button class="nav-link" onclick="navigate('/movies')">Movies</button>
      ${user ? `<button class="nav-link" onclick="navigate('/bookings')">Bookings</button>` : ''}
    </nav>
    <div class="nav-spacer"></div>
    <div class="nav-actions">
      ${user ? `
        <div class="nav-user" style="cursor:pointer" onclick="navigate('/profile')">
          <div class="nav-avatar">${user.name ? user.name[0].toUpperCase() : 'U'}</div>
          <span class="nav-user-name">${user.name || 'User'}</span>
        </div>
        ${user.role === 'admin' ? `<a href="admin.html" class="nav-btn nav-btn-outline">⚙️ Admin</a>` : ''}
        <button class="nav-btn nav-btn-outline" onclick="handleLogout()">Logout</button>
      ` : `
        <button class="nav-btn nav-btn-outline" onclick="navigate('/login')">Login</button>
        <button class="nav-btn nav-btn-primary" onclick="navigate('/register')">Sign Up</button>
      `}
    </div>
    <button class="nav-hamburger" onclick="toggleMobileMenu()">
      <span></span><span></span><span></span>
    </button>`;
}

function toggleMobileMenu() {
  // Simple toggle for mobile — inline nav
  const links = document.querySelector('.nav-links');
  if (!links) return;
  if (links.style.display === 'flex') {
    links.style.display = '';
  } else {
    links.style.display = 'flex';
    links.style.flexDirection = 'column';
    links.style.position = 'absolute';
    links.style.top = '70px';
    links.style.left = '0';
    links.style.right = '0';
    links.style.background = 'rgba(10,10,15,0.98)';
    links.style.padding = '16px';
    links.style.gap = '8px';
    links.style.zIndex = '999';
  }
}

// ── Router ─────────────────────────────────────────────────────────────────
function navigate(path) {
  window.location.hash = '#' + path;
}

async function router() {
  const hash = window.location.hash || '#/';
  const path = hash.slice(1) || '/';

  renderNavbar();

  if (path === '/' || path === '') { await renderHome(); return; }
  if (path === '/movies')          { await renderMoviesPage(); return; }
  if (path === '/login')           { renderLogin(); return; }
  if (path === '/register')        { renderRegister(); return; }
  if (path === '/profile')         { await renderProfile(); return; }
  if (path === '/bookings')        { await renderBookings(); return; }
  if (path.startsWith('/movie/'))  { await renderMovieDetail(path.split('/')[2]); return; }
  if (path.startsWith('/book/'))   { await renderBookPage(path.split('/')[2]); return; }
  if (path.startsWith('/ticket/')) { await renderTicket(path.split('/')[2]); return; }

  setApp(`<div class="error-page">
    <div class="error-code">404</div>
    <div class="error-message">Page not found</div>
    <div class="error-sub">The page you're looking for doesn't exist.</div>
    <button class="btn btn-primary" onclick="navigate('/')">Go Home</button>
  </div>`);
}

// ── HOME PAGE ──────────────────────────────────────────────────────────────
async function renderHome() {
  document.getElementById('app').innerHTML = `<div id="home-container"></div>`;

  // Try the live Django API first.
  // If it is unreachable (e.g. Vercel deployment without a backend),
  // fall back silently to the bundled LOCAL_MOVIES dataset so the
  // page always renders with real content.
  const res = await api.get('/movies/');
  if (res.ok && res.data && res.data.data && res.data.data.length > 0) {
    state.movies = res.data.data;
  } else if (typeof LOCAL_MOVIES !== 'undefined' && LOCAL_MOVIES.length > 0) {
    state.movies = LOCAL_MOVIES;
  } else {
    showToast('Failed to load movies', 'error');
    return;
  }

  renderHomeContent();
}

function renderHomeContent() {
  const movies = filterMovies();
  const featured = state.movies.find(m => m.status === 'popular') || state.movies[0];
  const latest = state.movies.filter(m => m.status === 'latest').slice(0, 6);
  const popular = state.movies.filter(m => m.status === 'popular').slice(0, 6);
  const upcoming = state.movies.filter(m => m.status === 'upcoming').slice(0, 6);

  const genres = ['All', ...new Set(state.movies.map(m => m.genre).filter(Boolean))];

  document.getElementById('home-container').innerHTML = `
    ${featured ? heroSection(featured) : ''}
    <div class="search-filters">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search movies, directors, cast..." id="search-input"
          value="${state.searchQuery}" oninput="handleSearch(this.value)">
      </div>
      <div class="genre-filters" id="genre-filters">
        ${genres.map(g => `<button class="genre-btn ${g === state.currentGenre ? 'active' : ''}"
          onclick="setGenre('${g}')">${g}</button>`).join('')}
      </div>
    </div>

    ${(state.searchQuery || state.currentGenre !== 'All')
      ? `<div class="section">
          <div class="section-header"><h2 class="section-title">Search Results (${movies.length})</h2></div>
          ${movies.length ? `<div class="movies-grid fade-in">${movies.map(movieCard).join('')}</div>`
            : emptyState('🔍', 'No movies found', 'Try a different search or filter')}
        </div>`
      : `
        ${latest.length ? `<div class="section">
          <div class="section-header"><h2 class="section-title">🆕 Latest Movies</h2>
            <button class="btn btn-outline btn-sm" onclick="navigate('/movies')">View All</button>
          </div>
          <div class="movies-grid fade-in">${latest.map(movieCard).join('')}</div>
        </div>` : ''}
        ${popular.length ? `<div class="section">
          <div class="section-header"><h2 class="section-title">🔥 Popular Movies</h2></div>
          <div class="movies-grid fade-in">${popular.map(movieCard).join('')}</div>
        </div>` : ''}
        ${upcoming.length ? `<div class="section">
          <div class="section-header"><h2 class="section-title">🎭 Upcoming Movies</h2></div>
          <div class="movies-grid fade-in">${upcoming.map(movieCard).join('')}</div>
        </div>` : ''}
      `}`;
}

function heroSection(movie) {
  return `<div class="hero">
    <div class="hero-bg" style="background-image:url('${movie.banner || movie.poster || ''}')"></div>
    <div class="hero-gradient"></div>
    <div class="hero-content">
      <div class="hero-badge">🎬 Featured Film</div>
      <h1 class="hero-title">${movie.title}</h1>
      <div class="hero-meta">
        <span class="hero-meta-item hero-rating">${starRating(movie.rating)}</span>
        <span class="hero-meta-item">📽️ ${movie.genre}</span>
        <span class="hero-meta-item">🌐 ${movie.language}</span>
        <span class="hero-meta-item">⏱️ ${movie.duration} min</span>
      </div>
      <p class="hero-description">${movie.description || ''}</p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-lg" onclick="navigate('/movie/${movie._id}')">🎟️ Book Now</button>
        ${movie.trailer ? `<a href="${movie.trailer}" target="_blank" class="btn btn-outline btn-lg">▶️ Trailer</a>` : ''}
      </div>
    </div>
  </div>`;
}

function movieCard(movie) {
  return `<div class="movie-card" onclick="navigate('/movie/${movie._id}')">
    ${movie.poster
      ? `<img src="${movie.poster}" alt="${movie.title}" class="movie-poster" loading="lazy"
           onerror="this.outerHTML='<div class=\\'movie-poster-placeholder\\'>🎬</div>'">`
      : `<div class="movie-poster-placeholder">🎬</div>`}
    <div class="card-overlay"><button class="card-overlay-btn" onclick="navigate('/movie/${movie._id}')">Book Now</button></div>
    <div class="movie-card-info">
      <div class="movie-card-title">${movie.title}</div>
      <div class="movie-card-meta">
        <span class="movie-card-rating">${starRating(movie.rating)}</span>
        <span>${movie.language}</span>
      </div>
      <span class="movie-card-badge">${movie.genre}</span>
    </div>
  </div>`;
}

function filterMovies() {
  return state.movies.filter(m => {
    const matchSearch = !state.searchQuery ||
      m.title?.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      m.director?.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      (Array.isArray(m.cast) ? m.cast.join(' ') : (m.cast || '')).toLowerCase().includes(state.searchQuery.toLowerCase());
    const matchGenre = state.currentGenre === 'All' || m.genre === state.currentGenre;
    return matchSearch && matchGenre;
  });
}

function handleSearch(val) {
  state.searchQuery = val;
  renderHomeContent();
}
function setGenre(genre) {
  state.currentGenre = genre;
  state.searchQuery = '';
  renderHomeContent();
}

// ── MOVIES PAGE ────────────────────────────────────────────────────────────
async function renderMoviesPage() {
  showLoading();
  if (!state.movies.length) {
    const res = await api.get('/movies/');
    if (res.ok && res.data && res.data.data && res.data.data.length > 0) {
      state.movies = res.data.data;
    } else if (typeof LOCAL_MOVIES !== 'undefined' && LOCAL_MOVIES.length > 0) {
      state.movies = LOCAL_MOVIES;
    }
  }
  const genres = ['All', ...new Set(state.movies.map(m => m.genre).filter(Boolean))];
  const movies = filterMovies();
  setApp(`
    <div class="section" style="padding-top:30px">
      <h1 class="section-title" style="font-size:1.8rem;margin-bottom:20px">🎬 All Movies</h1>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
        <div class="search-box" style="flex:1;min-width:200px">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Search movies..." id="search-input"
            value="${state.searchQuery}" oninput="handleMoviesSearch(this.value)">
        </div>
        <div class="genre-filters">${genres.map(g => `<button class="genre-btn ${g === state.currentGenre ? 'active' : ''}"
          onclick="setGenreMovies('${g}')">${g}</button>`).join('')}</div>
      </div>
      <div id="movies-results">
        ${movies.length
          ? `<div class="movies-grid fade-in">${movies.map(movieCard).join('')}</div>`
          : emptyState('🔍', 'No movies found')}
      </div>
    </div>`);
}

function handleMoviesSearch(val) {
  state.searchQuery = val;
  const movies = filterMovies();
  document.getElementById('movies-results').innerHTML = movies.length
    ? `<div class="movies-grid fade-in">${movies.map(movieCard).join('')}</div>`
    : emptyState('🔍', 'No movies found');
}
function setGenreMovies(genre) {
  state.currentGenre = genre;
  document.querySelectorAll('.genre-btn').forEach(b => b.classList.toggle('active', b.textContent === genre));
  handleMoviesSearch(state.searchQuery);
}

// ── MOVIE DETAIL PAGE ──────────────────────────────────────────────────────
async function renderMovieDetail(movieId) {
  showLoading();
  const [movieRes, showsRes] = await Promise.all([
    api.get(`/movies/${movieId}/`),
    api.get(`/shows/?movie_id=${movieId}`),
  ]);

  if (!movieRes.ok) {
    setApp(`<div class="error-page">
      <div class="error-message">Movie not found</div>
      <button class="btn btn-primary" onclick="navigate('/')">Go Home</button>
    </div>`); return;
  }

  const movie = movieRes.data.data;
  const shows = showsRes.ok ? (showsRes.data.data || []) : [];

  // Group shows by theatre
  const theatreShowMap = {};
  for (const s of shows) {
    if (!theatreShowMap[s.theatre_id]) theatreShowMap[s.theatre_id] = [];
    theatreShowMap[s.theatre_id].push(s);
  }

  // Fetch theatre details
  const theatreIds = Object.keys(theatreShowMap);
  const theatreMap = {};
  await Promise.all(theatreIds.map(async tid => {
    const r = await api.get(`/theatres/${tid}/`);
    if (r.ok) theatreMap[tid] = r.data.data;
  }));

  const cast = Array.isArray(movie.cast) ? movie.cast : (movie.cast ? [movie.cast] : []);

  setApp(`
    <div class="movie-banner">
      ${movie.banner || movie.poster
        ? `<img src="${movie.banner || movie.poster}" class="movie-banner-img" alt="${movie.title}">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#1a1a28,#0a0a0f)"></div>`}
      <div class="movie-banner-gradient"></div>
    </div>
    <div class="movie-details-layout">
      <div>
        ${movie.poster
          ? `<img src="${movie.poster}" class="movie-poster-large" alt="${movie.title}"
               onerror="this.outerHTML='<div class=\\'movie-poster-placeholder-lg\\'>🎬</div>'">`
          : `<div class="movie-poster-placeholder-lg">🎬</div>`}
      </div>
      <div class="movie-info">
        <h1>${movie.title}</h1>
        <div class="movie-tags">
          <span class="movie-tag gold">${starRating(movie.rating)}</span>
          <span class="movie-tag primary">${movie.genre || '—'}</span>
          <span class="movie-tag">${movie.language || '—'}</span>
          <span class="movie-tag">⏱️ ${movie.duration} min</span>
          <span class="movie-tag secondary">${movie.status?.toUpperCase() || ''}</span>
        </div>
        <p class="movie-description">${movie.description || 'No description available.'}</p>
        <div class="movie-meta-grid">
          <div class="meta-item"><span class="meta-label">Director</span><span class="meta-value">${movie.director || '—'}</span></div>
          <div class="meta-item"><span class="meta-label">Release Date</span><span class="meta-value">${formatDate(movie.release_date)}</span></div>
          <div class="meta-item"><span class="meta-label">Language</span><span class="meta-value">${movie.language || '—'}</span></div>
          <div class="meta-item"><span class="meta-label">Duration</span><span class="meta-value">${movie.duration} minutes</span></div>
        </div>
        ${cast.length ? `<div style="margin-bottom:24px">
          <div class="meta-label" style="margin-bottom:10px">Cast</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">${cast.map(c =>
            `<span class="movie-tag">${c}</span>`).join('')}</div>
        </div>` : ''}
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${movie.trailer ? `<a href="${movie.trailer}" target="_blank" class="btn btn-outline">▶️ Watch Trailer</a>` : ''}
        </div>
      </div>
    </div>

    <div class="showtimes-section">
      <h2 class="section-title" style="margin-bottom:20px">🎭 Available Shows</h2>
      ${theatreIds.length === 0 ? emptyState('📭', 'No shows available', 'Check back soon for upcoming shows') :
        theatreIds.map(tid => {
          const theatre = theatreMap[tid];
          const tShows = theatreShowMap[tid];
          if (!theatre) return '';
          // Group by date
          const byDate = {};
          for (const s of tShows) {
            if (!byDate[s.date]) byDate[s.date] = [];
            byDate[s.date].push(s);
          }
          return `<div class="showtime-theatre">
            <div class="theatre-name">🏛 ${theatre.name}</div>
            <div class="theatre-location">📍 ${theatre.location}, ${theatre.city}</div>
            ${Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, dayShows]) => `
              <div style="margin-bottom:14px">
                <div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:8px">📅 ${formatDate(date)}</div>
                <div class="showtime-slots">
                  ${dayShows.map(s => `<div class="showtime-slot" onclick="navigate('/book/${s._id}')">
                    <span class="slot-time">${s.start_time}</span>
                    <span class="slot-price">${formatCurrency(s.price)}</span>
                  </div>`).join('')}
                </div>
              </div>`).join('')}
          </div>`;
        }).join('')}
    </div>`);
}

// ── SEAT BOOKING PAGE ──────────────────────────────────────────────────────
async function renderBookPage(showId) {
  if (!isLoggedIn()) {
    showToast('Please login to book tickets', 'warning');
    navigate('/login');
    return;
  }

  showLoading();
  const [showRes, seatsRes] = await Promise.all([
    api.get(`/shows/${showId}/`),
    api.get(`/seats/${showId}/`),
  ]);

  if (!showRes.ok || !seatsRes.ok) {
    setApp(`<div class="error-page">
      <div class="error-message">Show not found</div>
      <button class="btn btn-primary" onclick="navigate('/')">Go Home</button>
    </div>`); return;
  }

  const show = showRes.data.data;
  const seatData = seatsRes.data.data;

  const [movieRes, theatreRes, screenRes] = await Promise.all([
    api.get(`/movies/${show.movie_id}/`),
    api.get(`/theatres/${show.theatre_id}/`),
    api.get(`/screens/${show.screen_id}/`),
  ]);

  const movie = movieRes.ok ? movieRes.data.data : {};
  const theatre = theatreRes.ok ? theatreRes.data.data : {};
  const screen = screenRes.ok ? screenRes.data.data : {};

  let selected = new Set();

  function renderSeatGrid() {
    const rows = seatData.rows || [];
    const spr = seatData.seats_per_row || 10;
    const booked = new Set(seatData.booked_seats || []);

    return rows.map(row => {
      const seats = Array.from({length: spr}, (_, i) => {
        const seatId = `${row}${i + 1}`;
        const isBooked = booked.has(seatId);
        const isSel = selected.has(seatId);
        return `<div class="seat${isBooked ? ' booked' : isSel ? ' selected' : ''}"
          id="seat-${seatId}"
          title="${seatId}"
          ${isBooked ? '' : `onclick="toggleSeat('${seatId}')"`}>${isSel ? seatId : ''}</div>`;
      }).join('');
      return `<div class="seat-row"><div class="row-label">${row}</div>${seats}</div>`;
    }).join('');
  }

  function updateSummary() {
    const sel = [...selected];
    const total = sel.length * (seatData.price || 0);
    const el = document.getElementById('booking-summary-body');
    if (!el) return;
    el.innerHTML = `
      <div class="summary-item"><span class="summary-label">Movie</span><span class="summary-value">${movie.title || '—'}</span></div>
      <div class="summary-item"><span class="summary-label">Theatre</span><span class="summary-value">${theatre.name || '—'}</span></div>
      <div class="summary-item"><span class="summary-label">Screen</span><span class="summary-value">${screen.name || '—'}</span></div>
      <div class="summary-item"><span class="summary-label">Date</span><span class="summary-value">${formatDate(show.date)}</span></div>
      <div class="summary-item"><span class="summary-label">Time</span><span class="summary-value">${show.start_time}</span></div>
      <div class="summary-item">
        <span class="summary-label">Selected Seats</span>
        <div class="summary-seats">${sel.length ? sel.map(s => `<span class="seat-tag">${s}</span>`).join('') : '<span style="color:var(--text-dim);font-size:0.85rem">None selected</span>'}</div>
      </div>
      <div class="summary-item"><span class="summary-label">Tickets</span><span class="summary-value">${sel.length}</span></div>
      <div class="summary-item"><span class="summary-label">Price/ticket</span><span class="summary-value">${formatCurrency(seatData.price || 0)}</span></div>
      <div class="summary-item summary-total">
        <span>Total</span><span>${formatCurrency(total)}</span>
      </div>`;

    const btn = document.getElementById('confirm-btn');
    if (btn) {
      btn.disabled = sel.length === 0;
      btn.textContent = sel.length ? `Confirm Booking (${sel.length} seat${sel.length > 1 ? 's' : ''})` : 'Select Seats';
    }
  }

  window.toggleSeat = (seatId) => {
    if (selected.has(seatId)) {
      selected.delete(seatId);
      const el = document.getElementById(`seat-${seatId}`);
      if (el) { el.classList.remove('selected'); el.textContent = ''; }
    } else {
      if (selected.size >= 10) { showToast('Max 10 seats per booking', 'warning'); return; }
      selected.add(seatId);
      const el = document.getElementById(`seat-${seatId}`);
      if (el) { el.classList.add('selected'); el.textContent = seatId; }
    }
    updateSummary();
  };

  window.confirmBooking = async () => {
    if (selected.size === 0) { showToast('Please select at least one seat', 'warning'); return; }
    const btn = document.getElementById('confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Booking...';

    const res = await api.post('/seats/book/', {
      show_id: showId,
      seat_numbers: [...selected],
    });

    if (res.ok) {
      showToast('Booking confirmed! 🎉', 'success');
      const bookingId = res.data.data?._id;
      navigate(`/ticket/${bookingId}`);
    } else {
      showToast(res.data.message || 'Booking failed', 'error');
      btn.disabled = false;
      btn.textContent = `Confirm Booking`;
      // Refresh seat data to show newly booked seats
      const freshSeats = await api.get(`/seats/${showId}/`);
      if (freshSeats.ok) {
        Object.assign(seatData, freshSeats.data.data);
        document.getElementById('seat-grid-container').innerHTML = renderSeatGrid();
      }
    }
  };

  setApp(`
    <div style="padding:20px 40px 12px;display:flex;align-items:center;gap:12px">
      <button class="btn btn-ghost btn-sm" onclick="history.back()">← Back</button>
      <h1 style="font-size:1.2rem;font-weight:700">${movie.title || 'Book Tickets'}</h1>
    </div>
    <div class="booking-layout">
      <div class="seat-container">
        <div class="screen-label">
          <div class="screen-visual"></div>
          <div class="screen-text">Screen — All eyes this way</div>
        </div>
        <div class="seat-legend">
          <div class="legend-item"><div class="legend-seat legend-available"></div> Available</div>
          <div class="legend-item"><div class="legend-seat legend-selected"></div> Selected</div>
          <div class="legend-item"><div class="legend-seat legend-booked"></div> Booked</div>
        </div>
        <div class="seat-grid" id="seat-grid-container">${renderSeatGrid()}</div>
      </div>
      <div class="booking-summary">
        <div class="summary-title">📋 Booking Summary</div>
        <div id="booking-summary-body"></div>
        <button id="confirm-btn" class="btn btn-primary" style="width:100%;margin-top:16px;justify-content:center"
          onclick="confirmBooking()" disabled>Select Seats</button>
      </div>
    </div>`);

  updateSummary();
}

// ── TICKET / RECEIPT ───────────────────────────────────────────────────────
async function renderTicket(bookingId) {
  showLoading();
  const res = await api.get(`/bookings/${bookingId}/`);
  if (!res.ok) {
    setApp(`<div class="error-page">
      <div class="error-message">Booking not found</div>
      <button class="btn btn-primary" onclick="navigate('/bookings')">My Bookings</button>
    </div>`); return;
  }

  const b = res.data.data;
  const movie = b.movie || {};
  const theatre = b.theatre || {};
  const screen = b.screen || {};
  const show = b.show || {};

  const barcodeLines = Array.from({length: 35}, () => {
    const w = Math.random() > 0.5 ? `${Math.floor(Math.random() * 4) + 1}px` : `${Math.floor(Math.random() * 2) + 1}px`;
    return `<div class="barcode-line" style="width:${w}"></div>`;
  }).join('');

  setApp(`
    <div class="ticket-wrapper fade-in">
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="font-size:1.5rem;font-weight:800">🎉 Booking Confirmed!</h1>
        <p style="color:var(--text-muted);margin-top:6px">Your ticket is ready. Enjoy the show!</p>
      </div>
      <div class="ticket">
        <div class="ticket-header">
          <div class="ticket-brand">🎬 MOVIEBOOK</div>
          <div class="ticket-movie-title">${movie.title || 'Movie'}</div>
          <div class="ticket-movie-genre">${movie.genre || ''}</div>
        </div>
        <div class="ticket-body">
          <div class="ticket-row"><span class="ticket-label">Theatre</span><span class="ticket-value">🏛 ${theatre.name || '—'}</span></div>
          <div class="ticket-row"><span class="ticket-label">Screen</span><span class="ticket-value">${screen.name || '—'}</span></div>
          <div class="ticket-row"><span class="ticket-label">Date</span><span class="ticket-value">📅 ${formatDate(show.date || b.booking_date)}</span></div>
          <div class="ticket-row"><span class="ticket-label">Time</span><span class="ticket-value">🕐 ${show.start_time || '—'}</span></div>
          <div class="ticket-row"><span class="ticket-label">Tickets</span><span class="ticket-value">${b.ticket_count}</span></div>
          <div class="ticket-row"><span class="ticket-label">Price/Ticket</span><span class="ticket-value">${formatCurrency(b.price_per_ticket)}</span></div>
        </div>
        <div class="ticket-seats-section">
          <div class="ticket-seats-label">🪑 Seats</div>
          <div class="ticket-seats">${(b.seat_numbers || []).map(s => `<span class="ticket-seat-chip">${s}</span>`).join('')}</div>
        </div>
        <div class="ticket-total-row">
          <span class="ticket-total-label">Total Amount</span>
          <span class="ticket-total-value">${formatCurrency(b.total_amount)}</span>
        </div>
        <div class="ticket-footer">
          <div class="ticket-ref">
            <span class="ticket-ref-label">Booking Reference</span>
            <span class="ticket-ref-value">${b.booking_reference || '—'}</span>
          </div>
          <div class="ticket-barcode">
            <div class="barcode-lines">${barcodeLines}</div>
            <div style="font-size:0.65rem;color:var(--text-dim);margin-top:4px">${b.booking_reference || ''}</div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;flex-wrap:wrap" class="no-print">
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print Ticket</button>
        <button class="btn btn-outline" onclick="navigate('/bookings')">📋 My Bookings</button>
        <button class="btn btn-outline" onclick="navigate('/')">🏠 Home</button>
      </div>
    </div>`);
}

// ── LOGIN PAGE ─────────────────────────────────────────────────────────────
function renderLogin() {
  if (isLoggedIn()) { navigate('/'); return; }
  setApp(`
    <div class="auth-page">
      <div class="auth-card fade-in">
        <h1 class="auth-title">Welcome Back 👋</h1>
        <p class="auth-subtitle">Login to book your favourite movies</p>
        <form onsubmit="handleLogin(event)" novalidate>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="login-email" class="form-input" placeholder="you@example.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="login-password" class="form-input" placeholder="••••••••" required>
          </div>
          <div id="login-error" style="color:var(--error);font-size:0.85rem;margin-bottom:12px;display:none"></div>
          <button type="submit" id="login-btn" class="btn btn-primary" style="width:100%;justify-content:center">Login</button>
        </form>
        <div class="auth-switch">
          Don't have an account? <a onclick="navigate('/register')">Sign up</a>
        </div>
        <div style="margin-top:16px;padding:12px;background:var(--glass);border-radius:8px;border:1px solid var(--glass-border)">
          <div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:6px">Demo Credentials:</div>
          <div style="font-size:0.82rem;color:var(--text-muted)">Customer: john@example.com / john123</div>
          <div style="font-size:0.82rem;color:var(--text-muted)">Admin: admin@movies.com / admin123</div>
        </div>
      </div>
    </div>`);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errEl.style.display = 'none';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging in...';

  const res = await api.post('/auth/login/', { email, password });
  if (res.ok) {
    saveAuth(res.data.data.token, res.data.data.user);
    showToast(`Welcome back, ${res.data.data.user.name}! 🎬`, 'success');
    navigate('/');
  } else {
    errEl.textContent = res.data.message || 'Login failed';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

// ── REGISTER PAGE ──────────────────────────────────────────────────────────
function renderRegister() {
  if (isLoggedIn()) { navigate('/'); return; }
  setApp(`
    <div class="auth-page">
      <div class="auth-card fade-in">
        <h1 class="auth-title">Create Account 🎬</h1>
        <p class="auth-subtitle">Join MovieBook and start booking today</p>
        <form onsubmit="handleRegister(event)" novalidate>
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="reg-name" class="form-input" placeholder="John Doe" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="reg-email" class="form-input" placeholder="you@example.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="reg-password" class="form-input" placeholder="Min. 6 characters" required>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <input type="password" id="reg-confirm" class="form-input" placeholder="Repeat password" required>
          </div>
          <div id="reg-error" style="color:var(--error);font-size:0.85rem;margin-bottom:12px;display:none"></div>
          <button type="submit" id="reg-btn" class="btn btn-primary" style="width:100%;justify-content:center">Create Account</button>
        </form>
        <div class="auth-switch">
          Already have an account? <a onclick="navigate('/login')">Login</a>
        </div>
      </div>
    </div>`);
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const errEl = document.getElementById('reg-error');
  const btn = document.getElementById('reg-btn');

  errEl.style.display = 'none';
  if (!name || !email || !password) { errEl.textContent = 'All fields are required'; errEl.style.display = 'block'; return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; errEl.style.display = 'block'; return; }
  if (password !== confirm) { errEl.textContent = 'Passwords do not match'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating account...';

  const res = await api.post('/auth/register/', { name, email, password });
  if (res.ok) {
    saveAuth(res.data.data.token, res.data.data.user);
    showToast('Account created! Welcome to MovieBook 🎬', 'success');
    navigate('/');
  } else {
    errEl.textContent = res.data.message || 'Registration failed';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

async function handleLogout() {
  await api.post('/auth/logout/', {});
  clearAuth();
  showToast('Logged out successfully', 'info');
  navigate('/');
}

// ── PROFILE PAGE ───────────────────────────────────────────────────────────
async function renderProfile() {
  if (!isLoggedIn()) { navigate('/login'); return; }
  showLoading();

  const res = await api.get('/auth/profile/');
  if (!res.ok) { showToast('Failed to load profile', 'error'); return; }
  const user = res.data.data;
  // Update stored user
  localStorage.setItem('mb_user', JSON.stringify({...state.user, ...user}));

  setApp(`
    <div class="profile-layout fade-in">
      <div class="profile-header">
        <div class="profile-avatar">${user.name ? user.name[0].toUpperCase() : 'U'}</div>
        <div>
          <div class="profile-name">${user.name}</div>
          <div class="profile-email">✉️ ${user.email}</div>
          <span class="profile-badge ${user.role === 'admin' ? 'badge-admin' : 'badge-active'}">
            ${user.role === 'admin' ? '⚙️ Admin' : '👤 Customer'}
          </span>
          <span class="profile-badge badge-active" style="margin-left:8px">● ${user.status}</span>
        </div>
      </div>

      <div class="glass-card" style="margin-bottom:24px">
        <h3 style="margin-bottom:18px;font-size:1.05rem;font-weight:700">✏️ Edit Profile</h3>
        <form onsubmit="handleProfileUpdate(event)" novalidate>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="profile-name" class="form-input" value="${user.name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="profile-email" class="form-input" value="${user.email || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">New Password (optional)</label>
              <input type="password" id="profile-password" class="form-input" placeholder="Leave blank to keep current">
            </div>
          </div>
          <div id="profile-error" style="color:var(--error);font-size:0.85rem;margin:10px 0;display:none"></div>
          <button type="submit" id="profile-btn" class="btn btn-primary" style="margin-top:10px">Save Changes</button>
        </form>
      </div>
    </div>`);
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const name = document.getElementById('profile-name').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const password = document.getElementById('profile-password').value;
  const errEl = document.getElementById('profile-error');
  const btn = document.getElementById('profile-btn');

  errEl.style.display = 'none';
  const body = {};
  if (name) body.name = name;
  if (email) body.email = email;
  if (password) {
    if (password.length < 6) { errEl.textContent = 'Password must be 6+ characters'; errEl.style.display = 'block'; return; }
    body.password = password;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving...';
  const res = await api.put('/auth/profile/', body);
  if (res.ok) {
    saveAuth(state.token, {...state.user, ...res.data.data});
    showToast('Profile updated!', 'success');
    renderNavbar();
  } else {
    errEl.textContent = res.data.message || 'Update failed';
    errEl.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = 'Save Changes';
}

// ── BOOKINGS PAGE ──────────────────────────────────────────────────────────
async function renderBookings() {
  if (!isLoggedIn()) { navigate('/login'); return; }
  showLoading();
  const res = await api.get('/bookings/');
  if (!res.ok) { showToast('Failed to load bookings', 'error'); return; }
  const bookings = res.data.data || [];

  let activeTab = 'upcoming';

  function filterBookings(tab) {
    if (tab === 'upcoming')  return bookings.filter(b => b.status === 'confirmed');
    if (tab === 'past')      return bookings.filter(b => b.status === 'completed');
    if (tab === 'cancelled') return bookings.filter(b => b.status === 'cancelled');
    return bookings;
  }

  function renderBookingCard(b) {
    const movie = b.movie || {};
    const theatre = b.theatre || {};
    const show = b.show || {};
    return `
      <div class="booking-card fade-in">
        ${movie.poster
          ? `<img src="${movie.poster}" class="booking-card-poster" alt="${movie.title}"
               onerror="this.outerHTML='<div class=\\'booking-card-poster-placeholder\\'>🎬</div>'">`
          : `<div class="booking-card-poster-placeholder">🎬</div>`}
        <div class="booking-card-info">
          <div class="booking-card-title">${movie.title || '—'}</div>
          <div class="booking-card-meta">
            <span class="booking-meta-item">🏛 ${theatre.name || '—'}</span>
            <span class="booking-meta-item">📅 ${formatDate(show.date)}</span>
            <span class="booking-meta-item">🕐 ${show.start_time || '—'}</span>
            <span class="booking-meta-item">🪑 ${(b.seat_numbers || []).join(', ') || '—'}</span>
          </div>
          <span class="booking-status status-${b.status}">● ${b.status}</span>
        </div>
        <div class="booking-card-actions">
          <div>
            <div class="booking-card-total">${formatCurrency(b.total_amount)}</div>
            <div class="booking-card-ref">${b.booking_reference || ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-outline btn-sm" onclick="navigate('/ticket/${b._id}')">View Ticket</button>
            ${b.status === 'confirmed'
              ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking('${b._id}')">Cancel</button>`
              : ''}
          </div>
        </div>
      </div>`;
  }

  function renderTabContent() {
    const list = filterBookings(activeTab);
    const container = document.getElementById('bookings-content');
    if (!container) return;
    container.innerHTML = list.length
      ? list.map(renderBookingCard).join('')
      : emptyState('🎟️', 'No bookings here', activeTab === 'upcoming' ? 'Start by browsing movies!' : '');
  }

  setApp(`
    <div class="profile-layout fade-in">
      <h1 style="font-size:1.5rem;font-weight:800;margin-bottom:20px">🎟️ My Bookings</h1>
      <div class="bookings-tabs">
        <button class="tab-btn ${activeTab === 'upcoming'  ? 'active' : ''}" onclick="switchTab('upcoming')">Upcoming (${bookings.filter(b=>b.status==='confirmed').length})</button>
        <button class="tab-btn ${activeTab === 'past'      ? 'active' : ''}" onclick="switchTab('past')">Past (${bookings.filter(b=>b.status==='completed').length})</button>
        <button class="tab-btn ${activeTab === 'cancelled' ? 'active' : ''}" onclick="switchTab('cancelled')">Cancelled (${bookings.filter(b=>b.status==='cancelled').length})</button>
      </div>
      <div id="bookings-content"></div>
    </div>`);

  window.switchTab = (tab) => {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.textContent.startsWith(tab === 'upcoming' ? 'Upcoming' : tab === 'past' ? 'Past' : 'Cancelled')));
    renderTabContent();
  };

  window.cancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    const res = await api.post(`/bookings/${bookingId}/cancel/`, {});
    if (res.ok) {
      showToast('Booking cancelled', 'success');
      const b = bookings.find(x => x._id === bookingId);
      if (b) b.status = 'cancelled';
      renderTabContent();
      // Update tab counts
      document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.textContent.startsWith('Upcoming')) b.textContent = `Upcoming (${bookings.filter(x=>x.status==='confirmed').length})`;
        if (b.textContent.startsWith('Cancelled')) b.textContent = `Cancelled (${bookings.filter(x=>x.status==='cancelled').length})`;
      });
    } else {
      showToast(res.data.message || 'Cancellation failed', 'error');
    }
  };

  renderTabContent();
}

// ── Init ───────────────────────────────────────────────────────────────────
(function init() {
  loadAuth();
  window.addEventListener('hashchange', router);
  window.navigate = navigate;
  // Hide initial loading overlay
  const overlay = document.getElementById('loading-overlay');
  if (overlay) setTimeout(() => overlay.classList.add('hidden'), 400);
  router();
})();
