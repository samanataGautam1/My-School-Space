# School Space — Student Module: Complete Flow & Feature Guide

> Last Updated: 2026-04-09 (Session 9)
> This document reflects the actual implemented code.

---

## Table of Contents

1. [Access & Authentication](#1-access--authentication)
2. [Session Banner](#2-session-banner)
3. [Dashboard Tabs](#3-dashboard-tabs)
4. [Overview Tab](#4-overview-tab)
5. [Study Materials Tab](#5-study-materials-tab)
6. [Assignments Tab](#6-assignments-tab)
7. [Teacher Ratings Tab](#7-teacher-ratings-tab)
8. [Results Tab](#8-results-tab)
9. [Notifications](#9-notifications)
10. [Attendance Data](#10-attendance-data)
11. [Session Awareness](#11-session-awareness)
12. [API Reference (All Student Endpoints)](#12-api-reference-all-student-endpoints)

---

## 1. Access & Authentication

**Registration:** Student signs up with school code → auto-assigned to class → class teacher approves.
**Login:** Username OR email + School Code + Password
**Route:** `/dashboard/student`
**Auth Guard:** JWT token (7-day expiry) + role = `STUDENT`
**Must be approved** (`isApproved = true`) to see full dashboard.

---

## 2. Session Banner

A slim banner at the top of the dashboard, above all tabs.
Uses shared `SessionBanner` component.

| State | Display |
|-------|---------|
| Active | Green: `2nd Session — 2026 | 2nd Term | Active` |
| Inactive | Amber: `No Active Session | School is on a break` |
| Loading | Shimmer skeleton |

Data source: `GET /api/student/dashboard` → `data.activeSession`

When results are published for the current terminal, the banner can show a results link.

---

## 3. Dashboard Tabs

```
Overview       — Quick stats, attendance, materials progress
Study Materials — Watch videos, take quizzes, track progress
Assignments    — View + submit assignments, see grades
Teacher Ratings — Rate teachers anonymously (1-5 stars)
Results        — View published grade sheets (Nepal NEB format)
```

All tabs accessible by all students (no role-based restrictions within student dashboard).

---

## 4. Overview Tab

**API:** `GET /api/student/dashboard`

### What it shows:
- **Student info:** Name, class, roll number, student code
- **School info:** Name, code
- **Pending assignments count:** Assignments without a submission
- **Today's attendance:** P/A/L or null (not marked yet)
- **Active session info:** Session name, year, terminal, isActive

### Materials Progress (inline)
- Completed on time vs total materials
- Completion progress visualization

### Attendance Summary
- Monthly attendance: present/absent/late counts
- API: `GET /api/student/attendance?month=&year=`

---

## 5. Study Materials Tab

### Student Materials List
- Shows all materials for student's class
- Each shows: title, description, subject, teacher name, deadline
- Progress status: TODO / DONE
- API: `GET /api/materials/student`

### Video Playback + Quizzes
- Watch video materials with tracked position
- **In-video quizzes:** MCQ questions auto-pause at specific timestamps
- Student answers, auto-submits
- **Retake prevention:** Backend rejects duplicate quiz attempts
- Frontend shows "Already Completed" for answered questions
- API: `POST /api/materials/quiz/submit`

### Progress Tracking
- Saves: last watched position, total duration, completion status
- `completedAt` set when status changes to DONE
- Used for Effort calculation (timeliness relative to deadline)
- API: `POST /api/materials/progress`

### Quiz History
- View past quiz responses with correct/incorrect status
- API: `GET /api/materials/quiz/history`

---

## 6. Assignments Tab

### Assignment List
- Shows assignments for student's class, filtered by `sessionYear`
- Filter: `sessionYear = currentYear OR sessionYear IS NULL`
- Retained students only see current session assignments
- Each shows: title, subject, teacher, due date, status, grade
- API: `GET /api/assignments/student?userId=`

### Submit Assignment
- Upload file or type text (based on `submissionType`: FILE/TEXT/BOTH)
- File upload up to 50MB
- **Late detection:** Submissions after due date marked as late
- API: `POST /api/assignments/submit` (multipart/form-data)

### View Grades
- After teacher grades: score (0-100) + feedback text visible
- Late submission indicator shown

---

## 7. Teacher Ratings Tab

### Rate Teachers
- List of all teachers teaching in student's class
- Rate each: 1-5 stars + optional review text
- **Anonymous:** Teacher cannot see which student rated
- Ratings linked to session + year
- API: `POST /api/student/rate`

### Settings Check
- Ratings only available when school has `ratingsEnabled = true`
- When disabled: "Ratings are not available this session"
- API: `GET /api/student/settings`

### Teachers List
- Shows teachers with subjects for the student's class
- API: `GET /api/student/teachers`

---

## 8. Results Tab

### Published Terminals
- Shows list of terminals with published results
- Only terminals where `schoolexampublish.status = 'PUBLISHED'`
- API: `GET /api/student/results/terminals`

### Grade Sheet View
- Nepal NEB format grade sheet for a specific terminal
- Subject table: Theory, Practical, Total, Full, Pass, %, Grade, GPA, Status
- Overall: Grand Total, Percentage, Overall Grade, GPA, Final Status
- Nepal NEB Grade Scale legend reference
- Uses shared `GradeSheetView` component
- API: `GET /api/student/results/grade-sheet/:terminal`

---

## 9. Notifications

- In-app notifications: results, assignments, announcements
- Types received: `RESULT_PUBLISHED`, `SESSION_STARTED`, `SESSION_ADVANCE`, `PROMOTION`, `GRADUATION`, `ADMIN_NOTICE`, `INFO`
- Unread badge on bell icon
- API: `GET /api/student/notifications`

---

## 10. Attendance Data

- Monthly attendance history with present/absent/late counts
- Used in overview tab for quick summary
- API: `GET /api/student/attendance?month=&year=`

---

## 11. Session Awareness

- Dashboard API returns `activeSession` with session/year/terminal/isActive
- **Session banner** (shared `SessionBanner` component) at top of dashboard:
  - Active: green banner with session name + year + terminal + "Active" badge
  - Inactive: amber banner "No Active Session | School is on a break"
- Assignment list filtered by `sessionYear` (retained students see only current year)
- Results tab shows only published terminals
- Receives `SESSION_STARTED` notification when admin starts new session
- Sessions must be started in order: 1st → 2nd → 3rd → 4th (admin enforced)

### How student data is affected by session lifecycle:
| Event | Impact on Student |
|-------|-------------------|
| Session starts | New assignments appear, materials tracked |
| Run Calculation | Analytics scores frozen for this session |
| Results published | Grade sheets visible in Results tab |
| Promoted | Moved to next class, old data reset (assignments/materials/quizzes/attendance deleted) |
| Retained | Stays in class, sees only new sessionYear assignments |
| Graduated | All data preserved, school complete |

---

## 12. API Reference (All Student Endpoints)

All at `/api/student/*`, protected with JWT + `authMiddleware`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Dashboard stats + activeSession |
| GET | `/settings` | School settings (ratingsEnabled etc.) |
| GET | `/teachers` | Teachers for student's class |
| POST | `/rate` | Rate a teacher (anonymous, 1-5 stars) |
| GET | `/performance` | Student performance metrics |
| GET | `/attendance` | Attendance history by month/year |
| GET | `/notifications` | Student notifications |
| GET | `/results/terminals` | Published terminal list |
| GET | `/results/grade-sheet/:terminal` | Nepal NEB grade sheet |

### Assignment Routes (shared with teacher) — `/api/assignments/*`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/student?userId=` | Assignments for class (sessionYear filtered) |
| POST | `/submit` | Submit assignment (file/text) |

### Material Routes (shared with teacher) — `/api/materials/*`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/student` | Materials for class |
| POST | `/progress` | Update watch progress |
| POST | `/quiz/submit` | Submit quiz answer (retake prevention) |
| GET | `/quiz/history` | Quiz response history |

---

> **Testing:** Login with any student account from seed data (school code: SS01, password: Demo@1234)
> **Seed creates:** 15 students across classes 10A, 10B, 9A, 9B
