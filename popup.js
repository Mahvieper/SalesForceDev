let salesforceAPI = null;
let currentPage = 1;
let pageSize = 10;
let totalRecords = 0;
let currentFilters = {};

// DOM Elements
const connectionSection = document.getElementById('connectionSection');
const dashboardSection = document.getElementById('dashboardSection');
const connectionStatus = document.getElementById('connectionStatus');
const instanceUrlInput = document.getElementById('instanceUrl');
const connectBtn = document.getElementById('connectBtn');
const autoDetectBtn = document.getElementById('autoDetectBtn');
const searchFilter = document.getElementById('searchFilter');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const userFilter = document.getElementById('userFilter');

const statusFilter = document.getElementById('statusFilter');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const exportCSVBtn = document.getElementById('exportCSVBtn');
const openDashboardBtn = document.getElementById('openDashboardBtn');
const pageSizeFilter = document.getElementById('pageSizeFilter');
const auditLogHead = document.getElementById('auditLogHead');
const auditLogBody = document.getElementById('auditLogBody');
const loadingIndicator = document.getElementById('loadingIndicator');
const noResults = document.getElementById('noResults');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const recordCount = document.getElementById('recordCount');

function isSessionExpired(error) {
    return error?.status === 401 || error?.code === 'INVALID_SESSION_ID';
}

function handleSessionExpiry() {
    salesforceAPI = null;
    chrome.storage.local.remove(['instanceUrl', 'accessToken', 'authMethod']);
    connectionSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    updateConnectionStatus(false);
    const instanceUrl = instanceUrlInput.value;
    if (instanceUrl) {
        showSessionExpiredPrompt(instanceUrl);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSavedConnection();
    setupEventListeners();
});

function setupEventListeners() {
    connectBtn.addEventListener('click', connectToSalesforce);
    autoDetectBtn.addEventListener('click', autoDetectInstance);
    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    exportCSVBtn.addEventListener('click', exportToCSV);
    openDashboardBtn.addEventListener('click', openDashboard);
    prevPage.addEventListener('click', () => changePage(-1));
    nextPage.addEventListener('click', () => changePage(1));
    pageSizeFilter.addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        applyFilters();
    });

    // Quick date filters
    document.querySelectorAll('.quick-date-filters .btn').forEach(btn => {
        btn.addEventListener('click', (e) => setQuickDateFilter(e.target.dataset.period));
    });
}

async function connectToSalesforce() {
    const instanceUrl = instanceUrlInput.value.trim();
    
    if (!instanceUrl) {
        alert('Please enter your Salesforce instance URL');
        return;
    }

    try {
        // Try to get the access token/session ID
        let authData = await getSalesforceAuth(instanceUrl);
        
        if (!authData) {
            showManualAuthOption(instanceUrl);
            return;
        }

        salesforceAPI = new SalesforceAPI(instanceUrl, authData.accessToken);
        
        // Test the connection
        try {
            await salesforceAPI.getUsers();
        } catch (error) {
            if (isSessionExpired(error) && authData.method !== 'manual') {
                console.log('Session expired, re-extracting from page...');
                authData = await getSalesforceAuth(instanceUrl, true);
                if (authData) {
                    salesforceAPI = new SalesforceAPI(instanceUrl, authData.accessToken);
                    try {
                        await salesforceAPI.getUsers();
                    } catch (retryError) {
                        if (isSessionExpired(retryError)) {
                            console.log('Re-extraction also returned expired session');
                            showSessionExpiredPrompt(instanceUrl);
                            return;
                        }
                        showManualAuthOption(instanceUrl);
                        return;
                    }
                } else {
                    showSessionExpiredPrompt(instanceUrl);
                    return;
                }
            } else {
                showManualAuthOption(instanceUrl);
                return;
            }
        }
        
        // Save connection
        await chrome.storage.local.set({
            instanceUrl: instanceUrl,
            accessToken: authData.accessToken,
            authMethod: authData.method
        });

        showDashboard();
        await loadUsers();
        applyFilters();
    } catch (error) {
        console.error('Connection error:', error);
        showManualAuthOption(instanceUrl);
    }
}

