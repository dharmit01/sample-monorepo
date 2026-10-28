import { TRPCError } from "@trpc/server";
import { MESSAGES } from "@repo/constants";
import type { LoginInput, SignupInput } from "@repo/validators";
import { hashPassword, verifyPassword } from "../../lib/auth";
import { authDal } from "./auth.dal";

export class AuthService {
  async signup({ name, email, password }: SignupInput) {
    const user = await authDal.create({ name, email, passwordHash: await hashPassword(password) });
    if (!user) throw new TRPCError({ code: "CONFLICT", message: MESSAGES.auth.emailTaken });
    return user;
  }

  async login({ email, password }: LoginInput) {
    const user = await authDal.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash)))
      throw new TRPCError({ code: "UNAUTHORIZED", message: MESSAGES.auth.invalidCredentials });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}

export const authService = new AuthService();
