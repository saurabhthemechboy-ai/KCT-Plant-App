# KCT Plant App — Full Project Context

**Last updated:** 03-Oct-2026
**Owner:** Saurab Upadhyay (saurabhthemechboy@gmail.com)
**GitHub repo:** https://github.com/saurabhthemechboy-ai/KCT-Plant-App
**Live web app:** https://kct-plant-app.web.app
**Backend API:** https://script.google.com/macros/s/AKfycby_eHVk3fAsjTiKyIk6RHDeOCJP3YCiLrBrYibw2QT_fsXUyQjIsQ9l7mOkltaYphhrOg/exec
**Firebase project:** kct-plant-app
**Google Sheet ID:** 1GsBUhLFbfWdRrk44jGl274gUp68_xDRC8TCVnt3l7pc

---

## 1. WHAT THE APP DOES

An Android app (TWA) for Kakinada Coal Terminal (KCT), a coal terminal in India. Used by shift workers and management to:

- **Work Intimation** — workers log when they start / complete maintenance work
- **Issue Reporting** — anyone reports a plant issue with photo (from camera or gallery), with annotation tools
- **History** — view past work records and reported issues
- **Today** — live dashboard of today's work and issues
- **All Issues** — full issues list with Open / In Progress / Resolved tabs (visible to all roles)
- **My Assignments** — issues assigned to the logged-in user
- **Dashboard** — 18 analytics charts (KPIs, trends, MTTR, MTBF, heatmaps, Pareto, etc.)
- **Admin Users** — manage user accounts (admin only)
- **Email notifications** — auto-email incharges and electrical team on issue reports

---

## 2. ARCHITECTURE
Android APK (TWA — Trusted Web Activity)
↓ opens
https://kct-plant-app.web.app (Firebase Hosting)
↓ serves
public/index.html (single-file front-end app)
↓ fetch() POST with text/plain body
Google Apps Script /exec Web App (Code.gs)
↓
Google Sheets (data) + Drive (photos) + Gmail (notifications)

text

**Key architectural facts:**
- Firebase hosts the front-end statically. No redirect to `/exec` (that was the OLD broken setup causing the banner).
- Apps Script serves a JSON API. `doGet` with `?action=...` and `doPost` with `{action, payload}` JSON body.
- Front-end calls `fetch(API_URL, {method:"POST", redirect:"follow", headers:{"Content-Type":"text/plain;charset=utf-8"}, body: JSON.stringify({action, payload})})`.
- **Critical:** Content-Type MUST be `text/plain;charset=utf-8` to avoid CORS preflight. Apps Script does not answer OPTIONS preflight requests.
- TWA verified via `.well-known/assetlinks.json` at Firebase.

**Why this architecture:** Originally the app was served entirely by Apps Script, but Apps Script pages show a "This application was created by a Google Apps Script user" banner that cannot be removed. Moving front-end to Firebase removes the banner. But then `google.script.run` no longer exists, so the backend had to become a REST-style JSON API called via fetch.

---

## 3. ROLES

| Role | Can do |
|---|---|
| operator | Report issues, log work start/finish on any issue, see all issues |
| technician | Same as operator |
| incharge | Everything above + assign issues (to technician/operator), delete nothing, edit nothing else, view dashboard and admin |
| admin | Everything + delete issues + manage users + assign to ANY role + view dashboard and admin |
| visitor | Read-only. Logged in via shared account. Can see all screens but cannot submit, assign, delete, or change password. |

**Assignment rule:** incharge can assign to technicians and operators only. Admin can assign to anyone.

**Work logging rule:** Anyone (any role except visitor) can log Work Start and Work Finish on any issue. Assignment is a bookkeeping marker; it does not restrict who can work the issue.

---

## 4. SHEETS

**Spreadsheet:** `1GsBUhLFbfWdRrk44jGl274gUp68_xDRC8TCVnt3l7pc`

