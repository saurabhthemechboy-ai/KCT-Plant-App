# KCT Plant App — Project Context

## What it is
Android app for Kakinada Coal Terminal.
- Work Intimation (start/complete)
- Issue Reporting with photos
- History, Today, Dashboard (18 charts)
- Admin user management

## Architecture
- **Front-end**: HTML/JS in Apps Script's `Index.html` + a copy in GitHub
- **Backend**: Google Apps Script (`Code.gs`)
- **Data**: Google Sheet (ID: 1GsBUhLFbfWdRrk44jGl274gUp68_xDRC8TCVnt3l7pc)
  - Tabs: "Running Plant Work Log", "App Users", "Plant Issues Log"
- **Photos**: Google Drive folder "Running Plant Issues"
- **APK**: Built via GitHub Actions → `.github/workflows/build-apk.yml` (TWA)
- **APK URL**: https://kct-plant-app.web.app (Firebase Hosting redirects to /exec)
- **Distribution**: GitHub Releases
  - https://github.com/saurabhthemechboy-ai/KCT-Plant-App/releases/latest

## Apps Script project files
- `Code.gs` — main backend
- `Index.html` — the app HTML (must be kept in sync with GitHub's index.html)
- `ChartsBackend.gs` — chart data functions (buildExtraChartData_)
- `ChartsFrontend.html` — chart rendering (may be unused — inlined into Index.html)
- `Seed_Employees.gs` — bulk user seeding (function: seedAllEmployees)
- `Setup.gs` — one-time setup (don't re-run)

## Login users (sample)
- Admins: saurab.upadhyay, fanish.sinha
- Incharges: akshya.dash, bidyut.kuiri, biren.sahu, keelu.hemanthvarma, prashant.parida, raj.kumar, vamsi.krishna
- Default password: kct@123

## Roles
- operator — report issues only
- technician — report issues only
- incharge — everything except admin
- admin — everything + delete issues + manage users

## Critical rules
1. **After editing Code.gs or Index.html in Apps Script:**
   Save → Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy
2. **Index.html exists in TWO places** — Apps Script AND GitHub. Keep in sync.
3. **Don't paste old work intimation code** into KCT project — it will break `doGet` and `submitWork`.
4. **firebase.json must have the redirect to /exec** — otherwise CORS breaks photos.
5. **When adding users:** edit `Seed_Employees.gs` → add to SEED_EMPLOYEES → Save → Run `seedAllEmployees`. No deploy needed.

## Known quirks
- Session tokens last ~6 hours (Apps Script CacheService limit)
- deleteIssue uses fire-and-forget (google.script.run can falsely report errors)
- Work matching: `buildCompletionPairs_` in Code.gs
- `00:00` start times break matching — should be validated

## Recent fixes (Sep 29 2026)
- Added admin-only delete issue (fire-and-forget pattern)
- Fixed missing comma in historyReload filters
- Added Work Status filter (Work tab) and Issue Status filter (Issues tab)
- Filters swap when switching tabs via historyShowTab()

## TODO (tomorrow)
- Discuss/implement push notifications
  - Options: email (current), in-app banner (recommended), FCM push, WhatsApp
