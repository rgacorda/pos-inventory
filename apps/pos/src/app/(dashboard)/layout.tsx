"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { dbHelpers } from "@/lib/db";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingTerminal, setIsCheckingTerminal] = useState(true);
  const [hasTerminal, setHasTerminal] = useState(false);

  useEffect(() => {
    const checkTerminal = async () => {
      try {
        const terminalId = await dbHelpers.getTerminalId();
        
        if (!terminalId) {
          // No terminal selected, redirect to terminal selection
          router.push("/select-terminal");
        } else {
          setHasTerminal(true);
        }
      } catch (error) {
        console.error("Error checking terminal:", error);
      } finally {
        setIsCheckingTerminal(false);
      }
    };

    checkTerminal();
  }, [pathname, router]);

  // Show loading state while checking terminal
  if (isCheckingTerminal) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Only render dashboard if terminal is selected
  if (!hasTerminal) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      {children}
    </div>
  );
}