### Tab: "Running Plant Work Log"
Columns (1-indexed):
1. Timestamp (reported to sheet)
2. Date (work date, formatted dd-MM-yyyy)
3. Status ("WORK STARTING" or "WORK COMPLETED")
4. Equipment (C1..C7, TH#1..3, SCR#1-2, RTL, TT1..6)
5. Work Type
6. Location
7. Shift In-charge
8. Responsible Person
9. Manpower (number)
10. Expected Duration
11. Start Time (HH:mm)
12. Completion Time (HH:mm)
13. Total Duration (minutes, number)
14. Safety items (comma-separated)
15. Completion Status
16. Remarks

### Tab: "App Users"
Columns:
1. userId (lowercase, unique)
2. name
3. pwd_hash (SHA-256 of salt::password)
4. salt (UUID)
5. role (operator/technician/incharge/admin/visitor)
6. active (YES/NO)
7. must_change (YES/NO)
8. last_login (timestamp)
9. notes
10. email

**Visitor account:** userId=`visitor`, password=`kct@visitor`. Seeded by `createVisitorUser()` function in Code.gs. Cannot be disabled, cannot have its password reset via UI.

### Tab: "Plant Issues Log"
**22 columns** (1-indexed):
1. reportedAt (full timestamp)
2. Date (date only)
3. Issue Type (Mechanical/Electrical/Structural/Safety/Housekeeping/Other)
4. Equipment
5. Location
6. Priority (Low/Medium/High/Critical)
7. Description
8. Reported By (name)
9. Status (Open/In Progress/Resolved)
10. Assigned To (name or blank)
11. Photo URL (CDN: https://lh3.googleusercontent.com/d/<id>)
12. Resolved Photo URL (CDN)
13. Assigned At (timestamp, format dd-MM-yyyy HH:mm)
14. Resolved At (timestamp)
15. Resolved By (name)
16. Resolution Notes
17. statusHistory (JSON array of events)
18. workStartedAt (NEW — added in Phase 4)
19. workStartedBy (NEW)
20. workFinishedAt (NEW)
21. workFinishedBy (NEW)
22. doneBy (NEW — mirrors workFinishedBy for easy list rendering)

**Status history JSON format:**
```json
[
  {"at":"dd-MM-yyyy HH:mm:ss","by":"Name","action":"Created","status":"Open"},
  {"at":"...","by":"Name","action":"Assigned","to":"Name","status":"Open"},
  {"at":"...","by":"Name","action":"Work started","status":"In Progress"},
  {"at":"...","by":"Name","action":"Work finished","status":"Resolved"},
  {"at":"...","by":"Name","action":"Status changed","from":"Open","to":"In Progress","notes":"..."}
]
Photo storage: Drive folder "Running Plant Issues" → subfolders by yyyy-MM → files named <stamp>_<equipment>_<type>.jpg or RESOLVED_<stamp>_<equipment>_<type>.jpg. Files shared as ANYONE_WITH_LINK/VIEW.

**5. THE FOUR-TIMESTAMP WORKFLOW**
The core lifecycle of an issue:

text
[1] REPORTED          anyone reports (reportedAt)
       ↓
[2] ASSIGNED          incharge/admin assigns (assignedAt) — optional step
       ↓
[3] WORK STARTED      assignee (or anyone) taps "Log Work Start" (workStartedAt)
       ↓
[4] WORK FINISHED     assignee (or anyone) taps "Log Work Finish" with photo (workFinishedAt)
       ↓
Status → Resolved
Rules:

Assignment does NOT auto-advance status. Open → Open after assignment.

Log Work Start flips Open → In Progress.

Log Work Finish flips In Progress → Resolved.

Reassignment does NOT wipe the start log (was originally wiped, but that caused bugs — we removed the wipe).

Log Work Finish allows "In Progress" issues even if workStartedAt is empty (legacy compat).

**6. APPS SCRIPT FILES (Code.gs)**
Location: Apps Script project KCT Plant App
Deployment ID: AKfycby_eHVk3fAsjTiKyIk6RHDeOCJP3YCiLrBrYibw2QT_fsXUyQjIsQ9l7mOkltaYphhrOg

Files in the Apps Script project:

Code.gs — main backend (contains everything below)

Index.html — the app HTML (must be kept in sync with GitHub's index.html)

ChartsBackend.gs — chart data functions (buildExtraChartData_)

Seed_Employees.gs — bulk user seeding (function seedAllEmployees)

appsscript.json — project manifest (timezone Asia/Kolkata, scopes)

(Setup.gs, translations.html, ChartsFrontend.html, manifest.html may or may not exist; some are dead code)

Key functions in Code.gs:

doGet(e) — If e.parameter.action present, calls routeApiAction_(action, payload) and returns JSON via ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON). Note: DO NOT call setHeaders() on ContentService output — the method doesn't exist. Apps Script auto-sets Access-Control-Allow-Origin: * for "Anyone" deployments.

doPost(e) — Parses JSON body {action, payload}, calls routeApiAction_, returns JSON. Strips BOM. Returns detailed error on parse failure.

routeApiAction_(action, payload) — Switch statement routing action names to functions. Actions:

loginUser, validateSession, logoutUser, changePassword

getFormOptions, getEquipmentList, getIssueStatuses, getIssuePriorities

submitWork, submitIssue, getMyIssues

getHistory, getToday, getAllIssues, getIssueDetail

getAssignableUsers, assignIssue, logWorkStart, logWorkFinish

updateIssueStatus (legacy, still used)

getDashboard, adminListUsers, adminResetPassword, adminSetUserActive

deleteIssue

Visitor guard: denyVisitor_(session) throws "Viewers cannot perform this action." Called in: submitWork, submitIssue, assignIssue, logWorkStart, logWorkFinish, updateIssueStatus, deleteIssue, adminResetPassword, adminSetUserActive, changePassword.

Session management: Tokens in CacheService (max 6h TTL — Apps Script limit). Key: sess_<token>, value JSON {userId, name, role, expiresAt}.

Sheet constants:

ISSUES_COL_COUNT = 22

ISSUES_COL object maps names to 1-based column indices

**7. FRONT-END FILES (index.html)**
Locations (must be kept in sync):

GitHub repo: public/index.html (or root — currently at root)

Apps Script project: Index.html

Single-file app: all HTML, CSS, JS, translations in one file. Approx 5000+ lines.

Key top-of-script constants:

js
let SESSION_TOKEN = null;
let CURRENT_USER = null;
let FIRST_SCREEN_SHOWN = false;
const ROOT_SCREENS = ["loginScreen", "homeScreen"];
const API_URL = "https://script.google.com/macros/s/AKfycby_.../exec";
Key functions:

apiCall(action, payload, onSuccess, onFail) — single chokepoint for all backend calls. Uses fetch with text/plain, handles SESSION_EXPIRED by logging out. Timeout: 90s for photo uploads (submitIssue, updateIssueStatus), 20s for everything else.

showScreen(id, fromPop) — hides all SCREENS elements, shows one, updates browser history

doLogin, doLogout, showHome, refreshTodayBadge, refreshAllIssuesBadge, refreshMyAssignmentsBadge

openWorkForm, submitWorkForm

openIssuesScreen, submitIssueForm (with duplicate warning flow)

openAllIssues, allIssuesLoad, allIssuesRender_

openIssueDetail, renderIssueDetail_ (shows 4-timestamp time metrics card + timeline)

logWorkStartPrompt, submitLogStart

openLogFinishModal, submitLogFinish

openAssignModal, submitAssign

openDashboard, renderDashboard_ and many _render... chart functions

openAdminPanel, loadAdminUsers, adminConfirmReset, adminConfirmToggle

openMyAssignments, myAssignmentsSetTab, myAssignmentsLoad, myAssignmentsRender_

Home tiles (visibility by role):

Report Issue — visible to all except visitor (visitor sees tile but click shows "Viewers cannot report issues")

My History — visible to all

Today — visible to all

My Assignments — visible to all (badge = active assigned count)

All Issues — visible to all

Work Intimation — incharge, admin, visitor (visitor click blocked)

Dashboard — incharge, admin, visitor

Admin Users — admin, visitor (visitor sees list but no action buttons)

Translations: 4 languages — en, te (Telugu), hi (Hindi), od (Odia). Object TRANSLATIONS. Function applyLanguage(lang) iterates [data-i18n], [data-i18n-html], [data-i18n-placeholder] elements. Language stored in localStorage under key kct_lang.

IMPORTANT: TRANSLATIONS object is very sensitive to syntax errors — a single missing comma or a broken string will crash the entire script block, causing "doLogin is not defined" errors and making the login button do nothing.

**8. DEPLOYMENT WORKFLOW**
Backend (Apps Script)
Edit Code.gs in Apps Script editor

Ctrl+S to save

Deploy → Manage deployments → pencil icon → Version: New version → Deploy

Do NOT create a New deployment — that changes the URL and breaks the frontend

The /exec URL stays the same

Frontend (Firebase Hosting)
Option A — GitHub push (auto CI):

Edit index.html (locally or via GitHub web editor)

Commit to main branch

GitHub Actions workflow .github/workflows/firebase-hosting-deploy.yml runs

Wait 1-2 min for green check in Actions tab

Firebase serves the new file

Option B — CLI:

text
firebase deploy --only hosting
Sync to Apps Script
After Firebase deploy succeeds, copy the same index.html content into Apps Script's Index.html file. Save. Deploy → New version.

Why sync: So /exec (opened directly without ?action=) serves the same app. Both must always be identical.

APK (TWA)
Only rebuild if changing icons, app name, manifest.json, or TWA start URL. Normal front-end and backend changes do NOT require APK rebuild — the TWA loads the live URL every time.

Build workflow: .github/workflows/build-apk.yml. Uses Gradle + com.google.androidbrowserhelper:androidbrowserhelper:2.5.0. Requires GitHub secrets: KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD.

**9. FIREBASE CONFIG**
firebase.json:

json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "!/.well-known/assetlinks.json",
      "**/node_modules/**",
      "**/*.md",
      "cors-test.html",
      "package.json",
      "package-lock.json",
      "yarn.lock",
      "*.yml",
      "*.yaml"
    ],
    "rewrites": [
      { "source": "/.well-known/**", "destination": "/.well-known/:splat" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
      },
      {
        "source": "/",
        "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
      }
    ]
  }
}
Key points:

"public": "." — serves from repo root (not a public/ subfolder)

.well-known/assetlinks.json must be served for TWA verification

** rewrite serves index.html for all SPA routes

Cache headers force Chrome to always re-fetch index.html

.firebaserc:

json
{ "projects": { "default": "kct-plant-app" } }
.well-known/assetlinks.json:

json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.kct.plantapp",
    "sha256_cert_fingerprints": ["<release keystore SHA-256>"]
  }
}]

**10. DATA OPS & CONFIG VALUES**
Equipment list: C1, C2, C3, C4, C5, C6, C7, TH#1, TH#2, TH#3, SCR#1, SCR#2, RTL, TT1, TT2, TT3, TT4, TT5, TT6

Work types: Idler Replacement, Chute Cleaning, Take-up Cleaning, Belt Inspection, Belt Cleaning, Scraper Cleaning / Adjustment, Steel Cord / Patch Cutting, Minor Hot Work, Skirt Rubber Adjustment

Issue types: Mechanical, Electrical, Structural, Safety, Housekeeping, Other

Priorities: Low, Medium, High, Critical

Expected durations: Less than 15 Minutes, 15-30 Minutes, More Than 30 Minutes

Completion statuses: Work Completed Successfully, Work Partially Completed, Work Stopped / Suspended, Further Work Required

Shift incharges (dropdown): Akshya Kumar Dash, Bidyut Kumar Kuiri, Biren Sahu, Hemanth Varma, Prashant Kumar Parida, Raj Kumar, Vamsi Krishna

Email routing:

Plant incharges group: plant-incharges@googlegroups.com (email only for Electrical issues OR Critical priority)

Electrical team (always for Electrical issues): ctelectrical@bothragroup.com, manikandan.nachimuthu@bothragroup.com

Admin alert on email failure: saurabh.upadhyay@bothragroup.com

**11. KNOWN QUIRKS & GOTCHAS**
Session tokens last ~6 hours — Apps Script CacheService TTL limit. After that users must log in again.

ContentService.createTextOutput().setHeaders() does not exist. Only HtmlOutput has setHeaders. For JSON CORS, rely on Apps Script's auto header (works for "Anyone" deployments).

Do not add doOptions — Apps Script web apps never invoke it. The only fix for CORS preflight is to avoid triggering preflight by using Content-Type: text/plain on the client.

deleteIssue uses fire-and-forget pattern — the frontend doesn't wait for a response because Apps Script sometimes reports errors even when the row was successfully deleted.

Work matching uses buildCompletionPairs_ — pairs a "WORK STARTING" row with the next matching "WORK COMPLETED" row (same equipment, work type, location). 00:00 start times can break matching.

Translations object is fragile. Any missing comma or malformed string in TRANSLATIONS breaks the ENTIRE app with "X is not defined" errors. Always validate after edits.

GitHub Actions cache: if a Firebase deploy fails with "Directory 'public' does not exist", the firebase.json still has "public": "public" but no such folder exists. Fix: change to "public": ".".

TWA verification requires exact fingerprint match — the SHA-256 in assetlinks.json must match the release keystore that signed the actual APK. Not the debug keystore.

The GitHub Actions secret FIREBASE_SERVICE_ACCOUNT must be the full JSON content of a Firebase service account with at least "Firebase Hosting Admin" role in Google Cloud IAM.

Work Start wipe on reassign was REMOVED — originally reassignment wiped workStartedAt/workStartedBy, causing "Work must be started before it can be finished" errors on In Progress issues. Now reassignment preserves the start log.

Legacy compatibility: logWorkFinish allows finishing an "In Progress" issue even if workStartedAt is empty (old broken rows).

**12. RECENT FIXES / FEATURES (chronological)**
Sep-Oct 2026:

Removed the Google Apps Script banner — moved front-end to Firebase Hosting. Backend became JSON API called via fetch.

Fixed CORS — POST with Content-Type: text/plain;charset=utf-8 avoids preflight. ContentService auto-sets Access-Control-Allow-Origin: *.

Fixed ContentService.setHeaders is not a function — removed all setHeaders calls on JSON responses.

Everyone sees all issues — removed scope restriction in getAllIssues, made All Issues tile visible to all roles.

Added My Assignments tile — new tile + badge + screen (Active/Resolved/All tabs).

4-timestamp work log — added workStartedAt, workStartedBy, workFinishedAt, workFinishedBy, doneBy columns to Issues sheet. Log Work Start / Log Work Finish buttons on issue detail.

Time metrics card on issue detail showing gaps between reported → assigned → started → finished.

Duplicate warning — backend findRecentOpenDuplicate_ checks for open issues on same equipment/location within 7 days. Frontend shows modal with "Cancel" and "Submit Anyway" buttons.

Fixed reassignment wipe bug — reassignment no longer wipes workStartedAt/workStartedBy. Also made logWorkFinish accept In Progress issues with no start log.

Visitor role — read-only shared account. denyVisitor_ guard on all write actions. Admin/visitor can view admin panel but visitor has no action buttons.

Multi-language support — English, Telugu, Hindi, Odia. Language picker floating button. localStorage persistence.

Fixed corrupted err_network line in en translations — a botched paste merged lang_odia string with err_network string, causing SyntaxError on entire script block. Login was broken. Fixed by replacing with err_network: "Network error: ",.

**13. WHAT'S NOT DONE / IDEAS FOR FUTURE**
Discussed but not implemented:

Real-time push notifications — Kimi AI proposed a plan using TWA push + Deno Deploy relay + VAPID keys. Requires APK rebuild for Android 13+ (POST_NOTIFICATIONS permission). Deferred.

In-app bell / notification history — deferred in favor of the My Assignments badge.

Dashboard KPIs for new timestamps — could add "assigned→started delay by shift", "actual work time", "longest idle issues".

Cleanup of unused Apps Script files — translations.html is now unused (inlined), ChartsFrontend.html and manifest.html likely unused.

Sheet cleanup — old resolved issues from before the new 4-timestamp flow have empty R/S/T/U columns.

Batch vs parallel API calls on dashboard load — currently could fire 15 calls; batching into one call would help.

Outbox for dead-zone submissions — localStorage-backed pending queue.

Deferred architectural ideas:

Sessions in a Sheet instead of CacheService for >6h sessions

Service-account Node backend on Oracle Cloud Always Free (if Apps Script quotas bite)

**14. RULES FOR ANY AI WORKING ON THIS PROJECT**
Never modify files without first seeing the current content. Ask for the file or relevant snippet before proposing edits.

Design first, then code. For any non-trivial change, agree on the design with the user before writing code.

Incremental patches. For big changes, break into "pieces" (Piece 1, Piece 2...) and test each before moving on.

Preserve backward compat. Existing rows in the sheet have the old 17-column format. New 22-column format must not break old rows.

Keep index.html in sync between GitHub and Apps Script. Both must always be identical.

After changing Code.gs, user MUST redeploy as New Version, not New Deployment (which would change the URL).

Watch for the translations object. A single syntax error there breaks the entire app. Always scan for missing commas after adding new keys.

Test on desktop Chrome first, then real device.

Don't rebuild the APK for front-end or backend changes — only for icon, app name, manifest, or TWA start URL changes.

The user is a mechanical engineer, not a full-time developer. Explain changes step by step, use bullet points, avoid jargon where possible. When giving code, give the FULL corrected function or file, not just the diff, because the user copies and pastes.

When something is broken, always ask for the exact error message from Chrome DevTools Console — don't guess.

The user does not use a credit card. Any infrastructure recommendation must be free-tier friendly (Deno Deploy, Cloudflare Workers, Oracle Cloud Always Free, Firebase free tier).

**15. KEY FILES TO REQUEST IF RESUMING SESSION**
If our chat breaks and you're continuing in a new session, ask the user to paste:

Code.gs (full file) — if we need to work on the backend

index.html (full file) — if we need to work on the frontend

firebase.json — if we need to work on hosting config

Chrome DevTools Console error — if something is broken

view-source:https://kct-plant-app.web.app/index.html output — to confirm what's deployed

The user has pasted Code.gs and index.html in previous messages of this session. They are large (5000+ lines each). Do not ask for both at once unless necessary.

**16. CONTACT / OWNER NOTES**
Owner: Saurab Upadhyay

Role: Mechanical Engineer at Kakinada Coal Terminal

GitHub username: saurabhthemechboy-ai

Firebase account: saurabhthemechboy@gmail.com

Company domain: bothragroup.com

Language skill: English + some Hindi; app supports EN/TE/HI/OD because operators speak different languages

The user is doing this project on the side to improve plant operations. Prioritize stability and clarity over clever code.

## 17. RELIABILITY WORK (Oct 2026)

### Done
- **Piece 1 — Automated daily backups.**
  - File: `Backups.gs`
  - Daily trigger at 02:00 IST → full sheet copy + CSV export to Drive
  - Folder: `KCT Plant Backups/` (in saurabhthemechboy@gmail.com's Drive)
  - Retention: 30 daily + 12 monthly
  - Health check: 03:00 IST daily, emails saurabhthemechboy@gmail.com if stale
  - Log tab: `_Backups`

- **Piece 2 — Sheet-backed sessions.**
  - File: `Sessions.gs`
  - Tab: `Sessions` (token, userId, name, role, createdAt, lastSeenAt, expiresAt, revoked)
  - Timing: 8h idle + 24h absolute
  - Feature flag: script property `USE_SHEET_SESSIONS` ("true" = sheet, "false" = CacheService fallback)
  - Old CacheService helpers renamed to `*Cache_` in Code.gs and used as fallback
  - New route: `renewSession` (not yet called by frontend)
  - Opportunistic cleanup on every 20th login
  - Rollback: run `uninstallSessions` in Apps Script editor — no redeploy needed

### Fixed in the same deploy
- `adminResetPassword` / `adminSetUserActive`: `id` was referenced before declaration → ReferenceError on every call. Now fixed. Also now revokes the target user's active sessions.
- `getHistory`: `ROLE_AVISITOR` typo → ReferenceError for incharge/admin/visitor. Now fixed with a string comparison.

### Next
- Piece 2.5 — "Remember me" trusted device tokens (30-day, per-device, revocable)
- Piece 2.6 — Admin session diagnostics card
- Piece 3 — Submission outbox (IndexedDB queue + `clientId` dedupe column)

END OF CONTEXT

text

---

## How to use this file

**Save it as `KCT_CONTEXT.md` in your GitHub repo root.**

If our chat ever breaks, start a new chat with whichever AI you're using and paste this entire document as the first message, followed by:

> "This is the context for my KCT Plant App. Please read it fully and confirm you understand before we continue. [Then describe your current issue or ask.]"

Any competent AI will pick up exactly where we are. The document has:
- The architecture
- The deployment workflow
- Every known gotcha
- The current state of the code
- The rules for how to help you (design first, incremental patches, full files not diffs)
- What to ask you for when resuming

## Also worth doing

**Add a line at the top of this file:**
```markdown
> **If you are an AI picking this up:** read section 14 (Rules) first. Then section 2 (Architecture). Then section 15 (Key Files) to know what to request. The rest is reference.
That way any AI knows where to start scanning.

Optionally, save a shorter "current state" file too — just the last few changes and any open work — so that for quick questions you don't have to paste the whole thing. Something like:

markdown
# KCT Plant App — Current State (quick ref)

- Last deploy: 03-Oct-2026, fixed err_network syntax error, login working
- Backend deployment ID: AKfycby_eHVk3fAsjTiKyIk6RHDeOCJP3YCiLrBrYibw2QT_fsXUyQjIsQ9l7mOkltaYphhrOg
- Frontend: index.html at repo root, deployed by GitHub Actions on push to main
- Currently stable, no active issues
- Pending ideas: push notifications, dashboard KPIs on new timestamps, sheet cleanup
- Full context: see KCT_CONTEXT.md

****CURRENT FIXES

1. Fixed My Assignments screen showing blank — the `<div id="myAssignmentsScreen">` 
    was nested inside `<div id="homeScreen">` (inside home-grid) instead of being a 
    top-level sibling of the other screens. Because homeScreen is `display:none` 
    on non-home screens, the child element was also invisible. Moved it out as a 
    sibling of homeScreen.
2. Fixed SESSION_EXPIRED handling in frontend apiCall — added a check in the 
    `.then(data => ...)` block that detects `{success:false, message:"SESSION_EXPIRED"}` 
    and forces a clean logout + re-login instead of leaving the current screen 
    showing an error message.
3. Added date picker to Log Work Start / Finish modals — previously only time 
    was editable, so backfilling work done yesterday but logged today would 
    record the wrong date. Both modals now have `<input type="date">` defaulting 
    to today (max=today). Backend logWorkStart / logWorkFinish now accept 
    startDate / finishDate parameters and combine them with the time. Route 
    handler in routeApiAction_ updated. New translation keys: log_start_date, 
    log_finish_date (EN/TE/HI/OD).
4. Added 2 new dashboard KPI tiles + 1 new table:
    - Unassigned Open (count of Open issues with no assignee)
    - Avg Response Time (mean of workStartedAt - assignedAt in filtered period)
    - Stale Assignments table (assigned > 24h ago, never started, sorted by 
      hours waiting; amber at 48h, red at 72h)
    - All respect existing dateRange / equipment filters
    - New translations: dashboard_kpi_unassigned, dashboard_kpi_response, 
      dashboard_stale_title

- Last deploy: 03-Oct-2026
- Backups: live (Backups.gs, daily 02:00 IST)
- Sessions: live (Sessions.gs, 8h idle / 24h cap)
- Pending ideas: remember-me device tokens, outbox, session diagnostics card

- Fixed leaderboard completion % — was always 50% because each completed job
  was counted as two rows (START + COMPLETED). Now counts distinct START rows
  and pairs them via workPairs.
- Restored missing dashboard chart blocks (mttrTrend, downtime, startVsComplete)
  that were accidentally dropped during an edit.
- Peak Activity Heatmap now uses 6 buckets of 4h aligned to shifts:
  06-10, 10-14, 14-18, 18-22, 22-02, 02-06.
- Shift Comparison now uses A/B/C shifts (06-14, 14-22, 22-06) with per-shift
  colours. Backend builds SHIFT_DEFS; frontend _renderShiftCompare_ handles
  any number of shifts generically.

- Pareto chart now supports three modes via a dropdown on the dashboard card:
  By Equipment (default), By Work Type, By Issue Type. Backend computes all
  three in buildExtraChartData_ and returns them as
  charts.pareto = { byEquipment, byWorkType, byType }. Each mode shows
  Top 10 + "Other" bucket, with cumulative-% line.

  Key insight surfaced by By Work Type: Idler Replacement accounts for ~76%
  of all Work Log rows — worth operational investigation.

  Frontend: paretoModeChanged() re-renders from
  window.__lastDashboard.charts.pareto[mode] — no API call on dropdown change.

  Note: By Work Type counts rows (start+complete = 2 rows). If we ever want
  distinct jobs, use workPairs to dedupe.
****
- Last deploy: 05-Oct-2026
- Added three-mode Pareto (Equipment / Work Type / Issue Type)
- All dashboard charts working
- Pending ideas: remember-me device tokens, submission outbox, Work Type Pareto dedupe
****
