// Google Apps Script for Analytics Dashboard Backend

// OAuth2 Configuration
const CLIENT_ID = 'YOUR_CLIENT_ID'; // Replace with your OAuth 2.0 Client ID
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET'; // Replace with your OAuth 2.0 Client Secret
const SHEET_ID = 'YOUR_SHEET_ID'; // Replace with your Google Sheet ID
const PROPERTY_ID = 'YOUR_PROPERTY_ID'; // Replace with your GA4 Property ID (e.g., properties/123456789)
const SITE_URL = 'YOUR_SITE_URL'; // Replace with your Search Console Site URL (e.g., https://example.com)

// OAuth2 Service Setup
function getOAuthService() {
  return OAuth2.createService('GoogleAnalyticsAndSearchConsole')
      .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
      .setTokenUrl('https://accounts.google.com/o/oauth2/token')
      .setClientId(CLIENT_ID)
      .setClientSecret(CLIENT_SECRET)
      .setCallbackFunction('authCallback')
      .setPropertyStore(PropertiesService.getScriptProperties())
      .setScope([
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/spreadsheets'
      ].join(' '))
      .setParam('access_type', 'offline')
      .setParam('prompt', 'consent');
}

// Handle OAuth Callback
function authCallback(request) {
  const service = getOAuthService();
  const isAuthorized = service.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Authorization successful! You can close this window.');
  } else {
    return HtmlService.createHtmlOutput('Authorization failed.');
  }
}

// Generate Authorization URL
function doGet(e) {
  const service = getOAuthService();
  if (!service.hasAccess()) {
    const authorizationUrl = service.getAuthorizationUrl();
    return HtmlService.createHtmlOutput(
      `<a href="${authorizationUrl}" target="_blank">Authorize</a>. Please open this link to authorize the app, then close this window.`
    );
  }
  return HtmlService.createHtmlOutput('App is already authorized.');
}

// Handle HTTP Requests from Dashboard
function doPost(e) {
  const service = getOAuthService();
  if (!service.hasAccess()) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Not authorized. Please authorize the app.' }))
        .setMimeType(ContentService.MimeType.JSON);
  }

  const params = JSON.parse(e.postData.contents);
  const action = params.action;

  try {
    switch (action) {
      case 'fetchAnalytics':
        return fetchAnalyticsData(params);
      case 'fetchSearchConsole':
        return fetchSearchConsoleData(params);
      case 'exportToSheet':
        return exportToSheet(params);
      default:
        return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
            .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
        .setMimeType(ContentService.MimeType.JSON);
  }
}

// Fetch Google Analytics Data
function fetchAnalyticsData(params) {
  const propertyId = params.propertyId || PROPERTY_ID;
  const dateRange = params.dateRange || '7daysAgo';
  const startDate = getStartDate(dateRange);
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

  const payload = {
    dateRanges: [{ startDate: startDate, endDate: 'today' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'engagementRate' }
    ],
    dimensions: [{ name: 'date' }, { name: 'pagePath' }, { name: 'sessionDefaultChannelGroup' }]
  };

  const service = getOAuthService();
  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + service.getAccessToken() },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Failed to fetch Analytics data: ' + response.getContentText());
  }

  const data = JSON.parse(response.getContentText());
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

// Fetch Search Console Data
function fetchSearchConsoleData(params) {
  const siteUrl = params.siteUrl || SITE_URL;
  const dateRange = params.dateRange || '7daysAgo';
  const startDate = getStartDate(dateRange);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  const payload = {
    startDate: startDate,
    endDate: 'today',
    dimensions: ['query', 'page', 'date'],
    rowLimit: 100
  };

  const service = getOAuthService();
  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + service.getAccessToken() },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Failed to fetch Search Console data: ' + response.getContentText());
  }

  const data = JSON.parse(response.getContentText());
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

// Export Data to Google Sheet
function exportToSheet(params) {
  const sheetId = params.sheetId || SHEET_ID;
  const dataType = params.dataType; // 'analytics' or 'searchConsole'
  const data = params.data;
  const sheet = SpreadsheetApp.openById(sheetId);
  let sheetName;

  try {
    if (dataType === 'analytics') {
      sheetName = 'Analytics Data';
      const analyticsSheet = sheet.getSheetByName(sheetName) || sheet.insertSheet(sheetName);
      analyticsSheet.clear();

      // Headers
      analyticsSheet.getRange('A1:E1').setValues([['Date', 'Page Path', 'Users', 'Sessions', 'Avg. Session Duration']]);

      // Data
      const rows = data.rows.map(row => [
        row.dimensionValues[0].value,
        row.dimensionValues[1].value,
        parseInt(row.metricValues[0].value),
        parseInt(row.metricValues[1].value),
        formatDuration(parseFloat(row.metricValues[3].value))
      ]);
      analyticsSheet.getRange(2, 1, rows.length, 5).setValues(rows);
    } else if (dataType === 'searchConsole') {
      sheetName = 'Search Console Data';
      const scSheet = sheet.getSheetByName(sheetName) || sheet.insertSheet(sheetName);
      scSheet.clear();

      // Headers
      scSheet.getRange('A1:F1').setValues([['Query', 'Page', 'Date', 'Clicks', 'Impressions', 'CTR']]);

      // Data
      const rows = data.rows.map(row => [
        row.keys[0],
        row.keys[1],
        row.keys[2],
        row.clicks,
        row.impressions,
        (row.ctr * 100).toFixed(1) + '%'
      ]);
      scSheet.getRange(2, 1, rows.length, 6).setValues(rows);
    } else {
      throw new Error('Invalid data type for export');
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: `Data exported to sheet: ${sheetName}` }))
        .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    throw new Error(`Failed to export to sheet: ${error.message}`);
  }
}

// Utility Functions
function getStartDate(range) {
  const today = new Date();
  if (range === '7d') {
    today.setDate(today.getDate() - 7);
  } else if (range === '30d') {
    today.setDate(today.getDate() - 30);
  } else if (range === '90d') {
    today.setDate(today.getDate() - 90);
  } else if (range === '365d') {
    today.setDate(today.getDate() - 365);
  } else {
    today.setDate(today.getDate() - 7); // Default to 7 days
  }
  return Utilities.formatDate(today, 'GMT', 'yyyy-MM-dd');
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}
