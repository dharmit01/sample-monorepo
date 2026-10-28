import type { LoginInput, SignupInput } from "@repo/validators";
import { sessionCookie, signToken } from "../../lib/auth";
import { authService } from "./auth.service";

/** HTTP concerns: sets/clears the session cookie around the service calls. */
export class AuthController {
  async signup(input: SignupInput, resHeaders: Headers) {
    const user = await authService.signup(input);
    resHeaders.append("Set-Cookie", sessionCookie(await signToken(user.id)));
    return user;
  }

  async login(input: LoginInput, resHeaders: Headers) {
    const user = await authService.login(input);
    resHeaders.append("Set-Cookie", sessionCookie(await signToken(user.id)));
    return user;
  }

  logout(resHeaders: Headers) {
    resHeaders.append("Set-Cookie", sessionCookie("", 0));
  }
}

export const authController = new AuthController();
