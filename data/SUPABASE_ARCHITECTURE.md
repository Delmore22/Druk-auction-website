# Collectors-Alliance: Supabase Architecture & Responsibilities

**Date:** April 30, 2026  
**Status:** Authentication & inventory migration complete. Frontend integration in progress.  
**Backend:** Supabase (no custom API layer needed)  

---

## Architecture Overview

This project uses **Supabase** as the backend, replacing the original Firebase design. Key differences:

| Aspect | Original Plan | Current (Supabase) |
|--------|---------------|-------------------|
| Auth | Firebase Auth | ✅ Supabase Auth |
| Data Store | Firestore | ✅ PostgreSQL (Supabase) |
| Authorization | Custom API middleware | ✅ RLS (Row-Level Security) policies |
| File Storage | Firebase Storage | ✅ Supabase Storage |
| Real-time | Firestore listeners | Supabase Realtime (optional) |

**Critical:** There is **no backend API layer to build**. Supabase exposes a REST API automatically for all tables. Security is enforced via **RLS policies**, not middleware.

---

## What's Complete

### ✅ 1. Authentication (Supabase Auth)
- **Location:** `index.js` (fully rewritten)
- **Flow:** Login/signup → Supabase Auth → user stored in `users` table
- **Setup needed:** In Supabase dashboard, go to **Settings → Authentication → Email** and disable "Confirm email" for immediate signup (or handle confirmation flow in frontend)
- **Access codes:** `access_codes` table tracks invitation codes. Used during signup to validate new users.

**Tables created & live:**
- `users` (id, email, display_name, role, access_code, created_at)
- `access_codes` (code, status, created_by, created_by_email, created_at, redeemed_by, redeemed_at)

### ✅ 2. Inventory Migration
- **Source:** `data/cars.json` (20 vehicles)
- **Destination:** `inventory_vehicles` table in Supabase
- **Status:** All 20 cars successfully upserted
- **Script:** `migrate-inventory-to-collectors-alliance.ps1` (uses publishable key + UTF-8 encoding fix for PowerShell)

**Table schema:**
```
inventory_vehicles (
  id text (PK),
  vin, year, make, model, engine, transmission, body_style,
  mileage, condition, description, photo,
  starting_bid, current_bid, reserve_price, buy_now_price,
  market_status ('Sale', 'Sold', etc.),
  inventory_status ('Active', 'Pending', 'Sold'),
  listing_type, time_remaining, seller, location, pickup,
  auction_start_at, auction_end_at,
  is_demo, is_archived,
  created_at, updated_at
)
```

### ✅ 3. Favorites
- **Location:** `components.js` (favorites heart button logic)
- **Table:** `user_favorites` (user_id, vehicle_id, added_at)
- **Behavior:** Sync to Supabase on toggle; load from Supabase on page load
- **RLS:** Users can only see/modify their own favorites

### ✅ 4. Photo Uploads (Already wired in `car-add-vehicle.js`)
- **Buckets:** `brainstorming-images`, `vehicle-submission-photos`
- **RLS:** Allow anon/authenticated users to upload to respective buckets

---

## What Remains

### ❌ 1. Frontend Integration (High Priority)

Update these files to **fetch from Supabase** instead of `data/cars.json`:

| File | Line | Current | Needed |
|------|------|---------|--------|
| `car-dashboard.js` | 871 | `fetch('data/cars.json')` | Supabase query to `inventory_vehicles` |
| `car-details.js` | 384 | `fetch('data/cars.json')` + find by ID | Supabase `.eq('id', vehicleId)` |
| `my-vehicles.js` | 683 | Static JSON | Supabase + filter by seller |
| `my-searches.js` | 6 | Static JSON | Supabase + apply search filters |

**Pattern to use:**
```javascript
const { data, error } = await supabase
  .from('inventory_vehicles')
  .select('*')
  .eq('inventory_status', 'Active')
  .order('created_at', { ascending: false });
```

**Supabase client loading:** Already in place via `<script>` tags or ESM imports in each file.

### ❌ 2. Bidding & Buy Now (car-details.js:~line 450)

Create a `bids` table:
```sql
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  vehicle_id text not null,
  user_id text not null,
  bid_amount numeric not null,
  placed_at timestamptz default now(),
  foreign key (vehicle_id) references inventory_vehicles(id),
  foreign key (user_id) references users(id)
);
```

**Business logic:**
- New bid must be > current_bid on vehicle
- Check reserve_price; don't show "Won" until reserve is met
- "Buy Now" button sets bid directly to `buy_now_price` (if vehicle allows it)
- Update `inventory_vehicles.current_bid` when new bid placed

