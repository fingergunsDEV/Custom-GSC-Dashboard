// Google Apps Script for Analytics Dashboard Backend

// Constants
const SHEET_ID = 'YOUR_SHEET_ID'; // Replace with your Google Sheet ID
const PROPERTY_ID = 'YOUR_PROPERTY_ID'; // Replace with your GA4 Property ID
const SITE_URL = 'YOUR_SITE_URL'; // Replace with your Search Console Site URL

// Handle HTTP Requests
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;

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

  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
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
