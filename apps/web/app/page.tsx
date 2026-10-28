import { ROUTES } from "@repo/constants";
import { redirect } from "next/navigation";

export default function Home() {
  redirect(ROUTES.dashboard);
}
