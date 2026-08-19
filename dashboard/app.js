const API_URL = 'http://localhost:8000';
const POLL_INTERVAL = 1000;
let globalWindow = 60;
let globalLimit = 10;

const usersContainer = document.getElementById('users-container');
const activeUsersElement = document.getElementById('active-users');
const windowTimeElement = document.getElementById('window-time');
const maxRequestsElement = document.getElementById('max-requests');

const userRequests = new Map();
const userLogs = new Map();

// Control panel elements
const userIdInput = document.getElementById('user-id-input');
const endpointSelect = document.getElementById('endpoint-select');
const sendOneBtn = document.getElementById('send-one-btn');
const sendFiveBtn = document.getElementById('send-five-btn');
const sendFifteenBtn = document.getElementById('send-fifteen-btn');
const feedbackElement = document.getElementById('request-feedback');

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
        userLogs.set(userId, []);
    }
    
    const count = userData.count;
    const limit = userData.limit;
    const window = userData.window;
    const timestamps = userData.timestamps || [];
    const recentRequests = userData.recent_requests || [];
    
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
    
    // Update timeline with both allowed and blocked requests
    updateTimeline(card, recentRequests, serverTimestamp, window);
    
    // Update request logs
    updateRequestLog(card, userId, recentRequests);
    
    // Flash animation for new requests
    const previousLogs = userLogs.get(userId) || [];
    if (recentRequests.length > previousLogs.length) {
        const latestRequest = recentRequests[0];
        if (latestRequest) {
            card.classList.remove('flash-allowed', 'flash-blocked');
            void card.offsetWidth; // Trigger reflow
            card.classList.add(latestRequest.allowed ? 'flash-allowed' : 'flash-blocked');
            setTimeout(() => {
                card.classList.remove('flash-allowed', 'flash-blocked');
            }, 600);
        }
    }
    
    userRequests.set(userId, timestamps);
    userLogs.set(userId, recentRequests);
}

function updateTimeline(card, recentRequests, serverTimestamp, window) {
    const timeline = card.querySelector('.timeline');
    const previousLogs = userLogs.get(card.dataset.userId) || [];
    
    // Get timestamps from recent requests that are within the window
    const requestsInWindow = recentRequests.filter(req => 
        (serverTimestamp - req.timestamp) <= window
    );
    
    // Clear existing dots
    timeline.innerHTML = '';
    
    // Add dots for all requests in window
    requestsInWindow.forEach((request, index) => {
        const age = serverTimestamp - request.timestamp;
        const position = ((window - age) / window) * 100;
        
        const dot = document.createElement('div');
        dot.className = `timeline-dot ${request.allowed ? 'allowed' : 'blocked'}`;
        dot.style.left = `${Math.max(0, position)}%`;
        
        const statusText = request.allowed ? 'Allowed' : 'Blocked';
        const time = new Date(request.timestamp * 1000).toLocaleTimeString();
        dot.title = `${statusText} - ${request.endpoint}\n${time}\nCount: ${request.count}/${10}`;
        
        // Add pulse animation for new requests
        const isNew = index === 0 && recentRequests.length > previousLogs.length;
        if (isNew) {
            dot.classList.add('pulse');
        }
        
        timeline.appendChild(dot);
    });
}

function updateRequestLog(card, userId, recentRequests) {
    const logContainer = card.querySelector('.log-entries');
    const allowedCountElement = card.querySelector('.allowed-count');
    const blockedCountElement = card.querySelector('.blocked-count');
    
    if (!logContainer) return;
    
    // Calculate stats
    const allowedCount = recentRequests.filter(r => r.allowed).length;
    const blockedCount = recentRequests.filter(r => !r.allowed).length;
    
    allowedCountElement.textContent = allowedCount;
    blockedCountElement.textContent = blockedCount;
    
    // Get previous logs to detect new entries
    const previousLogs = userLogs.get(userId) || [];
    const previousTimestamps = new Set(previousLogs.map(l => l.timestamp));
    
    // Clear and rebuild log entries
    logContainer.innerHTML = '';
    
    recentRequests.slice(0, 20).forEach(request => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        // Add animation for new entries
        const isNew = !previousTimestamps.has(request.timestamp);
        if (isNew) {
            entry.classList.add('new-entry');
        }
        
        const statusDot = document.createElement('div');
        statusDot.className = `log-status ${request.status}`;
        
        const time = document.createElement('div');
        time.className = 'log-time';
        const date = new Date(request.timestamp * 1000);
        time.textContent = date.toLocaleTimeString();
        
        const endpoint = document.createElement('div');
        endpoint.className = 'log-endpoint';
        endpoint.textContent = request.endpoint;
        
        const badge = document.createElement('div');
        badge.className = `log-badge ${request.status}`;
        badge.textContent = request.status;
        
        const count = document.createElement('div');
        count.className = 'log-count';
        count.textContent = `${request.count}/${10}`;
        
        entry.appendChild(statusDot);
        entry.appendChild(time);
        entry.appendChild(endpoint);
        entry.appendChild(badge);
        entry.appendChild(count);
        
        logContainer.appendChild(entry);
    });
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
        
        <div class="request-log">
            <div class="log-header">
                <div class="log-label">Request History</div>
                <div class="log-stats">
                    <span class="allowed-count">0</span> allowed / 
                    <span class="blocked-count">0</span> blocked
                </div>
            </div>
            <div class="log-container">
                <div class="log-entries"></div>
            </div>
        </div>
    `;
    
    return card;
}

// Send request to API
async function sendRequest(userId, endpoint) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'X-User-ID': userId
            }
        });
        
        const data = await response.json();
        return {
            success: response.ok,
            status: response.status,
            data: data
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Send multiple requests
async function sendMultipleRequests(count) {
    const userId = userIdInput.value.trim();
    const endpoint = endpointSelect.value;
    
    if (!userId) {
        showFeedback('Please enter a User ID', 'error');
        return;
    }
    
    // Disable buttons during sending
    setButtonsDisabled(true);
    
    let successCount = 0;
    let blockedCount = 0;
    const results = [];
    
    showFeedback(`Sending ${count} request${count > 1 ? 's' : ''} as "${userId}"...`, 'info');
    
    for (let i = 0; i < count; i++) {
        const result = await sendRequest(userId, endpoint);
        results.push(result);
        
        if (result.success) {
            successCount++;
        } else if (result.status === 429) {
            blockedCount++;
        }
        
        // Small delay between requests
        if (i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Show results
    const message = `Sent ${count} requests: ${successCount} allowed, ${blockedCount} blocked`;
    showFeedback(message, successCount > 0 ? 'success' : 'error');
    
    setButtonsDisabled(false);
}

// Show feedback message
function showFeedback(message, type) {
    feedbackElement.textContent = message;
    feedbackElement.className = `feedback show ${type}`;
    
    // Auto-hide after 5 seconds for success/error messages
    if (type !== 'info') {
        setTimeout(() => {
            feedbackElement.classList.remove('show');
        }, 5000);
    }
}

// Enable/disable buttons
function setButtonsDisabled(disabled) {
    sendOneBtn.disabled = disabled;
    sendFiveBtn.disabled = disabled;
    sendFifteenBtn.disabled = disabled;
}

// Button event listeners
sendOneBtn.addEventListener('click', () => sendMultipleRequests(1));
sendFiveBtn.addEventListener('click', () => sendMultipleRequests(5));
sendFifteenBtn.addEventListener('click', () => sendMultipleRequests(15));

// Allow Enter key in input
userIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMultipleRequests(1);
    }
});

setInterval(fetchStats, POLL_INTERVAL);
fetchStats();