async function getSalesforceAuth(instanceUrl, skipCookies) {
    // Method 1: Try to extract from Salesforce page
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (currentTab.url && currentTab.url.includes('force.com')) {
            const results = await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                func: extractSessionFromPage,
            });
            
            if (results && results[0] && results[0].result) {
                return {
                    accessToken: results[0].result,
                    method: 'page-extraction'
                };
            }
        }
    } catch (error) {
        console.log('Could not extract from page:', error);
    }

    // Method 2: Try cookies (skip if retrying page extraction specifically)
    if (skipCookies) return null;
    try {
        const url = new URL(instanceUrl);
        const domains = [
            url.hostname,
            '.' + url.hostname,                                           // .subdomain.force.com
            '.' + url.hostname.split('.').slice(-2).join('.'),            // .force.com or .salesforce.com
        ];
        
        for (const domain of domains) {
            const cookies = await chrome.cookies.getAll({ domain });
            // Try 'sid' first, then any 'sid_*' cookie (Salesforce can use sid_<orgid>)
            const sidCookie = cookies.find(c => c.name === 'sid') ||
                              cookies.find(c => c.name.startsWith('sid_'));
            if (sidCookie) {
                return {
                    accessToken: sidCookie.value,
                    method: 'cookie'
                };
            }
        }
    } catch (error) {
        console.log('Could not get from cookies:', error);
    }

    return null;
}

function extractSessionFromPage() {
    // Helper: parse sid from document.cookie
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(?:^|;)\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*([^;]+)'));
        return match ? match[1] : null;
    }

    // 1. Try window.__sfdcSessionId (Lightning, classic)
    if (window.__sfdcSessionId) {
        return window.__sfdcSessionId;
    }

    // 2. Try document cookie 'sid' directly (most common)
    try {
        const sid = getCookie('sid');
        if (sid) return sid;
    } catch (e) {}

    // 3. Try localStorage
    try {
        const storageData = localStorage.getItem('sfdc_session');
        if (storageData) {
            const session = JSON.parse(storageData);
            return session.sessionId || session.accessToken;
        }
    } catch (e) {}

    // 4. Try sforce global (classic only)
    if (typeof sforce !== 'undefined' && sforce.connection && sforce.connection.sessionId) {
        return sforce.connection.sessionId;
    }

    // 5. Try window.sfdcSessionId (alternative naming)
    if (window.sfdcSessionId) {
        return window.sfdcSessionId;
    }

    // 6. Try Sfdc global (Lightning framework sometimes exposes this)
    try {
        if (typeof Sfdc !== 'undefined' && Sfdc.session) {
            return Sfdc.session.id || Sfdc.session.sessionId;
        }
    } catch (e) {}

    // 7. Try aura token from Lightning
    try {
        if (typeof $A !== 'undefined' && $A.util && $A.util.getSessionId) {
            return $A.util.getSessionId();
        }
    } catch (e) {}

    return null;
}

function showManualAuthOption(instanceUrl) {
    // Create a modal for manual authentication
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Authentication Required</h3>
            <p>Automatic authentication failed. Please choose an authentication method:</p>
            
            <div class="auth-methods">
                <div class="auth-method-card">
                    <h4>Method 1: Session ID</h4>
                    <p>Copy your Session ID from Salesforce:</p>
                    <ol>
                        <li>Open Salesforce in a new tab</li>
                        <li>Open Developer Console (Ctrl+Shift+I)</li>
                        <li>Run: <code>console.log(window.__sfdcSessionId)</code></li>
                        <li>Copy the session ID</li>
                    </ol>
                    <input type="text" id="sessionIdInput" placeholder="Paste Session ID here" class="input-field">
                </div>
                
                <div class="auth-method-card">
                    <h4>Method 2: Connected App</h4>
                    <p>Use OAuth 2.0 with a Connected App</p>
                    <button id="oauthBtn" class="btn btn-primary">Login with Salesforce</button>
                </div>
            </div>
            
            <div class="modal-actions">
                <button id="submitSessionBtn" class="btn btn-primary">Connect with Session ID</button>
                <button id="cancelAuthBtn" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('submitSessionBtn').addEventListener('click', async () => {
        const sessionId = document.getElementById('sessionIdInput').value.trim();
        if (sessionId) {
            salesforceAPI = new SalesforceAPI(instanceUrl, sessionId);
            try {
                await salesforceAPI.getUsers();
                await chrome.storage.local.set({
                    instanceUrl: instanceUrl,
                    accessToken: sessionId,
                    authMethod: 'manual'
                });
                modal.remove();
                showDashboard();
                await loadUsers();
                applyFilters();
            } catch (error) {
                alert('Invalid Session ID. Please try again.');
            }
        }
    });
    
    document.getElementById('cancelAuthBtn').addEventListener('click', () => {
        modal.remove();
    });
    
    // Add OAuth button handler
    document.getElementById('oauthBtn').addEventListener('click', () => {
        startOAuthFlow(instanceUrl);
    });
}

