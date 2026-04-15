"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Wifi, WifiOff, Terminal as TerminalIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { dbHelpers } from "@/lib/db";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  showSuccessToast,
  showErrorToast,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";

export default function SelectTerminalPage() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [availableTerminals, setAvailableTerminals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>("");
  const [manualTerminalId, setManualTerminalId] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Check if terminal is already selected
    checkExistingTerminal();

    // Fetch available terminals if online
    if (isOnline) {
      fetchTerminals();
    }
  }, []);

  const checkExistingTerminal = async () => {
    const terminalId = await dbHelpers.getTerminalId();
    if (terminalId) {
      // Terminal already selected, redirect to dashboard
      router.push("/");
    }
  };

  const fetchTerminals = async () => {
    setIsLoading(true);
    try {
      const terminals = await apiClient.getTerminals();
      if (terminals && terminals.length > 0) {
        setAvailableTerminals(terminals.filter((t: any) => t.isActive));
      }
    } catch (error) {
      console.error("Failed to fetch terminals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTerminal = async () => {
    // Prioritize manual entry if it has a value, otherwise use dropdown selection
    const terminalId = manualTerminalId.trim() || selectedTerminalId;

    if (!terminalId) {
      setError("Please select or enter a terminal ID");
      return;
    }

    try {
      await dbHelpers.setTerminalId(terminalId);
      
      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Terminal"), {
        description: `Terminal ${terminalId} selected successfully`,
      });

      // Redirect to dashboard
      router.push("/");
    } catch (error) {
      console.error("Failed to set terminal:", error);
      showErrorToast(ERROR_MESSAGES.UPDATE_FAILED("terminal"), {
        description: "Failed to set terminal. Please try again.",
      });
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl flex items-center gap-2">
                <TerminalIcon className="h-6 w-6" />
                Select Terminal
              </CardTitle>
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-orange-600" />
                )}
              </div>
            </div>
            <CardDescription>
              Choose a terminal to start using the POS system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isOnline && (
              <Alert variant="default" className="bg-orange-50 border-orange-200">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Offline Mode:</strong> You can still select a terminal manually
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading available terminals...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Dropdown selection - show when terminals are available and online */}
                {isOnline && availableTerminals.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="terminal">Select from Available Terminals</Label>
                    <Select
                      value={selectedTerminalId}
                      onValueChange={(value) => {
                        setSelectedTerminalId(value);
                        setManualTerminalId(""); // Clear manual entry when selecting from dropdown
                        setError("");
                      }}
                    >
                      <SelectTrigger id="terminal" className="w-full">
                        <SelectValue placeholder="Choose a terminal" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTerminals.map((terminal) => (
                          <SelectItem key={terminal.id} value={terminal.terminalId}>
                            {terminal.terminalId}
                            {terminal.name && ` - ${terminal.name}`}
                            {terminal.location && ` (${terminal.location})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Manual entry - always show */}
                <div className="space-y-2">
                  {isOnline && availableTerminals.length > 0 && (
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-500">Or enter manually</span>
                      </div>
                    </div>
                  )}
                  <Label htmlFor="manualTerminal">
                    {isOnline && availableTerminals.length > 0 
                      ? "Manual Terminal ID" 
                      : "Terminal ID"}
                  </Label>
                  <Input
                    id="manualTerminal"
                    placeholder="e.g., TERMINAL-001"
                    className="w-full"
                    value={manualTerminalId}
                    onChange={(e) => {
                      setManualTerminalId(e.target.value);
                      setSelectedTerminalId(""); // Clear dropdown selection when typing manually
                      setError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSelectTerminal();
                      }
                    }}
                    autoFocus={!isOnline || availableTerminals.length === 0}
                  />
                  <p className="text-xs text-gray-500">
                    Enter a unique terminal identifier for this device
                  </p>
                </div>

                {isOnline && availableTerminals.length === 0 && (
                  <p className="text-xs text-gray-500 text-center">
                    No terminals found in the system. Please enter a terminal ID manually.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2 pt-4">
              <Button
                onClick={handleSelectTerminal}
                className="w-full"
                disabled={
                  isLoading ||
                  (!selectedTerminalId && !manualTerminalId.trim())
                }
              >
                Continue
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full"
              >
                Logout
              </Button>
            </div>

            <div className="text-center text-xs text-gray-500">
              <p>This terminal selection is required to use the POS system</p>
              <p className="mt-1">Works offline after initial setup</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
