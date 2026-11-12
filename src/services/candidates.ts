import "server-only";
import { adminDb, COL } from "@/lib/firebase/admin";
import type { CandidateDTO } from "@/types";

const QUERY_BATCH_SIZE = 30;

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function loadCandidates(townshipSlug?: string, workerUids?: string[]): Promise<CandidateDTO[]> {
  const db = adminDb();
  let userDocs: FirebaseFirestore.DocumentSnapshot[];

  if (workerUids) {
    const uniqueUids = [...new Set(workerUids)];
    if (uniqueUids.length === 0) return [];
    const profiles = await Promise.all(
      chunks(uniqueUids, QUERY_BATCH_SIZE).map((uids) =>
        db.getAll(...uids.map((uid) => db.collection(COL.users).doc(uid))),
      ),
    );
    userDocs = profiles.flat().filter(
      (doc) => doc.exists && doc.get("role") === "worker" && doc.get("visibility") === "visible",
    );
  } else {
    let query = db
      .collection(COL.users)
      .where("role", "==", "worker")
      .where("visibility", "==", "visible");
    if (townshipSlug) query = query.where("townshipSlug", "==", townshipSlug);
    const profiles = await query.orderBy("ratingAvg", "desc").limit(30).get();
    userDocs = profiles.docs;
  }

  if (userDocs.length === 0) return [];
  const relatedData = await Promise.all(
    chunks(userDocs.map((doc) => doc.id), QUERY_BATCH_SIZE).map(async (uids) => {
      const [skills, media] = await Promise.all([
        db.collection(COL.skills).where("uid", "in", uids).get(),
        db.collection(COL.media).where("uid", "in", uids).where("moderationStatus", "==", "approved").get(),
      ]);
      return { skills: skills.docs, media: media.docs };
    }),
  );

  const skillsByUid = new Map<string, CandidateDTO["skills"]>();
  const mediaByUid = new Map<string, CandidateDTO["media"]>();
  relatedData.forEach(({ skills, media }) => {
    skills.forEach((doc) => {
      const skill = doc.data();
      const list = skillsByUid.get(skill.uid) ?? [];
      list.push({
        slug: skill.skillSlug,
        label: skill.label,
        status: skill.verificationStatus,
        yearsExperience: skill.yearsExperience,
      });
      skillsByUid.set(skill.uid, list);
    });

    media
      .sort((a, b) => (b.get("createdAt")?.toMillis() ?? 0) - (a.get("createdAt")?.toMillis() ?? 0))
      .forEach((doc) => {
        const item = doc.data();
        const list = mediaByUid.get(item.uid) ?? [];
        if (list.length < 6) {
          list.push({
            id: doc.id,
            type: item.type,
            url: item.secureUrl,
            thumbnailUrl: item.thumbnailUrl,
            caption: item.caption,
            skillSlug: item.skillSlug,
          });
          mediaByUid.set(item.uid, list);
        }
      });
  });

  return userDocs.map((doc) => {
    const profile = doc.data()!;
    return {
      id: doc.id,
      displayName: String(profile.displayName ?? "Worker"),
      township: String(profile.township ?? ""),
      bio: String(profile.bio ?? ""),
      ratingAvg: Number(profile.ratingAvg ?? 0),
      ratingCount: Number(profile.ratingCount ?? 0),
      endorsementCount: Number(profile.endorsementCount ?? 0),
      skills: skillsByUid.get(doc.id) ?? [],
      media: mediaByUid.get(doc.id) ?? [],
      memberSince: profile.createdAt?.toDate ? profile.createdAt.toDate().toISOString() : new Date(0).toISOString(),
    };
  });
}
