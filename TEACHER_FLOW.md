# School Space — Teacher Module: Complete Flow & Feature Guide

> Last Updated: 2026-04-11 (Session 10)
> This document reflects the actual implemented code.
> Session 10: Analytics live calc fixed (no more zeros), subject filter shows only teacher's subjects, Prepare Graph shows all classes, scatter plot + individual cards + parent dashboard all return identical values, session banner removed, portfolio redesigned inline.

---

## Table of Contents

1. [Access & Authentication](#1-access--authentication)
2. [Dashboard Tabs](#2-dashboard-tabs)
3. [Overview Tab](#3-overview-tab)
4. [Assignments Tab](#4-assignments-tab)
5. [Study Materials Tab](#5-study-materials-tab)
6. [Attendance Tab](#6-attendance-tab)
7. [Approvals Tab](#7-approvals-tab)
8. [Reports / Exams Tab](#8-reports--exams-tab)
9. [Analytics — New Formula System](#9-analytics--new-formula-system)
10. [Session Analytics Verification (Class Teacher)](#10-session-analytics-verification-class-teacher)
11. [SWOT Feedback System](#11-swot-feedback-system)
12. [Complaint System](#12-complaint-system)
13. [Notifications](#13-notifications)
14. [Session Awareness](#14-session-awareness)
15. [Class Teacher Privileges](#15-class-teacher-privileges)
16. [Graph Visibility Rules](#16-graph-visibility-rules)
17. [Session Banner](#17-session-banner)
18. [Assignment Table (Improved)](#18-assignment-table-improved)
19. [Frontend Components](#19-frontend-components)
20. [API Reference (All Teacher Endpoints)](#20-api-reference-all-teacher-endpoints)

---

## 1. Access & Authentication

**Registration:** Teacher signs up with school code → status `PENDING` → admin approves.
**Login:** Username OR email + School Code + Password
**Route:** `/dashboard/teacher`
**Auth Guard:** JWT + role = `TEACHER`
**Status must be `ACTIVE`** — `ON_LEAVE`, `SUSPENDED`, `REJECTED` cannot access dashboard.

---

## 2. Dashboard Tabs

```
ALL TEACHERS:
  Overview         — Classes, subjects, quick stats
  Assignments      — Create, manage, grade assignments
  Study Materials  — Upload videos, create quizzes, track progress

CLASS TEACHERS ONLY (isClassTeacher = true):
  Attendance       — Mark daily attendance, view history
  Approvals        — Approve/reject student registrations
  Reports / Exams  — Enter marks, submit results to admin
```

---

## 3. Overview Tab

**API:** `GET /api/teacher/dashboard/overview`

- Classes and subjects assigned
- Quick stats: student count, pending approvals
- Class Management sub-view: `GET /api/teacher/dashboard/class/:classId/students`

---

## 4. Assignments Tab

### Create Assignment

- Fields: title, description, class, subject, file (50MB), due date, submission type
- **sessionYear auto-set** from `school.activePerformanceYear`
- API: `POST /api/assignments/create`

### Teacher Assignment List

- Filtered: `sessionYear = currentYear OR sessionYear IS NULL`
- API: `GET /api/assignments/teacher?userId=`

### Grade Submissions

- Grade each submission: score (0-100) + feedback
- Late detection (submitted after due date)
- API: `POST /api/assignments/grade`

### Open/Close: `PATCH /api/assignments/:id/toggle-close`

---

## 5. Study Materials Tab

### Upload: video + thumbnail via Cloudinary. `POST /api/materials/create`

### In-Video Quizzes: MCQ at specific timestamps, retake prevention

### Progress Tracking: watched position, TODO/DONE status. `POST /api/materials/progress`

### Delete: `DELETE /api/materials/:id`

---

## 6. Attendance Tab (Class Teachers Only)

- Mark P/A/L per student per date (unique: studentId + date)
- History by month/year
- APIs: `GET /api/attendance/classes`, `POST /api/attendance/save`, `GET /api/attendance/history/:classId`

---

## 7. Approvals Tab (Class Teachers Only)

- Approve/reject pending student registrations
- Handle failed students (promotionStatus = PENDING)

---

## 8. Reports / Exams Tab (Class Teachers Only)

- Enter marks: Theory + Practical per subject per student
- Submit subject marks → admin
- Submit class result → admin
- Mark session done → creates `sessioncompletion` record

---

## 9. Analytics — New Formula System

**Data is now PRE-CALCULATED by admin's "Run Calculation" action.**
Teachers see stored results from `potentialmetric` table, not dynamically computed values.

### Performance Score (X-axis: -100 to +100)

```
PERFORMANCE = Exam + Assignment + Attendance

A. EXAM (50% weight):
   Formula: (avgExamPercentage - 50) × 0.5
   Range: -25 to +25
   Example: student got 63% → (63-50) × 0.5 = +6.5

B. ASSIGNMENT (30% weight):
   Formula: sum of (each grade - 50) × 0.3
   Grades are out of 100. Only graded submissions counted.
   Example: grades [20,30,50,80,100,90]
     → deviations: -30 + -20 + 0 + 30 + 50 + 40 = 70
     → 70 × 0.3 = +21

C. ATTENDANCE (20% weight):
   Formula: ((present - absent) / activeDays) × 20
   Late (L) counts as present.
   Range: -20 to +20
```

### Potential Score (Y-axis: -40 to +80)

```
POTENTIAL = Effort (40) + Curiosity (40) + Learning Speed (20)

A. EFFORT (40 points):
   Part 1 — Assignment Submission (20 pts):
     ((onTime - late - missed) / totalAssignments) × 20
     onTime = submitted before due date
     late   = submitted after due date
     missed = closed without submission

   Part 2 — Timely Material Watching (20 pts):
     ((onTimeWatched - lateWatched) / totalMaterials) × 20
     Uses studymaterial.deadline field

B. CURIOSITY (40 points):
   Part 1 — Quiz Completion (30 pts, AUTO):
     ((totalSolved - notSolved) / totalQuestions) × 30
     totalSolved = quiz responses submitted by student
     notSolved   = totalQuestions - totalSolved

   Part 2 — Teacher MCQ Score (10 pts, MANUAL):
     Class teacher inputs 0-10 per student
     This is the ONLY manual input in the entire system

C. LEARNING SPEED (20 points, AUTO):
   ((correct - incorrect - missed) / totalQuestions) × 20
   correct   = isCorrect = true
   incorrect = isCorrect = false
   missed    = questions never attempted
```

### Scatter Plot Quadrants

```
  Y-axis (Potential): -40 to +80, midpoint = 20
  X-axis (Performance): -100 to +100, midpoint = 0

  X > 0 AND Y > 20 = Star Performer
  X < 0 AND Y > 20 = High Potential Learner (Rising Stars)
  X > 0 AND Y < 20 = Coasting
  X < 0 AND Y < 20 = Needs Support
```

### Scatter Plot Dot Colors

| Status                   | Dot Color                                  | Counted in Quadrants | Tooltip                                    |
| ------------------------ | ------------------------------------------ | -------------------- | ------------------------------------------ |
| `COMPLETED`              | Colored (green/blue/amber/red by quadrant) | Yes                  | Full score breakdown                       |
| `PENDING_TEACHER_REVIEW` | Colored (same as COMPLETED)                | Yes                  | Score breakdown + "(Pending verification)" |
| `NO_DATA`                | Grey                                       | No                   | "No calculation data yet"                  |

- NO_DATA students positioned at chart center (0, 20)
- Empty overlay shown only when ALL students are NO_DATA
- Class average dot shown only when at least one student has data (not NO_DATA)
- Quadrant counts exclude NO_DATA students
- When all counts are 0: "Counts will appear after calculation is verified"

### Analytics Query Behavior (Single Source of Truth)

- **Both scatter plot AND student detail view** read from `potentialmetric` table
- Scatter plot: `GET /analytics/performance-potential` → reads potentialmetric per student
- Student detail (Prepare Graph): `GET /student/:id/performance` → reads SAME potentialmetric
- This ensures numbers match everywhere (no separate live calculation)
- Fallback: if no potentialmetric exists, falls back to live `calculateStudentMetrics()` from analyticsHelper
- Matches by **session name only** — no year filter (picks most recent year via `orderBy: sessionYear desc`)
- Session dropdown values: "1st Session", "2nd Session", etc. (capitalized, matching stored data)
- For PENDING records: potential = `effortTotal + curiosityQuiz + learningSpeed` (partial, without MCQ)
- Class teacher sees PENDING + COMPLETED data; subject teachers see COMPLETED only
- API response includes `counts` (starPerformer/risingStars/consistent/needsSupport/noData) + `classAvg`
- Dropdown changes trigger re-fetch via `useEffect` watching `fetchAnalytics`

### Data Snapshot Logic

- ALL data is **frozen at the moment admin clicks Run Calculation**
- `snapshotAt` timestamp stored on `schoolexampublish.calculationSnapshotAt`
- All queries use `createdAt <= snapshotAt` to collect data
- After snapshot: new assignments/materials/attendance belong to NEXT session

---

## 10. Session Analytics Verification (Class Teacher)

After admin runs calculation, class teacher must verify scores and fill in Curiosity MCQ.

### Flow:

```
Admin clicks "Run Calculation"
         ↓
potentialmetric records created (status: PENDING_TEACHER_REVIEW)
         ↓
Class teacher notified: "Please verify and fill Curiosity MCQ"
         ↓
Teacher opens Analytics tab → sees verification panel
         ↓
Per student: review auto-calculated scores (read-only)
             fill in Curiosity MCQ score (0-10)
         ↓
Save → curiosityTotal, potentialTotal calculated, status → COMPLETED
         ↓
Graphs visible to parents + subject teachers
```

### Verification Panel (per student):

```
AUTO-CALCULATED (read-only):
  Performance: Exam +6.5, Assignment +21, Attendance +8.5 = +36
  Effort: Assignment 6.7, Materials -10 = -3.3
  Curiosity Quiz: 13.3
  Learning Speed: 3.7

TEACHER INPUT:
  Curiosity MCQ (0-10): [____]

TOTALS (after MCQ input):
  Potential: -3.3 + 13.3 + [MCQ] + 3.7
  Performance: +36
```

### APIs:

- **Save MCQ scores:** `PATCH /api/teacher/dashboard/session-curiosity`
  ```json
  Body: { "session": "1st Session", "year": 2026, "studentScores": [{ "studentId": 1, "mcqScore": 7 }] }
  ```
- **Get analytics data:** `GET /api/teacher/dashboard/session-analytics?session=&year=&classId=`
- **Mark session done:** `POST /api/teacher/dashboard/class/:classId/done`

---

## 11. SWOT Feedback System

- Parents request SWOT for their child
- Teacher submits: Strength, Weakness, Opportunity, Threat, Suggestion
- APIs: `GET /feedback/requests`, `POST /feedback/submit`, `GET /feedback/history`

---

## 12. Complaint System

- Teacher sends complaint to parent → `teachermessage` record + email
- APIs: `POST /send-complaint`, `GET /students-with-parents`

---

## 13. Notifications

Types received: `RESULT_PUBLISHED`, `SESSION_STARTED`, `SESSION_ADVANCE`, `SYSTEM_NOTICE`, `INFO`

After Run Calculation, class teachers receive:

```
"Calculation complete for {terminal}. Please verify student analytics
 and fill in Curiosity MCQ scores to finalize potential ratings."
```

---

## 14. Session Awareness

- Assignment creation auto-tags with `sessionYear`
- Analytics scatter uses pre-calculated potentialmetric data per session
- Session filter (1st–4th) on scatter plot
- `SESSION_STARTED` notification sent to all teachers when admin starts session

---

## 15. Class Teacher Privileges

| Feature                      | Regular Teacher      | Class Teacher           |
| ---------------------------- | -------------------- | ----------------------- |
| Overview                     | Yes                  | Yes                     |
| Assignments                  | Yes                  | Yes                     |
| Study Materials              | Yes                  | Yes                     |
| Attendance                   | No                   | **Yes**                 |
| Approvals                    | No                   | **Yes**                 |
| Reports / Exams              | No                   | **Yes**                 |
| Submit Class Result          | No                   | **Yes**                 |
| Mark Session Done            | No                   | **Yes**                 |
| **Fill Curiosity MCQ**       | No                   | **Yes**                 |
| **Verify Session Analytics** | No                   | **Yes**                 |
| SWOT Feedback                | Yes                  | Yes                     |
| View Scatter Plot            | Yes (COMPLETED only) | **Yes (incl. PENDING)** |

---

## 16. Graph Visibility Rules

| Role            | Sees Whose Data                  | Status Required                        |
| --------------- | -------------------------------- | -------------------------------------- |
| Admin           | All students                     | COMPLETED                              |
| Class Teacher   | Their class                      | **PENDING_TEACHER_REVIEW + COMPLETED** |
| Subject Teacher | Students in their assigned class | COMPLETED only                         |
| Parent          | Their child only                 | COMPLETED only                         |

If `PENDING_TEACHER_REVIEW`:

- Only class teacher sees (to fill MCQ)
- Admin can also see (read-only)
- Parents and subject teachers see: "Scores are being verified"

After class teacher marks complete → status = `COMPLETED` → visible to all.

---

## 17. Session Banner

A slim banner displayed at the top of the teacher dashboard, above all tabs.
Uses shared `SessionBanner` component (`frontend/src/components/ui/SessionBanner.jsx`).

| State    | Display                       |
| -------- | ----------------------------- | ------------------------------------- | ------- |
| Active   | Green: `🟢 2nd Session — 2026 | 2nd Term                              | Active` |
| Inactive | Amber: `🔴 No Active Session  | Contact admin to start a new session` |
| Loading  | Shimmer skeleton placeholder  |

Data source: `GET /api/teacher/dashboard/profile` → `data.activeSession`

---

## 18. Assignment Table (Improved)

The teacher assignment list is now a **proper table** with columns:

| Column      | Description                                                       |
| ----------- | ----------------------------------------------------------------- |
| Status      | Green dot (active), red dot (overdue), grey dot (closed)          |
| Title       | Assignment name + "Closed" badge if applicable                    |
| Class       | Indigo pill badge showing class (e.g., "10A") from `Renamedclass` |
| Subject     | Subject name                                                      |
| Due Date    | Date, red text if overdue                                         |
| Submissions | Count                                                             |
| Action      | "View" button to open submissions                                 |

**Filters** (Subject, Class, Due Date) now work correctly using `Renamedclass` field.

---

## 19. Frontend Components

| File                          | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| `TeacherDashboard.jsx`        | Main container, all tabs, analytics (~3,450 lines) |
| `AssignmentPortal.jsx`        | Assignment create/manage/grade                     |
| `TeacherReport.jsx`           | Exam marks entry + submission                      |
| `AttendancePage.jsx`          | Daily attendance marking                           |
| `AttendanceHistoryView.jsx`   | Monthly attendance history                         |
| `AttendanceWidget.jsx`        | Attendance overview card                           |
| `StudentAnalysisView.jsx`     | Per-student SWOT + analytics verification          |
| `StudentPerformanceGraph.jsx` | Standalone scatter plot page                       |
| `ClassTrendlineView.jsx`      | Class performance over sessions                    |
| `MatrixChart.jsx`             | Workload vs performance chart                      |
| `TrendlinePage.jsx`           | Standalone trendline page                          |

---

## 20. API Reference (All Teacher Endpoints)

### Dashboard Routes — `/api/teacher/dashboard/*`

| Method    | Endpoint                                  | Description                                       |
| --------- | ----------------------------------------- | ------------------------------------------------- |
| GET       | `/overview`                               | Overview stats                                    |
| GET       | `/profile`                                | Profile info                                      |
| GET       | `/classes`                                | Assigned classes                                  |
| GET       | `/class/:classId/students`                | Students in class                                 |
| GET       | `/class/:classId/all-students`            | All students (inc. unapproved)                    |
| GET       | `/class/:classId/session-report`          | Class session report                              |
| POST      | `/class/:classId/done`                    | Mark session done (triggers graph visibility)     |
| GET       | `/student/:studentId/session-report`      | Student session report                            |
| GET       | `/student/:studentId/monthly-performance` | Monthly performance                               |
| GET       | `/student/:studentId/performance`         | Performance data                                  |
| GET       | `/student/:studentId/terminals`           | Published terminals                               |
| GET       | `/student/:studentId/terminal-marks`      | Terminal marks                                    |
| POST      | `/student/:studentId/potential`           | Update potential (legacy)                         |
| GET       | `/student/approvals`                      | Pending approvals                                 |
| POST      | `/student/approval/:studentId`            | Approve/reject                                    |
| GET       | `/exam-marks/query`                       | Query marks                                       |
| POST      | `/exam-marks`                             | Enter marks                                       |
| POST      | `/submit-subject-marks`                   | Submit subject to admin                           |
| POST      | `/submit-class-result`                    | Submit class to admin                             |
| GET       | `/notifications/unread-exam-count`        | Unread exam count                                 |
| POST      | `/notifications/read-exams`               | Mark exam read                                    |
| GET       | `/notifications`                          | All notifications                                 |
| POST      | `/notifications/mark-read`                | Mark all read                                     |
| GET       | `/feedback/requests`                      | SWOT requests                                     |
| POST      | `/feedback/submit`                        | Submit SWOT                                       |
| GET       | `/feedback/history`                       | Feedback history                                  |
| **PATCH** | **`/session-curiosity`**                  | **Save Curiosity MCQ scores (0-10 per student)**  |
| **GET**   | **`/session-analytics`**                  | **Get pre-calculated analytics for verification** |
| GET       | `/analytics/performance-potential`        | Scatter plot data (reads potentialmetric)         |
| GET       | `/analytics/trendline`                    | Trendline data                                    |
| GET       | `/students-with-parents`                  | Students + parents                                |
| POST      | `/send-complaint`                         | Complaint to parent                               |

### Assignment Routes — `/api/assignments/*`

| Method | Endpoint            | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| POST   | `/create`           | Create (auto-sets sessionYear)               |
| GET    | `/teacher-options`  | Classes + subjects                           |
| GET    | `/teacher`          | Teacher's assignments (sessionYear filtered) |
| GET    | `/student`          | Student's assignments (sessionYear filtered) |
| POST   | `/submit`           | Student submits                              |
| POST   | `/grade`            | Teacher grades                               |
| PATCH  | `/:id/toggle-close` | Open/close                                   |

### Attendance Routes — `/api/attendance/*`

| Method | Endpoint             | Description            |
| ------ | -------------------- | ---------------------- |
| GET    | `/classes`           | Classes for attendance |
| GET    | `/students/:classId` | Students in class      |
| GET    | `/history/:classId`  | History                |
| POST   | `/save`              | Save records           |

### Study Material Routes — `/api/materials/*`

| Method | Endpoint         | Description               |
| ------ | ---------------- | ------------------------- |
| POST   | `/create`        | Upload (Cloudinary/local) |
| GET    | `/teacher`       | Teacher's materials       |
| GET    | `/student`       | Student's materials       |
| POST   | `/progress`      | Update progress           |
| GET    | `/analytics/:id` | Material analytics        |
| POST   | `/quiz/submit`   | Submit quiz answer        |
| GET    | `/quiz/history`  | Quiz history              |
| POST   | `/quiz/feedback` | Quiz feedback             |
| DELETE | `/:id`           | Delete material           |

---

> **Testing:** `teacher_math / Demo@1234` (school code: SS01)
> **Seed:** 5 teachers (teacher_math, teacher_science, teacher_english, teacher_cs, teacher_hindi)
