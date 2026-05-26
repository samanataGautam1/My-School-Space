# School Space — Complete System Flow & Feature Documentation

# Last Updated: 2026-04-11 (Session 10)

================================================================================
PROJECT OVERVIEW
================================================================================

Name: School Space
Type: Multi-tenant School Management System (SaaS)
Target: Nepal Education System (NEB Grading Standard)
Stack: React 19 + Vite (Frontend) | Node.js + Express + Prisma + MySQL (Backend)
Frontend: http://localhost:3000
Backend: http://localhost:8080
Entry: backend/index.js → backend/src/server.js

================================================================================
USER ROLES (4 Roles)
================================================================================

1. ADMIN — School owner. Manages everything.
2. TEACHER — Subject teacher or class head. Marks, attendance, materials.
3. STUDENT — Views assignments, submits work, watches materials, takes quizzes.
4. PARENT — Views child's performance, results, assignments, communicates with admin.

================================================================================
AUTHENTICATION SYSTEM
================================================================================

## Registration Flow

- Admin: Creates school + gets school code (e.g., SS01). Gmail only. Email OTP.
- Teacher: Signs up with school code → status PENDING → admin approves.
- Student: Signs up with school code → auto-assigned to class. Class head approves.
- Parent: Signs up with student codes → linked to children.

## Login

- Username OR email + School Code + Password
- School code ownership validated before password check
- JWT token (7 day expiry) stored in localStorage
- Account lockout: 5 failed attempts → 15 min lock

## Password Reset

- Admin: resets directly (no approval needed)
- Others: submit request → admin approves/rejects → reset code sent
- Dev mode (NODE_ENV=development): auto-approves requests + returns reset code in response
- Email send failures do not crash the request (graceful fallback)

## School Code Recovery

- Admin: code emailed directly
- Others: request sent to admin for approval

## Email Verification

- 5-digit OTP via Nodemailer (per-school SMTP)
- 5-minute expiry, resend available

================================================================================
ADMIN DASHBOARD — FEATURES
================================================================================

## Sidebar Navigation

CORE:

- Dashboard (overview)
- Class Management
- Staff & Faculty
- Student Records
  INSIGHTS:
- Teacher Performance (ratings)
- Examinations & Result
- Class Promotion
  SYSTEM:
- Session Management ← NEW (2026-04-09)
- Configuration (settings)

---

### 1. Dashboard (Overview)

- Stat cards: Faculty count, Students, Parents, Classes
- Top Performing Faculty (by student ratings, filterable by session/year)
  - Session filter includes ALL + 1st/2nd/3rd/4th Session
  - Year filter (2024–2027)
- Student Enrollment pie chart (by class)
  - Smooth ease-in-out animation on initial load (1200ms)
  - Re-animates on data change (always active via recharts props)
- Broadcast Notice button → sends notification to all parents/students
- Pending Teacher Approvals alert

### 2. Class Management

**Overview Table:**

- Lists all classes with: Division, Section, Students, Parents, Teachers
- Search by class/subject/teacher name
- "Show Detail" → opens ClassroomEngineDetail
- Delete class (with confirmation)

**Configure New Class (addClass view):**

- Create class: name (e.g., "10") + section (e.g., "A")
- Active Classes grid showing stats per class

**Classroom Engine Detail:**

- 3 tabs: Students, Parents, Teachers
- Students tab: table with name, code, status
- Parents tab: parent name, child name, email
- Teachers tab: cards with subjects, actions:
  - Set as Head / Remove as Head
  - Move (to another class + subject)
  - Remove (from this class)
  - Delete from System (permanent, with confirmation modal)

### 3. Staff & Faculty (TeacherManagement)

- List all teachers: name, email, subjects, classes, status
- Approve/Reject pending teachers
- Edit teacher: name, email, class assignment
- Delete teacher (with confirmation)
- Badge shows pending approval count

### 4. Student Records (StudentManagement)

- List all students: code, name, class, username, email
- Search by name, filter by class
- Edit student: name, roll number, email
- Delete student (with confirmation modal)

