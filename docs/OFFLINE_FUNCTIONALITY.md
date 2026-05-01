# POS System - Offline Functionality

## Overview

The POS system has been enhanced with robust offline support, allowing it to work seamlessly even when the internet connection is lost. The app will now continue to function after a page refresh, even when offline.

## Key Changes Made

### 1. **PWA Configuration Enhanced** ([next.config.ts](../apps/pos/next.config.ts))
   - **Enabled PWA in all environments** (previously disabled in development)
   - **Changed caching strategies** from `NetworkFirst`/`StaleWhileRevalidate` to `CacheFirst` for static assets (JS, CSS, images, fonts)
   - **Reduced API timeout** from 10s to 3s for faster offline detection
   - **Added HTML document caching** with `StaleWhileRevalidate` strategy
   - **Added offline fallback page** configuration

### 2. **Offline Detection** 
   - Created `useOnlineStatus` hook ([use-online-status.ts](../apps/pos/src/hooks/use-online-status.ts))
   - Created `OfflineIndicator` component ([offline-indicator.tsx](../apps/pos/src/components/offline-indicator.tsx))
   - Shows amber banner at the top when offline
   - Automatically listens to browser online/offline events

### 3. **Smart Sync Management** ([providers.tsx](../apps/pos/src/components/providers.tsx))
   - **Auto-starts sync only when online** and authenticated
   - **Stops sync when offline** to prevent connection errors
   - **Auto-resumes sync** when connection is restored
   - **Improved React Query retry logic** - doesn't retry when offline

### 4. **Middleware Cache Headers** ([middleware.ts](../apps/pos/src/middleware.ts))
   - **Removed strict no-cache headers** that prevented service worker caching
   - **Allows proper PWA caching** for offline access
   - Still handles authentication redirects properly

### 5. **Offline Fallback Page** ([offline/page.tsx](../apps/pos/src/app/offline/page.tsx))
   - Minimal standalone page shown when a page isn't cached
   - **Auto-reloads when connection is restored**
   - Provides "Try Again" and "Go Back" options
   - Works without React or external dependencies

### 6. **PWA Update Notifications** ([pwa-installer.tsx](../apps/pos/src/components/pwa-installer.tsx))
   - Detects when new version is available
   - Shows toast notification with refresh option
   - Checks for updates every hour

## How It Works

### Caching Strategy

1. **Static Assets (JS, CSS, Fonts, Images)**: `CacheFirst`
   - Served from cache immediately
   - Updated in background when online

2. **HTML Pages**: `StaleWhileRevalidate`
   - Served from cache immediately (fast)
   - Updated in background when online

3. **API Calls**: `NetworkFirst` with 3s timeout
   - Tries network first
   - Falls back to cache if offline or timeout
   - 5-minute cache expiration

4. **Offline Fallback**: Custom offline page
   - Shown only when a page isn't cached

### Offline Behavior

When offline:
- ✅ All cached pages work normally (including after refresh)
- ✅ Product browsing works (from IndexedDB)
- ✅ Order creation works (stored locally in IndexedDB)
- ✅ Offline indicator shows at the top
- ✅ Sync is paused automatically
- ❌ New data from server won't load (uses cached data)

When back online:
- ✅ Offline indicator disappears
- ✅ Sync auto-resumes
- ✅ Pending orders/payments sync to server
- ✅ Fresh data loads from API

## Testing Offline Functionality

### Method 1: Browser DevTools (Recommended)

1. **Build and start the app**:
   ```bash
   cd apps/pos
   npm run build
   npm start
   ```

2. **Open Chrome DevTools** (F12)

3. **Go to Network tab**:
   - Check "Offline" checkbox in the throttling dropdown
   - OR select "Offline" from the throttling preset

4. **Test scenarios**:
   - ✅ Navigate between pages → Should work from cache
   - ✅ Refresh the page (F5) → Should load from cache (no ERR_CONNECTION_REFUSED)
   - ✅ Create orders → Should save to IndexedDB
   - ✅ Check offline indicator → Should show amber banner

5. **Go back online**:
   - Uncheck "Offline" in DevTools
   - Verify sync resumes automatically
   - Check that orders sync to server

### Method 2: Airplane Mode

1. **Build and start the app** (same as above)
2. **Load the app in browser**
3. **Enable Airplane Mode** on your device
4. **Test the same scenarios** as Method 1

### Method 3: Disconnect Network Cable / Turn Off Wi-Fi

Most realistic test for actual offline scenarios.

## Service Worker Management

### View Service Worker Status

1. Open Chrome DevTools → **Application** tab
2. Click **Service Workers** in left sidebar
3. You'll see:
   - Status (activated, waiting, etc.)
   - Source (sw.js)
   - Update on reload checkbox

