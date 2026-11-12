import "server-only";
import { adminDb, COL } from "@/lib/firebase/admin";
import type { CandidateDTO, CandidateMediaDTO, CandidateReviewDTO, CandidateSkillDTO } from "@/types";

const CANDIDATE_LIMIT = 60;
const QUERY_CHUNK_SIZE = 30;

export async function listVisibleCandidates(): Promise<CandidateDTO[]> {
  const db = adminDb();
  const userSnapshot = await db
    .collection(COL.users)
    .where("visibility", "==", "visible")
    .limit(CANDIDATE_LIMIT)
    .get();
  const workers = userSnapshot.docs.filter((doc) => doc.get("role") === "worker");
  if (workers.length === 0) return [];

  const skillsByUid = new Map<string, CandidateSkillDTO[]>();
  const mediaByUid = new Map<string, CandidateMediaDTO[]>();
  const reviewsByUid = new Map<string, CandidateReviewDTO[]>();
  const uids = workers.map((doc) => doc.id);

  for (let offset = 0; offset < uids.length; offset += QUERY_CHUNK_SIZE) {
    const chunk = uids.slice(offset, offset + QUERY_CHUNK_SIZE);
    const [skillsSnapshot, mediaSnapshot, reviewsSnapshot] = await Promise.all([
      db.collection(COL.skills).where("uid", "in", chunk).get(),
      db.collection(COL.media).where("uid", "in", chunk).where("moderationStatus", "==", "approved").get(),
      db.collection(COL.endorsements).where("workerUid", "in", chunk).where("status", "==", "approved").get(),
    ]);

    for (const doc of skillsSnapshot.docs) {
      const uid = doc.get("uid") as string;
      const skills = skillsByUid.get(uid) ?? [];
      skills.push({
        slug: doc.get("skillSlug") as string,
        label: doc.get("label") as string,
        status: doc.get("verificationStatus") as CandidateSkillDTO["status"],
        yearsExperience: (doc.get("yearsExperience") as number) ?? 0,
      });
      skillsByUid.set(uid, skills);
    }

    for (const doc of mediaSnapshot.docs) {
      const uid = doc.get("uid") as string;
      const media = mediaByUid.get(uid) ?? [];
      media.push({
        id: doc.id,
        type: doc.get("type") as CandidateMediaDTO["type"],
        url: doc.get("secureUrl") as string,
        thumbnailUrl: doc.get("thumbnailUrl") as string,
        caption: (doc.get("caption") as string) ?? "",
        skillSlug: doc.get("skillSlug") as string,
      });
      mediaByUid.set(uid, media);
    }

    for (const doc of reviewsSnapshot.docs) {
      const uid = doc.get("workerUid") as string;
      const reviews = reviewsByUid.get(uid) ?? [];
      reviews.push({
        voucherName: (doc.get("voucherName") as string) ?? "Community member",
        relationship: doc.get("voucherRelationship") as CandidateReviewDTO["relationship"],
        rating: doc.get("rating") as number,
        comment: (doc.get("comment") as string) ?? "",
      });
      reviewsByUid.set(uid, reviews);
    }
  }

  return workers.map((doc) => {
    const createdAt = doc.get("createdAt");
    return {
      id: doc.id,
      displayName: (doc.get("displayName") as string) ?? "Worker",
      township: (doc.get("township") as string) ?? "",
      bio: (doc.get("bio") as string) ?? "",
      ratingAvg: (doc.get("ratingAvg") as number) ?? 0,
      ratingCount: (doc.get("ratingCount") as number) ?? 0,
      endorsementCount: (doc.get("endorsementCount") as number) ?? 0,
      reviews: (reviewsByUid.get(doc.id) ?? []).slice(0, 3),
      skills: skillsByUid.get(doc.id) ?? [],
      media: mediaByUid.get(doc.id) ?? [],
      memberSince: createdAt?.toDate?.().toISOString() ?? "",
    };
  });
}