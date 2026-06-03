let salesforceAPI = null;
let currentInstanceUrl = '';

const connectionSection = document.getElementById('connectionSection');
const dashboardSection = document.getElementById('dashboardSection');
const connectionStatus = document.getElementById('connectionStatus');
const instanceUrlInput = document.getElementById('instanceUrl');
const connectBtn = document.getElementById('connectBtn');
const openDashboardBtn = document.getElementById('openDashboardBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const connectedInstance = document.getElementById('connectedInstance');

function isSessionExpired(error) {
    return error?.status === 401 || error?.code === 'INVALID_SESSION_ID';
}

function handleSessionExpiry() {
    salesforceAPI = null;
    currentInstanceUrl = '';
    chrome.storage.local.remove(['instanceUrl', 'accessToken', 'authMethod']);
    connectionSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    updateConnectionStatus(false);
}

document.addEventListener('DOMContentLoaded', () => {
    loadSavedConnection();
    setupEventListeners();
});

function setupEventListeners() {
    connectBtn.addEventListener('click', connectToSalesforce);
    openDashboardBtn.addEventListener('click', openDashboard);
    disconnectBtn.addEventListener('click', handleSessionExpiry);
}

async function connectToSalesforce() {
    const instanceUrl = instanceUrlInput.value.trim();

    if (!instanceUrl) {
        alert('Please enter your Salesforce instance URL');
        return;
    }

    try {
        const authData = await getSalesforceAuth(instanceUrl);

        if (!authData) {
            showManualAuthOption(instanceUrl);
            return;
        }

        salesforceAPI = new SalesforceAPI(instanceUrl, authData.accessToken);

        try {
            await salesforceAPI.getUsers();
        } catch (error) {
            if (isSessionExpired(error)) {
                showSessionExpiredPrompt(instanceUrl);
                return;
            } else {
                showManualAuthOption(instanceUrl);
                return;
            }
        }

        await chrome.storage.local.set({
            instanceUrl: instanceUrl,
            accessToken: authData.accessToken,
            authMethod: authData.method
        });

        showDashboard(instanceUrl);
    } catch (error) {
        console.error('Connection error:', error);
        showManualAuthOption(instanceUrl);
    }
}

async function getSalesforceAuth(instanceUrl) {
    try {
        const url = new URL(instanceUrl);
        const domains = [
            url.hostname,
            '.' + url.hostname,
            '.' + url.hostname.split('.').slice(-2).join('.'),
        ];

        for (const domain of domains) {
            const cookies = await chrome.cookies.getAll({ domain });
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

async function discoverFromCookies() {
    const baseDomains = ['salesforce.com', 'force.com', 'cloudforce.com', 'visualforce.com'];
    for (const baseDomain of baseDomains) {
        try {
            const cookies = await chrome.cookies.getAll({ domain: '.' + baseDomain });
            const sidCookie = cookies.find(c => c.name === 'sid') ||
                              cookies.find(c => c.name.startsWith('sid_'));
            if (sidCookie) {
                const domain = sidCookie.domain.startsWith('.')
                    ? sidCookie.domain.slice(1)
                    : sidCookie.domain;
                return {
                    instanceUrl: 'https://' + domain,
                    accessToken: sidCookie.value
                };
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

async function loadSavedConnection() {
    try {
        const data = await chrome.storage.local.get(['instanceUrl', 'accessToken']);

        if (data.instanceUrl && data.accessToken) {
            instanceUrlInput.value = data.instanceUrl;
            salesforceAPI = new SalesforceAPI(data.instanceUrl, data.accessToken);
            try {
                await salesforceAPI.getUsers();
                showDashboard(data.instanceUrl);
            } catch (error) {
                if (isSessionExpired(error)) {
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
                            showDashboard(data.instanceUrl);
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
        } else {
            const discovered = await discoverFromCookies();
            if (discovered) {
                instanceUrlInput.value = discovered.instanceUrl;
                const authData = await getSalesforceAuth(discovered.instanceUrl);
                if (authData) {
                    salesforceAPI = new SalesforceAPI(discovered.instanceUrl, authData.accessToken);
                    try {
                        await salesforceAPI.getUsers();
                        await chrome.storage.local.set({
                            instanceUrl: discovered.instanceUrl,
                            accessToken: authData.accessToken,
                            authMethod: authData.method
                        });
                        showDashboard(discovered.instanceUrl);
                    } catch (error) {
                        console.error('Auto-connect failed:', error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading saved connection:', error);
    }
}

function showDashboard(instanceUrl) {
    currentInstanceUrl = instanceUrl;
    connectionSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    connectedInstance.textContent = instanceUrl;
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

function showManualAuthOption(instanceUrl) {
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
                showDashboard(instanceUrl);
            } catch (error) {
                alert('Invalid Session ID. Please try again.');
            }
        }
    });

    document.getElementById('cancelAuthBtn').addEventListener('click', () => {
        modal.remove();
    });

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
                    <p>Click below to open the Salesforce login page. After logging in, return and click <strong>Connect</strong>.</p>
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
                showDashboard(instanceUrl);
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
    const clientId = 'YOUR_CONNECTED_APP_CLIENT_ID';
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

        const urlParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
        const accessToken = urlParams.get('access_token');
        const responseInstanceUrl = urlParams.get('instance_url');

        if (accessToken) {
            salesforceAPI = new SalesforceAPI(responseInstanceUrl, accessToken);
            await chrome.storage.local.set({
                instanceUrl: responseInstanceUrl,
                accessToken: accessToken,
                authMethod: 'oauth'
            });

            const modal = document.querySelector('.auth-modal');
            if (modal) modal.remove();

            showDashboard(responseInstanceUrl);
        }
    } catch (error) {
        console.error('OAuth error:', error);
        alert('OAuth authentication failed. Please try another method.');
    }
}