### Clear Service Worker Cache

If you need to reset everything:

```javascript
// Run in browser console
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
  }
});

// Then refresh the page
location.reload();
```

### Force Update

```javascript
// Run in browser console
navigator.serviceWorker.getRegistration().then(reg => reg.update());
```

## Important Notes

### Development vs Production

- **PWA now works in both development and production**
- Service worker is active in `npm run dev` (previously disabled)
- For best testing, use production build (`npm run build && npm start`)

### First Load Requirement

- **First page visit must be online** to cache resources
- After that, app works fully offline
- Service worker installs in background on first visit

### Updating the App

When you deploy updates:
1. Service worker detects new version
2. Toast notification appears: "Update available!"
3. User clicks "Refresh" to update
4. New version activates immediately

### Cache Size Limits

Current cache limits:
- Google Fonts: 4 entries, 1 year
- Font files: 4 entries, 7 days
- Images: 64 entries, 24 hours
- JavaScript: 64 entries, 24 hours
- CSS: 32 entries, 24 hours
- API responses: 32 entries, 5 minutes
- HTML pages: 32 entries, 24 hours

## Troubleshooting

### "ERR_CONNECTION_REFUSED" still appears

1. Make sure you built with `npm run build` (not just `npm run dev`)
2. Check that service worker is registered (DevTools → Application → Service Workers)
3. Clear service worker and try again (see "Clear Service Worker Cache" above)
4. Make sure you visited the page while online first (to cache it)

### Offline indicator doesn't show

1. Check browser console for errors
2. Verify `OfflineIndicator` is rendered in layout
3. Test with DevTools "Offline" checkbox

### Updates not appearing

1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Unregister service worker manually (see above)
3. Clear browser cache and storage

### Sync not resuming when online

1. Check browser console for errors
2. Verify `Providers` component is mounting correctly
3. Check that authentication token is valid
4. Look for failed items in IndexedDB

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Browser                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Service Worker (sw.js)                 │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │  Cache Storage                               │  │ │
│  │  │  • google-fonts (CacheFirst)                 │  │ │
│  │  │  • static-font-assets (CacheFirst)           │  │ │
│  │  │  • static-image-assets (CacheFirst)          │  │ │
│  │  │  • static-js-assets (CacheFirst)             │  │ │
│  │  │  • static-style-assets (CacheFirst)          │  │ │
│  │  │  • pages-cache (StaleWhileRevalidate)        │  │ │
│  │  │  • api-cache (NetworkFirst, 3s timeout)      │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              React App                              │ │
│  │  • OfflineIndicator (shows online/offline status)  │ │
│  │  • PWAInstaller (handles updates)                  │ │
│  │  • Providers (manages sync)                        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │          IndexedDB (via Dexie)                      │ │
│  │  • Products, Categories                            │ │
│  │  • Orders, Payments (pending/synced/failed)        │ │
│  │  • Sync metadata                                   │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                      │
                      │ Auto-sync when online
                      │ (60s interval)
                      │
                      ▼
            ┌──────────────────┐
            │   Backend API    │
            │   (port 3000)    │
            └──────────────────┘
```

## Future Enhancements

Potential improvements for offline functionality:

1. **Background Sync API**: Automatically sync when connection is restored (even when app is closed)
2. **Periodic Background Sync**: Keep data fresh in background
3. **Push Notifications**: Notify when sync completes or fails
4. **Install Prompt**: Prompt users to install as PWA
5. **Offline Analytics**: Track offline usage patterns
6. **Smart Preloading**: Predict and preload pages user might visit
7. **Conflict Resolution**: Handle when same item is edited offline and online

## Related Files

- **Configuration**: [apps/pos/next.config.ts](../apps/pos/next.config.ts)
- **Manifest**: [apps/pos/public/manifest.json](../apps/pos/public/manifest.json)
- **Hooks**: [apps/pos/src/hooks/use-online-status.ts](../apps/pos/src/hooks/use-online-status.ts)
- **Components**:
  - [apps/pos/src/components/offline-indicator.tsx](../apps/pos/src/components/offline-indicator.tsx)
  - [apps/pos/src/components/pwa-installer.tsx](../apps/pos/src/components/pwa-installer.tsx)
  - [apps/pos/src/components/providers.tsx](../apps/pos/src/components/providers.tsx)
- **Pages**:
  - [apps/pos/src/app/layout.tsx](../apps/pos/src/app/layout.tsx)
  - [apps/pos/src/app/offline/page.tsx](../apps/pos/src/app/offline/page.tsx)
- **Middleware**: [apps/pos/src/middleware.ts](../apps/pos/src/middleware.ts)
- **API Client**: [apps/pos/src/lib/api-client.ts](../apps/pos/src/lib/api-client.ts)
