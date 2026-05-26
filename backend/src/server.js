const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Mount Routes
const signupRoutes = require(path.join(__dirname, 'controllers', 'auth', 'signup'));
const loginRoutes = require(path.join(__dirname, 'controllers', 'auth', 'login'));
const adminDashboardRoutes = require(path.join(__dirname, 'controllers', 'admin', 'dashboard'));
const passwordRoutes = require(path.join(__dirname, 'controllers', 'auth', 'password'));
const schoolRoutes = require(path.join(__dirname, 'controllers', 'admin', 'school'));
const schoolCodeRoutes = require(path.join(__dirname, 'controllers', 'admin', 'schoolCode'));
const verifyRoutes = require(path.join(__dirname, 'controllers', 'auth', 'verify'));

// Middleware
const { authMiddleware } = require(path.join(__dirname, 'middleware', 'auth'));

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Global Logger
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[RESPONSE] ${req.method} ${res.statusCode} ${req.url}`);
  });
  next();
});

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false  // disabled — API server, not a user-facing app
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

app.use('/api/login', limiter);
app.use('/api/signup', limiter);
app.use('/api/school-code', limiter);

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
    "http://localhost:5173",
    "https://my-school-space.vercel.app"
  ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/* ================= HEALTH CHECK (JSON) ================= */
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

app.get('/debug-student', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const student = await prisma.student.findFirst({
      where: { firstName: { contains: 'Shrasta' } },
      include: {
        exammark: true,
        Renamedclass: true
      }
    });
    let publish = null;
    if (student) {
      publish = await prisma.schoolexampublish.findFirst({
        where: { schoolId: student.schoolId, examTerminal: '1st Term' }
      });
    }
    res.json({ student, publish });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await prisma.$disconnect();
  }
});

/* ================= API STATUS PAGE ================= */
app.get('/', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  let dbStatus = 'connected';
  let dbColor = '#22c55e';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'disconnected';
    dbColor = '#ef4444';
  } finally {
    await prisma.$disconnect();
  }

  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);
  const uptimeStr = `${h}h ${m}m ${s}s`;

  const routes = [
    { group: 'Auth', method: 'POST', path: '/api/signup/admin', desc: 'Admin registration' },
    { group: 'Auth', method: 'POST', path: '/api/signup/teacher', desc: 'Teacher registration' },
    { group: 'Auth', method: 'POST', path: '/api/signup/student', desc: 'Student registration' },
    { group: 'Auth', method: 'POST', path: '/api/signup/parent', desc: 'Parent registration' },
    { group: 'Auth', method: 'POST', path: '/api/login', desc: 'Login (all roles)' },
    { group: 'Auth', method: 'POST', path: '/api/verify/email', desc: 'Verify OTP' },
    { group: 'Auth', method: 'POST', path: '/api/verify/resend-code', desc: 'Resend OTP' },
    { group: 'Auth', method: 'GET', path: '/api/auth/me', desc: 'Check session' },
    { group: 'Auth', method: 'POST', path: '/api/password/request', desc: 'Request password reset' },
    { group: 'Auth', method: 'POST', path: '/api/password/reset', desc: 'Reset password' },
    { group: 'Auth', method: 'POST', path: '/api/school-code/request', desc: 'Request school code recovery' },
    { group: 'Admin', method: 'GET', path: '/api/admin/overview', desc: 'School overview' },
    { group: 'Admin', method: 'GET', path: '/api/admin/teachers-by-class', desc: 'Teachers by class' },
    { group: 'Admin', method: 'GET', path: '/api/admin/pending-teachers', desc: 'Pending teacher approvals' },
    { group: 'Admin', method: 'GET', path: '/api/admin/students', desc: 'All students' },
    { group: 'Admin', method: 'GET', path: '/api/admin/classes', desc: 'All classes' },
    { group: 'Admin', method: 'GET', path: '/api/admin/notifications', desc: 'Admin notifications' },
    { group: 'Admin', method: 'GET', path: '/api/admin/reviews', desc: 'Teacher reviews' },
    { group: 'Admin', method: 'GET', path: '/api/admin/messages/requests', desc: 'Parent message requests' },
    { group: 'Admin', method: 'PATCH', path: '/api/admin/settings', desc: 'Update school settings' },
    { group: 'Admin', method: 'GET', path: '/api/admin/exam-submissions', desc: 'Exam submissions' },
    { group: 'Admin', method: 'GET', path: '/api/password/admin/requests', desc: 'Password reset requests' },
    { group: 'Teacher', method: 'GET', path: '/api/teacher/dashboard/overview', desc: 'Teacher overview' },
    { group: 'Teacher', method: 'GET', path: '/api/teacher/dashboard/profile', desc: 'Teacher profile' },
    { group: 'Teacher', method: 'GET', path: '/api/attendance/classes', desc: 'Classes for attendance' },
    { group: 'Teacher', method: 'POST', path: '/api/attendance/save', desc: 'Save attendance' },
    { group: 'Teacher', method: 'GET', path: '/api/attendance/history/:classId', desc: 'Attendance history' },
    { group: 'Teacher', method: 'POST', path: '/api/assignments/create', desc: 'Create assignment' },
    { group: 'Teacher', method: 'GET', path: '/api/assignments/teacher', desc: 'Teacher assignments' },
    { group: 'Teacher', method: 'POST', path: '/api/assignments/grade', desc: 'Grade submission' },
    { group: 'Teacher', method: 'POST', path: '/api/materials/create', desc: 'Upload study material' },
    { group: 'Teacher', method: 'GET', path: '/api/materials/teacher', desc: 'Teacher materials' },
    { group: 'Teacher', method: 'GET', path: '/api/teacher/dashboard/student/approvals', desc: 'Pending student approvals' },
    { group: 'Teacher', method: 'POST', path: '/api/teacher/dashboard/send-complaint', desc: 'Send complaint to parent' },
    { group: 'Student', method: 'GET', path: '/api/student/dashboard', desc: 'Student dashboard' },
    { group: 'Student', method: 'GET', path: '/api/assignments/student', desc: 'Student assignments' },
    { group: 'Student', method: 'POST', path: '/api/assignments/submit', desc: 'Submit assignment' },
    { group: 'Student', method: 'GET', path: '/api/materials/student', desc: 'View study materials' },
    { group: 'Student', method: 'POST', path: '/api/student/rate', desc: 'Rate a teacher' },
    { group: 'Student', method: 'GET', path: '/api/materials/quiz/history', desc: 'Quiz history' },
    { group: 'Parent', method: 'GET', path: '/api/parent/dashboard/overview', desc: 'Parent overview' },
    { group: 'Parent', method: 'GET', path: '/api/parent/dashboard/children/performance', desc: 'Child analytics' },
    { group: 'Parent', method: 'POST', path: '/api/parent/dashboard/messages/send', desc: 'Send message to admin' },
    { group: 'Parent', method: 'GET', path: '/api/parent/feedback/children', desc: 'Children for feedback' },
    { group: 'Parent', method: 'POST', path: '/api/parent/feedback/request', desc: 'Request SWOT feedback' },
  ];

  const groups = [...new Set(routes.map(r => r.group))];
  const methodColor = { GET: '#2563eb', POST: '#16a34a', PATCH: '#d97706', PUT: '#7c3aed', DELETE: '#dc2626' };
  const methodBg = { GET: '#eff6ff', POST: '#f0fdf4', PATCH: '#fffbeb', PUT: '#f5f3ff', DELETE: '#fef2f2' };
  const groupColor = { Auth: '#2563eb', Admin: '#d97706', Teacher: '#16a34a', Student: '#7c3aed', Parent: '#db2777' };

  const routeRows = groups.map(group => {
    const groupRoutes = routes.filter(r => r.group === group);
    return groupRoutes.map((r, i) => `
      <tr>
        ${i === 0 ? `<td rowspan="${groupRoutes.length}" style="padding:10px 16px;font-weight:600;color:${groupColor[group]};vertical-align:top;border-right:1px solid #e5e7eb;white-space:nowrap;font-size:13px;">${group}</td>` : ''}
        <td style="padding:9px 16px;">
          <span style="background:${methodBg[r.method] || '#f9fafb'};color:${methodColor[r.method] || '#374151'};border:1px solid ${methodColor[r.method] || '#d1d5db'}22;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;font-family:monospace;">${r.method}</span>
        </td>
        <td style="padding:9px 16px;font-family:monospace;font-size:12.5px;color:#374151;">${r.path}</td>
        <td style="padding:9px 16px;font-size:13px;color:#6b7280;">${r.desc}</td>
      </tr>`).join('');
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>School Space — API</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#f9fafb;color:#111827;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;}
    header{background:#fff;border-bottom:1px solid #e5e7eb;padding:18px 40px;display:flex;align-items:center;justify-content:space-between;}
    .logo{font-size:20px;font-weight:700;color:#111827;}
    .logo span{color:#2563eb;}
    .badge{background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-size:11px;font-weight:600;padding:2px 10px;border-radius:999px;margin-left:8px;}
    .time{font-size:12px;color:#9ca3af;}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:24px 40px 0;}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;}
    .card-label{font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;}
    .card-value{font-size:20px;font-weight:700;color:#111827;display:flex;align-items:center;gap:6px;}
    .card-sub{font-size:11px;color:#9ca3af;margin-top:3px;}
    .dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;}
    section{padding:24px 40px;}
    h2{font-size:13px;font-weight:600;color:#374151;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;}
    .checks{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
    button{background:#fff;border:1px solid #d1d5db;color:#374151;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;transition:border-color .15s,background .15s;}
    button:hover{background:#f3f4f6;border-color:#9ca3af;}
    .result{font-size:13px;color:#6b7280;}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;font-size:13px;}
    thead{background:#f9fafb;}
    thead th{padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;}
    tbody tr{border-bottom:1px solid #f3f4f6;}
    tbody tr:last-child{border-bottom:none;}
    tbody tr:hover{background:#f9fafb;}
    footer{text-align:center;padding:20px 40px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;margin-top:24px;background:#fff;}
  </style>
</head>
<body>

<header>
  <div>
    <span class="logo">School <span>Space</span><span class="badge">API</span></span>
    <div style="font-size:12px;color:#6b7280;margin-top:3px;">Backend Status · Port ${process.env.PORT || 8080}</div>
  </div>
  <div class="time">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
</header>

<div class="cards">
  <div class="card">
    <div class="card-label">Server</div>
    <div class="card-value"><span class="dot" style="background:#16a34a;"></span> Online</div>
    <div class="card-sub">Port ${process.env.PORT || 8080}</div>
  </div>
  <div class="card">
    <div class="card-label">Database</div>
    <div class="card-value"><span class="dot" style="background:${dbColor};"></span> ${dbStatus}</div>
    <div class="card-sub">MySQL · Prisma ORM</div>
  </div>
  <div class="card">
    <div class="card-label">Uptime</div>
    <div class="card-value" style="font-size:17px;">${uptimeStr}</div>
    <div class="card-sub">Since last restart</div>
  </div>
  <div class="card">
    <div class="card-label">Routes</div>
    <div class="card-value">${routes.length}</div>
    <div class="card-sub">${groups.length} modules</div>
  </div>
  <div class="card">
    <div class="card-label">Environment</div>
    <div class="card-value" style="font-size:15px;text-transform:capitalize;">${process.env.NODE_ENV || 'development'}</div>
    <div class="card-sub">Node ${process.version}</div>
  </div>
  <div class="card">
    <div class="card-label">Frontend</div>
    <div class="card-value" style="font-size:14px;">localhost:3000</div>
    <div class="card-sub">CORS allowed</div>
  </div>
</div>

<section>
  <h2>Quick Checks</h2>
  <div class="checks">
    <button onclick="ping('/health','r1')">Ping /health</button>
    <span id="r1" class="result"></span>
    <button onclick="ping('/api/auth/me','r2')">Test /auth/me</button>
    <span id="r2" class="result"></span>
  </div>
</section>

<section>
  <h2>API Endpoints (${routes.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Module</th><th>Method</th><th>Path</th><th>Description</th>
      </tr>
    </thead>
    <tbody>${routeRows}</tbody>
  </table>
</section>

<footer>School Space · Node ${process.version} · Port ${process.env.PORT || 8080}</footer>

<script>
async function ping(url, id) {
  const el = document.getElementById(id);
  el.textContent = '...';
  el.style.color = '#9ca3af';
  try {
    const t = Date.now();
    const r = await fetch(url);
    const ms = Date.now() - t;
    el.textContent = r.ok ? '✅ ' + r.status + ' OK (' + ms + 'ms)' : '⚠️ ' + r.status;
    el.style.color = r.ok ? '#16a34a' : '#d97706';
  } catch {
    el.textContent = '❌ unreachable';
    el.style.color = '#dc2626';
  }
}
setInterval(() => location.reload(), 30000);
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/* ================= ROUTES ================= */
app.use('/api/assignments', authMiddleware, require(path.join(__dirname, 'controllers', 'teacher', 'assignment')));
app.use('/api/attendance', require(path.join(__dirname, 'controllers', 'teacher', 'attendance')));

app.use('/api/signup', signupRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/school-code', schoolCodeRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/auth', require(path.join(__dirname, 'controllers', 'auth', 'auth')));

// Dashboard Routes
app.use('/api/teacher/dashboard', require(path.join(__dirname, 'controllers', 'teacher', 'dashboard')));
app.use('/api/admin', authMiddleware, adminDashboardRoutes);
app.use('/api/student', require(path.join(__dirname, 'controllers', 'student', 'student')));
app.use('/api/parent/dashboard', require(path.join(__dirname, 'controllers', 'parent', 'dashboard')));
app.use('/api/parent/feedback', require(path.join(__dirname, 'controllers', 'parent', 'feedback')));
app.use('/api/materials', require(path.join(__dirname, 'controllers', 'teacher', 'studyMaterial')));

// Static files
app.use('/assignments', express.static(path.join(__dirname, '../uploads/assignments')));
app.use('/materials', express.static(path.join(__dirname, '../uploads/materials')));
app.use('/messages', express.static(path.join(__dirname, '../uploads/messages')));

/* ================= 404 HANDLER ================= */
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

/* ================= GLOBAL ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] School Space Backend running on port ${PORT}`);
  console.log(`[SERVER] Timestamp: ${new Date().toISOString()}`);
});

module.exports = app;
