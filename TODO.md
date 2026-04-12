# V2V-V2I Project UI/UX Restructure & Bug Fix TODO

## Completed: 0/12

### Phase 1: Setup & Dependencies (Install/Init)
- [ ] 1. Install Tailwind/shadcn/framer-motion/leaflet/recharts/sonner deps via execute_command
- [ ] 2. Run `npx shadcn@latest init` + add core components (button/card/badge/table/sheet/toast/dialog)
- [ ] 3. Update globals.css with Tailwind directives + preserve custom anims/vars

### Phase 2: Global Structure
- [ ] 4. Refactor app/layout.tsx: Add shadcn providers (ThemeProvider), cn util, sidebar/nav
- [ ] 5. Create app/components/ui/* from shadcn; utils.ts (cn func)

### Phase 3: Core UI Components
- [ ] 6. Refactor LiveBlocks.tsx to shadcn (PageShell=Card w/header, ChipRow=grid badges)
- [ ] 7. Create MapViewer.tsx (Leaflet: positions, V2V circles/lines, zoom to units)
- [ ] 8. Create GPSDashboard.tsx (Recharts gauges: accuracy/confidence/speed; framer-motion anims)

### Phase 4: Page Restructures
- [ ] 9. Home page.tsx → Interactive dashboard (map overview + live stats grid)
- [ ] 10. Login/control/admin/user-portal: Shadcn forms/tables/buttons + toasts/motion
- [ ] 11. RoleNodePage.tsx: Integrate MapViewer + GPSDashboard; role-specific HUDs/gauges

### Phase 5: Polish & Test
- [ ] 12. Add framer-motion transitions, Sonner toasts, PWA icons; full responsive test + `npm run dev`
- [ ] 13. attempt_completion with `npm run dev` demo

**Next:** Execute step 1 after confirmation.

