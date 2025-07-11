```javascript
const express = require('express');
const dotenv = require('dotenv');
const { google } = require('googleapis');
const axios = require('axios');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (e.g., HTML dashboard)
app.use(express.static('public'));

// OAuth2 Configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'http://localhost:3000/auth/callback' // Redirect URI
);

// Scopes
const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/spreadsheets'
];

// Authorization URL
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.json({ authUrl });
});

// OAuth Callback
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    res.redirect('/?authorized=true');
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Fetch Analytics Data
app.post('/api/fetchAnalytics', async (req, res) => {
  const { dateRange } = req.body;
  try {
    const response = await axios.post(process.env.APPS_SCRIPT_URL, {
      action: 'fetchAnalytics',
      propertyId: process.env.PROPERTY_ID,
      dateRange
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Analytics data:', error);
    res.status(500).json({ error: 'Failed to fetch Analytics data' });
  }
});

// Fetch Search Console Data
app.post('/api/fetchSearchConsole', async (req, res) => {
  const { dateRange } = req.body;
  try {
    const response = await axios.post(process.env.APPS_SCRIPT_URL, {
      action: 'fetchSearchConsole',
      siteUrl: process.env.SITE_URL,
      dateRange
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Search Console data:', error);
    res.status(500).json({ error: 'Failed to fetch Search Console data' });
  }
});

// Export Data to Sheet
app.post('/api/exportToSheet', async (req, res) => {
  const { dataType, data } = req.body;
  try {
    const response = await axios.post(process.env.APPS_SCRIPT_URL, {
      action: 'exportToSheet',
      sheetId: process.env.SHEET_ID,
      dataType,
      data
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error exporting to sheet:', error);
    res.status(500).json({ error: 'Failed to export data to sheet' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### Step 2: Update the Apps Script
The Apps Script remains largely the same as provided in the previous response, but it no longer needs OAuth2 configuration since the Node.js backend handles authentication. Below is the updated Apps Script, simplified to handle data fetching and sheet export without OAuth logic.

<xaiArtifact artifact_id="a1ed59ac-396a-482d-852e-ef60de60b7a3" artifact_version_id="65ea1de7-7797-435f-bcbd-d06173d5d5ed" title="Code.gs" contentType="text/javascript">
```javascript
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
