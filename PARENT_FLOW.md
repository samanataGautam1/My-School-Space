# School Space — Parent Module: Complete Flow & Feature Guide

> Last Updated: 2026-04-09 (Session 9)
> This document reflects the actual implemented code.

---

## Table of Contents

1. [Access & Authentication](#1-access--authentication)
2. [Session Banner](#2-session-banner)
3. [Child Switcher](#3-child-switcher)
4. [Dashboard Tabs](#4-dashboard-tabs)
5. [Notices Tab (Complaints)](#5-notices-tab)
6. [Overview Tab (Analytics)](#6-overview-tab)
7. [Attendance Tab](#7-attendance-tab)
8. [Report Tab (SWOT Feedback)](#8-report-tab)
9. [Tasks Tab (Assignments)](#9-tasks-tab)
10. [Results Tab (Grade Sheets)](#10-results-tab)
11. [Chat (Messaging)](#11-chat-messaging)
12. [Notifications](#12-notifications)
13. [Session Awareness](#13-session-awareness)
14. [Graph Visibility Rules](#14-graph-visibility-rules)
15. [API Reference (All Parent Endpoints)](#15-api-reference-all-parent-endpoints)

---

## 1. Access & Authentication

**Registration:** Parent signs up with student codes → linked to children.
**Login:** Username OR email + School Code + Password
**Route:** `/dashboard/parent`
**Auth Guard:** JWT token (7-day expiry) + role = `PARENT`

Parents can be linked to **multiple students** (siblings). The child switcher handles this.

---

## 2. Session Banner

A slim banner at the top of the dashboard, above all tabs.
Uses shared `SessionBanner` component.

| State | Display |
|-------|---------|
| Active | Green: `2nd Session — 2026 | 2nd Term | Active` |
| Inactive | Amber: `No Active Session | School is on a break` |
| Loading | Shimmer skeleton |

Data source: `GET /api/parent/dashboard/overview` → `data.activeSession`

When results are published, shows: "Results available for {childName}" with link.

---

## 3. Child Switcher

**For multi-child parents (siblings in same school).**

- Dropdown in header showing all linked children
- Current child shown with avatar + name + "VIEWING" badge
- Switching refreshes ALL tab data for the new child
- State: `selectedChildIndex` + `children[]` array
- APIs re-fetched with new child's studentId

---

## 4. Dashboard Tabs

```
Notices     — School announcements, alerts, teacher notices
Overview    — Performance vs Potential scatter plot + analytics
Attendance  — Monthly attendance breakdown
Report      — SWOT feedback history + portfolio
Tasks       — Assignment tracker
Results     — Terminal grade sheets (Nepal NEB format)
```

Plus: **Chat** accessible from header (not a tab).

---

## 5. Notices Tab

**Default tab on load.**

### Child Quick Summary Card
- Performance score, Potential score, Attendance %, Submitted count, Pending count

### Notice List
Types shown:
- **Pinned (school):** Admin broadcast notices
- **Result Published:** Terminal results available
- **Report Ready:** SWOT feedback completed
- **Teacher Notice:** Complaints/messages from teacher

Color-coded icons and sub-messages per type.

---

## 6. Overview Tab (Analytics)

### Performance vs Potential Scatter Plot
- Shows child's position on the 4-quadrant graph
- **X-axis:** Performance (-100 to +100)
- **Y-axis:** Potential (-40 to +80)
- Quadrant midpoints: X=0, Y=20

### Quadrants:
| Quadrant | Condition | Label |
|----------|-----------|-------|
| Top-right | X > 0, Y > 20 | Star Performer |
| Top-left | X < 0, Y > 20 | High Potential Learner |
| Bottom-right | X > 0, Y < 20 | Coasting |
| Bottom-left | X < 0, Y < 20 | Needs Support |

### Parent-Friendly Insight Card
- Explains child's quadrant in plain language
- Color-coded: green (star), blue (learner), amber (coasting), red (support)
- Shows numeric scores for performance + potential

### Score Explanation Cards
- Performance: based on exam results, assignment grades, attendance
- Potential: based on effort, curiosity, learning speed

### Session Selector
- Options: 1st / 2nd / 3rd / 4th Session
- Default: current active session
- Filters trendline data client-side from existing performance data
- Only shows sessions with `status = COMPLETED` data

### Data Source
- API: `GET /api/parent/dashboard/children/performance?session=`
- Returns per-child: performance score, potential score, trendlines, breakdowns
- Accepts optional `?session=` param for server-side filtering

---

## 7. Attendance Tab

### Summary Cards
- Total Days, Present, Absent, Late, Overall %

### Monthly Breakdown
- Progress bars per month showing attendance rate
- Daily records grid with color-coded squares

### Legend
- Green = Present (P)
- Red = Absent (A)
- Amber = Late (L)

### API
- `GET /api/parent/dashboard/child/:studentId/attendance?month=&year=`

---

## 8. Report Tab (SWOT Feedback)

### Academic Performance Portfolio
- "Generate Portfolio" button creates a detailed report
- Assignment/Exam/Attendance component scores
- Potential growth metrics (Learning Speed, Curiosity, etc.)
- Growth quadrant visualization
- Print as PDF

### Request SWOT Report
- "Request SWOT Report via Email" sends request to teacher
- API: `POST /api/parent/feedback/request`

### Evaluation History
- List of completed SWOT reports
- Each shows: name, date, verified badge, "View Full Report" button
- Full report modal: Strength, Weakness, Opportunity, Threat, Suggestion

### APIs
- Children: `GET /api/parent/feedback/children`
- Requests: `GET /api/parent/feedback/requests`
- Reports: `GET /api/parent/feedback/reports`

---

## 9. Tasks Tab (Assignments)

### Summary Cards
- Total, Submitted, Pending, Overdue

### Assignment Table
| Column | Description |
|--------|-------------|
| Title & Subject | Assignment name + subject |
| Due Date | When it's due |
| Status | GRADED / SUBMITTED / PENDING / OVERDUE / MISSED |
| Grade | Score if graded |

### Status Colors
| Status | Color |
|--------|-------|
| GRADED | Green |
| SUBMITTED | Blue |
| PENDING | Amber |
| OVERDUE | Red |
| MISSED | Red |

### Assignment Session Filtering
- Assignments filtered by `sessionYear = currentYear OR sessionYear IS NULL`
- Retained students see only current year assignments
- API: `GET /api/parent/dashboard/children/assignments`

---

## 10. Results Tab (Grade Sheets)

### Terminal Selector
- Dropdown: 1st Term, 2nd Term, 3rd Term, 4th Term
- Only shows terminals with published results

### Grade Sheet View (Nepal NEB Format)
- Student info, school info, terminal header
- Subject table: Theory, Practical, Total, Full, Pass, %, Grade, GPA, Status
- Overall: Grand Total, Percentage, Grade, GPA, Final Status
- Nepal NEB Grade Scale legend
- Uses shared `GradeSheetView` component

### APIs
- Terminals: `GET /api/parent/dashboard/child/:studentId/terminals`
- Marks: `GET /api/parent/dashboard/child/:studentId/terminal-marks?terminal=`
- Grade sheet: `GET /api/parent/dashboard/student/:studentId/grade-sheet/:terminal`

---

## 11. Chat (Messaging)

### Flow
```
Parent sends message → status: PENDING
      ↓
Admin sees in inbox → Accept / Reject / Delete
      ↓
If accepted → conversation thread opens
      ↓
Parent and admin can exchange messages
```

### Message Features
- Images: base64 embedded in body (MEDIUMTEXT, up to 16MB)
- Supported: PNG, JPEG, GIF, WebP — max 500KB per image
- Status tracking: PENDING → ACCEPTED / REJECTED
- Conversation thread with timestamps

### Teacher Messages
- Teachers can send complaints/notices to parents
- Parent sees these in the Notices tab
- API: `GET /api/parent/dashboard/teacher-messages`
- Unread count: `GET /api/parent/dashboard/teacher-messages/unread-count`

---

## 12. Notifications

Types received:
| Type | Description |
|------|-------------|
| `RESULT_PUBLISHED` | Terminal results available for child |
| `PROMOTION` | Child promoted to next class |
| `GRADUATION` | Child graduated from Class 10 |
| `SESSION_STARTED` | New session started |
| `SESSION_ADVANCE` | Session ended/advanced |
| `ADMIN_NOTICE` | School broadcast |
| `INFO` | General info |

API: `GET /api/parent/dashboard/notifications`

---

## 13. Session Awareness

- Overview API returns `activeSession` with session/year/terminal/isActive
- **Session banner** (shared `SessionBanner` component) at top of dashboard:
  - Active: green banner with session + year + terminal + "Active"
  - Inactive: amber banner "No Active Session | School is on a break"
- Assignment list filtered by `sessionYear` (via backend)
- Performance scatter plot has session selector (1st–4th Session, capitalized)
- Receives `SESSION_STARTED` notification when admin starts session
- Sessions enforced in order: 1st → 2nd → 3rd → 4th (admin side)

### How parent sees session lifecycle:
| Event | What Parent Sees |
|-------|------------------|
| Session starts | Green banner, `SESSION_STARTED` notification |
| Results published | Grade sheet in Results tab, `RESULT_PUBLISHED` notification |
| Child promoted | `PROMOTION` notification, child shows new class |
| Child graduated | `GRADUATION` notification, congratulations message |
| Session ends | Amber "School is on a break" banner |

---

## 14. Graph Visibility Rules

The Performance vs Potential scatter plot data is only shown when
`potentialmetric.status = 'COMPLETED'` for that session.

| Condition | What Parent Sees |
|-----------|------------------|
| status = COMPLETED | Scatter plot with child's position (colored dot) |
| status = PENDING_TEACHER_REVIEW | "Scores are being verified. Check back soon." |
| No data for session | "No data for this session yet" |

Class teacher must verify + fill curiosity MCQ before parent can see the graph.

### Scatter Plot Axis Ranges (Parent Overview)
- X-axis (Performance): -100 to +100
- Y-axis (Potential): -40 to +80
- Position mapping: `getPosX = ((val+100)/200)*100%`, `getPosY = ((val+40)/120)*100%`
- Quadrant midpoints: X=0, Y=20
- Session selector filters trendline data client-side

### Analytics Query (Backend)
- `GET /api/parent/dashboard/children/performance?session=`
- Matches potentialmetric by session name only (no year filter, picks most recent)
- For PENDING records: potential = effortTotal + curiosityQuiz + learningSpeed

---

## 15. API Reference (All Parent Endpoints)

### Dashboard Routes — `/api/parent/dashboard/*`
Protected with JWT.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/overview` | Overview + activeSession |
| GET | `/notifications` | Parent notifications |
| GET | `/messages` | Message history |
| POST | `/messages/send` | Send message to admin |
| GET | `/children/performance` | Analytics data per child (?session=) |
| GET | `/children/assignments` | Assignment tracker (sessionYear filtered) |
| GET | `/child/:studentId/monthly-performance` | Monthly breakdown |
| GET | `/child/:studentId/attendance` | Attendance by month/year |
| GET | `/child/:studentId/terminals` | Published terminal list |
| GET | `/child/:studentId/terminal-marks` | Terminal marks |
| GET | `/student/:studentId/grade-sheet/:terminal` | Nepal NEB grade sheet |
| GET | `/teacher-messages` | Teacher complaints/notices |
| GET | `/teacher-messages/unread-count` | Unread teacher message count |
| GET | `/daily-briefing` | Daily summary |

### Feedback Routes — `/api/parent/feedback/*`
Protected with JWT.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/children` | Children for feedback |
| GET | `/validate-student` | Validate student code |
| POST | `/request` | Request SWOT feedback from teacher |
| GET | `/requests` | Feedback request history |
| GET | `/reports` | Completed SWOT reports |

---

> **Testing:** Login with any parent account from seed data (school code: SS01, password: Demo@1234)
> **Seed creates:** 5 parents linked to students
