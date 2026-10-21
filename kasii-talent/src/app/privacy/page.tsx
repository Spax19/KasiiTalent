import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { POLICY_VERSION } from "../../lib/bot-messages";

export const metadata = { title: "Privacy notice · KasiTalent" };

/**
 * TEMPLATE. Fill every [BRACKETED] item and have a South African lawyer review it
 * before launch. It is written to follow POPIA's notification requirements, but it is
 * not legal advice.
 */

type Section = { title: string; paragraph?: string; items?: string[] };

const sections: Section[] = [
  {
    title: "Who we are",
    paragraph:
      "KasiTalent is operated by [LEGAL ENTITY NAME] ([REGISTRATION NUMBER]), [ADDRESS]. Our Information Officer is [NAME], reachable at [EMAIL] and [PHONE].",
  },
  {
    title: "What we collect, and why",
    items: [
      "Your cellphone number, to identify you and to message you on WhatsApp.",
      "Your name, area, skills and years of experience, to build your profile.",
      "Photos and short videos of your work that you send us, as proof of your skills.",
      "Vouches (name, relationship, rating and comment) that customers or bosses give you.",
      "Records of your consent choices, so we can show what you agreed to and when.",
    ],
  },
  {
    title: "Who sees your information",
    paragraph:
      "Employers can see your name, area, skills, ratings and approved work photos only if you agreed to profile sharing. They never see your cellphone number unless you reply 1 to a contact request. We use service providers (WhatsApp/Meta, Google Firebase, Cloudinary, Vercel) to run the service. Some of them store data outside South Africa; we only use providers that protect personal information to a comparable standard.",
  },
  {
    title: "Your rights",
    items: [
      "Send STOP on WhatsApp at any time to hide your profile and withdraw sharing consent.",
      "Send DELETE on WhatsApp to permanently erase your profile, photos, videos and number.",
      "Ask us what we hold about you, or to correct it, at [EMAIL].",
      "You may complain to the Information Regulator of South Africa if you believe your information has been mishandled.",
    ],
  },
  { title: "Who can use KasiTalent", paragraph: "You must be 18 or older." },
  {
    title: "How long we keep it",
    paragraph:
      "We keep your profile until you delete it. Conversation state is deleted automatically after 7 days. [ADD ANY RETENTION PERIOD REQUIRED BY LAW].",
  },
];

export default function PrivacyPage() {
  return (
    <Container component="main" maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h3" component="h1" fontWeight={800}>
        Privacy notice
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Version {POLICY_VERSION}
      </Typography>

      <Box sx={{ mt: 5, display: "flex", flexDirection: "column", gap: 4 }}>
        {sections.map((s) => (
          <Box component="section" key={s.title}>
            <Typography variant="h6" component="h2" fontWeight={700} gutterBottom>
              {s.title}
            </Typography>
            {s.paragraph && <Typography color="text.secondary">{s.paragraph}</Typography>}
            {s.items && (
              <Box component="ul" sx={{ m: 0, pl: 3 }}>
                {s.items.map((item) => (
                  <Typography key={item} component="li" color="text.secondary" sx={{ mt: 0.5 }}>
                    {item}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Container>
  );
}