### 5. Teacher Performance (Reviews)

- View all teacher ratings by students
- Filter by session (1st/2nd/3rd/4th) and year
- Shows: teacher name, average rating, review text, subject, class
- Ratings are anonymous from students

### 6. Examinations & Result

**Active Session + Terminal Bar:**

- Read-only session/year display (linked from Session Management tab)
- "Manage" link → navigates to Session Management tab
- Terminal selector (1st–4th Term) for browsing exam data
- Submission progress bar (X/Y classes submitted)

**Session ↔ Terminal Linking (1:1):**

- Each session maps to exactly one terminal:
  1st Session = 1st Term, 2nd Session = 2nd Term, etc.
- Changing terminal auto-syncs to corresponding session
- On page load, terminal auto-syncs from school's active session
- Terminal Status card clicks also sync the session

**CORRECT Exam Flow (Publish first, then Calculate):**

```
Teachers Submit Marks
      ↓
Step 1: PUBLISH RESULT
  - Enabled when at least one class has submitted marks
  - Makes results official, emails grade sheets to all parents
  - Creates notifications for parents + teachers
  - On 4th Term: auto-promotes passed students, graduates Class 10
  - Button: "Publish Result" → "Published (Republish)"
      ↓
Step 2: RUN CALCULATION
  - Enabled ONLY after result is published
  - Disabled state shows "Publish Results First"
  - Processes marks, aggregates performance metrics
  - Finalizes session assignments (penalty for missed)
  - Auto-advances school to next session
  - Backend guard: rejects if status ≠ PUBLISHED
  - Button: "Run Calculation" → "Calculated"
      ↓
Results visible to students and parents
```

**Terminal Status Overview:**

- 4 buttons showing each term's status (Published/Calculated/Submitted/No Data)
- Clicking a terminal syncs both the terminal and session selectors

**Submission Details Table:**

- Class, Terminal, Subjects count, Submitted By, Date
- Click to view class results modal (marks, grades, pass/fail per student)

**Published Results History:**

- Terminal, Status, Classes, Students, Avg %, Pass/Fail, Published date

### 7. Session Management ← NEW (2026-04-09)

Dedicated tab for the complete session lifecycle. Replaces the session/year
selectors that were previously embedded in the Examinations tab.

**Active Session Status Card:**

- Prominent display: session name, year, terminal, teacher count
- Green "Active" badge with pulse animation when session is running
- "No session active" state when no session is configured
- "End Session" button (red) when active
- "Start New Session" button when inactive

**Quick Actions (3 cards):**

1. Start Session — opens Start Session modal
2. End Session — opens End Session modal (disabled when no active session)
3. End & Advance — opens the advance-session modal with promotion preview

**Start Session Modal:**

- Session picker: 4 toggle buttons (1st–4th Session)
- Year input: numeric field
- Live preview: shows selected session + year + corresponding terminal
- Typed confirmation: user must type "START SESSION" to enable confirm button
- On 1st Session start: resets all non-graduated student promotion statuses to NONE
- Creates SESSION_STARTED notification visible to all users

**End Session Modal:**

- Shows current session being ended
- Warning: what will happen (lock records, disable ratings, finalize completion)
- Typed confirmation: user must type their SCHOOL NAME to confirm
- Creates sessioncompletion records for all classes × teachers
- Disables teacher performance ratings
- Creates SESSION_ADVANCE notification

**Session History:**

- Timeline of completed sessions with status badges:
  - Published (exam results published)
  - Calculated (metrics finalized)
  - Completed (session ended, no exam data)
- Completion date for each session
- Auto-loads when tab opens; Refresh button available

**End Session & Advance (Modal — accessed from Quick Actions):**

