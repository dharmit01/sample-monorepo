"use client";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ROUTES } from "@repo/constants";
import { loginInput, signupInput, type SignupInput } from "@repo/validators";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/client";

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const trpc = useTRPC();
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const onSuccess = () => {
    router.replace(ROUTES.dashboard);
    router.refresh();
  };
  const login = useMutation(trpc.auth.login.mutationOptions({ onSuccess }));
  const signup = useMutation(trpc.auth.signup.mutationOptions({ onSuccess }));
  const mutation = mode === "login" ? login : signup;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    // Same zod schema the API validates with
    const parsed = (mode === "login" ? loginInput : signupInput).safeParse(data);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof FieldErrors] ??= issue.message;
      return setErrors(next);
    }
    setErrors({});
    if (mode === "login") login.mutate(parsed.data);
    else signup.mutate(parsed.data as SignupInput);
  }

  const isLogin = mode === "login";
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isLogin ? "Log in" : "Create an account"}</CardTitle>
        <CardDescription>
          {isLogin ? "Enter your email and password." : "Sign up with your name, email and a password."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {!isLogin && <Field name="name" label="Name" autoComplete="name" error={errors.name} />}
          <Field name="email" type="email" label="Email" autoComplete="email" error={errors.email} />
          <Field
            name="password"
            type="password"
            label="Password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            error={errors.password}
          />
          {mutation.error && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        {isLogin ? "No account?" : "Already registered?"}
        <Link
          href={isLogin ? ROUTES.signup : ROUTES.login}
          className="text-foreground underline underline-offset-4"
        >
          {isLogin ? "Sign up" : "Log in"}
        </Link>
      </CardFooter>
    </Card>
  );
}

function Field({
  label,
  error,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string; error?: string }) {
  // Unique ids: Next keeps the previous route mounted (hidden), so plain "email" would collide
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function useLogout() {
  const trpc = useTRPC();
  const router = useRouter();
  return useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: () => {
        router.replace(ROUTES.login);
        router.refresh();
      },
    }),
  );
}
