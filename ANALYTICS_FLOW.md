# Performance vs Potential — Complete Analytics Flow

## Overview

The Performance vs Potential scatter plot is the core analytics feature of School Space. It plots each student on a 2D graph where:
- **X-axis (Performance):** How well the student is doing academically (exam + assignment + attendance)
- **Y-axis (Potential):** How much effort and engagement the student shows (effort + curiosity + learning speed)

Students fall into 4 quadrants:
- **Star Performers** (high perf + high pot): excelling and engaged
- **Rising Stars** (low perf + high pot): struggling but trying hard
- **Coasting** (high perf + low pot): doing well but not putting in effort
- **Needs Support** (low perf + low pot): struggling and disengaged

---

## Formulas (from PDF specification)

### Performance (X-axis)

| Component | Weight | Formula | Range |
|-----------|--------|---------|-------|
| Exam Marks | 50% | `(avgExamPct - 50) * 0.5` | ±25 |
| Assignment Grade | 30% | `sum(each_grade - 50) * 0.3` | variable |
| Attendance | 20% | `((present - absent) / totalDays) * 20` | ±20 |

**Performance Total** = examScore + assignmentScore + attendanceScore

### Potential (Y-axis)

| Component | Points | Formula | Range |
|-----------|--------|---------|-------|
| Effort: Assignment Submission | 20 | `((onTime - late - missed) / total) * 20` | ±20 |
| Effort: Timely Materials | 20 | `((onTimeWatched - lateWatched) / total) * 20` | ±20 |
| Curiosity: Quiz Questions | 30 | `((solved - notSolved) / totalQuestions) * 30` | ±30 |
| Curiosity: Teacher MCQ | 10 | Manual teacher input (0-10) | 0-10 |
| Learning Speed | 20 | `((correct - incorrect - missed) / totalQuestions) * 20` | ±20 |

**Potential Total** = effortTotal + curiosityTotal + learningSpeed

### Implementation Files

| File | Purpose |
|------|---------|
| `backend/src/utils/performanceCalculator.js` | Performance formulas (single source of truth) |
| `backend/src/utils/potentialCalculator.js` | Potential formulas (single source of truth) |
| `backend/src/controllers/teacher/analyticsHelper.js` | Orchestrator: fetches data + calls calculators |
| `backend/src/controllers/teacher/performanceHelper.js` | Stores to potentialmetric during finalizeSessionAssignments |
| `backend/src/controllers/admin/dashboard.js` | Admin run-calculation endpoint |

---

## Phase 1: Data Collection (ongoing during session)

During an active session, teachers and students generate the raw data that feeds the graph.

### Teacher Actions → Feed Performance

| Action | API | Feeds |
|--------|-----|-------|
| Enter exam marks | Reports tab | `examScore` (50% weight) |
| Grade assignments | Assignments tab | `assignmentScore` (30% weight) |
| Mark daily attendance | Attendance tab | `attendanceScore` (20% weight) |

### Student Actions → Feed Potential

| Action | Feeds |
|--------|-------|
| Submit assignments on time / late / miss deadline | `effortAssignment` (20 pts) |
| Watch study materials before / after deadline | `effortMaterials` (20 pts) |
| Solve quiz questions after watching materials | `curiosityQuiz` (30 pts) |
| Get correct answers on quizzes | `learningSpeed` (20 pts) |

### Who Sees What

- **Class teacher:** LIVE scatter plot (recalculates on every page load)
- **Subject teacher:** LIVE scatter plot (only their classes)
- **Student:** No graph access
- **Parent:** No data yet (waits for teacher verification)

### APIs Used

- `GET /api/teacher/dashboard/analytics/performance-potential?session=X&classId=Y` — live scatter plot
- `GET /api/teacher/dashboard/student/:id/performance` — individual student drill-down

Both endpoints call `calculateStudentMetrics()` from `analyticsHelper.js`, which calls `performanceCalculator` + `potentialCalculator` for the math.

---

## Phase 2: Admin Publishes Results

**Prerequisite:** All teachers must have submitted exam marks, and class teachers must have submitted their class results.

Admin → Session Management → **Publish Result** (e.g. "1st Term")

- Grade sheets emailed to parents (Nepal NEB format)
- This **unlocks** the "Run Calculation" button for that session

### API

- `POST /api/admin/run-calculation` becomes available after publish

---

## Phase 3: Admin Runs Calculation (snapshot + freeze)

Admin clicks **"Run Calculation"** for the session.

### What Happens

