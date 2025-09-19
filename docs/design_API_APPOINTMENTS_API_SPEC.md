# Oriva Appointments API Specification

**Status**: Proposed API for Phase 2 migration
**Current Implementation**: Phase 1 using Work Buddy Supabase
**Target Migration**: When Oriva implements appointments API

## 🎯 **Implementation Scope Clarification**

**IMPORTANT**: This specification is for **enhancing the Oriva Platform API** (`/Users/cosmic/Documents/oriva-platform/api/`) to provide centralized appointments functionality. This is **NOT** about enhancing Work Buddy's database.

### **Architecture Overview**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Work Buddy    │    │  Other 3rd      │    │  Future Oriva   │
│     App         │◄──►│  Party Apps     │◄──►│     Apps        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │   Oriva Platform API    │
                    │  /api/v1/appointments   │
                    │ (NEW ENDPOINTS BELOW)   │
                    └─────────────────────────┘
```

### **Implementation Strategy**
1. **Oriva Platform API Enhancement**: Add appointments endpoints to existing API
2. **Work Buddy Migration**: Update Work Buddy to consume these new endpoints
3. **Marketplace Availability**: Same endpoints available to all 3rd party developers
4. **Data Centralization**: All appointment data stored in Oriva's database

## Overview

This document specifies the appointments/bookings API that should be implemented in the Oriva platform to support Work Buddy's scheduling functionality. Currently, Work Buddy implements appointments in its own Supabase database (Phase 1), but will migrate to Oriva's centralized appointments API when available (Phase 2).

## Benefits of Oriva Appointments API

### 1. **Unified User Profile**
- User's work appointments become part of their core Oriva identity
- Cross-app visibility and integration across the Oriva marketplace
- Centralized calendar and scheduling across all Oriva applications

### 2. **Cross-App Integration**
- Future Oriva apps can book into existing Work Buddy sessions
- Calendar sync with other productivity tools in the marketplace
- Team coordination across multiple Oriva applications

### 3. **Platform Network Effects**
- More valuable user profiles (appointments + preferences + history)
- Cross-pollination between different productivity apps
- Stronger user lock-in to the Oriva ecosystem

---

## API Endpoints Specification

### Base URL
```
https://api.oriva.io/api/v1
```

### Authentication
All endpoints require Oriva JWT authentication token:
```
Authorization: Bearer {oriva_jwt_token}
```

---

## 📅 Appointment Management

### 1. **Create Appointment**
```http
POST /appointments
```

**Request Body:**
```json
{
  "title": "Desk session - 25 minutes",
  "description": "Productive focused work session",
  "work_type": "desk",
  "scheduled_start": "2024-01-15T14:00:00Z",
  "duration_minutes": 25,
  "max_participants": 3,
  "is_private": false,
  "app_metadata": {
    "app_id": "work-buddy",
    "focus_level": 8,
    "productivity_notes": "Deep work session"
  }
}
```

**Response:**
```json
{
  "id": "apt_1234567890",
  "title": "Desk session - 25 minutes",
  "description": "Productive focused work session",
  "host_user_id": "user_abc123",
  "host": {
    "id": "user_abc123",
    "name": "Alex Smith",
    "avatar": "https://oriva.io/avatars/user_abc123.jpg"
  },
  "participants": [
    {
      "id": "user_abc123",
      "name": "Alex Smith",
      "avatar": "https://oriva.io/avatars/user_abc123.jpg",
      "joined_at": "2024-01-15T13:55:00Z"
    }
  ],
  "work_type": "desk",
  "scheduled_start": "2024-01-15T14:00:00Z",
  "scheduled_end": "2024-01-15T14:25:00Z",
  "duration_minutes": 25,
  "max_participants": 3,
  "is_private": false,
  "status": "scheduled",
  "app_metadata": {
    "app_id": "work-buddy",
    "focus_level": 8,
    "productivity_notes": "Deep work session"
  },
  "created_at": "2024-01-15T13:55:00Z",
  "updated_at": "2024-01-15T13:55:00Z"
}
```

### 2. **Get Available Appointments**
```http
GET /appointments?status=available
```

**Query Parameters:**
- `status` - Filter by status (`available`, `active`, `completed`, `cancelled`)
- `work_type` - Filter by work type (`desk`, `moving`, `anything`)
- `is_private` - Filter by privacy (`true`, `false`)
- `max_participants` - Filter by max participants
- `start_date` - Filter appointments starting after this date
- `end_date` - Filter appointments starting before this date
- `page` - Pagination page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Response:**
```json
{
  "appointments": [
    {
      "id": "apt_1234567890",
      "title": "Desk session - 25 minutes",
      "host": {
        "id": "user_abc123",
        "name": "Alex Smith",
        "avatar": "https://oriva.io/avatars/user_abc123.jpg"
      },
      "participants": [...],
      "work_type": "desk",
      "scheduled_start": "2024-01-15T14:00:00Z",
      "duration_minutes": 25,
      "max_participants": 3,
      "current_participants": 1,
      "is_private": false,
      "status": "available",
      "created_at": "2024-01-15T13:55:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### 3. **Get Appointment Details**
```http
GET /appointments/{appointment_id}
```

**Response:**
```json
{
  "id": "apt_1234567890",
  "title": "Desk session - 25 minutes",
  "description": "Productive focused work session",
  "host_user_id": "user_abc123",
  "host": {
    "id": "user_abc123",
    "name": "Alex Smith",
    "avatar": "https://oriva.io/avatars/user_abc123.jpg"
  },
  "participants": [
    {
      "id": "user_abc123",
      "name": "Alex Smith",
      "avatar": "https://oriva.io/avatars/user_abc123.jpg",
      "joined_at": "2024-01-15T13:55:00Z"
    },
    {
      "id": "user_def456",
      "name": "Jamie Chen",
      "avatar": "https://oriva.io/avatars/user_def456.jpg",
      "joined_at": "2024-01-15T13:58:00Z"
    }
  ],
  "work_type": "desk",
  "scheduled_start": "2024-01-15T14:00:00Z",
  "scheduled_end": "2024-01-15T14:25:00Z",
  "duration_minutes": 25,
  "max_participants": 3,
  "is_private": false,
  "status": "active",
  "app_metadata": {
    "app_id": "work-buddy",
    "focus_level": 8,
    "productivity_notes": "Deep work session"
  },
  "created_at": "2024-01-15T13:55:00Z",
  "updated_at": "2024-01-15T14:02:00Z"
}
```

### 4. **Join Appointment**
```http
POST /appointments/{appointment_id}/join
```

**Request Body:**
```json
{
  "message": "Looking forward to working together!",
  "app_metadata": {
    "work_description": "Working on React components"
  }
}
```

**Response:**
```json
{
  "success": true,
  "appointment": {
    // Full appointment object with updated participants
  }
}
```

### 5. **Leave Appointment**
```http
POST /appointments/{appointment_id}/leave
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully left the appointment"
}
```

### 6. **Update Appointment**
```http
PUT /appointments/{appointment_id}
```

**Request Body:**
```json
{
  "title": "Updated session title",
  "description": "Updated description",
  "scheduled_start": "2024-01-15T15:00:00Z",
  "duration_minutes": 30,
  "app_metadata": {
    "focus_level": 9,
    "productivity_notes": "High intensity session"
  }
}
```

**Response:**
```json
{
  // Updated appointment object
}
```

### 7. **Cancel Appointment**
```http
DELETE /appointments/{appointment_id}
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment cancelled successfully"
}
```

---

## 📊 User Appointment History

### 8. **Get User's Appointments**
```http
GET /users/me/appointments
```

**Query Parameters:**
- `status` - Filter by status
- `role` - Filter by user role (`host`, `participant`, `all`)
- `start_date` - Appointments after this date
- `end_date` - Appointments before this date
- `page` - Pagination
- `limit` - Items per page

**Response:**
```json
{
  "appointments": [
    // Array of appointment objects
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

### 9. **Get Current Active Appointment**
```http
GET /users/me/appointments/current
```

**Response:**
```json
{
  "appointment": {
    // Current active appointment object or null
  }
}
```

---

## 🎯 Data Model

### Appointment Object
```typescript
interface Appointment {
  id: string;                          // Unique appointment ID
  title: string;                       // Appointment title
  description?: string;                // Optional description
  host_user_id: string;               // Host's Oriva user ID
  host: {                             // Host user profile
    id: string;
    name: string;
    avatar: string;
  };
  participants: Array<{               // Current participants
    id: string;
    name: string;
    avatar: string;
    joined_at: string;
  }>;
  work_type: 'desk' | 'moving' | 'anything';  // Work Buddy specific
  scheduled_start: string;            // ISO datetime
  scheduled_end: string;              // ISO datetime
  duration_minutes: number;           // Duration in minutes
  max_participants: number;           // Maximum allowed participants
  is_private: boolean;                // Privacy setting
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  app_metadata: {                     // App-specific data
    app_id: string;                   // e.g., "work-buddy"
    [key: string]: any;               // App-specific fields
  };
  created_at: string;                 // ISO datetime
  updated_at: string;                 // ISO datetime
}
```

### Status Lifecycle
```
scheduled → active → completed
    ↓
 cancelled
```

---

## 🔄 Real-time Events

### WebSocket Events
Oriva should emit real-time events for appointment changes:

```javascript
// Appointment created
{
  "event": "appointment:created",
  "data": {
    "appointment": { /* appointment object */ }
  }
}

// User joined appointment
{
  "event": "appointment:participant_joined",
  "data": {
    "appointment_id": "apt_1234567890",
    "participant": {
      "id": "user_def456",
      "name": "Jamie Chen",
      "avatar": "https://oriva.io/avatars/user_def456.jpg",
      "joined_at": "2024-01-15T13:58:00Z"
    }
  }
}

// User left appointment
{
  "event": "appointment:participant_left",
  "data": {
    "appointment_id": "apt_1234567890",
    "participant_id": "user_def456"
  }
}

// Appointment status changed
{
  "event": "appointment:status_changed",
  "data": {
    "appointment_id": "apt_1234567890",
    "old_status": "scheduled",
    "new_status": "active"
  }
}

// Appointment updated
{
  "event": "appointment:updated",
  "data": {
    "appointment": { /* updated appointment object */ }
  }
}
```

---

## 🔒 Security & Permissions

### Access Control
- **Create**: Any authenticated user can create appointments
- **View**: Users can view public appointments + their own private appointments
- **Join**: Users can join public appointments if space available
- **Update**: Only the host can update appointment details
- **Cancel**: Only the host can cancel appointments
- **Leave**: Participants can leave at any time

### Privacy
- **Public appointments**: Visible to all users, can be joined by anyone
- **Private appointments**: Only visible to invited participants
- **Host control**: Host has full control over their appointments

### Rate Limiting
- **Create**: 10 appointments per hour per user
- **Join**: 50 joins per hour per user
- **Updates**: 20 updates per hour per appointment

---

## 📈 Analytics & Insights

### Optional Analytics Endpoints
```http
GET /users/me/appointments/analytics
GET /appointments/analytics/trends
```

These could provide insights for users and the platform about:
- Appointment completion rates
- Popular work types and times
- User productivity patterns
- Platform usage trends

---

## 🔧 Implementation Notes

### Database Schema Considerations
```sql
-- Appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  host_user_id VARCHAR(255) NOT NULL,
  work_type VARCHAR(50),
  scheduled_start TIMESTAMP NOT NULL,
  scheduled_end TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL,
  max_participants INTEGER DEFAULT 3,
  is_private BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'scheduled',
  app_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Appointment participants junction table
CREATE TABLE appointment_participants (
  appointment_id UUID REFERENCES appointments(id),
  user_id VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active',
  PRIMARY KEY (appointment_id, user_id)
);
```

### Migration Path from Work Buddy Phase 1
When Oriva implements this API:

1. **Data Migration**: Export appointments from Work Buddy Supabase to Oriva
2. **API Migration**: Update Work Buddy to use Oriva appointments API
3. **Enhanced Metadata**: Move Work Buddy-specific data to `app_metadata`
4. **Deprecation**: Phase out Work Buddy's appointments tables

### App Metadata Usage
```json
{
  "app_metadata": {
    "app_id": "work-buddy",
    "focus_level": 8,
    "productivity_notes": "Deep work session",
    "effectiveness_rating": 5,
    "work_description": "Working on React components"
  }
}
```

---

## 🎯 Success Metrics

Once implemented, this API will enable:

1. **Cross-App Integration**: 100% appointment visibility across Oriva apps
2. **User Experience**: Single calendar for all Oriva productivity apps
3. **Platform Value**: Increased user engagement and app stickiness
4. **Developer Experience**: Standardized appointments API for all marketplace apps

---

## 📋 **Development Notes**

### **Technical Assessment (Added 2025-01-15)**
- **Scope**: Medium-Large (2-3 weeks development)
- **Target Location**: `/Users/cosmic/Documents/oriva-platform/api/index.js`
- **Database**: Add to existing Supabase schema
- **Integration**: Extends current Express.js API structure

### **Current Oriva API Structure Analysis**
- **Framework**: Express.js with Supabase backend
- **Existing Patterns**: `/api/v1/` prefix, JWT auth, rate limiting
- **Dependencies**: `@supabase/supabase-js`, `express-validator`, `winston`
- **Security**: API key validation middleware already implemented

### **Implementation Plan**
1. **Database Schema**: Add appointments tables to existing Supabase
2. **Middleware**: Extend existing auth/validation for appointments
3. **Endpoints**: Add 9 new `/api/v1/appointments/*` routes
4. **Real-time**: Implement WebSocket for live updates
5. **Testing**: Unit tests following existing patterns

### **Technical Considerations**
- **Authentication**: Leverage existing JWT validation
- **Rate Limiting**: Add appointment-specific limits
- **Caching**: Redis for permission/profile data
- **Migration**: Careful data transfer from Work Buddy's Supabase

### **Strategic Value**
- **Platform Network Effects**: Creates cross-app integration foundation
- **Marketplace API**: Standardized appointments for all 3rd party developers
- **User Experience**: Centralized calendar across Oriva ecosystem

---

**Next Steps:**
1. **Oriva Platform Team**: Implements appointments API in `/oriva-platform/api/`
2. **Work Buddy Team**: Migrates from Phase 1 (own Supabase) to Phase 2 (Oriva API)
3. **Marketplace**: Same endpoints available to all 3rd party developers
4. **Cross-App Integration**: Enhanced collaboration and user experience