- Preview what will happen: lock session, disable ratings, run promotions
- On 4th Session — special rules:
  - Class 10: ALL students auto-graduated (no exam required for 4th session)
  - Class 1–9: normal promotion logic (pass=promote, fail=pending review)
  - BLOCKED until all Class 1–9 teacher submissions are received
  - Class 10 is EXEMPT from the submission check
  - Preview modal shows:
    - Class 10 auto-graduation count (separate indigo card)
    - Class 1–9 promotion breakdown (will promote / will fail / no results)
    - Missing submissions list (e.g., "Missing: 9A, 9B")
  - "Confirm & Advance" button disabled when Class 1–9 submissions incomplete
    - Shows "Submissions Incomplete" as button text
- On Sessions 1–3: standard advance (lock + notify)

**Backend Endpoints:**

- POST /api/admin/start-session — validates session/year/confirmation, updates school
- POST /api/admin/end-session — validates school name confirmation, creates completions
- GET /api/admin/session-history — lists completed sessions with exam status

### 8. Class Promotion System

**Gated on Result Publish:**

- ALL promotion action buttons (Promote, Retain, Graduate, Run Auto-Promotion)
  are DISABLED until the latest terminal result is PUBLISHED
- Disabled state:
  - Individual buttons show "Publish results first" text
  - "Run Auto-Promotion" button shows "Publish Results First"
  - Tooltip: "Publish results before taking promotion actions"
- Backend guard: promotion endpoints reject with
  { error: "Results must be published before promotion" } if no published result

**Summary Cards:**

- Total, Promoted, Retained, Pending Review, Not Processed, Graduated

**Filterable Table:**

- Search by name, filter by class, filter by status
- Per-student row: name, code, roll, current class, next class, result, %, status, action

**Per-student Actions:**

- Promote: moves student to next class (confirmation modal with student info)
- Retain: keeps student in same class
- Graduate: for Class 10 students only
- All actions require result to be published first (frontend + backend enforced)

**Promotion Confirmation Modals:**

- Show student info card: name, code, current class, result, score
- Action description explaining what will happen
- Confirm / Cancel buttons

**Bulk Auto-Promotion:**

- "Run Auto-Promotion" button processes all students with NONE status
- Only available after 4th Term results are published
- Logic:
  ```
  Class 1-9 PASS  → Promoted to next class (name+1, same section)
  Class 10 PASS   → GRADUATED (school completion)
  Any class FAIL  → PENDING (sent for manual review)
  No results      → SKIPPED
  ```

**Data Reset on Promotion (IMPORTANT):**
When a student is PROMOTED to the next class, the following data is DELETED:

- Assignment submissions (for old class assignments)
- Study material progress (studentmaterialstatus — all records)
- Quiz responses (quizresponse — all records)
- Attendance records (all records)

The following data is KEPT (historical record):

- Student profile (name, code, email, roll number)
- Exam marks (all terminals)
- SWOT feedback records
- Ratings given by student
- Parent linkage
- Enrollment records

This reset applies to:

- Manual promote (/promotions/:studentId/promote)
- Bulk promote (/promotions/bulk)
- Auto-promote during session advance (/advance-session on 4th session)

**GRADUATION (Class 10 students):**

- Data is NOT reset — graduate = school complete, keep full record
- Student marked as GRADUATED
- Kept in class enrollment (historical)
- All historical data preserved

**Nepal School System:**

- Classes 1–10. Class 10 is the final class.
- Graduation history tracked via GET /api/admin/graduations

### 9. Configuration (Settings)

**School Identity:**

- Edit: name, email, phone, address (with diff confirmation modal)
- School code: read-only
- Administrator info with verified badge

**System Preferences:**

- Teacher Performance Ratings toggle (with session selector modal)
- Parent Messaging toggle
- Save Configuration button

### 10. Messaging System (ChatInterface)

- Parent sends message → status PENDING
- Admin: Accept, Reject, Delete, Reply
- Conversation thread view
- Image attachments: base64 embedded in message body (no file uploads)
  - Images only (PNG, JPEG, GIF, WebP), max 500KB per image
  - Stored in MEDIUMTEXT body column (supports up to 16MB)

### 11. Notifications

- Bell icon with unread count
- Types: INFO, RESULT_PUBLISHED, PROMOTION, GRADUATION, SESSION_STARTED,
  SESSION_ADVANCE, ADMIN_NOTICE, SYSTEM_NOTICE
