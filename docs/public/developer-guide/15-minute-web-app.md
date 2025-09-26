# 15-Minute Web App Integration

**Goal**: Build a working web app that displays Oriva user data.

## What You'll Build
- ✅ Simple HTML page that loads user profile
- ✅ API proxy to handle CORS and security
- ✅ Error handling and loading states
- ✅ Foundation for building more features

## Prerequisites
- [ ] Completed [5-Minute API Test](./5-minute-api-test.md)
- [ ] Your API key confirmed working
- [ ] Code editor ready

---

## Step 1: Create Project Structure (2 minutes)

```bash
mkdir my-oriva-app
cd my-oriva-app

# Create the basic files
touch index.html
touch server.js
touch package.json
touch .env
```

## Step 2: Set Up Environment (3 minutes)

**`.env` file:**
```bash
ORIVA_API_KEY=your_oriva_api_key_here
ORIVA_API_URL=https://api.oriva.io/api/v1
PORT=3000
```

**`package.json` file:**
```json
{
  "name": "my-oriva-app",
  "version": "1.0.0",
  "description": "My Oriva Platform Integration",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3"
  }
}
```

**Install dependencies:**
```bash
npm install
```

## Step 3: Create API Proxy Server (5 minutes)

**`server.js` file:**
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files (your HTML)
app.use(express.static('.'));

// API proxy endpoint
app.get('/api/user', async (req, res) => {
  try {
    console.log('📡 Fetching user data from Oriva API...');

    const response = await fetch(`${process.env.ORIVA_API_URL}/user/me`, {
      headers: {
        'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MyOrivaApp/1.0.0'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const userData = await response.json();
    console.log('✅ User data retrieved successfully');

    res.json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch user data'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    apiConfigured: !!process.env.ORIVA_API_KEY
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`👤 User API: http://localhost:${PORT}/api/user`);

  if (!process.env.ORIVA_API_KEY) {
    console.log('⚠️  Warning: ORIVA_API_KEY not found in .env file');
  }
});
```

## Step 4: Create Frontend (5 minutes)

**`index.html` file:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Oriva App</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
        }
        .status {
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
        }
        .loading { background: #f0f8ff; border: 1px solid #0066cc; }
        .success { background: #f0fff0; border: 1px solid #00cc00; }
        .error { background: #fff0f0; border: 1px solid #cc0000; }
        .user-card {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        button {
            background: #0066cc;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover { background: #0052a3; }
        button:disabled { background: #ccc; cursor: not-allowed; }
    </style>
</head>
<body>
    <h1>🚀 My Oriva App</h1>
    <p>Testing integration with the Oriva Platform API.</p>

    <div id="status"></div>

    <button id="loadUserBtn" onclick="loadUserData()">Load My Profile</button>

    <div id="userProfile"></div>

    <script>
        // Show initial status
        showStatus('Ready to connect to Oriva API', 'loading');

        async function loadUserData() {
            const button = document.getElementById('loadUserBtn');
            const statusDiv = document.getElementById('status');
            const profileDiv = document.getElementById('userProfile');

            // Update UI for loading state
            button.disabled = true;
            button.textContent = 'Loading...';
            showStatus('Fetching your profile data...', 'loading');
            profileDiv.innerHTML = '';

            try {
                const response = await fetch('/api/user');
                const result = await response.json();

                if (result.success) {
                    showStatus('✅ Profile loaded successfully!', 'success');
                    displayUserProfile(result.data);
                } else {
                    throw new Error(result.message || 'Failed to load profile');
                }

            } catch (error) {
                console.error('Error:', error);
                showStatus(`❌ Error: ${error.message}`, 'error');
                profileDiv.innerHTML = `
                    <div class="error">
                        <h3>Troubleshooting Steps:</h3>
                        <ol>
                            <li>Check your .env file has the correct API key</li>
                            <li>Make sure your server is running</li>
                            <li>Verify your API key at <a href="https://oriva.io" target="_blank">oriva.io</a></li>
                        </ol>
                    </div>
                `;
            } finally {
                button.disabled = false;
                button.textContent = 'Reload Profile';
            }
        }

        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = `<div class="${type}">${message}</div>`;
        }

        function displayUserProfile(user) {
            const profileDiv = document.getElementById('userProfile');
            profileDiv.innerHTML = `
                <div class="user-card">
                    <h2>👤 Your Oriva Profile</h2>
                    <p><strong>Name:</strong> ${user.name || user.displayName || 'Not provided'}</p>
                    <p><strong>Email:</strong> ${user.email || 'Not provided'}</p>
                    <p><strong>User ID:</strong> ${user.id || 'Not provided'}</p>
                    <p><strong>Account Created:</strong> ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not provided'}</p>

                    <details style="margin-top: 15px;">
                        <summary style="cursor: pointer; font-weight: bold;">📋 Raw API Response</summary>
                        <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; margin-top: 10px; font-size: 12px;">${JSON.stringify(user, null, 2)}</pre>
                    </details>
                </div>

                <div class="success">
                    <h3>🎉 Integration Successful!</h3>
                    <p>Your app is now connected to the Oriva Platform. You can:</p>
                    <ul>
                        <li>Access user profile data</li>
                        <li>Build features using the Oriva API</li>
                        <li>Submit your app to the marketplace</li>
                    </ul>
                    <p><strong>Next steps:</strong> <a href="../START_GUIDE.md">Complete Integration Guide</a></p>
                </div>
            `;
        }

        // Test server connection on page load
        fetch('/health')
            .then(response => response.json())
            .then(data => {
                if (data.apiConfigured) {
                    showStatus('Server ready with API key configured ✅', 'success');
                } else {
                    showStatus('⚠️ Server running but API key not found', 'error');
                }
            })
            .catch(() => {
                showStatus('❌ Server not running. Run "npm start" first.', 'error');
            });
    </script>
</body>
</html>
```

## Step 5: Test Your App (1 minute)

**Start your server:**
```bash
npm start
```

**Open in browser:**
```
http://localhost:3000
```

**Click "Load My Profile"** and see your Oriva user data!

---

## 🎯 Success! What You've Built

You now have:
- ✅ **Working Oriva API integration**
- ✅ **Secure server-side proxy** (API key stays secret)
- ✅ **Error handling and user feedback**
- ✅ **Foundation for building more features**

## 🚀 What's Next?

### Add More Features (30 minutes)
Try adding these API calls to your app:
```javascript
// Get user's profiles
fetch('/api/profiles')

// Get user's groups
fetch('/api/groups')

// Get marketplace apps
fetch('/api/marketplace')
```

### Production Deployment (1 hour)
→ **[Production Deployment Guide](./production-deployment.md)**
- Deploy to Vercel/Netlify
- Configure environment variables
- Set up monitoring

### Marketplace Integration (2 hours)
→ **[Complete Integration Guide](../START_GUIDE.md)**
- iframe embedding for marketplace
- Security headers and CSP
- App submission process

### Need Help?
- **[API Reference](./api-reference-complete.md)** - All available endpoints
- **[Troubleshooting](./api-troubleshooting-guide.md)** - Common issues and solutions
- **[Security Patterns](./authentication-patterns.md)** - Production security

---

**🎉 Congratulations!** You've built your first Oriva-integrated web app. You're ready to build something amazing!