function showSessionExpiredPrompt(instanceUrl) {
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Session Expired</h3>
            <p>Your Salesforce session has expired. The extension needs a valid session to access audit logs.</p>
            <div class="auth-methods">
                <div class="auth-method-card">
                    <h4>Re-authenticate with Salesforce</h4>
                    <p>Click below to open the Salesforce login page. After logging in, return and click <strong>Auto-Detect</strong>.</p>
                    <button id="openLoginBtn" class="btn btn-primary">Open Salesforce Login</button>
                </div>
                <div class="auth-method-card">
                    <h4>Or use a Session ID manually</h4>
                    <ol>
                        <li>Open Salesforce in a new tab</li>
                        <li>Open Developer Console (Ctrl+Shift+I)</li>
                        <li>Run: <code>console.log(window.__sfdcSessionId)</code></li>
                        <li>Copy the session ID and paste below</li>
                    </ol>
                    <input type="text" id="sessionIdInput" placeholder="Paste Session ID here" class="input-field">
                    <button id="submitSessionBtn" class="btn btn-primary" style="margin-top:8px">Connect with Session ID</button>
                </div>
            </div>
            <div class="modal-actions">
                <button id="cancelAuthBtn" class="btn btn-secondary">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('openLoginBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: instanceUrl + '/secur/logout.jsp' }).then(() => {
            modal.remove();
        });
    });

    document.getElementById('submitSessionBtn').addEventListener('click', async () => {
        const sessionId = document.getElementById('sessionIdInput').value.trim();
        if (sessionId) {
            salesforceAPI = new SalesforceAPI(instanceUrl, sessionId);
            try {
                await salesforceAPI.getUsers();
                await chrome.storage.local.set({
                    instanceUrl: instanceUrl,
                    accessToken: sessionId,
                    authMethod: 'manual'
                });
                modal.remove();
                showDashboard();
                await loadUsers();
                applyFilters();
            } catch (error) {
                alert('Invalid Session ID. Please try again.');
            }
        }
    });

    document.getElementById('cancelAuthBtn').addEventListener('click', () => {
        modal.remove();
    });
}

async function startOAuthFlow(instanceUrl) {
    // OAuth 2.0 flow implementation
    const clientId = 'YOUR_CONNECTED_APP_CLIENT_ID'; // You'll need to replace this
    const redirectUri = chrome.identity.getRedirectURL('oauth2');
    
    const authUrl = `https://login.salesforce.com/services/oauth2/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=api%20refresh_token`;
    
    try {
        const responseUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });
        
        // Parse the access token from the response URL
        const urlParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
        const accessToken = urlParams.get('access_token');
        const instanceUrl = urlParams.get('instance_url');
        
        if (accessToken) {
            salesforceAPI = new SalesforceAPI(instanceUrl, accessToken);
            await chrome.storage.local.set({
                instanceUrl: instanceUrl,
                accessToken: accessToken,
                authMethod: 'oauth'
            });
            
            // Remove modal if it exists
            const modal = document.querySelector('.auth-modal');
            if (modal) modal.remove();
            
            showDashboard();
            await loadUsers();
            applyFilters();
        }
    } catch (error) {
        console.error('OAuth error:', error);
        alert('OAuth authentication failed. Please try another method.');
    }
}

