import Script from 'next/script';

export default function SwTestPage() {
  return (
    <div style={{ padding: '40px', fontFamily: 'monospace' }}>
      <h1>Service Worker Test Page</h1>
      
      <div id="status" style={{ 
        padding: '20px', 
        margin: '20px 0', 
        border: '2px solid #333',
        borderRadius: '8px'
      }}>
        <p>Checking service worker...</p>
      </div>

      <div id="details" style={{
        padding: '20px',
        background: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <h3>Debug Info:</h3>
        <pre id="debug"></pre>
      </div>

      <Script id="sw-test" strategy="afterInteractive">
        {`
          (function() {
            const statusEl = document.getElementById('status');
            const debugEl = document.getElementById('debug');
            
            const debug = [];
            
            debug.push('Navigator: ' + (typeof navigator !== 'undefined' ? 'Available' : 'Not available'));
            debug.push('Service Worker API: ' + ('serviceWorker' in navigator ? 'Supported ✅' : 'Not supported ❌'));
            debug.push('Location: ' + window.location.href);
            debug.push('Protocol: ' + window.location.protocol);
            
            if ('serviceWorker' in navigator) {
              // Check if already registered
              navigator.serviceWorker.getRegistrations().then(registrations => {
                debug.push('\\nExisting registrations: ' + registrations.length);
                registrations.forEach((reg, i) => {
                  debug.push('  [' + i + '] Scope: ' + reg.scope);
                  debug.push('      Active: ' + (reg.active ? 'Yes ✅' : 'No'));
                  debug.push('      Installing: ' + (reg.installing ? 'Yes' : 'No'));
                  debug.push('      Waiting: ' + (reg.waiting ? 'Yes' : 'No'));
                });
                
                debugEl.textContent = debug.join('\\n');
                
                if (registrations.length > 0) {
                  statusEl.innerHTML = '<p style="color: green; font-weight: bold;">✅ Service Worker is registered!</p>';
                } else {
                  statusEl.innerHTML = '<p style="color: orange; font-weight: bold;">⚠️ No service worker registered yet. Attempting registration...</p>';
                  
                  // Try to register
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(registration => {
                      debug.push('\\n✅ Manual registration successful!');
                      debug.push('   Scope: ' + registration.scope);
                      debugEl.textContent = debug.join('\\n');
                      statusEl.innerHTML = '<p style="color: green; font-weight: bold;">✅ Service Worker registered successfully!</p>';
                    })
                    .catch(error => {
                      debug.push('\\n❌ Registration failed: ' + error.message);
                      debugEl.textContent = debug.join('\\n');
                      statusEl.innerHTML = '<p style="color: red; font-weight: bold;">❌ Service Worker registration failed!</p><pre>' + error.message + '</pre>';
                    });
                }
              });
              
              // Check if sw.js is accessible
              fetch('/sw.js')
                .then(response => {
                  debug.push('\\n/sw.js fetch: ' + response.status + ' ' + response.statusText);
                  if (response.ok) {
                    debug.push('  ✅ sw.js file is accessible');
                  } else {
                    debug.push('  ❌ sw.js file returned error');
                  }
                  debugEl.textContent = debug.join('\\n');
                })
                .catch(error => {
                  debug.push('\\n❌ /sw.js fetch failed: ' + error.message);
                  debugEl.textContent = debug.join('\\n');
                });
            } else {
              statusEl.innerHTML = '<p style="color: red; font-weight: bold;">❌ Service Workers not supported in this browser</p>';
              debugEl.textContent = debug.join('\\n');
            }
          })();
        `}
      </Script>
    </div>
  );
}
