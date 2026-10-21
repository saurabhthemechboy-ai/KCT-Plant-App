# KCT Plant App — Full Project Context

**Last updated:** 21-Oct-2026
**Owner:** Saurab Upadhyay (saurabhthemechboy@gmail.com)
**GitHub repo:** https://github.com/saurabhthemechboy-ai/KCT-Plant-App
**Live web app:** https://kct-plant-app.web.app
**Backend API:** https://script.google.com/macros/s/AKfycby_eHVk3fAsjTiKyIk6RHDeOCJP3YCiLrBrYibw2QT_fsXUyQjIsQ9l7mOkltaYphhrOg/exec
**Firebase project:** kct-plant-app
**Google Sheet ID:** 1GsBUhLFbfWdRrk44jGl274gUp68_xDRC8TCVnt3l7pc

---

> **If you are an AI picking this up:** read Section 15 (Rules) first. Then Section 2 (Architecture). Then Section 16 (Key Files) to know what to request. The rest is reference.

---

## 1. WHAT THE APP DOES

An Android app (TWA) for Kakinada Coal Terminal (KCT), a coal terminal in India. Used by shift workers and management to:

- **Work Intimation** — workers log when they start / complete maintenance work.
- **Issue Reporting** — anyone reports a plant issue with photo (from camera or gallery), with annotation tools.
- **History** — view past work records and reported issues.
- **Today** — live dashboard of today's work and issues.
- **All Issues** — full issues list with Open / In Progress / Resolved tabs (visible to all roles).
- **My Assignments** — issues assigned to the logged-in user.
- **Dashboard** — 18 analytics charts (KPIs, trends, MTTR, MTBF, heatmaps, Pareto, etc.).
- **Admin Users** — manage user accounts (admin only).
- **Export Data** — download Issues or Work Log as CSV (incharge/admin only).
- **Real-time Notifications** — push alerts for new issues via FCM.
- **Email notifications** — auto-email incharges and electrical team on issue reports.

---

## 2. ARCHITECTURE

