import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/trpc/server";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      {/* Session read happens at request time, so it streams in behind Suspense */}
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await (await api()).auth.me();
  if (!user) redirect("/login");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Welcome, {user.name}</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        Role: <span className="font-medium">{user.role}</span>
      </CardContent>
      <CardFooter>
        <LogoutButton />
      </CardFooter>
    </Card>
  );
}
