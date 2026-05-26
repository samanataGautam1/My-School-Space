# School Space — Admin Module: Complete Flow & Feature Guide

> Last Updated: 2026-04-11 (Session 10)
> This document reflects the **actual implemented code** — not plans.
> Session 10: Class 10 Retain button removed (graduate only), promotion UI improved with progress bar, analytics auto-advance removed from read-only endpoints.

---

## Table of Contents

1. [Access & Authentication](#1-access--authentication)
2. [Sidebar Navigation](#2-sidebar-navigation)
3. [Dashboard (Overview)](#3-dashboard-overview)
4. [Class Management](#4-class-management)
5. [Staff & Faculty](#5-staff--faculty)
6. [Student Records](#6-student-records)
7. [Teacher Performance (Reviews)](#7-teacher-performance-reviews)
8. [Examinations & Result](#8-examinations--result)
9. [Class Promotion](#9-class-promotion)
10. [Session Management](#10-session-management)
11. [Configuration (Settings)](#11-configuration-settings)
12. [Messaging System](#12-messaging-system)
13. [Notifications](#13-notifications)
14. [Complete Session Lifecycle](#14-complete-session-lifecycle)
15. [run-calculation — Term 1-3 vs Term 4](#15-run-calculation--term-1-3-vs-term-4)
16. [Graduation Rules — Single Trigger](#16-graduation-rules--single-trigger)
17. [Session State Detection](#17-session-state-detection)
18. [Assignment Session Filtering](#18-assignment-session-filtering)
19. [Retain Logic — No Duplicate Enrollment](#19-retain-logic--no-duplicate-enrollment)
20. [Prisma Null Filter Pattern](#20-prisma-null-filter-pattern)
21. [Notification Type Constants](#21-notification-type-constants)
22. [Nepal NEB Grading Rules](#22-nepal-neb-grading-rules)
23. [Cross-Dashboard Session Banner](#22-cross-dashboard-session-banner)
24. [Nepal NEB Grading Rules](#23-nepal-neb-grading-rules)
25. [Database Schema (Key Models)](#24-database-schema-key-models)
26. [API Reference (All 57 Admin Endpoints)](#25-api-reference-all-57-admin-endpoints)

---

## 1. Access & Authentication

**Login:** Username OR email + School Code + Password
**Route:** `/dashboard/admin`
**Auth Guard:** JWT token (7-day expiry) + role = `ADMIN`
**Middleware:** `authMiddleware` + `allowRoles('ADMIN')` on every route

**Admin Registration:**
- Creates school + generates unique code (e.g., SS01)
- Gmail + email OTP verification
- One admin per school (`school.adminId` unique)

**Password Reset:** Admin resets directly.
**School Code Recovery:** Code emailed directly.

---

## 2. Sidebar Navigation

```
CORE
  Dashboard         — Stats, faculty rankings, enrollment chart
  Class Management  — Classes, sections, teacher assignments
  Staff & Faculty   — Teacher list, approvals, status
  Student Records   — Student list, search, edit

INSIGHTS
  Teacher Performance — Anonymous student ratings
  Examinations & Result — Publish, calculate, view submissions
  Class Promotion   — Promote / retain / graduate students

SYSTEM
  Session Management — Start/end sessions, Class 10 early graduation, history
  Configuration     — School identity, system preferences
```

---

## 3. Dashboard (Overview)

**API:** `GET /api/admin/overview?session=&year=`

- **Stat Cards (5):** Faculty, Students, Parents, Classes, **Current Session**
  - Session card shows: session name + year + green pulse dot when active
  - When no session: shows "No Session" with "Start Session →" link to Sessions tab
- **Broadcast Notice:** `POST /api/admin/broadcast-notice`
- **Pending Teacher Approvals:** Approve / Reject cards
- **Top Performing Faculty:** Ranked by rating, filterable by session (ALL/1st–4th) + year (2024–2027)
- **Student Enrollment Pie Chart:** Donut chart, ease-in-out 1200ms animation, always re-animates on data change

---

## 4. Class Management

- Overview table: Division, Section, Students, Parents, Teachers
- Configure new class: name + section
- Classroom Engine Detail: 3 tabs (Students, Parents, Teachers with Set Head / Move / Remove / Delete)

---

## 5. Staff & Faculty

**API:** `GET /api/admin/teachers-by-class`

Status values: `PENDING`, `ACTIVE`, `ON_LEAVE`, `SUSPENDED`, `REJECTED`
Actions: Approve, Reject, Edit, Status Toggle, Delete

---

## 6. Student Records

**API:** `GET /api/admin/students?name=&className=`

Search, filter, edit (name/roll/email), delete with confirmation.

---

## 7. Teacher Performance (Reviews)

**API:** `GET /api/admin/teacher-ratings?session=&year=&className=`

Filterable by session (1st–4th), year, class. Color-coded progress bars. Details modal with anonymous reviews. Filters persisted in localStorage.

---

## 8. Examinations & Result

### Session ↔ Terminal Linking (1:1)
```
1st Session = 1st Term    2nd Session = 2nd Term
3rd Session = 3rd Term    4th Session = 4th Term
```
- Terminal auto-syncs from active session on load
- Read-only browse — session managed from Session Management tab

### Active Session Bar
- Read-only session + year display
- "Manage" link → Session Management tab
- Terminal dropdown + submission progress bar

### Exam Flow

```
Teachers Submit Marks
         ↓
    ┌─────────────────────────────────────────────────────┐
    │  STEP 1: PUBLISH RESULT                             │
    │  Enabled: ≥1 class has submitted marks              │
    │  • Results visible to students & parents            │
    │  • Grade sheets emailed (Nepal NEB format)          │
    │  • RESULT_PUBLISHED notifications                   │
    │  • Does NOT trigger promotion                       │
    │  API: POST /api/admin/publish-terminal              │
    └─────────────────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────────────────┐
    │  STEP 2: RUN CALCULATION                            │
    │  Enabled: ONLY after publish                        │
    │  Backend rejects if status ≠ PUBLISHED              │
    │                                                     │
    │  ALL TERMS: Snapshot data → calculate Performance     │
    │    & Potential scores per student → store in           │
    │    potentialmetric (status: PENDING_TEACHER_REVIEW)    │
    │  TERMS 1-3: Metrics only. No promotion. No advance.   │
    │  TERM 4:    Metrics + promote Class 1-9 + advance.    │
    │             Class 10 SKIPPED entirely.                 │
    │  After calc: class teachers notified to verify         │
    │    and fill Curiosity MCQ scores (0-10)                │
    │  API: POST /api/admin/run-calculation                  │
    └─────────────────────────────────────────────────────┘
```

### Data Snapshot Logic
When admin clicks Run Calculation:
1. **Snapshot timestamp** captured (`calculationSnapshotAt` on schoolexampublish)
2. All data queries use `createdAt <= snapshotAt`
3. After snapshot: new assignments/materials/attendance → next session
4. Per-student scores stored in `potentialmetric` with `status: PENDING_TEACHER_REVIEW`
5. Class teachers notified to verify + fill Curiosity MCQ (0-10)
6. After teacher completes → `status: COMPLETED` → graphs visible to parents + subject teachers

### New Performance Formula
```
PERFORMANCE = Exam + Assignment + Attendance
  Exam:       (avgExamPct - 50) × 0.5      → -25 to +25
  Assignment: sum(each grade - 50) × 0.3   → varies
  Attendance: ((present-absent)/days) × 20  → -20 to +20
  Total: approximately -100 to +100
```

### New Potential Formula
```
POTENTIAL = Effort (40) + Curiosity (40) + Learning Speed (20)
  Effort:    assignment submission (20) + material timeliness (20)
  Curiosity: quiz completion (30, auto) + teacher MCQ (10, manual)
  Speed:     ((correct-incorrect-missed)/total) × 20
  Total: approximately -40 to +80
```

### Terminal Status Overview
- 4 buttons: Published / Calculated / X Submitted / No Data

### Submission Details Table + Published Results History
- Class results modal with per-student grades, GPA, pass/fail

---

## 9. Class Promotion

### Publish Gate
ALL buttons **DISABLED** until latest terminal result is **PUBLISHED**.
Backend: `{ error: "Results must be published before promotion" }`

Response includes: `isResultPublished`, `activeSession`, `activeTerminal`

### Summary Cards (6)
Total | Promoted | Graduated | Retained | Pending Review | Not Processed

### Per-Student Actions
- **Promote** (Class 1-9 PASS): next class + data reset
- **Retain** (failed): same class, updates existing enrollment (no duplicate)
- **Graduate** (Class 10): marks GRADUATED, keeps all data

### Process Remaining Students (Bulk)
- Button: "Process Remaining Students"
- Helper: "Only processes students not yet actioned by session advance"
- Filters: `promotionStatus IN ('NONE', 'PENDING')` — safe to rerun
- API: `POST /api/admin/promotions/bulk`

### Data Reset on Promotion

| Action | Assignments | Materials | Quizzes | Attendance | Exam Marks | SWOT | Ratings | Parents |
|--------|-------------|-----------|---------|------------|------------|------|---------|---------|
| **Promoted** | DELETED | DELETED | DELETED | DELETED | KEPT | KEPT | KEPT | KEPT |
| **Retained** | filtered by sessionYear | kept | kept | kept | KEPT | KEPT | KEPT | KEPT |
| **Graduated** | kept (all) | kept | kept | kept | KEPT | KEPT | KEPT | KEPT |

---

## 10. Session Management

### Session State Detection
- `activePerformanceSession = null` → **No session active**
- `activePerformanceSession = "2nd Session"` → **Session active**
- There is NO boolean `sessionActive` field. The string field IS the state.
- Schema has **no defaults** — new schools start with null (no session)

### Active Session Status Card
- Active: session name, year, terminal, teacher count + green "Active" badge
- Inactive: "No session active" + "Start New Session" button

### Quick Actions (3 Cards)
| Card | Action | Condition |
|------|--------|-----------|
| Start Session | Opens start modal | Always available |
| End Session | Opens end modal | Disabled when no active session |
| End & Advance | Opens advance modal | Disabled when no active session |

### Start Session Modal
- Session picker (1st–4th), year input, live preview
- Typed confirmation: **"START SESSION"**
- **Blocks** if a session is already active: `"A session is already active. End it before starting a new one."`
- Duplicate check: rejects if session+year already completed
- **Sequential order enforced:** 1st → 2nd → 3rd → 4th
  - Cannot start 2nd without completing 1st (same year)
  - Cannot start 1st of new year without completing 4th of previous year
  - First-ever session for a school is always allowed
  - Error example: `"Complete 1st Session (2026) before starting 2nd Session."`
- On 1st Session: resets all non-graduated promotionStatus to NONE
- **Notifications sent to ALL users:** Admin + all active teachers + all approved students + all parents (bulk insert)
- API: `POST /api/admin/start-session`

### End Session Modal
- Typed confirmation: **school name** (case-insensitive)
- Creates `sessioncompletion` records for all classes x teachers
- Disables teacher ratings
- **Clears session:** sets `activePerformanceSession = null`, `activePerformanceYear = null`
- After end-session, admin must explicitly start a new session
- API: `POST /api/admin/end-session`

### End & Advance Modal
**Preview API:** `GET /api/admin/advance-session/preview?session=&year=`

Response:
```json
{
  "ok": true,
  "currentSession": "4th Session", "currentYear": 2026,
  "nextSession": "1st Session", "nextYear": 2027,
  "isFourthSession": true,
  "blocked": true,
  "blockReason": "Missing submissions: 9A, 9B",
  "class10": { "count": 12, "autoGraduate": true, "examRequired": false },
  "class1to9": { "toPromote": 45, "toFail": 3, "noResults": 2, "missingSubmissions": ["9A", "9B"] },
  "submissionCheck": { "allSubmitted": false, "missingClasses": ["9A", "9B"] }
}
```

**4th Session Rules:**
| Rule | Description |
|------|-------------|
| Class 10 | ALL auto-graduated (no exam required) |
| Class 1-9 | Normal promotion (pass=promote, fail=pending) |
| Submission Check | Must have all Class 1-9 submissions |
| Class 10 Exempt | NOT required to submit for 4th session |
| Blocked | "Submissions Incomplete" when Class 1-9 missing |

**Class 10 Early Graduation Toggle (inside End & Advance modal):**
- Visible ONLY during 4th session when Class 10 students exist and not all graduated
- Toggle OFF (default): full End & Advance runs normally
- Toggle ON: graduates Class 10 only, session stays active
  - Typed confirmation changes to: **"GRADUATE CLASS 10"**
  - Button label changes to: "Graduate Class 10 Only"
  - Calls `POST /api/admin/graduate-class10-early`
  - Success: "X Class 10 students graduated. Session is still active."
- No separate standalone card — everything in one modal

**Backend endpoints:**
- `POST /api/admin/graduate-class10-early` — validates 4th session, confirmation, graduates remaining Class 10
- `GET /api/admin/class10-status` — returns `{ isFourthSession, total, graduated, remaining, allGraduated }`

### Session History
- Auto-loads on tab open
- Each entry: session, year, date, status (Published / Calculated / Completed)
- API: `GET /api/admin/session-history`

---

## 11. Configuration (Settings)

### School Identity
| Field | Editable | API |
|-------|----------|-----|
| School Name | Yes | `PATCH /api/admin/school-identity` |
| School Code | Read-only | — |
| Email | Yes | `PATCH /api/admin/school-identity` |
| Phone | Yes | `PATCH /api/admin/school-identity` |
| Address | Yes | `PATCH /api/admin/school-identity` |

### System Preferences
- Teacher Performance Ratings: toggle with session selector
- Parent Messaging: toggle

---

## 12. Messaging System

```
Parent sends message → PENDING → Admin: Accept/Reject/Delete → Conversation thread
```
Images: base64 in MEDIUMTEXT body (up to 16MB). Supported: PNG, JPEG, GIF, WebP — max 500KB.

---

## 13. Notifications

| Type | When | Recipients |
|------|------|------------|
| `INFO` | General system info | School-wide |
| `ADMIN_NOTICE` | Broadcast notice | All parents + students |
| `RESULT_PUBLISHED` | Results published | Parents + teachers |
| `PROMOTION` | Student promoted | Specific student's parents |
| `GRADUATION` | Student graduated | Specific student's parents |
| `SESSION_STARTED` | Session started | **ALL users** (admin + teachers + students + parents) |
| `SESSION_ADVANCE` | Session ended/advanced | School-wide |
| `SYSTEM_NOTICE` | Calculation, early graduation | Admin or school-wide |

---

## 14. Complete Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: SETUP (one-time)                                       │
│  Admin creates school → classes → students register → teachers  │
│  register & approved → assigned to classes                      │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: START SESSION                                          │
│  Session Management → Start Session                             │
│  Blocks if session already active                               │
│  Type "START SESSION" → active for entire school                │
│  Notifications to ALL users (admin + teachers + students +      │
│  parents) via bulk insert                                       │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: ACADEMIC ACTIVITIES                                    │
│  Teachers: assignments (tagged with sessionYear), materials,    │
│            attendance, grading                                  │
│  Students: submit work, watch videos, take quizzes              │
│  Parents: view notices, track attendance, chat with admin        │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: EXAM PROCESSING                                        │
│  1. Teachers enter marks (Theory + Practical)                   │
│  2. Class teacher submits marks to admin                        │
│  3. Admin publishes results (Step 1) → grade sheets emailed    │
│  4. Admin runs calculation (Step 2):                            │
│     → Terms 1-3: metrics only, no promotion, no advance         │
│     → Term 4: metrics + promote Class 1-9 + advance             │
│               (Class 10 SKIPPED — never processed here)         │
└─────────────────────────────────────────────────────────────────┘
         ↓
    Repeat Phase 2→4 for 2nd, 3rd, 4th Session
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: CLASS 10 EARLY GRADUATION (optional, 4th session)      │
│  Inside End & Advance modal → toggle "Graduate Class 10 Early"  │
│  Type "GRADUATE CLASS 10" → Class 10 graduated, session active  │
│  Class 1-9 completely unaffected                                │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: YEAR END (End & Advance on 4th Session)                │
│  BLOCKED until all Class 1-9 submissions received               │
│  • Class 10: auto-graduated (skips already graduated)           │
│  • Class 1-9 PASS: promoted + data reset                       │
│  • Class 1-9 FAIL: sent to manual review                       │
│  • Session advances to next                                     │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 7: SESSION CLEARED                                        │
│  activePerformanceSession = null, activePerformanceYear = null  │
│  Admin must explicitly start next session                       │
│  Class Promotion tab → "Process Remaining Students" (safe)      │
└─────────────────────────────────────────────────────────────────┘
         ↓
    New academic year. Cycle restarts from Phase 2.
```

---

## 15. run-calculation — Term 1-3 vs Term 4

```javascript
/*
 * run-calculation behavior:
 * ALL TERMS: snapshot data → calculate Performance & Potential per student
 *            → store in potentialmetric (PENDING_TEACHER_REVIEW)
 *            → notify class teachers to verify + fill curiosity MCQ
 * Terms 1-3: metrics only, no promotion, no session advance
 * Term 4:   metrics + promote Class 1-9 + advance session
 * Class 10: NEVER processed for promotion — handled by advance-session
 */
```

| Terminal | Snapshot | Metrics Stored | Teacher Verify | Promotion | Advance | Notification |
|----------|---------|----------------|----------------|-----------|---------|--------------|
| 1st Term | Yes | Yes | Yes (MCQ) | No | No | SYSTEM_NOTICE + teacher notify |
| 2nd Term | Yes | Yes | Yes (MCQ) | No | No | SYSTEM_NOTICE + teacher notify |
| 3rd Term | Yes | Yes | Yes (MCQ) | No | No | SYSTEM_NOTICE + teacher notify |
| 4th Term | Yes | Yes | Yes (MCQ) | Class 1-9 | Yes | SYSTEM_NOTICE + PROMOTION + teacher notify |

### Calculation Sequence (ALL terms):
1. Capture `snapshotAt` timestamp
2. For each student: collect exam/assignment/attendance/material/quiz data (up to snapshot)
3. Calculate Performance (exam + assignment + attendance scores)
4. Calculate Potential (effort + curiosity quiz + learning speed). curiosityMcq = null
5. Store in `potentialmetric` with status `PENDING_TEACHER_REVIEW`
6. Notify class teachers to verify + fill MCQ

### Additional (4th Term only):
7. Auto-promote Class 1-9 (PASS→PROMOTED, FAIL→PENDING). Class 10 SKIPPED.
8. Advance session to next period
9. Send PROMOTION notifications to parents

### Class Teacher Verification (after any term):
- Teacher reviews auto-calculated scores (read-only)
- Fills in Curiosity MCQ (0-10) per student — the ONLY manual input
- Saves → curiosityTotal + potentialTotal computed → status = COMPLETED
- Graphs become visible to parents + subject teachers

### Analytics Query Behavior:
- Scatter plot data reads from `potentialmetric` table (pre-calculated, not dynamic)
- Query matches by **session name only** (no year filter) — picks most recent year via `orderBy: sessionYear desc`
- This prevents data mismatch when school year advances past the calculation year
- For PENDING_TEACHER_REVIEW: `potentialTotal` is null, so potential = `effortTotal + curiosityQuiz + learningSpeed`

### New Utility Files:
- `backend/src/utils/performanceCalculator.js` — exam, assignment, attendance scores
- `backend/src/utils/potentialCalculator.js` — effort, curiosity, learning speed scores
- `backend/src/utils/notificationTypes.js` — NT.* constants for all notification types

---

## 16. Graduation Rules — Single Trigger

| Controller | Class 10 Behavior |
|------------|-------------------|
| `run-calculation` | **SKIPS** Class 10 entirely |
| `advance-session` | **GRADUATES** all Class 10 (the ONLY auto trigger) |
| `graduate-class10-early` | **GRADUATES** remaining Class 10 (manual early trigger) |
| `promotions/:id/graduate` | **GRADUATES** individual Class 10 (manual per-student) |

No duplicate processing possible.

---

## 17. Session State Detection

**Schema (no defaults):**
```prisma
activePerformanceSession  String?   // null = no session, any string = active
activePerformanceYear     Int?      // null = no session
```

**How session state is determined:**
- `school.activePerformanceSession === null` → No session active
- `school.activePerformanceSession === "2nd Session"` → 2nd Session is active
- No boolean field. The string IS the state.

**Guards:**
- `start-session`: blocks if `activePerformanceSession` is NOT null
- `end-session`: blocks if `activePerformanceSession` IS null
- `end-session` sets both fields to `null` after ending
- New schools (no seed) start with `null` — "No session active" shows correctly

---

## 18. Assignment Session Filtering

**Schema field:** `assignment.sessionYear` (Int, nullable)

- Teacher creates assignment → `sessionYear` auto-set from `school.activePerformanceYear`
- All queries filter: `WHERE sessionYear = currentYear OR sessionYear IS NULL`
- Retained students: only see current year assignments (old ones filtered out)
- Promoted students: old assignments deleted via data reset
- Graduated students: keep all

Filtered in: teacher assignments, student assignments, parent tasks tab.

---

## 19. Retain Logic — No Duplicate Enrollment

```javascript
await prisma.student.update({
  where: { id: studentId },
  data: { isApproved: true, promotionStatus: 'RETAINED' }
});
await prisma.enrollment.updateMany({
  where: { studentId, classId: student.classId },
  data: { year: activePerformanceYear }
});
```

No new enrollment row created. Updates existing one.

---

## 20. Prisma Null Filter Pattern

`promotionStatus` can be `'NONE'` or `null`. The correct Prisma filter:

```javascript
// CORRECT — handles both NONE and null
where: {
  schoolId,
  OR: [{ promotionStatus: 'NONE' }, { promotionStatus: null }]
}

// WRONG — null inside 'in' is ignored by Prisma
where: { promotionStatus: { in: ['NONE', null] } }
```

Applied in: run-calculation, advance-session preview (2 queries), advance-session (1 query).

---

## 21. Notification Type Constants

**File:** `backend/src/utils/notificationTypes.js`

```javascript
module.exports = {
  INFO:             'INFO',
  ADMIN_NOTICE:     'ADMIN_NOTICE',
  RESULT_PUBLISHED: 'RESULT_PUBLISHED',
  PROMOTION:        'PROMOTION',
  GRADUATION:       'GRADUATION',
  SESSION_STARTED:  'SESSION_STARTED',
  SESSION_ADVANCE:  'SESSION_ADVANCE',
  SYSTEM_NOTICE:    'SYSTEM_NOTICE'
};
```

Imported as `NT` in dashboard controller. All notification `type` values use `NT.*` constants — no hardcoded strings. Prevents typo bugs.

---

## 22. Cross-Dashboard Session Banner

**Component:** `frontend/src/components/ui/SessionBanner.jsx` (shared)

A slim banner shown at the top of Teacher, Student, and Parent dashboards.
Driven by `school.activePerformanceSession` from each dashboard's API.

| State | Design | Message |
|-------|--------|---------|
| Active | Green bg, pulse dot, session + year + terminal + "Active" badge | `2nd Session — 2026 | 2nd Term | Active` |
| Inactive | Amber bg, static dot | Teacher: "Contact admin to start a new session" |
| Inactive | Amber bg, static dot | Student/Parent: "School is on a break" |
| Loading | Shimmer skeleton | — |

**Data source per dashboard:**
- Teacher: `GET /api/teacher/dashboard/profile` → `data.activeSession`
- Student: `GET /api/student/dashboard` → `data.activeSession`
- Parent: `GET /api/parent/dashboard/overview` → `data.activeSession`

No separate API call — session info piggybacks on existing overview endpoints.

Admin dashboard does NOT use this banner (has session stat card instead).

---

## 23. Nepal NEB Grading Rules

**Utility:** `backend/src/utils/nepalGrading.js` (NOT modified)

| Grade | GPA | Percentage | Description |
|-------|-----|-----------|-------------|
| A+ | 4.0 | 90–100% | Outstanding |
| A | 3.6 | 80–89% | Excellent |
| B+ | 3.2 | 70–79% | Very Good |
| B | 2.8 | 60–69% | Good |
| C+ | 2.4 | 50–59% | Satisfactory |
| C | 2.0 | 40–49% | Acceptable |
| D+ | 1.6 | 30–39% | Partially Acceptable |
| D | 1.2 | 20–29% | Insufficient |
| E | 0.8 | 1–19% | Very Insufficient |
| N | 0.0 | 0 / Absent | Not Graded |

Pass: minimum D+ in both theory AND practical per subject. Any subject below D+ = FAIL.

---

## 24. Database Schema (Key Models)

### school
```prisma
activePerformanceSession  String?    // NO default — null = no session
activePerformanceYear     Int?       // NO default — null = no session
activeExamTerminal        String?
activeRatingSession       String?
activeRatingYear          Int?
ratingsEnabled            Boolean    @default(false)
```

### schoolexampublish
```prisma
calculationSnapshotAt  DateTime?    // Timestamp when Run Calculation was clicked
calculationStatus      String       // NOT_STARTED → COMPLETED
```

### potentialmetric (analytics scores per student per session)
```prisma
studentId           Int
session             String       // "1st Session"
sessionYear         Int          // 2026
terminal            String?      // "1st Term"
snapshotAt          DateTime?    // Frozen data timestamp

// Performance (auto-calculated)
examScore           Float?       // (avgPct-50)*0.5
assignmentScore     Float?       // sum(grade-50)*0.3
attendanceScore     Float?       // (present-absent)/days*20
performanceTotal    Float?       // sum of above

// Effort (auto-calculated)
effortAssignment    Float?       // (onTime-late-missed)/total*20
effortMaterials     Float?       // (onTimeWatched-lateWatched)/total*20
effortTotal         Float?

// Curiosity (auto + manual)
curiosityQuiz       Float?       // (solved-unsolved)/total*30 (auto)
curiosityMcq        Float?       // 0-10 (teacher input)
curiosityTotal      Float?       // quiz + mcq (set after teacher input)

// Learning Speed (auto)
learningSpeed       Float?       // (correct-incorrect-missed)/total*20

// Totals
potentialTotal      Float?       // set after teacher fills curiosityMcq
status              String       // PENDING_TEACHER_REVIEW → COMPLETED

@@unique([studentId, session, sessionYear])
```

### assignment
```prisma
sessionYear  Int?    // Filters by academic year for retained students
```

### enrollment
```prisma
@@unique([studentId, classId, year])
```

### notification
```prisma
type  String  @default("INFO")   // Free-text, uses NT.* constants
```
Recipients: `adminId`, `teacherId`, `studentId`, `parentId` (all nullable).

### sessioncompletion
```prisma
@@unique([classId, session, year])
```

---

## 25. API Reference (All 57 Admin Endpoints)

All at `/api/admin/*`, protected with JWT + ADMIN role.

### Dashboard & Overview (3)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/overview` | Stats, top teachers, enrollment distribution |
| GET | `/dashboard/financial-stats` | Fee collection stats |
| POST | `/broadcast-notice` | Notify all parents/students |

### Notifications (2)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| PATCH | `/notifications/read` | Mark all read |

### Classes (11)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/classes` | List with counts |
| GET | `/classes/overview` | Class-subject-teacher map |
| GET | `/classes/:id/details` | Students, parents, teachers |
| GET | `/classes/:id/students` | Students in class |
| GET | `/classes/:classId/results` | Exam results for class+terminal |
| POST | `/classes` | Create class |
| POST | `/classes/assign-teacher` | Assign teacher to subject+class |
| POST | `/classes/:id/assign-class-teacher` | Set class head |
| PATCH | `/classes/:id/assign-class-teacher` | Update class head |
| DELETE | `/classes/:id` | Delete class |
| DELETE | `/classes/:classId/teachers/:teacherId` | Remove teacher from class |

### Teachers (9)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/teachers-by-class` | All teachers with class/subject |
| GET | `/teacher-ratings` | Ratings by session/year |
| GET | `/pending-teachers` | Pending approvals |
| GET | `/reviews` | All reviews |
| PATCH | `/teachers/:id/approve` | Approve |
| PATCH | `/teachers/:id/reject` | Reject |
| PATCH | `/teachers/:id/status` | Toggle status |
| PATCH | `/teachers/:id` | Edit info |
| DELETE | `/teachers/:id` | Delete (cascade) |

### Students (3)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/students` | List (search/filter) |
| PATCH | `/students/:id` | Edit |
| DELETE | `/students/:id` | Delete |

### Subjects (2)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subjects` | List all |
| POST | `/subjects` | Create |

### Settings (4)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/settings` | Get rating settings |
| PATCH | `/settings` | Update preferences |
| PATCH | `/settings/ratings` | Toggle ratings + session |
| PATCH | `/school-identity` | Update name/email/phone/address |

### Messages (7)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/messages/requests` | Inbox |
| GET | `/messages/conversation/:userId` | Thread |
| POST | `/messages/:id/accept` | Accept |
| POST | `/messages/:id/reject` | Reject |
| POST | `/messages/reply` | Reply (with file) |
| POST | `/messages/send` | Send |
| DELETE | `/messages/:id` | Delete |

### Examinations (4)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/exam-submissions` | Submission status per terminal |
| GET | `/results-history` | Published terminals with stats |
| POST | `/publish-terminal` | Publish results + email grade sheets (NO promotion) |
| POST | `/run-calculation` | Terms 1-3: metrics only. Term 4: metrics + promote Class 1-9 + advance. Class 10 SKIPPED. |

### Session Management (7)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/start-session` | Start session (blocks if active, notifies ALL users) |
| POST | `/end-session` | End session (clears fields to null, school name confirmation) |
| GET | `/session-history` | Completed sessions with status |
| GET | `/advance-session/preview` | Preview (?session=&year=), returns blocked/class10/class1to9 |
| POST | `/advance-session` | End + advance + graduate Class 10 + promote Class 1-9 |
| POST | `/graduate-class10-early` | Early Class 10 graduation (4th session, typed confirmation) |
| GET | `/class10-status` | Class 10 total/graduated/remaining/allGraduated |

### Promotions (6)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/promotions` | Students + isResultPublished + activeSession + activeTerminal |
| POST | `/promotions/:studentId/promote` | Promote + data reset |
| POST | `/promotions/:studentId/retain` | Retain (updates existing enrollment, no duplicate) |
| POST | `/promotions/:studentId/graduate` | Graduate Class 10 |
| POST | `/promotions/bulk` | Process NONE/PENDING only (safe rerun) |
| GET | `/graduations` | Graduation history |

---

> **Testing:** `admin_demo / Demo@1234` at `http://localhost:3000/login`
> **Seed:** `cd backend && node prisma/seed.js`
> **Start:** `./start.sh` (backend:8080, frontend:3000, Prisma Studio:5555)