- Auto-marks as read when opened
- Broadcast notice to all parents/students

================================================================================
TEACHER DASHBOARD — FEATURES
================================================================================

## Tabs

- Overview, Assignments, Study Materials, Attendance, Exams, Analytics

### 1. Overview

- Classes, subjects, pending approvals count
- Student approval (for class head): approve/reject pending registrations
- For failed students: PROMOTE_FAIL or STAY_FAIL actions

### 2. Assignments

- Create assignment: title, description, class, subject, file upload (50MB)
- View submissions per assignment
- Grade submissions with feedback
- Open/Close assignments

### 3. Study Materials

- Upload videos (500MB) with thumbnails
- Create in-video quiz questions (MCQ at specific timestamps)
- Track student progress on materials

### 4. Attendance

- Mark daily attendance per class (Present/Absent/Late)
- History view by month/year
- Voice recognition support for marking

### 5. Exams

- Enter marks per student per subject
- Theory + Practical components
- Nepal NEB pass/fail evaluation per subject
- Submit to admin for class-level review

### 6. Analytics (Performance vs Potential — New Formula System)

- Scatter plot: X-axis Performance (-100 to +100), Y-axis Potential (-40 to +80)
- Quadrants: Star Performer (X>0,Y>20), Rising Stars (X<0,Y>20), Coasting (X>0,Y<20), Needs Support (X<0,Y<20)
- Data is PRE-CALCULATED by admin's "Run Calculation" → stored in potentialmetric table
- Scores read from potentialmetric (not calculated live)
- Session filter: 1st–4th Session dropdown, matches by session name (no year filter)
- Dot colors: COMPLETED/PENDING = colored by quadrant, NO_DATA = grey at center (0,20)

Performance = Exam(50%) + Assignment(30%) + Attendance(20%)
  Exam: (avgExamPct - 50) × 0.5
  Assignment: sum(each grade - 50) × 0.3
  Attendance: ((present - absent) / activeDays) × 20

Potential = Effort(40) + Curiosity(40) + Learning Speed(20)
  Effort: assignment submission timeliness (20) + material watching timeliness (20)
  Curiosity: quiz completion (30, auto) + teacher MCQ (10, manual input 0-10)
  Learning Speed: ((correct - incorrect - missed) / totalQuestions) × 20

Teacher verification: class teacher fills Curiosity MCQ → status COMPLETED → visible to all
Student analysis view (Prepare Graph): reads same potentialmetric data as scatter plot
SWOT feedback creation per student
Complaint system → emails parents

================================================================================
STUDENT DASHBOARD — FEATURES
================================================================================

### 1. Overview

- Pending assignments, attendance summary, class info

### 2. Assignment Portal

- View assigned work, download files
- Submit assignments (file upload)
- View grades and feedback

### 3. Study Materials

- Watch video materials
- Take in-video quizzes (auto-pauses at timestamp)
- Quiz retake prevention: backend rejects duplicate attempts, frontend shows "Already Completed"
- Track progress (watched position, completion status)
- Quiz history with scores

### 4. Teacher Rating

- Rate teachers (1-5 stars) anonymously per subject
- Optional review text

### 5. Results

- View published terminal grade sheets
- Nepal NEB format: Subject, Theory, Practical, Total, Grade, GPA, Status
- Grade legend reference

### 6. Notifications

- In-app alerts for results, assignments, announcements

================================================================================
PARENT DASHBOARD — FEATURES
================================================================================

## Tabs (7)

- Notices, Overview, Attendance, Report, Tasks, Results, Chat

### 1. Notices

- Child's Quick Summary card: Performance, Potential, Attendance%, Submitted, Pending
- Notice list: Pinned (school), Result Published, Report Ready, Teacher Notice
- Color-coded icons and sub-messages

### 2. Overview

- Child info card (name, class, roll, code)
- Performance vs Potential scatter plot (parent-friendly version)
  - Colored quadrants: Star Performer, High Potential Learner, Coasting, Needs Support
  - Insight card explaining child's position in plain language
  - Score explanation cards

