import type { UpdateRoleInput } from "@repo/validators";
import { userDal } from "./user.dal";

export class UserService {
  list() {
    return userDal.list();
  }

  setRole({ userId, role }: UpdateRoleInput) {
    return userDal.updateRole(userId, role);
  }
}

export const userService = new UserService();
