'use client';

import { WifiOff } from 'lucide-react';
import { useEffect } from 'react';

export default function OfflinePage() {
  useEffect(() => {
    // Automatically retry when connection is restored
    const handleOnline = () => {
      console.log('Connection restored, reloading page...');
      window.location.reload();
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <html lang="en">
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#f9fafb',
          textAlign: 'center',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '40px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '500px',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 24px',
              borderRadius: '50%',
              backgroundColor: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#f59e0b" 
                strokeWidth="2"
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </div>
            
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: '#111827',
            }}>
              You&apos;re Offline
            </h1>
            
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              marginBottom: '24px',
              lineHeight: '1.5',
            }}>
              This page isn&apos;t available right now. Please check your internet connection and try again.
            </p>
            
            <div style={{
              padding: '16px',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              marginBottom: '24px',
            }}>
              <p style={{
                fontSize: '14px',
                color: '#1e40af',
                margin: 0,
              }}>
                💡 <strong>Tip:</strong> Most of the POS system works offline. Go back to continue using cached pages.
              </p>
            </div>
            
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#000000',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.history.back()}
              style={{
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                width: '100%',
                marginTop: '12px',
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
