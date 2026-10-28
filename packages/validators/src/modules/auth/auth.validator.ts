import { z } from "zod";
import { LIMITS, MESSAGES } from "@repo/constants";

export const signupInput = z.object({
  name: z.string().trim().min(1, MESSAGES.validation.nameRequired).max(LIMITS.nameMax),
  email: z.email(MESSAGES.validation.emailInvalid).toLowerCase(),
  password: z.string().min(LIMITS.passwordMin, MESSAGES.validation.passwordTooShort).max(LIMITS.passwordMax),
});
export type SignupInput = z.infer<typeof signupInput>;

export const loginInput = z.object({
  email: z.email(MESSAGES.validation.emailInvalid).toLowerCase(),
  password: z.string().min(1, MESSAGES.validation.passwordRequired).max(LIMITS.passwordMax),
});
export type LoginInput = z.infer<typeof loginInput>;
