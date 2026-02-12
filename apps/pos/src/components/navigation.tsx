'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePendingSyncCount } from '@/hooks/useDatabase';
import { apiClient } from '@/lib/api-client';
import { useState, useEffect } from 'react';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingSyncCount();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [organizationName, setOrganizationName] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('user');
      const orgName = localStorage.getItem('organizationName');
      if (user) {
        setCurrentUser(JSON.parse(user));
      }
      if (orgName) {
        setOrganizationName(orgName);
      }
    }
  }, []);

  const handleLogout = () => {
    apiClient.logout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('organizationId');
      localStorage.removeItem('organizationName');
    }
    router.push('/login');
  };

  const navItems = [
    { href: '/', label: 'POS', icon: '🛒' },
    { href: '/orders', label: 'Orders', icon: '📋' },
    { href: '/products', label: 'Products', icon: '📦' },
  ];

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div div className="flex flex-col">
              <h1 className="text-xl font-bold text-white">🏪 AR-POS</h1>
              {organizationName && (
                <p className="text-xs text-blue-200">{organizationName}</p>
              )}
            </div
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-white">🏪 AR-POS</h1>
            <div className="flex gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    pathname === item.href
                      ? 'bg-white text-blue-700 font-medium shadow-sm'
                      : 'text-blue-100 hover:bg-blue-500 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>flex flex-col items-end text-sm text-blue-100">
                <div className="font-medium">👤 {currentUser.name || currentUser.email?.split('@')[0]}</div>
                <div className="text-xs text-blue-200">{currentUser.role}</div>
          
          <div className="flex items-center gap-3">
            {currentUser && (
              <div className="text-sm text-blue-100">
                👤 {currentUser.email?.split('@')[0]}
              </div>
            )}
            <div className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
              isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </div>
            {pendingCount > 0 && (
              <div className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm">
                {pendingCount} pending
              </div>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
