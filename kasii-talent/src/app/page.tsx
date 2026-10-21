import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const steps = [
  { n: "1", title: "Say hi on WhatsApp", body: "No app, no CV. Answer a few simple questions in your own words." },
  { n: "2", title: "Show your work", body: "Send photos or a short video of what you can do. We compress them so they use little data." },
  { n: "3", title: "Get vouched for", body: "Ask customers and bosses to vouch for you. Their word is your reference." },
  { n: "4", title: "Get hired locally", body: "Businesses near you find you, see your proof, and ask to contact you. You decide who gets your number." },
];

export default function Home() {
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER; // optional, e.g. 27821234567
  return (
    <Box component="main">
      <Container maxWidth="md" sx={{ py: { xs: 8, sm: 12 } }}>
        <Typography variant="overline" color="primary" fontWeight={700}>
          KasiiTalent
        </Typography>
        <Typography variant="h2" component="h1" fontWeight={800} sx={{ mt: 1, fontSize: { xs: "2.25rem", sm: "3rem" }, lineHeight: 1.15 }}>
          Your skills are your CV. Let your kasi businesses see them.
        </Typography>
        <Typography variant="h6" component="p" color="text.secondary" sx={{ mt: 2.5, maxWidth: 640, fontWeight: 400 }}>
          Barbers, welders, plumbers, stylists, shop assistants: build a profile on WhatsApp, show proof of your
          work, and get found by local businesses.
        </Typography>
        <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mt: 4 }}>
          {waNumber && (
            <Button variant="contained" color="success" size="large" href={`https://wa.me/${waNumber}?text=Hi`}>
              Start on WhatsApp
            </Button>
          )}
          <Button variant="contained" color="secondary" size="large" href="/signup">
            Business sign up
          </Button>
          <Button variant="outlined" color="secondary" size="large" href="/login">
            Log in
          </Button>
        </Stack>
      </Container>

      <Box sx={{ bgcolor: "background.paper", borderTop: 1, borderColor: "divider" }}>
        <Container
          maxWidth="md"
          sx={{
            py: 7,
            display: "grid",
            gap: 4,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          }}
        >
          {steps.map((s) => (
            <Box key={s.n}>
              <Avatar sx={{ bgcolor: "primary.light", color: "primary.contrastText", width: 36, height: 36, fontSize: 16, fontWeight: 700 }}>
                {s.n}
              </Avatar>
              <Typography variant="subtitle1" component="h2" fontWeight={700} sx={{ mt: 1.5 }}>
                {s.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {s.body}
              </Typography>
            </Box>
          ))}
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: 4, textAlign: "center" }}>
        <Link href="/privacy" color="text.secondary" underline="always" variant="body2">
          Privacy notice
        </Link>
      </Box>
    </Box>
  );
}
