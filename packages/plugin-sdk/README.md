# 🔌 @oriva/plugin-sdk

> **TypeScript SDK for developing Oriva plugins with comprehensive APIs**

Build powerful plugins for the Oriva platform with our comprehensive TypeScript SDK. Access entries, templates, user management, UI interactions, and plugin storage with full type safety.

[![npm version](https://img.shields.io/npm/v/@oriva/plugin-sdk)](https://www.npmjs.com/package/@oriva/plugin-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## 📦 Installation

```bash
npm install @oriva/plugin-sdk
```

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in your project root:

```bash
# Oriva Platform Configuration
REACT_APP_ORIVA_API_URL=https://api.oriva.io
REACT_APP_ORIVA_GRAPHQL_URL=https://api.oriva.io/graphql
REACT_APP_ORIVA_WS_URL=wss://api.oriva.io/graphql
REACT_APP_ORIVA_API_KEY=your_api_key_here
```

### 2. Initialize the SDK

```typescript
import { OrivaPluginSDK, PluginContext } from '@oriva/plugin-sdk';

// Initialize the SDK with your plugin context
const context: PluginContext = {
  pluginId: 'your-plugin-id',
  version: '1.0.0',
  userId: 'user-id',
  permissions: ['entries:read', 'entries:write'],
  apiKey: process.env.REACT_APP_ORIVA_API_KEY,
  baseUrl: process.env.REACT_APP_ORIVA_API_URL,
};

const sdk = new OrivaPluginSDK(context);

// Use the SDK APIs
async function createEntry() {
  try {
    const entry = await sdk.entries.createEntry({
      title: 'My First Entry',
      content: 'Hello, Oriva!',
      audience: 'public',
    });
    console.log('Entry created:', entry);
  } catch (error) {
    console.error('Failed to create entry:', error);
  }
}
```

> **💡 Pro Tip:** The SDK provides full TypeScript support with autocomplete and type checking!

---

## ⚛️ React Hooks

The SDK includes React hooks for easy integration:

```typescript
import { useEntries, useUser, useStorage } from '@oriva/plugin-sdk/hooks';

function MyPluginComponent({ sdk }) {
  const { entries, loading, createEntry } = useEntries(sdk);
  const { user } = useUser(sdk);
  const { value: settings, setValue: setSettings } = useStorage(sdk, 'settings', {});

  const handleCreateEntry = async () => {
    await createEntry({
      title: 'New Entry',
      content: 'Content here...',
    });
  };

  return (
    <div>
      <h1>Welcome, {user?.displayName}</h1>
      <button onClick={handleCreateEntry}>Create Entry</button>
      {loading ? <p>Loading...</p> : <EntryList entries={entries} />}
    </div>
  );
}
```

> **🎯 React Integration:** Hooks provide reactive state management and automatic re-rendering!

---

## 📚 API Reference

### 🔧 Core SDK

#### **`OrivaPluginSDK`**

Main SDK class providing access to all APIs.

```typescript
const sdk = new OrivaPluginSDK(context, config?);

// Available APIs
sdk.entries   // Entry management
sdk.templates // Template management
sdk.user      // User information
sdk.ui        // UI interactions
sdk.storage   // Plugin storage
```

| API | Purpose | Key Features |
|-----|---------|--------------|
| **entries** | Entry management | CRUD operations, filtering |
| **templates** | Template management | Template creation, rating |
| **user** | User information | Profile management, preferences |
| **ui** | UI interactions | Notifications, modals, navigation |
| **storage** | Plugin storage | Key-value storage, TTL support |

### 📝 Entry API

Manage Oriva entries with full CRUD operations.

```typescript
// Get entries with filtering
const entries = await sdk.entries.getEntries({
  status: 'published',
  limit: 10,
  search: 'keyword',
});

// Create a new entry
const entry = await sdk.entries.createEntry({
  title: 'My Entry',
  content: 'Entry content',
  sections: [
    { type: 'heading', content: 'Introduction', order: 0 },
    { type: 'body', content: 'Main content...', order: 1 },
  ],
  audience: 'public',
});

// Update an entry
const updated = await sdk.entries.updateEntry({
  id: 'entry-id',
  title: 'Updated Title',
});

// Delete an entry
await sdk.entries.deleteEntry('entry-id');
```

> **📖 Entry Management:** Full CRUD operations with filtering, search, and section-based content structure.

### 📋 Template API

Work with Oriva templates for structured content creation.

```typescript
// Get templates
const templates = await sdk.templates.getTemplates({
  category: 'blog',
  sortBy: 'rating',
});

// Create a template
const template = await sdk.templates.createTemplate({
  name: 'Blog Post',
  description: 'Standard blog post template',
  category: 'blog',
  sections: [
    { type: 'heading', placeholder: 'Enter title...', order: 0 },
    { type: 'body', placeholder: 'Write your post...', order: 1 },
  ],
});

// Rate a template
await sdk.templates.rateTemplate('template-id', 5);
```

> **🎨 Template System:** Create reusable content templates with variable substitution and rating system.

### 👤 User API

Access user information and manage preferences.

```typescript
// Get current user
const user = await sdk.user.getCurrentUser();

// Update user profile
const updated = await sdk.user.updateProfile({
  displayName: 'New Name',
  bio: 'Updated bio',
});

// Manage plugin-specific preferences
await sdk.user.setPreference('theme', 'dark');
const theme = await sdk.user.getPreference('theme');
```

> **👥 User Management:** Access user profiles, preferences, and plugin-specific settings.

### 🎨 UI API

Interact with the Oriva user interface.

```typescript
// Show notifications
await sdk.ui.showNotification({
  title: 'Success',
  message: 'Entry saved successfully',
  type: 'success',
});

// Show modals
const result = await sdk.ui.showModal({
  title: 'Confirm Action',
  content: 'Are you sure you want to delete this entry?',
  actions: [
    { label: 'Cancel', variant: 'secondary' },
    { label: 'Delete', variant: 'danger' },
  ],
});

// Navigate to screens
await sdk.ui.navigate({
  screen: 'CreateEntry',
  params: { templateId: 'template-id' },
});

// Show toast messages
await sdk.ui.showToast('Changes saved!', 'success');
```

> **🖥️ UI Integration:** Seamlessly integrate with Oriva's interface through notifications, modals, and navigation.

### 💾 Storage API

Persist plugin data with a key-value store.

```typescript
// Store data
await sdk.storage.set('user-preferences', {
  theme: 'dark',
  notifications: true,
});

// Retrieve data
const preferences = await sdk.storage.get('user-preferences');

// Check if key exists
const exists = await sdk.storage.has('user-preferences');

// Delete data
await sdk.storage.delete('user-preferences');

// Atomic operations
await sdk.storage.increment('view-count', 1);
await sdk.storage.push('recent-items', newItem);

// TTL support
await sdk.storage.setWithTTL('session-data', data, 3600); // 1 hour
```

> **🗄️ Data Persistence:** Store plugin-specific data with automatic serialization and TTL support.

---

## 🔐 Permissions

Your plugin must declare required permissions in its manifest:

```json
{
  "permissions": [
    "entries:read",
    "entries:write",
    "templates:read",
    "user:read",
    "ui:notifications",
    "storage:read",
    "storage:write"
  ]
}
```

### 📋 Available Permissions

| Permission | Description | Use Case |
|------------|-------------|----------|
| `entries:read` | Read entries | Content reading apps |
| `entries:write` | Create and update entries | Content creation tools |
| `entries:delete` | Delete entries | Content management |
| `templates:read` | Read templates | Template-based apps |
| `templates:write` | Create and update templates | Template creation tools |
| `user:read` | Read user information | User data access |
| `user:write` | Update user profiles | Profile management |
| `ui:notifications` | Show notifications | User feedback |
| `ui:modals` | Display modals | User interactions |
| `ui:navigation` | Navigate between screens | App navigation |
| `storage:read` | Read plugin storage | Data persistence |
| `storage:write` | Write to plugin storage | Data storage |

---

## 🚨 Error Handling

The SDK provides comprehensive error handling:

```typescript
import { ApiError } from '@oriva/plugin-sdk';

try {
  await sdk.entries.createEntry(entryData);
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message);
    console.error('Error Code:', error.code);
    console.error('Status:', error.status);
  }
}
```

> **🛡️ Robust Error Handling:** Comprehensive error types with detailed information for debugging.

---

## ⚡ Rate Limiting

API calls are rate-limited to ensure fair usage:

| Operation Type | Rate Limit | Purpose |
|----------------|------------|---------|
| **General API** | 1000 requests/hour per plugin | Standard operations |
| **Write Operations** | 200 requests/hour per plugin | Data modification |
| **Storage Operations** | 500 requests/hour per plugin | Data persistence |
| **UI Operations** | 100 requests/hour per plugin | User interface |

---

## 🔷 TypeScript Support

The SDK is built with TypeScript and provides full type safety:

```typescript
import type { Entry, Template, User, PluginManifest } from '@oriva/plugin-sdk';

// All API responses are properly typed
const entry: Entry = await sdk.entries.getEntry('entry-id');
const templates: Template[] = await sdk.templates.getTemplates();
```

> **🎯 Type Safety:** Full TypeScript support with autocomplete and compile-time error checking!

---

## 📚 Examples

### 📝 Blog Plugin

```typescript
import { OrivaPluginSDK } from '@oriva/plugin-sdk';

class BlogPlugin {
  constructor(private sdk: OrivaPluginSDK) {}

  async createBlogPost(title: string, content: string, tags: string[]) {
    // Create entry with blog template
    const entry = await this.sdk.entries.createEntry({
      title,
      content,
      templateId: 'blog-template-id',
      audience: 'public',
    });

    // Store tags in plugin storage
    await this.sdk.storage.set(`entry-tags-${entry.id}`, tags);

    // Show success notification
    await this.sdk.ui.showToast('Blog post created!', 'success');

    return entry;
  }

  async getMyPosts() {
    return this.sdk.entries.getEntries({
      templateId: 'blog-template-id',
      status: 'published',
    });
  }
}
```

### Analytics Plugin

```typescript
import { OrivaPluginSDK } from '@oriva/plugin-sdk';

class AnalyticsPlugin {
  constructor(private sdk: OrivaPluginSDK) {}

  async trackEvent(event: string, data: any) {
    // Store event in plugin storage
    const events = await this.sdk.storage.get('events') || [];
    events.push({
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    await this.sdk.storage.set('events', events);
  }

  async getAnalytics() {
    const events = await this.sdk.storage.get('events') || [];
    const stats = await this.sdk.entries.getEntryStats();

    return {
      totalEvents: events.length,
      entryStats: stats,
      recentEvents: events.slice(-10),
    };
  }

  async showAnalyticsDashboard() {
    const analytics = await this.getAnalytics();

    await this.sdk.ui.showModal({
      title: 'Analytics Dashboard',
      content: analytics,
      size: 'large',
    });
  }
}
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Documentation: https://github.com/0riva/oriva-platform
- Support: Use the support system within Oriva Core