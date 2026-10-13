import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);

export const loginBodySchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const registerBodySchema = z.object({
  email,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  displayName: z.string().trim().max(80).optional(),
  inviteCode: z.string().trim().max(100).optional(),
});

export const forgotPasswordBodySchema = z.object({ email });

export const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});
