"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArchivePanel } from "@/components/review/archive-panel";
import { EditsPanel } from "@/components/review/edits-panel";
import { ProblemsPanel } from "@/components/review/problems-panel";

const SECTIONS = ["problems", "edited", "archive"] as const;
type Section = (typeof SECTIONS)[number];

function sectionFromLocation(): Section {
  if (typeof window === "undefined") return "problems";
  const requested = new URLSearchParams(window.location.search).get("section");
  return SECTIONS.includes(requested as Section)
    ? (requested as Section)
    : "problems";
}

export default function ReviewPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("problems");

  useEffect(() => {
    setSection(sectionFromLocation());
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (!user || user.role === "MANAGER" || user.role === "CASHIER") {
        router.replace(user?.role === "CASHIER" ? "/variance" : "/products");
        return;
      }
      setRole(user.role);
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!role) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isAdmin = role === "ADMIN";
  const active = !isAdmin && section !== "problems" ? "problems" : section;

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Review</h1>
        <p className="text-muted-foreground mt-1">
          Profit problems, records that were edited, and anything archived.
        </p>
      </div>

      <Tabs
        value={active}
        onValueChange={(value) => {
          const next = value as Section;
          setSection(next);
          router.replace(`/review?section=${next}`);
        }}
      >
        <TabsList>
          <TabsTrigger value="problems">Problems</TabsTrigger>
          {isAdmin ? <TabsTrigger value="edited">Edited</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="archive">Archive</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="problems" className="pt-4">
          {active === "problems" ? <ProblemsPanel /> : null}
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="edited" className="pt-4">
            {active === "edited" ? <EditsPanel /> : null}
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="archive" className="pt-4">
            {active === "archive" ? <ArchivePanel /> : null}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
