const API_URL = 'http://localhost:8000';
const POLL_INTERVAL = 1000;
let globalWindow = 60;
let globalLimit = 10;

const usersContainer = document.getElementById('users-container');
const activeUsersElement = document.getElementById('active-users');
const windowTimeElement = document.getElementById('window-time');
const maxRequestsElement = document.getElementById('max-requests');

const userRequests = new Map();

async function fetchStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const data = await response.json();
        
        if (data.users) {
            updateDashboard(data.users, data.timestamp);
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

function updateDashboard(users, serverTimestamp) {
    const userIds = Object.keys(users);
    
    activeUsersElement.textContent = userIds.length;
    
    if (userIds.length === 0) {
        usersContainer.innerHTML = `
            <div class="empty-state">
                <p>No active users</p>
                <p class="hint">Send requests with X-User-ID header to see rate limiting in action</p>
            </div>
        `;
        return;
    }
    
    if (userIds.length > 0) {
        const firstUser = users[userIds[0]];
        globalWindow = firstUser.window;
        globalLimit = firstUser.limit;
        windowTimeElement.textContent = `${globalWindow}s`;
        maxRequestsElement.textContent = globalLimit;
    }
    
    userIds.forEach(userId => {
        const userData = users[userId];
        updateUserCard(userId, userData, serverTimestamp);
    });
    
    const existingCards = document.querySelectorAll('.user-card');
    existingCards.forEach(card => {
        const cardUserId = card.dataset.userId;
        if (!userIds.includes(cardUserId)) {
            card.remove();
        }
    });
}

function updateUserCard(userId, userData, serverTimestamp) {
    let card = document.querySelector(`[data-user-id="${userId}"]`);
    
    if (!card) {
        card = createUserCard(userId);
        if (usersContainer.querySelector('.empty-state')) {
            usersContainer.innerHTML = '';
        }
        usersContainer.appendChild(card);
        userRequests.set(userId, []);
    }
    
    const count = userData.count;
    const limit = userData.limit;
    const window = userData.window;
    const timestamps = userData.timestamps || [];
    
    const countElement = card.querySelector('.count-value');
    const limitElement = card.querySelector('.limit-value');
    const windowBar = card.querySelector('.window-progress');
    const windowTime = card.querySelector('.window-time');
    const timeline = card.querySelector('.timeline');
    
    countElement.textContent = count;
    limitElement.textContent = `/ ${limit}`;
    
    countElement.className = 'stat-value';
    if (count >= limit) {
        countElement.classList.add('danger');
    } else if (count >= limit * 0.7) {
        countElement.classList.add('warning');
    } else {
        countElement.classList.add('ok');
    }
    
    if (timestamps.length > 0) {
        const oldestTimestamp = Math.min(...timestamps);
        const elapsed = serverTimestamp - oldestTimestamp;
        const remaining = Math.max(0, window - elapsed);
        const percentage = (remaining / window) * 100;
        
        windowBar.style.width = `${percentage}%`;
        windowTime.textContent = `${Math.ceil(remaining)}s remaining`;
    } else {
        windowBar.style.width = '0%';
        windowTime.textContent = 'No requests';
    }
    
    const previousRequests = userRequests.get(userId) || [];
    const newTimestamps = timestamps.filter(ts => !previousRequests.includes(ts));
    
    newTimestamps.forEach(timestamp => {
        const age = serverTimestamp - timestamp;
        const position = ((window - age) / window) * 100;
        
        const dot = document.createElement('div');
        dot.className = 'timeline-dot allowed';
        dot.style.left = `${position}%`;
        dot.title = `Request at ${new Date(timestamp * 1000).toLocaleTimeString()}`;
        timeline.appendChild(dot);
    });
    
    const existingDots = timeline.querySelectorAll('.timeline-dot');
    existingDots.forEach(dot => {
        const currentLeft = parseFloat(dot.style.left);
        const age = ((100 - currentLeft) / 100) * window + 1;
        
        if (age >= window) {
            dot.remove();
        } else {
            const newPosition = ((window - age) / window) * 100;
            dot.style.left = `${Math.max(0, newPosition)}%`;
        }
    });
    
    userRequests.set(userId, timestamps);
}

function createUserCard(userId) {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.dataset.userId = userId;
    
    card.innerHTML = `
        <div class="user-header">
            <div>
                <span class="user-id">${userId}</span>
                <span class="status-indicator active"></span>
            </div>
            <div class="user-stats">
                <div class="stat">
                    <span class="stat-label">Requests</span>
                    <div>
                        <span class="stat-value count-value">0</span>
                        <span class="limit-value">/ ${globalLimit}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="window-container">
            <div class="window-label">Sliding Window</div>
            <div class="window-bar">
                <div class="window-progress"></div>
                <div class="window-time">0s remaining</div>
            </div>
        </div>
        
        <div class="timeline-container">
            <div class="timeline-label">Request Timeline (${globalWindow}s window)</div>
            <div class="timeline"></div>
        </div>
    `;
    
    return card;
}

setInterval(fetchStats, POLL_INTERVAL);
fetchStats();
