"use client";

import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";

export function SessionWatch() {
  useEffect(() => {
    if (!apiClient.getAccessToken()) return;

    const check = () => {
      apiClient.checkSession().catch(() => undefined);
    };
    check();
    const intervalId = window.setInterval(check, 15000);
    return () => window.clearInterval(intervalId);
  }, []);

  return null;
}
