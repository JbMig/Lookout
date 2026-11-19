import { redirect } from "next/navigation";

/** L'accueil ouvre le pipeline des agents. */
export default function Home() {
  redirect("/pipeline");
}