### 3. Attendance

- Summary cards: Total Days, Present, Absent, Late, Overall %
- Monthly breakdown with progress bars
- Daily records grid (color-coded squares)
- Legend: Present (green), Absent (red), Late (amber)

### 4. Report (SWOT)

- Academic Performance Portfolio: Generate Portfolio button
- Request SWOT Report via Email
- Evaluation History: list of SWOT reports
  - Each: name, date, verified badge, "View Full Report" button
  - Full report modal: Strength, Weakness, Opportunity, Threat, Suggestion
- Generate Portfolio: detailed report with
  - Assignment/Exam/Attendance component scores
  - Potential growth metrics (Learning Speed, Curiosity, etc.)
  - Growth quadrant visualization
  - Print as PDF

### 5. Tasks (Assignments)

- Summary: Total, Submitted, Pending, Overdue
- Assignment table: Title & Subject, Due Date, Status badge, Grade
- Status: GRADED (green), SUBMITTED (blue), PENDING (amber), OVERDUE (red), MISSED (red)

### 6. Results

- Terminal selector (1st Term, 2nd Term, etc.)
- Grade Sheet View (Nepal NEB format):
  - Student info, school info, terminal
  - Subject table: Theory, Practical, Total, Full, Pass, %, Grade, GPA, Status
  - Overall: Grand Total, Percentage, Grade, GPA, Final Status
  - Nepal NEB Grade Scale legend

### 7. Child Switcher

- Dropdown in header for multi-child parents
- Switching refreshes ALL tab data for the new child (setSelectedStudent + reset attendance)
- Shows: child name, avatar, "VIEWING" badge

### 8. Chat (Messaging)

- Send messages to admin with optional image attachments
- Images embedded as base64 in message body (no file upload endpoint)
- Images only (PNG, JPEG, GIF, WebP), max 500KB per image
- Status: PENDING → ACCEPTED/REJECTED
- Conversation thread view

================================================================================
NEPAL NEB GRADING SYSTEM
================================================================================

Utility: backend/src/utils/nepalGrading.js

Grade Scale:
A+ = 90-100% (GPA 4.0) Outstanding
A = 80-89% (GPA 3.6) Excellent
B+ = 70-79% (GPA 3.2) Very Good
B = 60-69% (GPA 2.8) Good
C+ = 50-59% (GPA 2.4) Satisfactory
C = 40-49% (GPA 2.0) Acceptable
D+ = 30-39% (GPA 1.6) Partially Acceptable
D = 20-29% (GPA 1.2) Insufficient
E = 1-19% (GPA 0.8) Very Insufficient
N = 0/Abs (GPA 0.0) Not Graded

Pass Criteria:

- Each subject: minimum D+ (GPA 1.6, 30%) in BOTH theory AND practical
- Overall: minimum GPA 1.6 across all subjects
- Any subject below D+ = overall FAIL

================================================================================
SESSION FLOW (Complete Lifecycle) — Updated 2026-04-09 (Session 9)
================================================================================

Phase 1: SETUP
  1. Students register → auto-linked to parents
  2. Admin creates classes + sections
  3. Students auto-mapped to classes
  4. Admin assigns subject teachers + class heads

Phase 2: SESSION START (via Session Management tab)
  5. Admin opens Session Management → clicks "Start Session"
  6. Selects session number (1st–4th) + academic year
  7. Types "START SESSION" to confirm
  8. Sequential order enforced: 1st → 2nd → 3rd → 4th
     Cannot skip sessions. First-ever session for school = always allowed.
  9. Blocks if session already active (must end current first)
  10. If 1st Session: resets all non-graduated promotionStatus to NONE
  11. SESSION_STARTED notification sent to ALL users (admin + teachers + students + parents)
  12. Session banner appears on Teacher/Student/Parent dashboards (green "Active")
  13. school.activePerformanceSession = null means no session (no default in schema)

