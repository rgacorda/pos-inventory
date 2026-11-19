import { redirect } from "next/navigation";

export default function ArchivePage() {
  redirect("/review?section=archive");
}
