import type { UpdateRoleInput } from "@repo/validators";
import { userService } from "./user.service";

export class UserController {
  list() {
    return userService.list();
  }

  setRole(input: UpdateRoleInput) {
    return userService.setRole(input);
  }
}

export const userController = new UserController();
