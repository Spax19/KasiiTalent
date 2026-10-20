// Path: src/types/index.ts
// Shared domain types. Server code uses Firestore Timestamps; anything sent to the
// browser uses the serialisable DTOs at the bottom (ISO strings, no phone numbers).

import type { Timestamp } from "firebase-admin/firestore";

export type Role = "worker" | "employer";
export type VerificationStatus = "pending" | "community_vouched" | "app_tested";
export type Visibility = "private" | "visible" | "paused";
export type MediaType = "image" | "video";
export type ConsentType =
  | "terms"
  | "profile_sharing"
  | "contact_sharing"
  | "marketing"
  | "age_18_plus";
export type Channel = "whatsapp" | "web";

export interface GeoPoint {
  lat: number;
  lng: number;
  geohash: string;
}

export interface UserDoc {
  role: Role;
  displayName: string;
  township: string;
  townshipSlug: string;
  city: string;
  province: string;
  location: GeoPoint | null;
  bio: string;
  languages: string[];
  ratingAvg: number;
  ratingCount: number;
  endorsementCount: number;
  verifiedSkillCount: number;
  mediaCount: number;
  visibility: Visibility;
  onboardingChannel: Channel;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActiveAt: Timestamp;
}

export interface UserPrivateDoc {
  phoneE164: string;
  phoneHash: string;
  email?: string;
}

export interface SkillDoc {
  uid: string;
  skillSlug: string;
  label: string;
  category: string;
  townshipSlug: string;
  yearsExperience: number;
  verificationStatus: VerificationStatus;
  vouchCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EndorsementDoc {
  workerUid: string;
  skillSlug?: string;
  voucherName: string;
  voucherRelationship: "customer" | "employer" | "neighbour" | "peer";
  voucherPhoneHash: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp;
}

export interface PortfolioMediaDoc {
  uid: string;
  type: MediaType;
  secureUrl: string;
  publicId: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  bytes?: number;
  durationSec?: number;
  caption: string;
  skillSlug: string;
  moderationStatus: "approved" | "pending" | "rejected";
  createdAt: Timestamp;
}

export interface JobPostingDoc {
  employerUid: string;
  title: string;
  description: string;
  skillSlugs: string[];
  paymentType: "fixed" | "hourly" | "daily";
  payAmountZar: number;
  township: string;
  townshipSlug: string;
  location: GeoPoint | null;
  radiusKm: number;
  status: "open" | "filled" | "closed" | "expired";
  startDate: Timestamp | null;
  expiresAt: Timestamp;
  applicantCount: number;
  createdAt: Timestamp;
}

/* ---------- Browser-safe DTOs (no phone numbers, no Timestamps) ---------- */

export interface CandidateSkillDTO {
  slug: string;
  label: string;
  status: VerificationStatus;
  yearsExperience: number;
}

export interface CandidateMediaDTO {
  id: string;
  type: MediaType;
  url: string;
  thumbnailUrl: string;
  caption: string;
  skillSlug: string;
}

export interface CandidateDTO {
  id: string;
  displayName: string;
  township: string;
  distanceKm?: number;
  bio: string;
  ratingAvg: number;
  ratingCount: number;
  endorsementCount: number;
  skills: CandidateSkillDTO[];
  media: CandidateMediaDTO[];
  memberSince: string; // ISO
}