async function autoDetectInstance() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (currentTab.url && (currentTab.url.includes('salesforce.com') || currentTab.url.includes('force.com'))) {
            const url = new URL(currentTab.url);
            const instanceUrl = `${url.protocol}//${url.hostname}`;
            instanceUrlInput.value = instanceUrl;
            
            // Auto-connect
            await connectToSalesforce();
        } else {
            alert('Please navigate to a Salesforce page first');
        }
    } catch (error) {
        console.error('Auto-detect error:', error);
    }
}

async function loadSavedConnection() {
    try {
        const data = await chrome.storage.local.get(['instanceUrl', 'accessToken']);
        
        if (data.instanceUrl && data.accessToken) {
            instanceUrlInput.value = data.instanceUrl;
            salesforceAPI = new SalesforceAPI(data.instanceUrl, data.accessToken);
            showDashboard();
            try {
                await loadUsers();
                applyFilters();
            } catch (error) {
                if (isSessionExpired(error)) {
                    // Try to re-authenticate from the current Salesforce page
                    const authData = await getSalesforceAuth(data.instanceUrl);
                    if (authData) {
                        salesforceAPI = new SalesforceAPI(data.instanceUrl, authData.accessToken);
                        try {
                            await salesforceAPI.getUsers();
                            await chrome.storage.local.set({
                                instanceUrl: data.instanceUrl,
                                accessToken: authData.accessToken,
                                authMethod: authData.method
                            });
                            await loadUsers();
                            applyFilters();
                            return;
                        } catch (retryError) {
                            if (!isSessionExpired(retryError)) throw retryError;
                        }
                    }
                    showSessionExpiredPrompt(data.instanceUrl);
                } else {
                    throw error;
                }
            }
        }
    } catch (error) {
        console.error('Error loading saved connection:', error);
    }
}

function showDashboard() {
    connectionSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    updateConnectionStatus(true);
}

function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
}

function updateConnectionStatus(connected) {
    const dot = connectionStatus.querySelector('.status-dot');
    const text = connectionStatus.querySelector('.status-text');
    
    if (connected) {
        dot.classList.add('connected');
        text.textContent = 'Connected';
    } else {
        dot.classList.remove('connected');
        text.textContent = 'Disconnected';
    }
}

async function loadUsers() {
    if (!salesforceAPI) return;
    
    try {
        const users = await salesforceAPI.getUsers();
        userFilter.innerHTML = '<option value="">All Users</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.Id;
            option.textContent = user.Name;
            userFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading users:', error);
        if (isSessionExpired(error)) {
            handleSessionExpiry();
        }
    }
}

function localDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function setQuickDateFilter(period) {
    const now = new Date();
    let start, end;

    switch(period) {
        case 'today':
            start = now; end = now;
            break;
        case 'yesterday':
            start = new Date(now); start.setDate(now.getDate() - 1);
            end = start;
            break;
        case '7days':
            start = new Date(now); start.setDate(now.getDate() - 7);
            end = now;
            break;
        case '30days':
            start = new Date(now); start.setDate(now.getDate() - 30);
            end = now;
            break;
        case 'thisMonth':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = now;
            break;
    }

    startDate.value = localDateStr(start);
    endDate.value = localDateStr(end);
    applyFilters();
}

function getFilters() {
    return {
        search: searchFilter.value.trim(),
        startDate: startDate.value ? startDate.value + 'T00:00:00Z' : null,
        endDate: endDate.value ? endDate.value + 'T23:59:59Z' : null,
        userId: userFilter.value,
        status: statusFilter.value,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
    };
}

async function applyFilters() {
    if (!salesforceAPI) return;

    currentFilters = getFilters();
    currentPage = 1;
    
    await loadAuditLogs();
}

async function loadAuditLogs() {
    if (!salesforceAPI) return;

    showLoading(true);
    hideNoResults();
    
    try {
        const filters = {
            ...currentFilters,
            limit: pageSize,
            offset: (currentPage - 1) * pageSize
        };

        const result = await salesforceAPI.getAuditLogs(filters);
        
        if (result.records.length === 0) {
            showNoResults();
        } else {
            displayAuditLogs(result.records, result.fields);
        }
        
        totalRecords = result.totalSize;
        updatePagination();
        recordCount.textContent = totalRecords;
        
    } catch (error) {
        console.error('Error loading audit logs:', error);
        if (isSessionExpired(error)) {
            handleSessionExpiry();
        } else {
            alert('Failed to load audit logs. Please check your connection and try again.');
        }
    } finally {
        showLoading(false);
    }
}

