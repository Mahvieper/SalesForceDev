// Background service worker for the extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Salesforce Audit Log Extension installed');
});

// Handle messages from popup if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSessionId') {
        // Handle session ID retrieval
        sendResponse({ success: true });
    }
});