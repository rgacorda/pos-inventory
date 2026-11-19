import { redirect } from "next/navigation";

export default function ProblemsPage() {
  redirect("/review?section=problems");
}
