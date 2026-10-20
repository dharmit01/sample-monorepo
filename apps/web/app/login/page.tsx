import { AuthForm } from "@/components/auth";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <AuthForm mode="login" />
    </main>
  );
}