1. `snapshotAt = NOW()` — freezes the data boundary
2. For **every student** in the school:
   - Collects all exam/assignment/attendance/material/quiz data up to snapshot
   - Runs `performanceCalculator.calculatePerformance()` → stores exam, assignment, attendance, performanceTotal
   - Runs `potentialCalculator.calculatePotential()` → stores effort, curiosityQuiz, learningSpeed
   - `curiosityMcq = NULL` (teacher fills later)
   - `potentialTotal = NULL` (calculated after MCQ)
   - `status = 'PENDING_TEACHER_REVIEW'`
3. Writes to `potentialmetric` table (one row per student per session)
4. **DATA IS FROZEN** — any new data after snapshotAt belongs to the next session
5. Notifies class teachers to verify

### API

```
POST /api/admin/run-calculation
Body: { examTerminal: "1st Term" }
```

### Who Sees What

- **Class teacher:** Frozen scatter plot + verification panel with MCQ input
- **Subject teacher:** Cannot see yet (status ≠ COMPLETED)
- **Parent:** Cannot see yet (status ≠ COMPLETED)

---

## Phase 4: Class Teacher Verifies + Fills MCQ

Class teacher opens the **Analytics** tab, clicks on a student dot, goes to the **Potential** tab.

### What They Do

1. **Review** auto-calculated scores (read-only): exam, assignment, attendance, effort, curiosityQuiz, learningSpeed
2. **Fill in** Curiosity MCQ score (0-10) per student using the "Run MCQ Evaluator" (6-question evaluation)
3. Click **"Save Curiosity"**

### What Happens on Save

```
curiosityTotal = curiosityQuiz + curiosityMcq
potentialTotal = effortTotal + curiosityTotal + learningSpeed
status → 'COMPLETED'
```

### API

```
PATCH /api/teacher/dashboard/session-curiosity
Body: { session: "1st Session", year: 2026, studentScores: [{ studentId: 1, mcqScore: 8 }, ...] }
```

### Who Sees What Now

| Role | Access |
|------|--------|
| **Class teacher** | Full scatter plot + individual drill-down |
| **Subject teachers** | Scatter plot for their classes only |
| **Parents** | Child's position on graph + full breakdown + trendlines |
| **Students** | No direct graph access |

---

## Phase 5: Everyone Views the Data

### Teacher Dashboard (Analytics tab)

- **Scatter plot:** All students in their classes plotted by (performance, potential)
- **Filters:** Class dropdown, Session dropdown
- **Click dot →** Individual student analysis with Performance + Potential tabs
- **Quadrant counts:** Star Performers, Rising Stars, Coasting, Needs Support
- **Class average crosshair** plotted on the graph

| API | Purpose |
|-----|---------|
| `GET /api/teacher/dashboard/analytics/performance-potential` | Scatter plot data for all students |
| `GET /api/teacher/dashboard/student/:id/performance` | Individual student breakdown |
| `GET /api/teacher/dashboard/session-analytics` | Session analytics for verification |
| `GET /api/teacher/dashboard/analytics/trendline` | Performance/potential across sessions |

### Parent Dashboard (Overview tab)

- **Scatter plot:** Child's position only (single dot)
- **Quadrant label:** Star Performer / High Potential Learner / Coasting / Needs Support
- **Breakdown cards:** Exam, Assignment, Attendance, Effort, Curiosity, Learning Speed
- **Trendlines:** Performance + Potential across sessions (history from potentialmetric)
- **Multi-child:** Switcher to view each child separately

| API | Purpose |
|-----|---------|
| `GET /api/parent/dashboard/children/performance` | All children's analytics + trendlines |

### Admin Dashboard

- **No Performance vs Potential scatter plot** on admin dashboard
- Admin controls the lifecycle: Publish Result → Run Calculation → (teacher verifies) → done
- Admin can view exam submission status and manage sessions

---

## Phase 6: Session Rolls Forward

### Session Data Boundaries

```
Session 1 data:  [session start] ──────────── [Admin runs calc for Session 1]
Session 2 data:  [Session 1 snapshotAt] ────── [Admin runs calc for Session 2]
Session 3 data:  [Session 2 snapshotAt] ────── [Admin runs calc for Session 3]
Session 4 data:  [Session 3 snapshotAt] ────── [Admin runs calc for Session 4]
```

### When Next Session Calc Runs

- Previous session data → moves to **trendline history**
- New session data → becomes the **active view**
- Graphs show current session; trendlines show all past sessions

### 4th Session Special Rules

| Student Status | What Happens |
|---------------|-------------|
| Class 1-9, PASS | Auto-promoted to next class |
| Class 1-9, FAIL | PENDING — manual review by teacher/admin (Promote or Retain) |
| Class 10, PASS | Auto-graduated (school completion) |