```text
Android APK (TWA — Trusted Web Activity)
↓ opens
https://kct-plant-app.web.app (Firebase Hosting)
↓ serves
public/index.html (single-file front-end app)
↓ fetch() POST with text/plain body
Google Apps Script /exec Web App (Code.gs)
↓
Google Sheets (data) + Drive (photos) + Gmail (notifications) + FCM (push)

Key architectural facts:

Firebase hosts the front-end statically. No redirect to /exec (that was the OLD broken setup causing the banner).

Apps Script serves a JSON API. doGet with ?action=... and doPost with {action, payload} JSON body.

Front-end calls fetch(API_URL, {method:"POST", redirect:"follow", headers:{"Content-Type":"text/plain;charset=utf-8"}, body: JSON.stringify({action, payload})}).

Critical: Content-Type MUST be text/plain;charset=utf-8 to avoid CORS preflight. Apps Script does not answer OPTIONS preflight requests.

TWA verified via .well-known/assetlinks.json at Firebase.

Why this architecture: Originally the app was served entirely by Apps Script, but Apps Script pages show a "This application was created by a Google Apps Script user" banner that cannot be removed. Moving front-end to Firebase removes the banner. But then google.script.run no longer exists, so the backend had to become a REST-style JSON API called via fetch.

## 3. ROLES
Role	Can do
operator	Report issues, log work start/finish on any issue, see all issues
technician	Same as operator
incharge	Everything above + assign issues (to technician/operator), export data, view dashboard and admin
admin	Everything + delete issues + manage users + assign to ANY role + view dashboard, export, and admin
visitor	Read-only. Logged in via shared account. Can see all screens but cannot submit, assign, delete, export, or change password.
Assignment rule: incharge can assign to technicians and operators only. Admin can assign to anyone.
Work logging rule: Anyone (any role except visitor) can log Work Start and Work Finish on any issue. Assignment is a bookkeeping marker; it does not restrict who can work the issue.

## 4. SHEETS
Spreadsheet: 1GsBUhLFbfWdRrk44jGl274gUp68_xDRC8TCVnt3l7pc

Tab: "Running Plant Work Log"
Timestamp

Date (dd-MM-yyyy)

Status ("WORK STARTING" or "WORK COMPLETED")

Equipment (C1..C7, TH#1..3, SCR#1-2, RTL, TT1..6)

Work Type

Location

Shift In-charge

Responsible Person

Manpower (number)

Expected Duration

Start Time (HH:mm)

Completion Time (HH:mm)

Total Duration (minutes)

Safety items (comma-separated)

Completion Status

Remarks

Tab: "App Users"
userId (lowercase, unique)

name

pwd_hash (SHA-256 of salt::password)

salt (UUID)

role (operator/technician/incharge/admin/visitor)

active (YES/NO)

must_change (YES/NO)

last_login (timestamp)

notes

email

Visitor account: userId=visitor, password=kct@visitor. Seeded by createVisitorUser(). Cannot be disabled or have its password reset via UI.

Tab: "Plant Issues Log"
22 columns:

reportedAt (full timestamp)

Date (date only)

Issue Type (Mechanical/Electrical/Structural/Safety/Housekeeping/Other)

Equipment

Location

Priority (Low/Medium/High/Critical)

Description

Reported By (name)

Status (Open/In Progress/Resolved)

Assigned To (name or blank)

Photo URL (CDN)

Resolved Photo URL (CDN)

Assigned At (timestamp)

Resolved At (timestamp)

Resolved By (name)

Resolution Notes

statusHistory (JSON array of events)

workStartedAt

workStartedBy

workFinishedAt

workFinishedBy

doneBy (mirrors workFinishedBy for easy list rendering)

Status history JSON format:

json
[
  {"at":"dd-MM-yyyy HH:mm:ss","by":"Name","action":"Created","status":"Open"},
  {"at":"...","by":"Name","action":"Assigned","to":"Name","status":"Open"},
  {"at":"...","by":"Name","action":"Work started","status":"In Progress"},
  {"at":"...","by":"Name","action":"Work finished","status":"Resolved"},
  {"at":"...","by":"Name","action":"Status changed","from":"Open","to":"In Progress","notes":"..."}
]
Photo storage: Drive folder "Running Plant Issues" → subfolders by yyyy-MM → files named <stamp>_<equipment>_<type>.jpg. Files shared as ANYONE_WITH_LINK/VIEW.

Tab: "Sessions" (added Oct 2026)
Stores session tokens persistently (replaces CacheService).

token

userId

name

role

createdAt

lastSeenAt

expiresAt

revoked

Tab: "FCM Tokens" (added Oct 2026)
Stores device push notification tokens.

Token

User

Registered At

Last Seen

Tab: "_Backups" (added Oct 2026)
Log of automated backup runs.

## 5. THE FOUR-TIMESTAMP WORKFLOW
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

Reassignment does NOT wipe the start log.

Log Work Finish allows "In Progress" issues even if workStartedAt is empty (legacy compat).

## 6. APPS SCRIPT FILES (Code.gs)
Location: Apps Script project KCT Plant App
Deployment ID: AKfycby_eHVk3fAsjTiKyIk6RHDeOCJP3YCiLrBrYibw2QT_fsXUyQjIsQ9l7mOkltaYphhrOg

Files in the project:

Code.gs — main backend.

Index.html — the app HTML (must be kept in sync with GitHub's index.html).

ChartsBackend.gs — chart data functions.

Sessions.gs — sheet-backed sessions.

Backups.gs — daily backup logic.

Seed_Employees.gs — bulk user seeding.

appsscript.json — project manifest (timezone Asia/Kolkata, scopes).

Key functions in Code.gs:

doGet(e) / doPost(e) — API entry points.

routeApiAction_(action, payload) — switch statement routing actions.

requireSession_(token), denyVisitor_(session) — auth guards.

getFcmAccessToken_(), sendIssueFcm_(), subscribeFcm() — push notification pipeline.

getFieldSuggestions() — autocomplete.

exportCsv(), countExportRows() — export.

loginUser, validateSession, logoutUser — auth.

Sheet constants: ISSUES_COL_COUNT = 22, ISSUES_COL object maps names to 1-based column indices.

## 7. FRONT-END FILES (index.html)
Locations (must be kept in sync):

GitHub repo: index.html (at root)

Apps Script project: Index.html

Single-file app: all HTML, CSS, JS, translations in one file (~6000+ lines).

Key globals:

javascript
let SESSION_TOKEN = null;
let CURRENT_USER = null;
let FIRST_SCREEN_SHOWN = false;
const ROOT_SCREENS = ["loginScreen", "homeScreen"];
const API_URL = "https://script.google.com/macros/s/AKfycby_.../exec";
Key functions:

apiCall(action, payload, onSuccess, onFail) — single chokepoint. Uses fetch with text/plain.

showScreen(id, fromPop) — hides all screens, shows one. Saves to sessionStorage for pull-to-refresh restore.

pageshow listener — validates session on reload, restores previous screen and tab.

Home tiles, issue forms, work intimation, dashboard rendering.

Home tiles (visibility by role):

Report Issue — all (except visitor, click blocked)

My History — all

Today — all

My Assignments — all

All Issues — all

Work Intimation — incharge, admin, visitor (click blocked)

Dashboard — incharge, admin, visitor

Admin Users — admin, visitor (list only)

Enable Notifications — all except visitor

Export Data — incharge, admin

Translations: 4 languages — en, te (Telugu), hi (Hindi), od (Odia).

## 8. DEPLOYMENT WORKFLOW
Backend (Apps Script):

Edit Code.gs.

Ctrl+S.

Deploy → Manage deployments → pencil icon → Version: New version → Deploy.

Do NOT create a New deployment — that changes the URL.

Frontend (Firebase Hosting):

Edit index.html.

Commit to main.

GitHub Actions runs.

Wait for green check.

Sync to Apps Script:
After Firebase deploy, copy the same index.html content into Apps Script's Index.html. Save. Deploy → New version.

APK (TWA):
Only rebuild for icons, app name, manifest, or start URL changes. Normal frontend/backend changes do NOT require APK rebuild.

## 9. FIREBASE CONFIG
firebase.json:

json
{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/.*", "!/.well-known/assetlinks.json", "**/node_modules/**", "**/*.md"],
    "rewrites": [
      { "source": "/.well-known/**", "destination": "/.well-known/:splat" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
      }
    ]
  }
}
"public": "." serves from repo root.

** rewrite serves index.html for all SPA routes.

Cache headers force Chrome to always re-fetch index.html.

.firebaserc:

json
{ "projects": { "default": "kct-plant-app" } }

## 10. DATA OPS & CONFIG VALUES
Equipment: C1-C7, TH#1-3, SCR#1-2, RTL, TT1-6

Work types: Idler Replacement, Chute Cleaning, Take-up Cleaning, Belt Inspection, Belt Cleaning, Scraper Cleaning / Adjustment, Steel Cord / Patch Cutting, Minor Hot Work, Skirt Rubber Adjustment

Issue types: Mechanical, Electrical, Structural, Safety, Housekeeping, Other

Priorities: Low, Medium, High, Critical

Expected durations: Less than 15 Minutes, 15-30 Minutes, More Than 30 Minutes

Completion statuses: Work Completed Successfully, Work Partially Completed, Work Stopped / Suspended, Further Work Required

Shift incharges: Akshya Kumar Dash, Bidyut Kumar Kuiri, Biren Sahu, Hemanth Varma, Prashant Kumar Parida, Raj Kumar, Vamsi Krishna

Email routing:

Plant incharges group: plant-incharges@googlegroups.com (email only for Electrical issues OR Critical priority)

Electrical team: ctelectrical@bothragroup.com, manikandan.nachimuthu@bothragroup.com

Admin alert on email failure: saurabh.upadhyay@bothragroup.com

## 11. KNOWN QUIRKS & GOTCHAS
Session tokens: Now last 8h idle / 24h absolute (sheet-backed). Previously CacheService (6h limit).

ContentService.createTextOutput().setHeaders() does not exist. Only HtmlOutput has setHeaders.

doOptions: Apps Script web apps never invoke it. Use text/plain to avoid preflight.

deleteIssue: Uses fire-and-forget pattern.

Work matching: buildCompletionPairs_ pairs a "WORK STARTING" row with the next matching "WORK COMPLETED" row (same equipment, work type, location).

Translations object is fragile. A single missing comma breaks the entire app.

GitHub Actions: if deploy fails with "Directory 'public' does not exist", fix firebase.json to "public": ".".

TWA verification: exact SHA-256 fingerprint match required in assetlinks.json.

Work Start wipe on reassign: Removed. Reassignment preserves the start log.

FCM in Service Worker: You cannot use firebase-app-compat.js inside a Service Worker because it references window. We use the raw push event in firebase-messaging-sw.js instead.

CSV vs XLSX: CSV generates plain text URLs (not clickable). XLSX was deferred to avoid binary file generation complexity in Apps Script.

## 12. RECENT FEATURES & FIXES (Chronological)
Sep 2026:

Removed Apps Script banner (moved to Firebase).

Fixed CORS (text/plain).

Everyone sees all issues.

Added My Assignments tile.

4-timestamp work log.

Duplicate warning modal.

Visitor role.

Multi-language support.

Oct 2026:

Fixed My Assignments blank screen: Moved <div id="myAssignmentsScreen"> out of homeScreen.

Fixed SESSION_EXPIRED handling: apiCall detects it and logs out cleanly.

Date pickers on Log Work Start/Finish: Backend now accepts startDate/finishDate.

Dashboard additions: Unassigned Open KPI, Avg Response Time KPI, Stale Assignments table.

Leaderboard fix: Completion % now counts distinct START rows via workPairs.

Heatmap fix: 6 buckets of 4h aligned to shifts.

Shift Comparison: Uses A/B/C shifts (06-14, 14-22, 22-06).

Three-mode Pareto: By Equipment, Work Type, Issue Type.

Automated Backups (Backups.gs): Daily 02:00 IST to Drive, 30 daily + 12 monthly retention.

Sheet-backed Sessions (Sessions.gs): 8h idle + 24h absolute. Feature flag USE_SHEET_SESSIONS.

Real-Time Push Notifications: FCM HTTP v1 + raw Push API in SW. FCM Tokens sheet.

Autocomplete Suggestions: For Work Location and Responsible Person.

Pull-to-Refresh Resilience: Session retry, sessionStorage screen/tab restore, no flash, multi-device sessions allowed.

Data Export: Admin/incharge CSV download with filters.

## 13. WHAT'S NOT DONE / IDEAS FOR FUTURE
In-app bell / notification history — deferred.

Dashboard KPIs for new timestamps — "assigned→started delay", "actual work time".

Outbox for dead-zone submissions — localStorage-backed queue.

Remember-me device tokens — 30-day trusted device tokens.

Admin session diagnostics card — view active sessions in UI.

Photo URLs clickable in export — deferred (requires XLSX generation).

SAP S/4HANA integration — deferred (requires SAP Gateway OData APIs + BTP middleware).

## 14. RELIABILITY WORK (Oct 2026)
Backups.gs: Daily trigger at 02:00 IST → full sheet copy + CSV export to Drive. Folder: KCT Plant Backups/. Retention: 30 daily + 12 monthly. Health check: 03:00 IST daily. Log tab: _Backups.

Sessions.gs: Tab: Sessions. Timing: 8h idle + 24h absolute. Feature flag: script property USE_SHEET_SESSIONS. Opportunistic cleanup on every 20th login. Rollback: run uninstallSessions.

Fixed adminResetPassword / adminSetUserActive: id was referenced before declaration. Now fixed. Also now revokes the target user's active sessions.

Fixed getHistory: ROLE_AVISITOR typo fixed.

Multi-Device Fix: createSession_ no longer revokes old sessions.

## 15. RULES FOR ANY AI WORKING ON THIS PROJECT
Never modify files without first seeing the current content.

Design first, then code.

Incremental patches. Break big changes into "pieces" (Piece 1, Piece 2...).

Preserve backward compat. Old 17-column rows must not break.

Keep index.html in sync between GitHub and Apps Script.

After changing Code.gs, user MUST redeploy as New Version, not New Deployment.

Watch for the translations object. A single syntax error breaks the app.

Test on desktop Chrome first, then real device.

Don't rebuild the APK for front-end or backend changes.

Explain step by step, use bullet points, avoid jargon.

When giving code, give the FULL corrected function or file, not just the diff.

When something is broken, always ask for the exact error message from Chrome DevTools Console.

The user does not use a credit card. Use free-tier friendly infrastructure only.

## 16. KEY FILES TO REQUEST IF RESUMING SESSION
If continuing in a new session, ask the user to paste:

Code.gs (full file) — for backend work.

index.html (full file) — for frontend work.

firebase.json — for hosting config.

Chrome DevTools Console error — if something is broken.

view-source:https://kct-plant-app.web.app/index.html — to confirm what's deployed.

Do not ask for both Code.gs and index.html at once unless necessary.

## 17. CONTACT / OWNER NOTES
Owner: Saurab Upadhyay

Role: Mechanical Engineer at Kakinada Coal Terminal

GitHub: saurabhthemechboy-ai

Firebase account: saurabhthemechboy@gmail.com

Company domain: bothragroup.com

Language skill: English + some Hindi; app supports EN/TE/HI/OD.

Note: The user is doing this project on the side to improve plant operations. Prioritize stability and clarity over clever code.

## 18. FEATURE DETAILS (Oct 2026)
Real-Time Push Notifications (FCM)
Uses raw Web Push API in the Service Worker (firebase-messaging-sw.js), NOT the Firebase Compat SDK.

The frontend (index.html) uses Firebase Compat SDK to get the device token.

Backend sends pushes using FCM HTTP v1 API.

FCM Tokens sheet stores tokens. Cleans up stale tokens on send.

"ENABLE NOTIFICATIONS" tile on home screen.

Different vibration patterns per priority.

Tapping notification opens the app.

Autocomplete Suggestions
Text input suggestions for "Exact Work Location" and "Responsible Person".

Reads past entries from Running Plant Work Log.

Scoped to the currently selected equipment.

Location suggestions ONLY from past WORK COMPLETED rows.

Responsible suggestions from all rows.

Returns up to 5 most recent entries.

Backend: getFieldSuggestions().

Pull-to-Refresh Resilience
validateSession retries once on network failure.

apiCall does NOT auto-logout on SESSION_EXPIRED for validateSession or badge refreshes.

Screen and tab state saved to sessionStorage.

pageshow restores state without flashing login screen.

Multi-device sessions allowed.

Data Export
Admin/incharge only.

Datasets: Issues / Work.

Filters: Equipment, Date Range (Today, 7d, 30d, 90d, All, Custom).

Generates CSV with UTF-8 BOM.

### 21-Oct-2026 — Work Starting / Completed blocks un-mixed

- **Bug:** During the addition of Repair Start/Finish/Delay Reason fields,
  the `STATUS_START` branch of `submitWork` was accidentally overwritten
  with `STATUS_COMPLETE` logic. Every WORK STARTING submit crashed with a
  ReferenceError on undefined variables (`completionTime`, `matchedDuration`,
  `matchedStartDateTime`). Nothing saved, no error surfaced in the frontend,
  no error appeared in Apps Script Executions (it was caught by the outer
  try/catch and returned `{success:false}` with no message).

- **Fix:** Restored the correct `STATUS_START` block. Also fixed a variable
  typo in `getWorkRecords_()` (`r` should have been `row`) that would have
  crashed the read on every submit.

- **Lesson:** When adding fields to a `submitWork`-style function with two
  branches (START vs COMPLETE), always re-verify that each branch only
  references variables defined within that branch. A crash in one branch
  silently kills the whole function because the outer catch returns a
  `{success:false}` object — and the frontend doesn't always check that
  shape before rendering success. Consider adding a `console.warn` when
  `apiCall` receives a response with `success:false` but no `message`.

Backend: countExportRows(), exportCsv().

Photo URLs exported as plain text.

END OF CONTEXT
