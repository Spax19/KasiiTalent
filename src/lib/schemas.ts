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
  terms: z.literal(true, { errorMap: () => ({ message: "Terms must be accepted" }) }),
  age18Plus: z.literal(true, { errorMap: () => ({ message: "You must be 18 or older" }) }),
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

export const createJobPostingSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
  skills: z.string().trim().max(300).default(""),
  paymentType: z.enum(["fixed", "hourly", "daily"]),
  payAmountZar: z.coerce.number().positive().max(1_000_000),
  township: z.string().trim().min(2).max(60),
  radiusKm: z.coerce.number().int().min(1).max(100).default(25),
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(""))
    .default("")
    .refine((value) => {
      if (!value) return true;
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, "Enter a valid start date."),
});
export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;

export const applyToJobSchema = z.object({
  jobId: z.string().min(1).max(150),
  message: z.string().trim().max(1000).default(""),
});

export const jobStatusSchema = z.enum(["open", "filled", "closed"]);
export const applicationStatusSchema = z.enum(["accepted", "declined"]);

export const saveCandidateSchema = z.object({
  workerUid: z.string().min(1).max(128),
  saved: z.boolean(),
});

export const employerProfileSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  businessType: z.string().trim().max(80).default(""),
  township: z.string().trim().min(2).max(60),
  city: z.string().trim().max(60).default(""),
  province: z.string().trim().max(60).default(""),
});
