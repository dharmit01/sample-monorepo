import { z } from "zod";

// Single source of truth for roles; the DB enum imports this too
export const ROLES = ["admin", "editor", "user"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const signupInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
export type SignupInput = z.infer<typeof signupInput>;

export const loginInput = z.object({
  email: z.email("Enter a valid email").toLowerCase(),
  password: z.string().min(1, "Password is required").max(128),
});

export const updateRoleInput = z.object({
  userId: z.uuid(),
  role: roleSchema,
});
