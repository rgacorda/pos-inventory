import { redirect } from "next/navigation";

export default function EditsPage() {
  redirect("/review?section=edited");
}
