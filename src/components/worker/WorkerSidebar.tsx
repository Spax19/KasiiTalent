import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import DashboardIcon from "@mui/icons-material/Dashboard";
import HandymanIcon from "@mui/icons-material/Handyman";
import WorkIcon from "@mui/icons-material/Work";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import MessageIcon from "@mui/icons-material/Message";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type WorkerSection = "dashboard" | "jobs";

const navigation = [
  { label: "My Profile", href: "/worker/dashboard", section: "dashboard", icon: <DashboardIcon /> },
  { label: "Find Jobs", href: "/worker/jobs", section: "jobs", icon: <WorkIcon /> },
  { label: "My Skills", href: "/worker/dashboard#skills", section: "skills", icon: <HandymanIcon /> },
  { label: "Portfolio", href: "/worker/dashboard#portfolio", section: "portfolio", icon: <PhotoLibraryIcon /> },
  { label: "Contact Requests", href: "/worker/dashboard#requests", section: "requests", icon: <MessageIcon /> },
] as const;

export default function WorkerSidebar({ active }: { active: WorkerSection }) {
  const links = navigation.map((item) => (
    <ListItemButton
      key={item.label}
      component="a"
      href={item.href}
      selected={item.section === active}
      sx={{ borderRadius: 2, color: item.section === active ? "primary.main" : "text.secondary" }}
    >
      <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>{item.icon}</ListItemIcon>
      <ListItemText primary={item.label} />
    </ListItemButton>
  ));

  return (
    <Box component="nav" aria-label="Worker dashboard navigation" sx={{ width: { xs: "100%", md: 260 }, flexShrink: 0 }}>
      <Box
        sx={{
          width: 260,
          boxSizing: "border-box",
          bgcolor: "background.paper",
          borderRight: 1,
          borderColor: "divider",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          p: 2,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <Box>
          <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ px: 2, py: 1, textDecoration: "none", display: "block" }}>
            KasiTalent
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: "block", mb: 3 }}>
            WORKER DASHBOARD
          </Typography>
          <List sx={{ p: 0, display: "grid", gap: 0.5 }}>{links}</List>
        </Box>

        <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700}>Find work close to home</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Browse local opportunities and keep track of your applications.
            </Typography>
            <Button component="a" href="/worker/jobs" variant="contained" fullWidth sx={{ mt: 2 }}>
              Find jobs
            </Button>
          </CardContent>
        </Card>
      </Box>

      <Stack
        direction="row"
        spacing={0.5}
        sx={{ display: { xs: "flex", md: "none" }, overflowX: "auto", px: 1, py: 0.75, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}
      >
        {navigation.map((item) => (
          <Button
            key={item.label}
            component="a"
            href={item.href}
            color={item.section === active ? "primary" : "inherit"}
            variant={item.section === active ? "contained" : "text"}
            size="small"
            startIcon={item.icon}
            sx={{ whiteSpace: "nowrap" }}
          >
            {item.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}
