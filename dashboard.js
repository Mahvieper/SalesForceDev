let salesforceAPI = null;
let currentPage = 1;
let pageSize = 25;
let totalRecords = 0;
let currentFilters = {};
let searchTerm = '';
let allRecords = [];
let allFields = [];

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const orgUrl = document.getElementById('orgUrl');
const reconnectBtn = document.getElementById('reconnectBtn');
const sidebarCount = document.getElementById('sidebarCount');
const sidebarUserName = document.getElementById('sidebarUserName');
const sidebarUserRole = document.getElementById('sidebarUserRole');

const searchFilter = document.getElementById('searchFilter');
const searchClearBtn = document.getElementById('searchClearBtn');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const userFilter = document.getElementById('userFilter');
const statusFilter = document.getElementById('statusFilter');
const pageSizeFilter = document.getElementById('pageSizeFilter');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const exportCSVBtn = document.getElementById('exportCSVBtn');
const refreshBtn = document.getElementById('refreshBtn');
const collapseFiltersBtn = document.getElementById('collapseFiltersBtn');

const auditLogBody = document.getElementById('auditLogBody');
const loadingIndicator = document.getElementById('loadingIndicator');
const noResults = document.getElementById('noResults');
const disconnectedMsg = document.getElementById('disconnectedMsg');
const tableSection = document.getElementById('tableSection');
const paginationInfo = document.getElementById('paginationInfo');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const recordCount = document.getElementById('recordCount');
const tableSearch = document.getElementById('tableSearch');

const filtersBody = document.getElementById('filtersBody');

function isSessionExpired(error) {
    return error?.status === 401 || error?.code === 'INVALID_SESSION_ID';
}

function updateConnectionStatus(connected, instanceUrl) {
    if (connected) {
        statusDot.className = 'connection-dot';
        statusText.textContent = 'Connected';
        orgUrl.textContent = instanceUrl || '';
    } else {
        statusDot.className = 'connection-dot disconnected';
        statusText.textContent = 'Disconnected';
        orgUrl.textContent = '';
    }
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
    const data = await chrome.storage.local.get(['instanceUrl', 'accessToken']);
    if (data.instanceUrl && data.accessToken) {
        salesforceAPI = new SalesforceAPI(data.instanceUrl, data.accessToken);
        updateConnectionStatus(true, data.instanceUrl);
        disconnectedMsg.style.display = 'none';
        tableSection.style.display = 'block';
        try {
            await loadUsers();
            applyFilters();
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
                        await loadUsers();
                        applyFilters();
                        return;
                    } catch (retryError) {
                        if (!isSessionExpired(retryError)) throw retryError;
                    }
                }
                handleSessionExpiry(data.instanceUrl);
            }
        }
    } else {
        updateConnectionStatus(false);
        disconnectedMsg.style.display = 'block';
        tableSection.style.display = 'none';
    }

    reconnectBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    });

    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    exportCSVBtn.addEventListener('click', exportToCSV);
    refreshBtn.addEventListener('click', applyFilters);

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            searchFilter.value = '';
            searchClearBtn.style.display = 'none';
            applyFilters();
        });
        searchFilter.addEventListener('input', () => {
            searchClearBtn.style.display = searchFilter.value ? 'block' : 'none';
        });
    }

    prevPage.addEventListener('click', () => changePage(-1));
    nextPage.addEventListener('click', () => changePage(1));

    pageSizeFilter.addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        applyFilters();
    });

    document.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            setQuickDateFilter(e.currentTarget.dataset.period);
        });
    });

    if (tableSearch) {
        tableSearch.addEventListener('input', () => {
            searchTerm = tableSearch.value.trim().toLowerCase();
            renderFilteredTable();
        });
    }

    if (collapseFiltersBtn) {
        let collapsed = false;
        collapseFiltersBtn.addEventListener('click', () => {
            collapsed = !collapsed;
            filtersBody.style.display = collapsed ? 'none' : 'block';
            collapseFiltersBtn.innerHTML = collapsed
                ? '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>'
                : '<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>';
        });
    }
}

