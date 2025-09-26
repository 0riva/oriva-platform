# 5-Minute API Test

**Goal**: Get your first successful API call working in under 5 minutes.

## What You'll Achieve
- ✅ Verify your Oriva API key works
- ✅ See real user data from the API
- ✅ Confirm your development environment is ready

## Prerequisites
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Oriva developer account created
- [ ] 5 minutes of focused time

## Step 1: Get Your API Key (2 minutes)

1. **Log into [Oriva Core](https://oriva.io)**
2. **Go to Settings** → **Developer Settings**
3. **Click "Generate Live API Key"**
4. **Copy the key** (starts with `oriva_pk_live_...`)

## Step 2: Test Your Key (3 minutes)

Create a simple test file:

```javascript
// test-api.js
const API_KEY = 'your_oriva_api_key_here'; // Replace with your actual key
const API_URL = 'https://api.oriva.io/api/v1';

async function testAPI() {
  console.log('🔍 Testing Oriva API connection...');

  try {
    // Test 1: Health check
    const healthResponse = await fetch(`${API_URL}/health`);
    console.log('✅ Health check:', healthResponse.status === 200 ? 'PASS' : 'FAIL');

    // Test 2: User data (with your API key)
    const userResponse = await fetch(`${API_URL}/user/me`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ API Authentication: PASS');
      console.log('👤 Your user data:', userData);
      console.log('\n🎉 SUCCESS! Your API key is working.');
    } else {
      console.log('❌ API Authentication: FAIL');
      console.log('Status:', userResponse.status);
      console.log('Check your API key and try again.');
    }

  } catch (error) {
    console.log('❌ Connection failed:', error.message);
  }
}

testAPI();
```

Run the test:
```bash
node test-api.js
```

## Expected Success Output
```
🔍 Testing Oriva API connection...
✅ Health check: PASS
✅ API Authentication: PASS
👤 Your user data: { id: "...", name: "...", email: "..." }

🎉 SUCCESS! Your API key is working.
```

## If Something Goes Wrong

**❌ "Invalid API key" error:**
- Check your key starts with `oriva_pk_live_...`
- Make sure you copied the entire key
- Generate a new key if needed

**❌ "Network error" or "CORS" error:**
- This is expected in browser environments
- Node.js testing should work fine
- You'll need a proxy for browser apps (covered in next steps)

## 🎯 What's Next?

Now that your API key works, choose your path:

### Quick Web Integration (15 minutes)
→ **[15-Minute Web App Guide](./15-minute-web-app.md)**
- Get a working web app with user data
- Simple HTML + JavaScript
- No complex setup required

### Full Production Setup (1 hour)
→ **[Complete Integration Guide](../START_GUIDE.md)**
- Production-ready security patterns
- Marketplace submission
- Advanced features

### Need Help?
→ **[Troubleshooting Guide](./api-troubleshooting-guide.md)**

---

**🎉 Congratulations!** You've successfully connected to the Oriva API. The hardest part is behind you.