Phase 3: ACADEMIC ACTIVITIES
  14. Teachers: create assignments (tagged with sessionYear), upload materials, mark attendance
  15. Students: submit work, watch videos, take quizzes
  16. 1 session = 1 terminal exam (1st Session = 1st Term, etc.)

Phase 4: EXAM PROCESSING (Publish first, Calculate second)
  17. Teachers submit marks → class teacher submits class result to admin
  18. Admin monitors submission progress (X/Y classes submitted)
  19. Admin clicks "Publish Result" (Step 1)
      - Enabled when ≥1 class has submitted marks
      - Makes results visible, emails Nepal NEB grade sheets to parents
      - RESULT_PUBLISHED notifications to parents + teachers
      - Does NOT trigger promotion (moved to Run Calculation)
  20. Admin clicks "Run Calculation" (Step 2)
      - Enabled ONLY after publish. Backend rejects if status ≠ PUBLISHED
      - Captures snapshotAt timestamp — ALL data before this point is frozen
      - Calculates Performance + Potential scores per student using new formulas:
        Performance = Exam(50%) + Assignment(30%) + Attendance(20%)
        Potential = Effort(40) + Curiosity(40) + Learning Speed(20)
      - Stores results in potentialmetric table (status: PENDING_TEACHER_REVIEW)
      - Terms 1-3: metrics only, no promotion, no session advance
      - Term 4: metrics + promote Class 1-9 + advance (Class 10 SKIPPED)
      - Notifies class teachers to verify + fill Curiosity MCQ (0-10)

Phase 5: TEACHER VERIFICATION
  21. Class teacher receives notification to verify analytics
  22. Opens student analysis → reviews auto-calculated scores (read-only)
  23. Fills in Curiosity MCQ score (0-10) per student — the ONLY manual input
  24. Saves → curiosityTotal + potentialTotal computed → status = COMPLETED
  25. Scatter plot becomes visible to parents + subject teachers

Phase 6: REPEAT SESSIONS
  26. Repeat Phases 2–5 for each session (1st → 2nd → 3rd → 4th)

Phase 7: SESSION END (via Session Management tab)
  Option A — End Session (lock only):
    Admin types school name → session cleared to null → must start next manually
  Option B — End & Advance:
    Preview shows promotion counts → auto-advances to next session
    On 4th Session: Class 10 auto-graduated, Class 1-9 promoted/failed
    Optional: toggle "Graduate Class 10 Early" before full advance
  Option C — Start new directly (overrides current)

Phase 8: PROMOTION (4th Session)
  27. Class 10: ALL auto-graduated by advance-session (not run-calculation)
  28. Class 1-9 PASS: promoted + data reset. FAIL: PENDING (manual review)
  29. "Process Remaining Students" button: safe rerun, only NONE/PENDING
  30. All promotion buttons gated on result publish

Phase 9: DATA RESET ON PROMOTION
  PROMOTED: assignments/submissions/materials/quizzes/attendance DELETED.
            Exam marks, SWOT, ratings, parent link, enrollments KEPT.
  RETAINED: stays in class, updates existing enrollment (no duplicate).
            Sees only current sessionYear assignments (filtered).
  GRADUATED: NOTHING deleted — full historical record preserved.

Phase 10: NEW SESSION
  31. Admin starts next session → cycle restarts from Phase 2
  32. Previous session data viewable in scatter plot history dropdown

================================================================================
INFRASTRUCTURE
================================================================================

## Express Configuration

- Body parser limit: 5MB (increased from 100KB default for base64 images)
- express.json({ limit: '5mb' }) in server.js

## Cloudinary Integration (ACTIVE — dpj78oen8)

- Used for study material file uploads (videos, thumbnails)
- Configuration: CLOUDINARY_CLOUD_NAME=dpj78oen8, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env
- Fallback: if Cloudinary env vars are missing, files stored locally under backend/uploads/
- Integration point: teacher study material upload controller
- Status: ACTIVE in production with cloud name dpj78oen8

## Message Storage

