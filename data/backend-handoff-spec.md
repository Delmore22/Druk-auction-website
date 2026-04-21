# Backend Handoff Spec — Classic Auction Platform

**Date:** April 21, 2026  
**Status:** Frontend complete (static JSON + localStorage). Backend required to replace all stubbed items below.  
**Firebase Project:** `classicauction` (project already initialized in `index.js`)  
**Auth:** Firebase Auth is already wired. All custom API endpoints should verify the Firebase ID token via `Authorization: Bearer <idToken>` header.

---

## Table of Contents

1. [Auth & Access Codes](#1-auth--access-codes)
2. [Vehicle Inventory](#2-vehicle-inventory)
3. [Favorites](#3-favorites)
4. [Add / Edit Vehicle](#4-add--edit-vehicle)
5. [Bidding & Buy Now](#5-bidding--buy-now)
6. [User Profile & Account](#6-user-profile--account)
7. [External Integrations](#7-external-integrations)
8. [File / Photo Uploads](#8-file--photo-uploads)
9. [Data Schemas](#9-data-schemas)
10. [Error Envelope](#10-error-envelope)
11. [Frontend → Backend Migration Checklist](#11-frontend--backend-migration-checklist)

---

## 1. Auth & Access Codes

Firebase Auth handles credential management. The backend only needs to:

- **Verify** the Firebase ID token on every protected request.
- **Manage roles** via Firestore custom claims or a `users` collection.
- **Issue access codes** for new signups (already partially built in `index.js`).

### Firestore Collections (already in use)

| Collection      | Purpose |
|-----------------|---------|
| `access_codes`  | Invite/access codes. Fields: `status` (`active`/`used`), `redeemedBy` (uid), `redeemedAt` |
| `users`         | (Create this) User profiles and roles |

### Existing Frontend Flow (index.js)

```
User signs up → enters access code → code validated in Firestore transaction →
code marked "used" → Firebase user created → accountName/email/role written to localStorage
```

### Role Values

| Role      | Access |
|-----------|--------|
| `admin`   | Generate access codes, manage all inventory, see all users |
| `dealer`  | Add/edit their own vehicles, view all listings |
| `member`  | View listings, place bids, manage favorites |

---

### POST /api/auth/generate-code

Generate a new invite code. Admin only.

**Request Headers**
```
Authorization: Bearer <idToken>
```

**Response 200**
```json
{
  "code": "ABCD-EFGH",
  "status": "active",
  "createdAt": "2026-04-21T12:00:00Z"
}
```

> Note: `index.js` already has a `randomCode()` client-side stub. Move this server-side so codes are written atomically to Firestore.

---

## 2. Vehicle Inventory

**Current state:** All pages fetch `data/cars.json` statically.  
**Files to update after API is ready:** `car-dashboard.js:871`, `car-details.js:384`, `my-vehicles.js:683`, `my-searches.js:6`

---

### GET /api/vehicles

List vehicles with optional filters and pagination.

**Query Parameters**

| Param        | Type    | Description |
|--------------|---------|-------------|
| `status`     | string  | `Sale`, `Sold`, `Reserve is Off`, `Appending` |
| `make`       | string  | e.g. `Ford` |
| `year_min`   | integer | e.g. `1950` |
| `year_max`   | integer | e.g. `1970` |
| `price_min`  | integer | Current bid floor |
| `price_max`  | integer | Current bid ceiling |
| `condition`  | string  | e.g. `Restored`, `Excellent`, `Survivor` |
| `sort`       | string  | `ending_soon`, `price_asc`, `price_desc`, `newest` |
| `page`       | integer | 1-based, default `1` |
| `per_page`   | integer | Default `20`, max `100` |

**Response 200**
```json
{
  "data": [ /* Vehicle objects — see schema section 9 */ ],
  "meta": {
    "total": 142,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  }
}
```

---

### GET /api/vehicles/:id

Single vehicle detail by slug ID (e.g. `1967-ford-mustang-fastback`).

**Response 200**
```json
{
  "data": { /* Vehicle object — see schema section 9 */ }
}
```

**Response 404**
```json
{
  "error": {
    "code": "vehicle_not_found",
    "message": "Vehicle not found."
  }
}
```

---

### GET /api/vehicles/:id/bids

Bid history for a vehicle.

**Response 200**
```json
{
  "data": [
    {
      "id": "bid_abc123",
      "amount": 47500,
      "bidderDisplayName": "J. Dealer",
      "placedAt": "2026-04-03T14:22:10Z"
    }
  ]
}
```

---

## 3. Favorites

**Current state:** `localStorage` key `dashboardFavoritesV1` stores an array of vehicle ID strings.  
**File to update:** `components.js` — `getFavorites`, `saveFavorites`, `isFavorite`, `toggleFavorite`

---

### GET /api/users/:uid/favorites

Returns the list of vehicle IDs favorited by the user.

**Auth required:** yes (must be own uid)

**Response 200**
```json
{
  "data": [
    "1967-ford-mustang-fastback",
    "1969-jaguar-e-type"
  ]
}
```

---

### PUT /api/users/:uid/favorites/:vehicleId

Add a vehicle to favorites (idempotent).

**Auth required:** yes (must be own uid)

**Response 200**
```json
{
  "data": {
    "vehicleId": "1967-ford-mustang-fastback",
    "addedAt": "2026-04-21T10:00:00Z"
  }
}
```

---

### DELETE /api/users/:uid/favorites/:vehicleId

Remove a vehicle from favorites.

**Auth required:** yes (must be own uid)

**Response 204** (No content)

---

### POST /api/users/:uid/favorites/sync

**Migration helper** — call once after first login to push existing localStorage favorites to the server.

**Request Body**
```json
{
  "vehicleIds": ["1967-ford-mustang-fastback", "1969-jaguar-e-type"]
}
```

**Response 200**
```json
{
  "synced": 2
}
```

---

## 4. Add / Edit Vehicle

**Current state:** `car-add-vehicle.js:1901` — `submitVehicle()` calls `collectVehicleData()` and logs to console. No HTTP call made yet.  
**Wire-up point:** Replace `// TODO: Send data to server` at line 1904.

---

### POST /api/vehicles

Create a new vehicle listing. Multipart form data (includes photos).

**Auth required:** yes (`dealer` or `admin` role)

**Content-Type:** `multipart/form-data`

**Form Fields** (mirrors `collectVehicleData()` output):

| Field               | Type     | Required | Notes |
|---------------------|----------|----------|-------|
| `vin`               | string   | yes      | 17 chars, validated |
| `year`              | integer  | yes      | |
| `make`              | string   | yes      | |
| `model`             | string   | yes      | |
| `engine`            | string   | no       | |
| `transmission`      | string   | no       | |
| `bodyStyle`         | string   | no       | |
| `mileage`           | string   | no       | e.g. `"50,000"` |
| `condition`         | string   | yes      | `Excellent`, `Restored`, `Survivor`, `Very Good`, `Frame-Off Restored` |
| `description`       | string   | no       | |
| `startingBid`       | integer  | yes      | |
| `reservePrice`      | integer  | no       | |
| `buyNowPrice`       | integer  | no       | |
| `seller`            | string   | yes      | Dealership name |
| `location`          | string   | yes      | City, State |
| `pickup`            | string   | no       | e.g. `"IL - Chicago"` |
| `auctionStartAt`    | ISO 8601 | yes      | |
| `auctionEndAt`      | ISO 8601 | yes      | |
| `photos[]`          | File[]   | no       | Up to 9 images |

**Response 201**
```json
{
  "data": {
    "id": "1967-ford-mustang-fastback",
    "status": "Appending"
  }
}
```

**Response 422**
```json
{
  "error": {
    "code": "validation_error",
    "message": "Validation failed.",
    "fields": {
      "vin": "VIN is required.",
      "startingBid": "Starting bid must be a positive integer."
    }
  }
}
```

---

### PATCH /api/vehicles/:id

Update an existing vehicle listing.

**Auth required:** yes (owner dealer or admin)

**Content-Type:** `application/json`  
**Body:** Any subset of vehicle fields (same names as POST above).

**Response 200**
```json
{
  "data": { /* Updated vehicle object */ }
}
```

---

### DELETE /api/vehicles/:id

Remove a vehicle listing.

**Auth required:** yes (admin only, or owner dealer if status is `Appending`)

**Response 204** (No content)

---

### POST /api/vehicles/import/csv

Bulk import vehicles from a CSV file.

**Auth required:** yes (`dealer` or `admin`)

**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field  | Type | Description |
|--------|------|-------------|
| `file` | File | CSV file. Header row required. Columns map to vehicle fields. |

**Response 200**
```json
{
  "imported": 12,
  "skipped": 2,
  "errors": [
    { "row": 4, "message": "Invalid VIN on row 4." }
  ]
}
```

> **CSV Column Mapping:** Column names should match the field names in the POST /api/vehicles schema above. VIN is the unique key — duplicate VINs are skipped.

---

## 5. Bidding & Buy Now

---

### POST /api/vehicles/:id/bids

Place a bid on a vehicle currently in `Sale` or `Reserve is Off` status.

**Auth required:** yes (any authenticated user)

**Request Body**
```json
{
  "amount": 49000
}
```

**Validation Rules:**
- `amount` must be greater than `currentBid`
- `amount` must be greater than or equal to `startingBid`
- Auction must not be expired (`auctionEndAt` in the future)
- Status must be `Sale` or `Reserve is Off`

**Response 201**
```json
{
  "data": {
    "id": "bid_def456",
    "vehicleId": "1967-ford-mustang-fastback",
    "amount": 49000,
    "newCurrentBid": 49000,
    "placedAt": "2026-04-21T15:30:00Z"
  }
}
```

**Response 409 (Conflict)**
```json
{
  "error": {
    "code": "bid_too_low",
    "message": "Bid must exceed the current bid of $47,500."
  }
}
```

---

### POST /api/vehicles/:id/buy-now

Purchase at the Buy Now price. Only valid if `buyNowPrice` is set and auction is active.

**Auth required:** yes

**Request Body:** (empty)

**Response 200**
```json
{
  "data": {
    "vehicleId": "1967-ford-mustang-fastback",
    "purchasePrice": 52500,
    "newStatus": "Sold",
    "confirmedAt": "2026-04-21T15:31:00Z"
  }
}
```

---

## 6. User Profile & Account

**Current state:** `settings.js` saves `accountName` to localStorage only. Delete account is a `window.confirm` stub with no HTTP call.

---

### GET /api/users/:uid

Get user profile.

**Auth required:** yes (own uid or admin)

**Response 200**
```json
{
  "data": {
    "uid": "firebase-uid-xyz",
    "email": "john@classicmotors.com",
    "displayName": "John Dealer",
    "role": "dealer",
    "createdAt": "2026-01-15T09:00:00Z"
  }
}
```

---

### PATCH /api/users/:uid

Update profile fields.

**Auth required:** yes (own uid only)

**Request Body**
```json
{
  "displayName": "John D. Dealer"
}
```

**Response 200**
```json
{
  "data": {
    "uid": "firebase-uid-xyz",
    "displayName": "John D. Dealer"
  }
}
```

> **Frontend wire-up:** `settings.js` — replace `localStorage.setItem('accountName', ...)` with `PATCH /api/users/:uid` call, then update localStorage from the response.

---

### DELETE /api/users/:uid

Delete account and all associated data.

**Auth required:** yes (own uid or admin)

**Soft-delete recommended:** set `status: "deleted"` and anonymize PII instead of hard deletion (keeps bid history intact).

**Response 204** (No content)

> **Frontend wire-up:** `settings.js:95` — replace `// TODO: wire to backend delete` with a `DELETE /api/users/:uid` call, then call `signOut()` and redirect to `index.html`.

---

### GET /api/users/:uid/my-vehicles

Return vehicles owned/listed by the user.

**Auth required:** yes (own uid or admin)

**Response 200**
```json
{
  "data": [ /* Array of Vehicle objects */ ],
  "meta": { "total": 5 }
}
```

> **Frontend wire-up:** `my-vehicles.js:683` — replace `fetch('data/cars.json')` with this endpoint, filtered to the logged-in uid.

---

## 7. External Integrations

### 7a. Manheim API

**Current state:** `car-add-vehicle.js:75` — `connectManheim()` shows a stub modal with simulated data.

**Backend scope:**
1. OAuth 2.0 handshake with Manheim (client credentials, server-side — never expose Manheim API keys to the browser).
2. Expose a proxy endpoint the frontend calls:

#### POST /api/integrations/manheim/connect

Initiates Manheim OAuth. Returns a redirect URL.

**Response 200**
```json
{
  "redirectUrl": "https://api.manheim.com/oauth/authorize?client_id=...&redirect_uri=..."
}
```

#### GET /api/integrations/manheim/callback

OAuth callback. Exchanges code for access token, stores token server-side, returns to add-vehicle page.

#### GET /api/integrations/manheim/inventory

Returns the authenticated dealer's Manheim inventory.

**Response 200**
```json
{
  "data": [
    { "vin": "VIN123456", "year": 2019, "make": "Tesla", "model": "Model S", "manheimId": "mhm_001" }
  ]
}
```

---

### 7b. NADA Guides API

**Current state:** `car-add-vehicle.js:84` — `connectNADA()` is a stub.

**Backend scope:** Look up vehicle value by VIN or year/make/model.

#### GET /api/integrations/nada/value

**Query Parameters:** `vin` OR (`year` + `make` + `model`)

**Response 200**
```json
{
  "data": {
    "vin": "VIN123456",
    "tradeInValue": 18500,
    "retailValue": 22000,
    "cleanBookValue": 20000,
    "source": "NADA",
    "fetchedAt": "2026-04-21T12:00:00Z"
  }
}
```

> **Frontend wire-up:** On the Add Vehicle form, after VIN decode, auto-populate a "NADA Suggested Value" field by calling this endpoint.

---

## 8. File / Photo Uploads

Photos are currently static files in `cars-photos/`. The backend needs a proper upload pipeline.

#### POST /api/uploads/photos

Upload one or more vehicle photos.

**Auth required:** yes

**Content-Type:** `multipart/form-data`

| Field     | Type   | Description |
|-----------|--------|-------------|
| `photos[]`| File[] | Max 9 files, each ≤ 10MB, MIME `image/jpeg` or `image/png` |

**Response 201**
```json
{
  "data": [
    {
      "url": "https://storage.classicauction.com/vehicles/photo-abc.jpg",
      "thumbnailUrl": "https://storage.classicauction.com/vehicles/thumb-abc.jpg",
      "key": "vehicles/photo-abc.jpg"
    }
  ]
}
```

> Store in **Firebase Storage** (already configured: `classicauction.firebasestorage.app`). Return the public URL. The vehicle record stores `photo` (first image URL) and `photos` (full array of URLs).

---

## 9. Data Schemas

### Vehicle Object

```json
{
  "id": "1967-ford-mustang-fastback",
  "vin": "7R02C135472",
  "year": 1967,
  "make": "Ford",
  "model": "Mustang Fastback",
  "engine": "289 V8",
  "transmission": "4-Speed Manual",
  "bodyStyle": "Fastback Coupe",
  "mileage": "50,000",
  "condition": "Restored",
  "description": "A beautifully restored...",
  "photo": "https://storage.classicauction.com/vehicles/1967-ford-mustang-fastback.jpg",
  "photos": [
    "https://storage.classicauction.com/vehicles/1967-ford-mustang-fastback.jpg",
    "https://storage.classicauction.com/vehicles/1967-ford-mustang-fastback-02.jpg"
  ],
  "startingBid": 42000,
  "currentBid": 47500,
  "reservePrice": null,
  "buyNowPrice": 52500,
  "status": "Sale",
  "auctionStartAt": "2026-04-02T18:00:00Z",
  "auctionEndAt": "2026-04-03T18:00:00Z",
  "seller": "Classic Motors Chicago",
  "sellerUid": "firebase-uid-xyz",
  "location": "Chicago, IL",
  "pickup": "IL - Chicago"
}
```

**Status values:**

| Value            | Meaning |
|------------------|---------|
| `Sale`           | Active auction, reserve met or no reserve |
| `Reserve is Off` | Active auction, reserve not yet met |
| `Appending`      | Listing created, auction not yet started |
| `Sold`           | Auction ended with a winning bid or buy-now |

---

### Bid Object

```json
{
  "id": "bid_abc123",
  "vehicleId": "1967-ford-mustang-fastback",
  "bidderUid": "firebase-uid-abc",
  "bidderDisplayName": "J. Dealer",
  "amount": 47500,
  "placedAt": "2026-04-03T14:22:10Z"
}
```

---

### User Object

```json
{
  "uid": "firebase-uid-xyz",
  "email": "john@classicmotors.com",
  "displayName": "John Dealer",
  "role": "dealer",
  "createdAt": "2026-01-15T09:00:00Z",
  "status": "active"
}
```

---

## 10. Error Envelope

All error responses use this shape:

```json
{
  "error": {
    "code": "machine_readable_snake_case",
    "message": "Human readable message.",
    "fields": {
      "fieldName": "Validation message for this field."
    }
  }
}
```

`fields` is only present for `422 Unprocessable Entity` responses.

### Standard HTTP Status Codes

| Code | When to use |
|------|-------------|
| 200  | Success (GET, PATCH) |
| 201  | Created (POST) |
| 204  | No content (DELETE, PUT with no body) |
| 400  | Bad request (malformed JSON, missing required param) |
| 401  | Missing or invalid auth token |
| 403  | Authenticated but not authorized (wrong role) |
| 404  | Resource not found |
| 409  | Conflict (bid too low, code already used, duplicate VIN) |
| 422  | Validation error (see `fields`) |
| 500  | Internal server error |

---

## 11. Frontend → Backend Migration Checklist

Use this to track wiring tasks as each endpoint goes live.

### Auth
- [ ] Replace `randomCode()` in `index.js` with `POST /api/auth/generate-code`
- [ ] On login success, call `GET /api/users/:uid` and write real role to localStorage (replace hardcoded `"member"`)

### Vehicles
- [ ] `car-dashboard.js:871` — replace `fetch('data/cars.json')` with `GET /api/vehicles`
- [ ] `car-details.js:384` — replace `fetch('data/cars.json')` with `GET /api/vehicles/:id`
- [ ] `my-vehicles.js:683` — replace `fetch('data/cars.json')` with `GET /api/users/:uid/my-vehicles`
- [ ] `my-searches.js:6` — replace `fetch('data/cars.json')` with `GET /api/vehicles` filtered by favorited IDs (or use `GET /api/users/:uid/favorites` then fetch each)
- [ ] `my-vehicles.js` price overrides — currently localStorage; replace with `PATCH /api/vehicles/:id`

### Add Vehicle
- [ ] `car-add-vehicle.js:1904` — replace `// TODO: Send data to server` with `POST /api/vehicles` (multipart)
- [ ] `car-add-vehicle.js:75` — replace `connectManheim()` stub with OAuth redirect to `POST /api/integrations/manheim/connect`
- [ ] `car-add-vehicle.js:84` — replace `connectNADA()` stub with `GET /api/integrations/nada/value`
- [ ] `car-add-vehicle.js:98` — replace CSV stub with `POST /api/vehicles/import/csv`

### Favorites
- [ ] `components.js` — add `POST /api/users/:uid/favorites/sync` call on first login (migrate existing localStorage favorites)
- [ ] `components.js` — replace `getFavorites`/`saveFavorites` with API calls after sync endpoint is live

### User / Account
- [ ] `settings.js:65` — replace `localStorage.setItem('accountName', ...)` with `PATCH /api/users/:uid`
- [ ] `settings.js:95` — replace delete stub with `DELETE /api/users/:uid` then `signOut()` + redirect

### Bidding
- [ ] `car-details.js` — wire bid submission button to `POST /api/vehicles/:id/bids`
- [ ] `car-details.js` — wire Buy Now button to `POST /api/vehicles/:id/buy-now`
- [ ] `car-details.js` — load bid history from `GET /api/vehicles/:id/bids`

### Photos
- [ ] On Add Vehicle form submission, upload photos to `POST /api/uploads/photos` first, then include returned URLs in the vehicle payload

---

*End of spec. Questions or schema changes should be discussed before backend development begins to avoid frontend rework.*
