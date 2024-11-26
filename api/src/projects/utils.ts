import { createHash } from "crypto";

export const hashEmail = (email: string): string => {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
};
