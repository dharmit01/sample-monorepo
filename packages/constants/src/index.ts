// Project-wide constants. Keep this file free of imports: backend tests load it directly with node.

// Single source of truth for roles; the DB enum and zod schema import this
export const ROLES = ["admin", "editor", "user"] as const;
export type Role = (typeof ROLES)[number];

export type Permission = "user:read" | "user:write" | "post:write" | "post:delete";

export const PERMISSIONS: Record<Role, Permission[]> = {
  admin: ["user:read", "user:write", "post:write", "post:delete"],
  editor: ["user:read", "post:write"],
  user: [],
};

export const SESSION_COOKIE = "session";
export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days, seconds

export const LIMITS = {
  nameMax: 100,
  passwordMin: 8,
  passwordMax: 128,
} as const;

export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  dashboard: "/dashboard",
} as const;

// All user-facing messages, shared by API responses and client-side validation
export const MESSAGES = {
  validation: {
    nameRequired: "Name is required",
    emailInvalid: "Enter a valid email",
    passwordTooShort: `Password must be at least ${LIMITS.passwordMin} characters`,
    passwordRequired: "Password is required",
  },
  auth: {
    emailTaken: "Email already registered",
    invalidCredentials: "Invalid email or password",
    unauthorized: "Please log in to continue",
    forbidden: "You don't have permission to do this",
  },
} as const;