**RLS policy:**
```sql
create policy bids_select on public.bids for select to anon, authenticated using (true);
create policy bids_insert on public.bids for insert to anon, authenticated with check (user_id = auth.uid());
```

### ❌ 3. Settings Page (settings.js)

**Account name save (line ~65):**
- Currently updates localStorage only
- Need: `supabase.from('users').update({ display_name: newName }).eq('id', userId)`

**Delete account (line ~95):**
- Currently stub only
- Need: 
  1. Delete from `users` table
  2. Call `supabase.auth.admin.deleteUser(userId)` **(server-only, needs API endpoint)**
  3. Or: For client-side, just call `supabase.auth.admin.deleteUser()` which requires admin access

**Note:** Deleting from Supabase Auth requires the **service role key** (server-only). Consider:
- Option A: Build a small backend endpoint for account deletion
- Option B: Mark users as `deleted=true` instead of actual deletion
- Option C: Require admin intervention for deletions

---

## Frontend ↔ Supabase Flow

### Initialization (every page)

1. Load Supabase client:
   ```javascript
   import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   ```

2. On page load, check auth state:
   ```javascript
   const { data: { session } } = await supabase.auth.getSession();
   if (session) {
     const userId = session.user.id;
     // Load user's data (favorites, etc.)
   }
   ```

### Reading Data (Public)
```javascript
// Anyone can read (RLS allows it)
const { data } = await supabase
  .from('inventory_vehicles')
  .select('*')
  .eq('inventory_status', 'Active');
```

### Writing Data (Authenticated)
```javascript
// Only logged-in users; RLS checks if they own the record
const { data, error } = await supabase
  .from('user_favorites')
  .insert({
    user_id: userId,
    vehicle_id: carId,
    added_at: new Date().toISOString()
  });
```

---

## Supabase Configuration Already Set Up

### Tables Created (with RLS)
✅ `brainstorming_entries`  
✅ `vehicle_submissions`  
✅ `inventory_vehicles`  
✅ `access_codes`  
✅ `users`  
✅ `user_favorites`  

### Storage Buckets
✅ `brainstorming-images`  
✅ `vehicle-submission-photos`  

### Keys & Endpoints
- **Project URL:** `https://chllzkgugwuerlnbltay.supabase.co`
- **Publishable key:** `sb_publishable_rpzSMoGHXVKEIRwipYmrHg_64fqgX0y` (safe for frontend)
- **Secret key:** `sb_secret_...` (server-only, not used in frontend)

---

## Important Notes for Backend Developer

1. **No custom APIs needed.** Supabase REST API replaces all `POST /api/vehicles`, `POST /api/bids`, etc. endpoints. Just configure RLS policies instead.

2. **RLS is security.** Row-level security policies (in SQL) enforce who can read/write. There's no authorization middleware layer.

3. **Frontend calls Supabase directly** with the publishable key. The publishable key is designed to be used client-side; RLS policies prevent users from accessing/modifying others' data.

4. **PowerShell/Node migrations** must use UTF-8 encoding when converting JSON to bytes for Supabase REST API calls (not UTF-16).

5. **Account deletion** (`auth.admin.deleteUser()`) requires the **service role key and admin context**, which can't be done from the client. Either:
   - Build a small Edge Function / backend endpoint that verifies the user, then deletes
   - Or, soft-delete by marking users as deleted instead

6. **Email confirmation** is disabled in Supabase Auth settings for dev/testing. Users sign up and log in immediately without email verification.

---

## Migration Checklist

**Done:**
- [x] Set up Supabase project & schema
- [x] Migrate inventory (20 vehicles)
- [x] Wire authentication (index.js)
- [x] Wire favorites (components.js)
- [x] Set up access codes table

**In Progress:**
- [ ] Update car-dashboard.js to fetch from Supabase
- [ ] Update car-details.js to fetch single vehicle
- [ ] Update my-vehicles.js for user's own vehicles
- [ ] Update my-searches.js with Supabase filters

**Remaining:**
- [ ] Create `bids` table & wire bid submission in car-details.js
- [ ] Wire settings.js account name save to Supabase
- [ ] Decide on account deletion strategy (soft-delete vs. Edge Function)
- [ ] Test end-to-end auth + favorites + bidding flow

---

## Questions for Backend Developer?

1. Should account deletion be soft-delete (mark as deleted) or hard-delete (requires Edge Function)?
2. Do you want to implement Supabase Realtime for live bid updates, or polling is fine?
3. Any custom business logic for reserve prices, bid validation, auction timers?

