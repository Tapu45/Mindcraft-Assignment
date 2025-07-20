// --- Socket.IO Setup ---
let socket, reconnectTimer;
let wsStatus = document.getElementById('ws-status');
let dashboardsCount = document.getElementById('dashboards-count');
let notification = document.getElementById('notification');
let visitorFeed = document.getElementById('visitor-feed');
let activeVisitors = document.getElementById('active-visitors');
let totalToday = document.getElementById('total-today');
let sessionsList = document.getElementById('sessions-list');
let sessionJourney = document.getElementById('session-journey');
let miniChart, chartData = [], chartLabels = [];
let filteredMode = false;

function showNotification(msg, important) {
  notification.textContent = msg;
  notification.style.display = 'block';
  if (important) notification.style.background = '#ffe0e0';
  else notification.style.background = '#e0ffe0';
  setTimeout(() => notification.style.display = 'none', 2000);
  // Optional: play sound
  if (window.Audio) {
    try {
      new Audio('https://pixabay.com/sound-effects/new-notification-022-370046/').play().catch(() => {});
    } catch (e) {
      // Ignore autoplay errors
    }
  }
}

function connectSocket() {
  socket = io({
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000
  });

  wsStatus.textContent = 'Connecting...';
  wsStatus.className = 'status reconnecting';

  socket.on('connect', () => {
    wsStatus.textContent = 'Connected';
    wsStatus.className = 'status connected';
  });

  socket.on('disconnect', () => {
    wsStatus.textContent = 'Disconnected';
    wsStatus.className = 'status disconnected';
    dashboardsCount.textContent = '';
  });

  socket.on('connect_error', () => {
    wsStatus.textContent = 'Reconnecting...';
    wsStatus.className = 'status reconnecting';
  });

  // Listen for all server events
  socket.onAny((type, data) => {
    handleWSMessage({ type, ...data });
  });
}
connectSocket();

function handleWSMessage(msg) {
  switch(msg.type) {
   case 'visitor_update':
      if (!filteredMode) {
        showNotification('New visitor event!');
        updateStats(msg.data.stats);
        addVisitorFeed(msg.data.event);
        updateMiniChart(msg.data.stats);
      }
      break;
    case 'filtered_stats':
      filteredMode = true;
      updateStats(msg.data.stats);
      renderFilteredFeed(msg.data.sessions);
      renderFilteredSessions(msg.data.sessions);
      showNotification(
        `Filtered: Active Visitors = ${msg.data.stats.totalActive}, Total Today = ${msg.data.stats.totalToday}`,
        false
      );
      break;
    case 'user_connected':
      dashboardsCount.textContent = `Dashboards: ${msg.data.totalDashboards}`;
      break;
    case 'user_disconnected':
      dashboardsCount.textContent = `Dashboards: ${msg.data.totalDashboards}`;
      break;
   case 'session_activity':
      if (!filteredMode) updateSession(msg.data);
      break;
    case 'alert':
      showNotification(msg.data.message, true);
      break;
    default:
      // ignore
  }
}

// --- UI Update Functions ---
function updateStats(stats) {
  activeVisitors.textContent = stats.totalActive;
  totalToday.textContent = stats.totalToday;
}

function addVisitorFeed(event) {
  if (!event || !event.timestamp) return; // Prevent error if event is null or missing timestamp
  let div = document.createElement('div');
  div.textContent = `[${event.timestamp}] ${event.type} - ${event.page} (${event.country})`;
  visitorFeed.prepend(div);
  // Keep only 20
  while (visitorFeed.childNodes.length > 20) visitorFeed.removeChild(visitorFeed.lastChild);
}

let sessions = {};
function updateSession(data) {
  sessions[data.sessionId] = data;
  renderSessions();
}

function renderSessions() {
  sessionsList.innerHTML = '';
  Object.values(sessions).forEach(s => {
    let div = document.createElement('div');
    div.textContent = `${s.sessionId}: ${s.currentPage} (${s.duration}s)`;
    div.style.cursor = 'pointer';
    div.onclick = () => showSessionJourney(s);
    sessionsList.appendChild(div);
  });
}

function showSessionJourney(session) {
  sessionJourney.innerHTML = `<strong>Journey for ${session.sessionId}:</strong> <span class="session-journey">${session.journey.join(' → ')}</span>`;
}

// --- Mini Chart ---
function updateMiniChart(stats) {
  let now = new Date();
  let label = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');
  if (chartLabels.length === 0 || chartLabels[chartLabels.length-1] !== label) {
    chartLabels.push(label);
    chartData.push(stats.totalActive);
    if (chartLabels.length > 10) {
      chartLabels.shift();
      chartData.shift();
    }
    miniChart.update();
  }
}
window.onload = function() {
  let ctx = document.getElementById('miniChart').getContext('2d');
  miniChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [{
        label: 'Active Visitors',
        data: chartData,
        borderColor: '#36a2eb',
        backgroundColor: '#cce6ff',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, suggestedMax: 10 } },
      plugins: { legend: { display: false } }
    }
  });
   fetch('/api/analytics/sessions')
    .then(res => res.json())
    .then(data => {
      data.forEach(updateSession);
    });

  fetch('/api/analytics/summary')
    .then(res => res.json())
    .then(stats => {
      updateStats(stats);
      // Optionally, update mini chart with historical data if available
    });
};

// --- Filters & Reset ---
function renderFilteredFeed(sessions) {
  visitorFeed.innerHTML = '';
  // Show the most recent pageview for each session
  sessions.forEach(s => {
    let div = document.createElement('div');
    div.textContent = `[Session: ${s.sessionId}] Last page: ${s.currentPage} (${s.country})`;
    visitorFeed.prepend(div);
  });
}

function renderFilteredSessions(sessions) {
  sessionsList.innerHTML = '';
  sessions.forEach(s => {
    let div = document.createElement('div');
    div.textContent = `${s.sessionId}: ${s.currentPage} (${s.duration}s)`;
    div.style.cursor = 'pointer';
    div.onclick = () => showSessionJourney(s);
    sessionsList.appendChild(div);
  });
}

function applyFilters() {
  let country = document.getElementById('filter-country').value;
  let page = document.getElementById('filter-page').value;
  socket.emit('request_detailed_stats', { country, page });
  showNotification('Filter applied!', false);
}

function resetStats() {
  filteredMode = false;
  visitorFeed.innerHTML = '';
  sessionsList.innerHTML = '';
  // Reload global stats and sessions
  fetch('/api/analytics/sessions')
    .then(res => res.json())
    .then(data => {
      sessions = {};
      data.forEach(updateSession);
    });

  fetch('/api/analytics/summary')
    .then(res => res.json())
    .then(stats => {
      updateStats(stats);
    });

  showNotification('Statistics reset!', true);
}