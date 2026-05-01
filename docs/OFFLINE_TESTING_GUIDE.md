# Testing Offline Functionality - Quick Guide

## ⚠️ IMPORTANT: Pages Must Be Cached First

**The offline functionality requires a two-step process:**

1. **Visit pages while ONLINE** → Pages get cached by service worker
2. **Go OFFLINE** → Cached pages work without internet

## 🧪 Proper Testing Steps

### Step 1: Build and Start Production Server

```bash
cd apps/pos
npm run build
npm start
```

**Important:** Always use production build for testing offline functionality. Service workers work better in production mode.

### Step 2: Cache Pages While Online

1. **Open the app** in your browser (e.g., http://localhost:3001)
2. **Login** to the POS system
3. **Navigate to ALL critical pages** while you have internet:
   - Dashboard (/)
   - Products (/products)
   - Transactions (/transactions)
   - Terminal Selection (/select-terminal)

**Wait 2-3 seconds on each page** to ensure the OfflineCacheManager caches them.

### Step 3: Verify Service Worker is Active

1. Open **Chrome DevTools** (F12)
2. Go to **Application** tab
3. Click **Service Workers** in the left sidebar
4. You should see:
   - ✅ Status: "activated and is running"
   - ✅ Source: sw.js

5. Click **Cache Storage** in left sidebar
6. You should see caches like:
   - `pages-cache` (contains HTML pages)
   - `static-js-assets` (contains JavaScript)
   - `static-style-assets` (contains CSS)

### Step 4: Test Offline Mode

#### Method A: Chrome DevTools (Recommended)

1. Keep DevTools open from Step 3
2. Go to **Network** tab
3. Check **"Offline"** checkbox (or select "Offline" from throttling dropdown)
4. **Refresh the page (F5 or Cmd+R)**
5. ✅ **Expected:** Page loads instantly from cache
6. ✅ **Expected:** No ERR_INTERNET_DISCONNECTED or ERR_CONNECTION_REFUSED
7. Navigate between pages that you visited in Step 2
8. ✅ **Expected:** All cached pages work perfectly

#### Method B: Airplane Mode

1. Complete Steps 1-2 first
2. Enable **Airplane Mode** on your device
3. Go back to the browser
4. **Refresh the page**
5. ✅ **Expected:** Page loads from cache
6. Navigate between cached pages
7. ✅ **Expected:** Everything works

### Step 5: Test Uncached Page (Expected to Show Offline Page)

1. While still offline (from Step 4)
2. Try to navigate to a page you **didn't** visit in Step 2
3. ✅ **Expected:** You see the beautiful offline page with:
   - "You're Currently Offline" message
   - "Try Again" button
   - "Go Back" button
   - Auto-reload when connection restores

### Step 6: Test Coming Back Online

1. While on any page
2. Uncheck **"Offline"** in DevTools (or disable Airplane Mode)
3. ✅ **Expected:** Amber offline banner disappears
4. ✅ **Expected:** Sync resumes automatically
5. ✅ **Expected:** Fresh data loads

## 🎯 What Should Work Offline

After caching (Step 2), these features work offline:

✅ **All previously visited pages** load instantly  
✅ **Product browsing** (from IndexedDB)  
✅ **Create orders** (saved to IndexedDB)  
✅ **Process payments** (saved to IndexedDB)  
✅ **View transactions** (from IndexedDB)  
✅ **Page navigation** (between cached pages)  
✅ **UI interactions** (buttons, forms, etc.)  

❌ **New data from server** won't load (uses cached/local data)  
❌ **Uncached pages** show offline fallback page  
❌ **External API calls** fail (expected)  

## 🐛 Troubleshooting

### Still Getting ERR_INTERNET_DISCONNECTED?

**Possible causes:**

1. ❌ **You didn't visit the page while online first**
   - **Solution:** Go online, visit the page, wait 2-3 seconds, then test offline again

2. ❌ **Service worker not activated**
   - **Solution:** Check DevTools → Application → Service Workers → Should say "activated"
   - If not activated, do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

3. ❌ **Testing in development mode** (`npm run dev`)
   - **Solution:** Use production build (`npm run build && npm start`)

4. ❌ **Browser cache was cleared**
   - **Solution:** Revisit pages while online to recache them

5. ❌ **Using incognito/private mode** (service workers may be restricted)
   - **Solution:** Use regular browser window

### Service Worker Not Installing?

```javascript
// Run in browser console:
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Worker Registrations:', regs);
});
```

**If empty:**
- Hard refresh the page (Ctrl+Shift+R)
- Check if service worker registration failed in Console tab
- Make sure you're running production build

### Clear Everything and Start Fresh

```javascript
// Run in browser console:

// 1. Unregister all service workers
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});

// 2. Clear all caches
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});

// 3. Reload page
location.reload();
```

Then repeat Steps 1-4 above.

## 📊 Verify Cache Status

Run this in the browser console to see what's cached:

```javascript
// Check what pages are cached
caches.open('pages-cache').then(cache => {
  cache.keys().then(keys => {
    console.log('Cached pages:', keys.map(k => k.url));
  });
});

// Check all cache names
caches.keys().then(names => {
  console.log('Available caches:', names);
});
```

## 🎓 How It Works

### First Visit (Online)
```
Browser → Fetch Page → Service Worker Intercepts
                     ↓
          ┌──────────┴──────────┐
          ↓                     ↓
     Network Request      Cache Storage
          ↓                     ↓
     Get Fresh Page        Save Copy
          ↓                     
     Return to Browser
```

### Subsequent Visits (Offline)
```
Browser → Request Page → Service Worker Intercepts
                              ↓
                       Check Cache Storage
                              ↓
                    ✅ Found in Cache
                              ↓
                    Return Cached Page
                    (No network needed!)
```

### Uncached Page (Offline)
```
Browser → Request Page → Service Worker Intercepts
                              ↓
                       Check Cache Storage
                              ↓
                    ❌ Not Found in Cache
                              ↓
                     Try Network (Fails)
                              ↓
                   Return offline.html Fallback
```

## 📝 Summary

1. ✅ **Build in production:** `npm run build && npm start`
2. ✅ **Visit all pages while online** (login, products, transactions, etc.)
3. ✅ **Wait for OfflineCacheManager** to cache pages (2-3 seconds per page)
4. ✅ **Go offline** (DevTools → Network → Offline checkbox)
5. ✅ **Refresh page** → Should load instantly from cache!
6. ✅ **Navigate** → All cached pages work
7. ✅ **Uncached page** → Shows nice offline.html fallback

**Key principle:** The offline functionality is a cache-first approach. Pages must be cached while online before they can work offline. This is standard PWA behavior!
