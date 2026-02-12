"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-900 group-[.toaster]:border-gray-200 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-gray-600",
          actionButton: "group-[.toast]:bg-gray-900 group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-600",
          success:
            "group-[.toaster]:border-green-200 group-[.toaster]:bg-green-50",
          error: "group-[.toaster]:border-red-200 group-[.toaster]:bg-red-50",
          warning:
            "group-[.toaster]:border-yellow-200 group-[.toaster]:bg-yellow-50",
          info: "group-[.toaster]:border-blue-200 group-[.toaster]:bg-blue-50",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5 text-green-600" />,
        info: <InfoIcon className="size-5 text-blue-600" />,
        warning: <TriangleAlertIcon className="size-5 text-yellow-600" />,
        error: <OctagonXIcon className="size-5 text-red-600" />,
        loading: <Loader2Icon className="size-5 text-gray-600 animate-spin" />,
      }}
      position="top-right"
      duration={3000}
      {...props}
    />
  );
};

export { Toaster };