### Data Reset on Promotion

| Data | PROMOTED | RETAINED | GRADUATED |
|------|----------|----------|-----------|
| Assignments | DELETED | Filtered by sessionYear | KEPT |
| Materials | DELETED | KEPT | KEPT |
| Quizzes | DELETED | KEPT | KEPT |
| Attendance | DELETED | KEPT | KEPT |
| Exam Marks | **KEPT** | KEPT | KEPT |
| SWOT Feedback | KEPT | KEPT | KEPT |
| Ratings | KEPT | KEPT | KEPT |
| Parent Links | KEPT | KEPT | KEPT |

---

## Visibility Rules Summary

| State | Class Teacher | Subject Teacher | Parent | Student |
|-------|:---:|:---:|:---:|:---:|
| Before Run Calc | LIVE graph | LIVE graph | No data | No access |
| After Run Calc (PENDING) | Frozen + can edit MCQ | No data | No data | No access |
| After Teacher Verify (COMPLETED) | Frozen graph | Frozen graph (their classes) | Child's graph + breakdown | No access |
| Next session calc runs | New live data | New live data | Previous → trendline | No access |

---

## Database: potentialmetric Table

| Field | Type | Description |
|-------|------|-------------|
| studentId | Int | Student reference |
| session | String | "1st Session", "2nd Session", etc. |
| sessionYear | Int | 2026, 2027, etc. |
| terminal | String? | "1st Term", "2nd Term", etc. |
| snapshotAt | DateTime? | When admin ran calculation |
| examScore | Float? | (examPct - 50) * 0.5 |
| assignmentScore | Float? | sum(grade - 50) * 0.3 |
| attendanceScore | Float? | ((P-A)/days) * 20 |
| performanceTotal | Float? | Sum of above 3 |
| effortAssignment | Float? | ((onTime-late-missed)/total) * 20 |
| effortMaterials | Float? | ((onTimeWatched-lateWatched)/total) * 20 |
| effortTotal | Float? | Assignment + Materials effort |
| curiosityQuiz | Float? | ((solved-notSolved)/total) * 30 |
| curiosityMcq | Float? | Teacher input 0-10 |
| curiosityTotal | Float? | Quiz + MCQ (set after teacher input) |
| learningSpeed | Float? | ((correct-incorrect-missed)/total) * 20 |
| potentialTotal | Float? | Effort + Curiosity + LearningSpeed (set after MCQ) |
| status | String | PENDING_TEACHER_REVIEW → COMPLETED |

**Unique constraint:** `(studentId, session, sessionYear)` — one record per student per session per year.

---

## API Reference

### Data Input (Teacher/Student actions)

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| POST | `/api/attendance/save` | TEACHER | Mark attendance → feeds attendanceScore |
| POST | `/api/assignments/grade` | TEACHER | Grade submission → feeds assignmentScore |
| POST | `/api/assignments/submit` | STUDENT | Submit assignment → feeds effortAssignment |
| POST | `/api/materials/create` | TEACHER | Create material → changes effort denominator |

### Calculation & Verification

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| POST | `/api/admin/run-calculation` | ADMIN | Snapshot + freeze + calculate all students |
| PATCH | `/api/teacher/dashboard/session-curiosity` | TEACHER | Fill MCQ scores → complete potentialTotal |

### Graph Read

| Method | Route | Role | Returns |
|--------|-------|------|---------|
| GET | `/api/teacher/dashboard/analytics/performance-potential` | TEACHER | Scatter plot data (all students, rounded integers) |
| GET | `/api/teacher/dashboard/student/:id/performance` | TEACHER | Individual student full breakdown |
| GET | `/api/teacher/dashboard/session-analytics` | TEACHER | Pre-calculated metrics for verification |
| GET | `/api/teacher/dashboard/analytics/trendline` | TEACHER | Historical performance/potential across sessions |
| GET | `/api/parent/dashboard/children/performance` | PARENT | Children's analytics + trendlines |

### Data Consistency

All graph endpoints use the same calculation pipeline:
1. `analyticsHelper.calculateStudentMetrics()` orchestrates data fetching
2. `performanceCalculator.calculatePerformance()` computes exam + assignment + attendance
3. `potentialCalculator.calculatePotential()` computes effort + curiosity + learningSpeed
4. If `potentialmetric` exists and session is finalized → uses stored (frozen) values
5. If not → calculates live from current database state

Teacher scatter plot, individual student view, and parent dashboard all return **identical values** for the same student.
