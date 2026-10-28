import { z } from "zod";
import { ROLES } from "@repo/constants";

export const roleSchema = z.enum(ROLES);

export const updateRoleInput = z.object({
  userId: z.uuid(),
  role: roleSchema,
});
export type UpdateRoleInput = z.infer<typeof updateRoleInput>;