const FIELD_DISPLAY = {
    'CreatedDate': { label: 'Date/Time', render: v => v ? new Date(v).toLocaleString() : 'N/A' },
    'CreatedBy.Name': { label: 'User', render: (v, r) => r.CreatedBy?.Name || 'N/A' },
    'Section': { label: 'Section', render: v => v || 'N/A' },
    'Action': { label: 'Action', render: v => v || 'N/A' },
    'Display': { label: 'Details', render: v => v ? truncateText(v, 100) : 'N/A', title: v => v || '' },
    'Status': { label: 'Status', render: v => v || 'N/A', cls: v => v ? (v.toLowerCase() === 'success' ? 'status-success' : 'status-failure') : '' },
    'DelegateUser': { label: 'Delegate User', render: v => v || 'N/A' },
};

function displayAuditLogs(records, fields) {
    auditLogHead.innerHTML = '';
    auditLogBody.innerHTML = '';

    const visibleFields = fields.filter(f => f !== 'Id' && FIELD_DISPLAY[f]);

    // Build header
    const headerRow = document.createElement('tr');
    visibleFields.forEach(f => {
        const th = document.createElement('th');
        th.textContent = FIELD_DISPLAY[f].label;
        headerRow.appendChild(th);
    });
    auditLogHead.appendChild(headerRow);

    // Build rows
    records.forEach(record => {
        const row = document.createElement('tr');
        visibleFields.forEach(f => {
            const td = document.createElement('td');
            const config = FIELD_DISPLAY[f];
            const rawValue = f === 'CreatedBy.Name' ? null : record[f];
            td.textContent = config.render(rawValue, record);
            if (config.cls) {
                td.className = config.cls(rawValue);
            }
            if (config.title) {
                const titleVal = f === 'CreatedBy.Name' ? (record.CreatedBy?.Name || '') : (record[f] || '');
                td.title = config.title(titleVal);
            }
            row.appendChild(td);
        });
        auditLogBody.appendChild(row);
    });
}

function truncateText(text, maxLength) {
    if (!text) return 'N/A';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function updatePagination() {
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    prevPage.disabled = currentPage === 1;
    nextPage.disabled = currentPage === totalPages;
}

function changePage(direction) {
    const newPage = currentPage + direction;
    const totalPages = Math.ceil(totalRecords / pageSize);
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        loadAuditLogs();
    }
}

function resetFilters() {
    searchFilter.value = '';
    startDate.value = '';
    endDate.value = '';
    userFilter.value = '';
    statusFilter.value = '';
    currentPage = 1;
    pageSize = 10;
    pageSizeFilter.value = '10';
    
    currentFilters = {};
    applyFilters();
}

async function exportToCSV() {
    if (!salesforceAPI) return;
    
    showLoading(true);
    
    try {
        const filters = {
            ...currentFilters,
            limit: 10000
        };
        
        const result = await salesforceAPI.getAuditLogs(filters);
        
        if (result.records.length === 0) {
            alert('No records to export');
            return;
        }
        
        const csvFields = result.fields.filter(f => f !== 'Id' && FIELD_DISPLAY[f]);
        const headers = csvFields.map(f => FIELD_DISPLAY[f].label);
        const csvContent = [
            headers.join(','),
            ...result.records.map(record => {
                return csvFields.map(f => {
                    const rawValue = f === 'CreatedBy.Name' ? (record.CreatedBy?.Name || 'N/A') : (record[f] || 'N/A');
                    return `"${String(rawValue).replace(/"/g, '""')}"`;
                }).join(',');
            })
        ].join('\n');
        
        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salesforce_audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Export error:', error);
        if (isSessionExpired(error)) {
            handleSessionExpiry();
        } else {
            alert('Failed to export audit logs');
        }
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    loadingIndicator.style.display = show ? 'flex' : 'none';
    if (show) {
        auditLogBody.innerHTML = '';
    }
}

function showNoResults() {
    noResults.style.display = 'block';
    auditLogBody.innerHTML = '';
}

function hideNoResults() {
    noResults.style.display = 'none';
}