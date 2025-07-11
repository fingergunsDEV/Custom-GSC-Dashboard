const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Cache credentials
let credentials = null;

// Fetch credentials from Apps Script
async function fetchCredentials() {
  if (credentials) return credentials;
  try {
    const response = await axios.post(process.env.APPS_SCRIPT_URL, { action: 'getCredentials' });
    credentials = response.data;
    if (credentials.error) throw new Error(credentials.error);
    return credentials;
  } catch (error) {
    console.error('Error fetching credentials:', error.message);
    throw new Error('Failed to fetch credentials');
  }
}

// Fetch Analytics Data
app.post('/api/fetchAnalytics', async (req, res) => {
  const { dateRange } = req.body;
  try {
    const creds = await fetchCredentials();
    const response = await axios.post(process.env.APPS_SCRIPT_URL, {
      action: 'fetchAnalytics',
      propertyId: creds.PROPERTY_ID,
      dateRange
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Analytics data:', error.message);
    res.status(500).json({ error: 'Failed to fetch Analytics data' });
  }
});

// Fetch Search Console Data
app.post('/api/fetchSearchConsole', async (req, res) => {
  const { dateRange } = req.body;
  try {
    const creds = await fetchCredentials();
    const response = await axios.post(process.env.APPS_SCRIPT_URL, {
      action: 'fetchSearchConsole',
      siteUrl: creds.SITE_URL,
      dateRange
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Search Console data:', error.message);
    res.status(500).json({ error: 'Failed to fetch Search Console data' });
  }
});

// Export Data to Sheet
app.post('/api/exportToSheet', async (req, res) => {
  const { dataType, data } = req.body;
  try {
    const creds = await fetchCredentials();
    const response = await axios.post(process.env.APPS_SCRIPT_URL, {
      action: 'exportToSheet',
      sheetId: creds.SHEET_ID,
      dataType,
      data
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error exporting to sheet:', error.message);
    res.status(500).json({ error: 'Failed to export data to sheet' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