- Message body column: MEDIUMTEXT (supports up to 16MB for base64 image content)
- Migrated from VARCHAR to MEDIUMTEXT to support embedded images

## FormData Requests

- Frontend does NOT set explicit Content-Type header on FormData requests
- Browser sets correct multipart/form-data boundary automatically

================================================================================
DATABASE SCHEMA (34+ Models)
================================================================================

Core: user, school, student, teacher, parent
Classes: Renamedclass (mapped to "class"), enrollment, teachersubject, subject
Academic: assignment (+ sessionYear field), submission, attendance, studymaterial, studentmaterialstatus
Quizzes: quizset, question, quizresponse
Exams: exammark, subjectexamsubmission, classexamsubmission, schoolexampublish (+ calculationSnapshotAt)
Analytics: potentialmetric (15+ score fields + status), rating, feedback, feedbackrequest
Comms: notification (type uses NT.* constants), message, teachermessage
Finance: fee, transaction
Auth: passwordresetrequest, pendingregistration, schoolcoderequest
Sessions: sessioncompletion

Key schema notes:
  school.activePerformanceSession: String? (NO default — null = no session)
  school.activePerformanceYear: Int? (NO default)
  assignment.sessionYear: Int? (filters by academic year for retained students)
  potentialmetric.status: PENDING_TEACHER_REVIEW | COMPLETED
  schoolexampublish.calculationSnapshotAt: DateTime? (data freeze timestamp)

================================================================================
API ROUTE STRUCTURE
================================================================================

Auth: POST /api/signup/{admin,teacher,student,parent}
POST /api/login
POST /api/verify/email, /api/verify/resend-code
GET /api/auth/me
POST /api/password/{request,reset}
POST /api/school-code/request

