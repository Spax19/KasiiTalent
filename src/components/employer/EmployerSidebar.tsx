import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GroupIcon from "@mui/icons-material/Group";
import MessageIcon from "@mui/icons-material/Message";
import SettingsIcon from "@mui/icons-material/Settings";
import WorkIcon from "@mui/icons-material/Work";
import DashboardIcon from "@mui/icons-material/Dashboard";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type EmployerSection = "dashboard" | "talent" | "jobs" | "messages" | "saved" | "settings";

const navigation = [
  { label: "Dashboard", href: "/dashboard", section: "dashboard", icon: <DashboardIcon /> },
  { label: "Find Talent", href: "/dashboard?tab=find", section: "talent", icon: <GroupIcon /> },
  { label: "My Jobs", href: "/jobs", section: "jobs", icon: <WorkIcon /> },
  { label: "Messages", href: "/messages", section: "messages", icon: <MessageIcon /> },
  { label: "Saved Candidates", href: "/saved", section: "saved", icon: <FavoriteIcon /> },
  { label: "Account Settings", href: "/settings", section: "settings", icon: <SettingsIcon /> },
] as const;

export default function EmployerSidebar({ active }: { active: EmployerSection }) {
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
    <Box component="nav" aria-label="Employer dashboard navigation" sx={{ width: { xs: "100%", md: 260 }, flexShrink: 0 }}>
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
            REAL SKILLS. STRONGER COMMUNITIES.
          </Typography>
          <List sx={{ p: 0, display: "grid", gap: 0.5 }}>{links}</List>
        </Box>

        <Paper elevation={0} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 3, border: 1, borderColor: "divider" }}>
          <GroupIcon color="primary" />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>
            Hire local. Build brighter communities.
          </Typography>
          <Button component="a" href="/jobs" variant="contained" fullWidth sx={{ mt: 2 }}>
            Post a Job
          </Button>
        </Paper>
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