function handleSessionExpiry(instanceUrl) {
    salesforceAPI = null;
    chrome.storage.local.remove(['instanceUrl', 'accessToken', 'authMethod']);
    updateConnectionStatus(false);
    disconnectedMsg.style.display = 'block';
    tableSection.style.display = 'none';
}

async function getSalesforceAuth(instanceUrl) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('force.com')) {
            const results = await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                func: () => {
                    function getCookie(name) {
                        const match = document.cookie.match(new RegExp('(?:^|;)\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*([^;]+)'));
                        return match ? match[1] : null;
                    }
                    if (window.__sfdcSessionId) return window.__sfdcSessionId;
                    try { const sid = getCookie('sid'); if (sid) return sid; } catch (e) {}
                    try {
                        const sd = localStorage.getItem('sfdc_session');
                        if (sd) { const s = JSON.parse(sd); return s.sessionId || s.accessToken; }
                    } catch (e) {}
                    if (typeof sforce !== 'undefined' && sforce.connection && sforce.connection.sessionId) return sforce.connection.sessionId;
                    if (window.sfdcSessionId) return window.sfdcSessionId;
                    try { if (typeof Sfdc !== 'undefined' && Sfdc.session) return Sfdc.session.id || Sfdc.session.sessionId; } catch (e) {}
                    try { if (typeof $A !== 'undefined' && $A.util && $A.util.getSessionId) return $A.util.getSessionId(); } catch (e) {}
                    return null;
                }
            });
            if (results && results[0] && results[0].result) {
                return { accessToken: results[0].result, method: 'page-extraction' };
            }
        }
    } catch (error) {
        console.log('Could not extract from page:', error);
    }
    try {
        const url = new URL(instanceUrl);
        const domains = [
            url.hostname,
            '.' + url.hostname,
            '.' + url.hostname.split('.').slice(-2).join('.')
        ];
        for (const domain of domains) {
            const cookies = await chrome.cookies.getAll({ domain });
            const sidCookie = cookies.find(c => c.name === 'sid') || cookies.find(c => c.name.startsWith('sid_'));
            if (sidCookie) return { accessToken: sidCookie.value, method: 'cookie' };
        }
    } catch (error) {
        console.log('Could not get from cookies:', error);
    }
    return null;
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
        if (users.length > 0) {
            sidebarUserName.textContent = users[0].Name;
        }
    } catch (error) {
        console.error('Error loading users:', error);
        if (isSessionExpired(error)) handleSessionExpiry();
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
    switch (period) {
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
    searchTerm = '';
    if (tableSearch) tableSearch.value = '';
    await loadAuditLogs();
}

async function loadAuditLogs() {
    if (!salesforceAPI) return;
    showLoading(true);
    hideNoResults();
    tableSection.style.display = 'block';
    disconnectedMsg.style.display = 'none';
    try {
        const filters = { ...currentFilters, limit: pageSize, offset: (currentPage - 1) * pageSize };
        const result = await salesforceAPI.getAuditLogs(filters);
        allRecords = result.records;
        allFields = result.fields;
        totalRecords = result.totalSize;
        if (result.records.length === 0) {
            showNoResults();
            auditLogBody.innerHTML = '';
        } else {
            renderFilteredTable();
        }
        updatePagination();
        if (sidebarCount) sidebarCount.textContent = totalRecords;
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

function renderFilteredTable() {
    let records = allRecords;
    if (searchTerm) {
        records = allRecords.filter(r => {
            const searchable = [
                r.Action, r.Section, r.Display, r.DelegateUser,
                r.CreatedBy?.Name, r.Status, r.CreatedDate
            ].filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
            return searchable.includes(searchTerm);
        });
    }
    displayAuditLogs(records, allFields);
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
    if (!dateStr) return { date: 'N/A', time: '' };
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate().toString().padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    const secs = d.getSeconds().toString().padStart(2, '0');
    return {
        date: `${day} ${month} ${year}`,
        time: `${hours}:${mins}:${secs}`
    };
}

function getSectionTag(section) {
    const colors = {
        'Manage Users': 'tag-blue',
        'Login': 'tag-green',
        'Security': 'tag-purple',
        'Data Management': 'tag-amber',
    };
    const cls = colors[section] || 'tag-blue';
    return `<span class="tag ${cls}">${section || 'N/A'}</span>`;
}

function displayAuditLogs(records, fields) {
    auditLogBody.innerHTML = '';
    const hasDelegate = fields.includes('DelegateUser');

    records.forEach((record, idx) => {
        const fd = formatDate(record.CreatedDate);
        const initials = getInitials(record.CreatedBy?.Name);
        const section = record.Section || 'N/A';
        const sectionTag = getSectionTag(section);

        const delegateHtml = hasDelegate && record.DelegateUser
            ? `<div class="delegate-cell">
                <div class="delegate-avatar">${getInitials(record.DelegateUser)}</div>
                <div class="delegate-info">
                    <span class="delegate-name">${record.DelegateUser.split('@')[0] || record.DelegateUser}</span>
                    <span class="delegate-email">${record.DelegateUser}</span>
                </div>
               </div>`
            : '<span style="color:var(--slate-400);font-size:12px;">—</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="date-cell">
                    <span class="activity-dot"></span>
                    <div class="date-text">
                        <span class="date">${fd.date}</span>
                        <span class="time">${fd.time}</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm">${initials}</div>
                    <span class="name">${record.CreatedBy?.Name || 'N/A'}</span>
                </div>
            </td>
            <td>${sectionTag}</td>
            <td>
                <div class="action-cell">
                    <span class="action-icon">
                        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </span>
                    <span class="action-text">${record.Action || 'N/A'}</span>
                </div>
            </td>
            <td>
                <div class="details-cell">
                    <p>${record.Display || 'N/A'}</p>
                </div>
            </td>
            <td>${delegateHtml}</td>
            <td>
                <button class="btn-menu" title="More actions" data-idx="${idx}">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
            </td>
        `;
        auditLogBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

function updatePagination() {
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const first = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const last = Math.min(currentPage * pageSize, totalRecords);
    paginationInfo.textContent = totalRecords === 0
        ? 'No results'
        : `Showing ${first} to ${last} of ${totalRecords} results`;
    prevPage.disabled = currentPage === 1;
    nextPage.disabled = currentPage === totalPages;
    recordCount.textContent = totalRecords;
    if (sidebarCount) sidebarCount.textContent = totalRecords;
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
    if (searchClearBtn) searchClearBtn.style.display = 'none';
    startDate.value = '';
    endDate.value = '';
    userFilter.value = '';
    statusFilter.value = '';
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.chip[data-period="today"]')?.classList.add('active');
    currentPage = 1;
    pageSize = 25;
    pageSizeFilter.value = '25';
    searchTerm = '';
    if (tableSearch) tableSearch.value = '';
    currentFilters = {};
    applyFilters();
}

async function exportToCSV() {
    if (!salesforceAPI) return;
    showLoading(true);
    try {
        const filters = { ...currentFilters, limit: 10000 };
        const result = await salesforceAPI.getAuditLogs(filters);
        if (result.records.length === 0) {
            alert('No records to export');
            return;
        }
        const csvFields = result.fields.filter(f => f !== 'Id');
        const headerMap = {
            'CreatedDate': 'Date/Time',
            'CreatedBy.Name': 'User',
            'Section': 'Section',
            'Action': 'Action',
            'Display': 'Details',
            'Status': 'Status',
            'DelegateUser': 'Delegate User'
        };
        const headers = csvFields.map(f => headerMap[f] || f);
        const csvContent = [
            headers.join(','),
            ...result.records.map(record => {
                return csvFields.map(f => {
                    let v;
                    if (f === 'CreatedBy.Name') v = record.CreatedBy?.Name || 'N/A';
                    else v = record[f] || 'N/A';
                    return `"${String(v).replace(/"/g, '""')}"`;
                }).join(',');
            })
        ].join('\n');
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
    if (show) auditLogBody.innerHTML = '';
}

function showNoResults() {
    noResults.style.display = 'block';
    auditLogBody.innerHTML = '';
}

function hideNoResults() {
    noResults.style.display = 'none';
}