Admin: GET/POST/PATCH/DELETE /api/admin/* (all protected with JWT + ADMIN role)
Includes: overview, classes, teachers, students, notifications,
reviews, messages, settings, exam-submissions, publish-terminal,
run-calculation, promotions, advance-session, broadcast-notice,
start-session, end-session, session-history, graduate-class10-early, class10-status

Teacher: GET/POST /api/teacher/dashboard/_
GET/POST /api/assignments/_
GET/POST /api/attendance/_
GET/POST /api/materials/_

Student: GET /api/student/dashboard, /performance, /attendance, /results/\*
POST /api/student/rate

Parent: GET /api/parent/dashboard/_ (overview, messages, children/_)
GET /api/parent/feedback/\* (children, requests, reports)
POST /api/parent/dashboard/messages/send
POST /api/parent/feedback/request

================================================================================
SEED DATA (for testing)
================================================================================

Run: cd backend && node prisma/seed.js

Creates:

- 1 Admin (admin_demo / Demo@1234)
- 5 Teachers (teacher_math/science/english/cs/hindi)
- 15 Students across 4 classes (10A, 10B, 9A, 9B) + 1 empty class (10D)
- 5 Parents linked to students
- 4 student profiles: STAR, RISING, CONSISTENT, NEEDS_SUPPORT
- Exam marks for 1st Term (all subjects, all students)
- Published 1st Term results (PUBLISHED + COMPLETED)
- Potential metrics (effort, curiosity, learningSpeed per profile)
- Attendance records (20 days)
- Assignments (8 per class, with submissions)
- Study materials with quizzes
- SWOT feedback for all students
- Teacher ratings
- Admin inbox messages (PENDING, ACCEPTED, REJECTED)
- Notifications, school code requests, password reset requests

================================================================================
KNOWN REMAINING ISSUES
================================================================================

Missing Backend Routes (4):

- GET /api/teacher/dashboard/overview
- GET /api/admin/teachers/filter
- GET /api/parent/dashboard/notifications
- GET /api/parent/dashboard/student/:id/exams

Debug Code:

- ~25 console.log in teacher + student dashboards
- 1 fs.appendFileSync in teacher backend

Code Quality:

- Parent dashboard has ~15 raw SQL queries (should be Prisma ORM)
- Mailer: schoolTransporters Map memory leak
- No axios timeout in frontend
- Frontend bundle 1.5MB (needs code splitting)
- No test suite, no CI/CD

Session 3 Fixes Applied:

- Chat: fileUrl removed from message.create (field doesn't exist in schema)
- Chat: base64 image embedding in message body instead of file attachments
- Chat: MEDIUMTEXT for body column, express.json limit 5MB
- Chat: Content-Type header removed from FormData requests
- Quiz: retake prevention (backend rejects, frontend shows "Already Completed")
- Material watch: seed used 'COMPLETED' → fixed to 'DONE', lastPosition 100→580
- Attendance seed: dynamic current month, status P/A/L (not PRESENT/ABSENT)
- Password reset: dev mode auto-approves + returns code, email failures don't crash
- Login: school code ownership validation before password check
- Role selection page redesigned

================================================================================
FILE STRUCTURE
================================================================================

backend/
index.js ← entry point
.env ← environment config
prisma/
schema.prisma ← 34 models
seed.js ← demo data
migrations/ ← 5 migrations
src/
server.js ← Express app + routes + Helmet + CORS
middleware/auth.js ← JWT + RBAC
services/mailer.js ← per-school SMTP email
utils/
validators.js ← input validation
nepalGrading.js ← Nepal NEB grade calculation
controllers/
auth/ ← signup, login, verify, password, schoolCode, google
admin/ ← dashboard, school, schoolCode, sessionDates
teacher/ ← dashboard, assignment, attendance, studyMaterial, analyticsHelper
student/ ← student
parent/ ← dashboard, feedback

frontend/
src/
App.jsx ← Router (18 routes)
main.jsx ← entry
authentication/ ← 11 auth pages
AdminDashboard/ ← 12 components
TeacherDashboard/ ← 13 components
StudentDashboard/ ← 4 components
ParentsDashboard/ ← 3 components
components/
ui/Shared.jsx ← Button, Input, Card, Badge, Modal
GradeSheetView.jsx ← Nepal NEB grade sheet display
services/api.js ← Axios service layer (~900 LOC)

================================================================================
SESSION 10 CHANGES (2026-04-11)
================================================================================

ANALYTICS PIPELINE (CRITICAL FIX):
  - All 3 analytics endpoints (scatter, individual, parent) now use the SAME
    `calculateStudentMetrics()` function from `analyticsHelper.js`
  - When `potentialmetric` table is empty (admin hasn't run calculation):
    → Live calculation kicks in automatically
    → Smart date fallback: if session date range has no data, expands to full year
  - Auto-advance REMOVED from read-only endpoints (teacher + parent)
    → Session changes only via admin Session Management tab
  - API response format MATCHED across teacher and parent endpoints:
    exam: { value, display }, assignment: { value, display },
    attendance: { value, display }, potential: { total, effort, curiosity, learningSpeed }

TEACHER DASHBOARD:
  - Subject filter: shows only teacher's own subjects
  - Create modals: class heads see all school subjects via `createSubjects`
  - Scatter plot: live calculation fallback when no potentialmetric data
  - Prepare Graph modal: shows ALL teacher's classes (not just class head)
  - Session banner: REMOVED
  - Scatter chart: fixed overflow padding

PARENT DASHBOARD:
  - Portfolio: popup modal → inline in feedback tab with Print/Download button
  - API format matched to teacher (structured exam/assignment/attendance/potential)
  - ChildAnalytics handles potential as object or number
  - Session banner: REMOVED

ADMIN DASHBOARD:
  - Class 10 Promotion: removed Retain button (graduate only)
  - Added progress bar, graduation cap icon
  - Class 1-9: improved summary stats with colored dots

DATABASE:
  - Old migrations folder DELETED — use `prisma db push` only
  - Setup: `npx prisma generate && npx prisma db push && node prisma/seed.js`

SETUP:
  - SETUP.md added to project root
  - SETUP_WINDOWS.md created for Windows deployment
  - .env excluded from zip (use .env.example)

================================================================================
END OF DOCUMENT
================================================================================
