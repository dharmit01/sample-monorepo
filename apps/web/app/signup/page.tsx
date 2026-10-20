import { AuthForm } from "@/components/auth";

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <AuthForm mode="signup" />
    </main>
  );
}
