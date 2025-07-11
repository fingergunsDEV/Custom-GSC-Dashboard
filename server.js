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



