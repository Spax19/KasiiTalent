// Path: src/lib/schemas.ts
import { z } from "zod";

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const skillInputSchema = z.object({
  label: z.string().trim().min(2).max(50),
  category: z.string().trim().min(2).max(30).default("services"),
  yearsExperience: z.coerce.number().min(0).max(60).default(0),
});

export const consentsSchema = z.object({
  terms: z.literal(true, { error: "Terms must be accepted" }),
  age18Plus: z.literal(true, { error: "You must be 18 or older" }),
  profileSharing: z.boolean(), // false => profile stays private
  policyVersion: z.string().min(1),
});

export const registerWorkerSchema = z.object({
  phone: z.string().min(9).max(20),
  displayName: z.string().trim().min(2).max(60),
  township: z.string().trim().min(2).max(60),
  city: z.string().trim().max(60).default(""),
  province: z.string().trim().max(60).default(""),
  bio: z.string().trim().max(280).default(""),
  languages: z.array(z.string().max(30)).max(6).default([]),
  lat: z.number().min(-35).max(-22).optional(), // South Africa bounding box
  lng: z.number().min(16).max(33).optional(),
  skills: z.array(skillInputSchema).min(1).max(8),
  consents: consentsSchema,
  channel: z.enum(["whatsapp", "web"]).default("web"),
  sourceMessageId: z.string().optional(),
});
export type RegisterWorkerInput = z.infer<typeof registerWorkerSchema>;

export const savePortfolioMediaSchema = z.object({
  publicId: z.string().min(5).max(200),
  secureUrl: z.string().url(),
  type: z.enum(["image", "video"]),
  skillSlug: z.string().min(2).max(60),
  caption: z.string().trim().max(140).default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().positive().max(50_000_000).optional(),
  durationSec: z.number().positive().max(120).optional(),
});
export type SavePortfolioMediaInput = z.infer<typeof savePortfolioMediaSchema>;
