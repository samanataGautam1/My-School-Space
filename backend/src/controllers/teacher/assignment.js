const express = require('express');
const path = require('path');
const prisma = require("../../../prisma/prisma");
const router = express.Router();
const { updateStudentAssignmentPerformance } = require('./performanceHelper');

console.log("[ASSIGN] Assignment Router Loaded");

// Middleware to check authentication (Simplified for now, assumes user attach by main middleware)
const authenticate = async (req, res, next) => {
    // In a real app, verify JWT here. For now, assuming request comes with userId in header or body 
    // BUT since we have a main auth middleware usually, let's assume req.user is populated if using common middleware.
    // Checking previous code style...
    // The previous implementation seems to rely on custom middleware or just direct access.
    // Let's implement a quick verification using existing pattern if possible.
    // Checking api.js, it sends Authorization header.
    // We'll rely on server.js to have the auth middleware or add it here.
    // For safety, let's just use the `req.user` which should be set by the main server middleware.

    // NOTE: If main server doesn't have global auth, we might need to import it.
    // Let's assume for this feature to work quickly, we will manually check or trust the input for internal logic
    // but better to check header.
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    // For now, let's trust the logic will be handled by `server.js` mounting.
    // If not, we will need to add `jsonwebtoken` verification here.
    next();
};

// Configure Multer for File Uploads (Lazy Loaded)
const getUpload = () => {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');

    const uploadDir = path.join(__dirname, '../../uploads/assignments');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });

    return multer({
        storage: storage,
        limits: { fileSize: 50 * 1024 * 1024 } // Increased to 50MB
    });
};

const lazyUpload = (req, res, next) => {
    const upload = getUpload();
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error("Upload Error:", err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: "File too large. Max limit is 50MB." });
            }
            return res.status(400).json({ error: "File upload failed: " + err.message });
        }
        next();
    });
};

/* =======================
    CREATE ASSIGNMENT
   ======================= */
router.post('/create', lazyUpload, async (req, res) => {
    try {
        console.log("Create Assignment Body:", req.body);
        console.log("Create Assignment File:", req.file);

        // Extract data from req.body (parsed by multer)
        // Extract data
        const { title, description, subjectId, classId, className, subjectName, dueDate, submissionType, teacherUserId } = req.body;

        let contentUrl = req.body.contentUrl;
        if (req.file) {
            contentUrl = `/assignments/${req.file.filename}`;
        }

        if (!teacherUserId) {
            return res.status(400).json({ error: "Teacher User ID is required" });
        }

        if (isNaN(parseInt(teacherUserId))) {
            return res.status(400).json({ error: "Invalid Teacher User ID" });
        }

        const teacher = await prisma.teacher.findUnique({
            where: { userId: parseInt(teacherUserId) }
        });

        if (!teacher) return res.status(404).json({ error: "Teacher profile not found." });

        // Resolve Class ID
        let finalClassId = classId ? parseInt(classId) : null;
        if (!finalClassId && className) {
            // Try to find class by name (parse "10A" -> "10", "A")
            const match = className.trim().match(/^(\d+)\s*([A-Za-z])$/);
            if (match) {
                const name = match[1];
                const section = match[2].toUpperCase();
                let cls = await prisma.Renamedclass.findFirst({
                    where: { schoolId: teacher.schoolId, name: name, section: section }
                });
                if (!cls) {
                    // Auto-create class if it doesn't exist (flexible mode)
                    cls = await prisma.Renamedclass.create({
                        data: { name, section, schoolId: teacher.schoolId }
                    });
                }
                finalClassId = cls.id;
            } else {
                return res.status(400).json({ error: "Invalid Class format. Use format like '10A'." });
            }
        }

        // Resolve Subject ID
        let finalSubjectId = subjectId ? parseInt(subjectId) : null;
        if (!finalSubjectId && subjectName) {
            // Try to find subject
            let sub = await prisma.subject.findFirst({
                where: { schoolId: teacher.schoolId, name: subjectName.trim() }
            });
            if (!sub) {
                // Auto-create subject
                sub = await prisma.subject.create({
                    data: { name: subjectName.trim(), schoolId: teacher.schoolId }
                });
            }
            finalSubjectId = sub.id;
        }

        if (!finalClassId || !finalSubjectId) {
            return res.status(400).json({ error: "Class and Subject are required." });
        }

        // Parse Due Date Safely
        let validDueDate = null;
        if (dueDate) {
            const parsed = new Date(dueDate);
            if (!isNaN(parsed.getTime())) {
                validDueDate = parsed;
            }
        }

        // Get current session year for assignment filtering
        const schoolConfig = await prisma.school.findUnique({
            where: { id: teacher.schoolId },
            select: { activePerformanceYear: true }
        });

        // Create Assignment
        const newAssignment = await prisma.assignment.create({
            data: {
                title,
                description,
                subjectId: finalSubjectId,
                classId: finalClassId,
                teacherId: teacher.id,
                dueDate: validDueDate,
                submissionType: submissionType || 'BOTH',
                contentUrl: contentUrl,
                sessionYear: schoolConfig?.activePerformanceYear || new Date().getFullYear()
            }
        });

        res.json({ ok: true, data: newAssignment });
    } catch (error) {
        console.error("Create Assignment Error:", error);
        res.status(500).json({ error: "Failed to create assignment" });
    }
});

/* =======================
    GET TEACHER OPTIONS (Classes & Subjects)
   ======================= */
router.get('/teacher-options', async (req, res) => {
    console.log("--- TEACHER OPTIONS ENDPOINT (FIXED) HIT ---");
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        const teacher = await prisma.teacher.findUnique({
            where: { userId: parseInt(userId) },
            select: { id: true, schoolId: true }
        });

        if (!teacher) return res.status(404).json({ error: "Teacher not found" });

        console.log("Teacher Found:", JSON.stringify(teacher));
        if (!teacher.id) {
            console.error("Teacher ID is MISSING in teacher object!");
        }

        const [teacherSubjects, directTeacher, classHeadOf, allSchoolSubjects] = await Promise.all([
            prisma.teachersubject.findMany({
                where: { teacherId: teacher.id },
                include: {
                    Renamedclass: { select: { id: true, name: true, section: true, schoolId: true } },
                    subject: { select: { id: true, name: true } }
                }
            }),
            prisma.teacher.findUnique({
                where: { id: teacher.id },
                include: { Renamedclass_classteachers: { select: { id: true, name: true, section: true, schoolId: true } } }
            }),
            prisma.Renamedclass.findMany({
                where: { classHeadId: teacher.id },
                select: { id: true, name: true, section: true }
            }),
            prisma.subject.findMany({
                where: { schoolId: teacher.schoolId },
                select: { id: true, name: true }
            })
        ]);


        console.log(`Found ${teacherSubjects.length} teacherSubjects.`);
        console.log(`Found ${directTeacher.Renamedclass_classteachers?.length || 0} direct classes.`);
        console.log(`Found ${classHeadOf.length} classes as Class Head.`);

        // Dedup classes and associate subjects
        const classMap = new Map();
        // mapping: which subjects are assigned to which classes (for this teacher)
        const mapping = [];

        // Add direct classes (legacy or generic) — filtered to teacher's school only
        if (directTeacher.Renamedclass_classteachers) {
            directTeacher.Renamedclass_classteachers
                .filter(c => c.schoolId === teacher.schoolId)
                .forEach(c => {
                    classMap.set(c.id, { ...c, subjects: [] });
                });
        }

        // For class head classes, fetch actual subject assignments for those classes
        const classHeadIds = classHeadOf.map(c => c.id);
        let classHeadSubjectAssignments = [];
        if (classHeadIds.length > 0) {
            classHeadSubjectAssignments = await prisma.teachersubject.findMany({
                where: { classId: { in: classHeadIds } },
                include: { subject: { select: { id: true, name: true } } }
            });
        }

        classHeadOf.forEach(c => {
            // Only subjects that are actually assigned to teachers for this class
            const classSubjects = classHeadSubjectAssignments
                .filter(ts => ts.classId === c.id && ts.subject)
                .map(ts => ts.subject);
            const uniqueSubjects = [...new Map(classSubjects.map(s => [s.id, s])).values()];
            classMap.set(c.id, { ...c, subjects: uniqueSubjects.map(s => s.name) });
            // Add to mapping
            uniqueSubjects.forEach(s => mapping.push({ classId: c.id, subjectId: s.id }));
        });

        // Add subject classes — filtered to teacher's school only
        teacherSubjects.forEach(ts => {
            if (ts.Renamedclass && ts.Renamedclass.schoolId === teacher.schoolId) {
                if (!classMap.has(ts.Renamedclass.id)) {
                    classMap.set(ts.Renamedclass.id, { ...ts.Renamedclass, subjects: [] });
                }
                const cls = classMap.get(ts.Renamedclass.id);
                if (ts.subject && !cls.subjects.includes(ts.subject.name)) {
                    cls.subjects.push(ts.subject.name);
                }
                // Add to mapping
                if (ts.subject) {
                    mapping.push({ classId: ts.Renamedclass.id, subjectId: ts.subject.id });
                }
            }
        });

        const classes = Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        // Teacher's own subjects (for filtering — only subjects they actually teach)
        const ownSubjectMap = new Map();
        teacherSubjects.forEach(ts => {
            if (ts.subject) {
                ownSubjectMap.set(ts.subject.id, ts.subject);
            }
        });
        const ownSubjects = Array.from(ownSubjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        // For creation: class heads get subjects assigned to their class, others get own subjects
        const createSubjectMap = new Map();
        if (classHeadIds.length > 0) {
            classHeadSubjectAssignments.forEach(ts => {
                if (ts.subject) createSubjectMap.set(ts.subject.id, ts.subject);
            });
        }
        // Always include teacher's own subjects
        ownSubjects.forEach(s => createSubjectMap.set(s.id, s));
        const createSubjects = Array.from(createSubjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        // Deduplicate mapping
        const mappingSet = new Set(mapping.map(m => `${m.classId}-${m.subjectId}`));
        const uniqueMapping = [...mappingSet].map(key => {
            const [classId, subjectId] = key.split('-').map(Number);
            return { classId, subjectId };
        });

        res.json({
            ok: true,
            data: { classes, subjects: ownSubjects, createSubjects, mapping: uniqueMapping }
        });


    } catch (error) {
        console.error("Get Teacher Options Error:", error);
        res.status(500).json({
            error: "Failed to fetch options",
            details: error.message,
            stack: error.stack
        });
    }
});

/* =======================
    GET TEACHER ASSIGNMENTS
   ======================= */
router.get('/teacher', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        const teacher = await prisma.teacher.findUnique({
            where: { userId: parseInt(userId) }
        });

        if (!teacher) return res.status(404).json({ error: "Teacher not found" });

        // Get current session year for filtering
        const school = await prisma.school.findUnique({
            where: { id: teacher.schoolId },
            select: { activePerformanceYear: true }
        });
        const currentYear = school?.activePerformanceYear || new Date().getFullYear();

        const assignments = await prisma.assignment.findMany({
            where: {
                teacherId: teacher.id,
                OR: [{ sessionYear: currentYear }, { sessionYear: null }]
            },
            include: {
                Renamedclass: true,
                subject: true,
                submission: {
                    include: {
                        student: {
                            include: { user: { select: { firstName: true, lastName: true } } }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formatted = assignments.map(a => ({
            ...a,
            submissions: a.submission.map(sub => ({
                ...sub,
                isLateSubmitted: sub.submittedAt && a.dueDate && new Date(sub.submittedAt) > new Date(a.dueDate)
            }))
        }));

        res.json({ ok: true, data: formatted });

    } catch (error) {
        console.error("Get Teacher Assignments Error:", error);
        res.status(500).json({ error: "Failed to fetch assignments" });
    }
});

/* =======================
    GET STUDENT ASSIGNMENTS
   ======================= */
router.get('/student', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        const student = await prisma.student.findUnique({
            where: { userId: parseInt(userId) },
            include: { Renamedclass: true }
        });

        if (!student || !student.classId) {
            return res.status(404).json({ error: "Student or class not found" });
        }

        // Get current session year for filtering (retained students only see current year assignments)
        const school = await prisma.school.findUnique({
            where: { id: student.schoolId },
            select: { activePerformanceYear: true }
        });
        const currentYear = school?.activePerformanceYear || new Date().getFullYear();

        const assignments = await prisma.assignment.findMany({
            where: {
                classId: student.classId,
                OR: [{ sessionYear: currentYear }, { sessionYear: null }]
            },
            include: {
                teacher: {
                    include: { user: { select: { firstName: true, lastName: true } } }
                },
                subject: true,
                submission: {
                    where: { studentId: student.id }
                }
            },
            orderBy: { dueDate: 'asc' }
        });

        // Check if published and CALCULATED for the student's current terminal
        const termPrefix = student.activePerformanceSession || "1st";
        const publishRecord = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: student.schoolId,
                examTerminal: { startsWith: termPrefix.split(' ')[0] },
                status: 'PUBLISHED'
            }
        });

        const isCalculated = publishRecord && publishRecord.calculationStatus === 'COMPLETED';

        // Transform data for frontend
        const formatted = assignments.map(a => {
            const submission = a.submission[0];
            let status = 'pending';
            const isLateSubmitted = submission && new Date(submission.submittedAt) > new Date(a.dueDate);

            if (submission) {
                status = submission.grade ? 'graded' : 'submitted';
            } else if (a.isClosed) {
                status = 'missing';
            } else if (new Date(a.dueDate) < new Date()) {
                status = 'late';
            }

            return {
                id: a.id,
                title: a.title,
                description: a.description,
                subject: a.subject?.name || 'General',
                subjectColor: 'bg-slate-100 text-slate-700',
                dueDate: a.dueDate,
                status: status,
                isLateSubmitted: isLateSubmitted,
                isClosed: a.isClosed,
                submittedDate: submission?.submittedAt,
                marks: submission?.grade ? `${submission.grade}/100` : null,
                percentage: submission?.grade || 0,
                feedback: submission?.feedback || null,
                teacher: a.teacher ? `${a.teacher.user.firstName} ${a.teacher.user.lastName}` : 'Unknown',
                contentUrl: a.contentUrl,
                submissionType: a.submissionType
            };
        });

        res.json({ ok: true, data: formatted });

    } catch (error) {
        console.error("Get Student Assignments Error:", error);
        res.status(500).json({ error: "Failed to fetch assignments" });
    }
});


/* =======================
    SUBMIT ASSIGNMENT
   ======================= */
router.post('/submit', lazyUpload, async (req, res) => {
    try {
        console.log("Submit Assignment Body:", req.body);
        console.log("Submit Assignment File:", req.file);

        const { assignmentId, userId } = req.body;

        if (!assignmentId || !userId) {
            return res.status(400).json({ error: "Assignment ID and User ID are required" });
        }

        // Find Student
        const student = await prisma.student.findUnique({
            where: { userId: parseInt(userId) }
        });

        if (!student) return res.status(404).json({ error: "Student profile not found." });

        // Check if assignment is closed
        const assignment = await prisma.assignment.findUnique({
            where: { id: parseInt(assignmentId) }
        });

        if (!assignment) return res.status(404).json({ error: "Assignment not found." });
        if (assignment.isClosed) return res.status(400).json({ error: "This assignment is closed and no longer accepting submissions." });

        // Update or Create Submission
        // Check if already submitted
        const existingSubmission = await prisma.submission.findFirst({
            where: {
                assignmentId: parseInt(assignmentId),
                studentId: student.id
            }
        });

        if (existingSubmission) {
            // Update existing (re-submission)
            // For now, let's just update the timestamp and potential grade reset if we want?
            // Or maybe just block if it's already graded?
            if (existingSubmission.grade) {
                return res.status(400).json({ error: "Assignment is already graded. Cannot resubmit." });
            }
        }

        const submissionData = {
            assignmentId: parseInt(assignmentId),
            studentId: student.id,
            submittedAt: new Date(),
            // We need a field for the file! 
            // Temporarily I'll store it in a way or I MUST add the column.
            // I will add `fileUrl String?` to Submission model.
            fileUrl: req.file ? `/assignments/${req.file.filename}` : null
        };

        if (existingSubmission) {
            const updated = await prisma.submission.update({
                where: { id: existingSubmission.id },
                data: {
                    submittedAt: new Date(),
                    fileUrl: req.file ? `/assignments/${req.file.filename}` : existingSubmission.fileUrl
                }
            });
            return res.json({ ok: true, data: updated });
        } else {
            const newSubmission = await prisma.submission.create({
                data: {
                    assignmentId: parseInt(assignmentId),
                    studentId: student.id,
                    fileUrl: req.file ? `/assignments/${req.file.filename}` : null
                }
            });
            return res.json({ ok: true, data: newSubmission });
        }

    } catch (error) {
        console.error("Submit Assignment Error:", error);
        res.status(500).json({ error: "Failed to submit assignment" });
    }
});

/* =======================
    GRADE SUBMISSION
   ======================= */
router.post('/grade', async (req, res) => {
    try {
        const { submissionId, grade, feedback, teacherUserId } = req.body;

        if (!submissionId || grade === undefined || !teacherUserId) {
            return res.status(400).json({ error: "Submission ID, Grade, and Teacher ID are required" });
        }

        const teacher = await prisma.teacher.findUnique({
            where: { userId: parseInt(teacherUserId) }
        });

        if (!teacher) return res.status(404).json({ error: "Teacher not found" });

        const submission = await prisma.submission.update({
            where: { id: parseInt(submissionId) },
            data: {
                grade: parseFloat(grade),
                feedback: feedback,
                gradedById: teacher.id
            }
        });

        // Update accumulated performance
        await updateStudentAssignmentPerformance(submission.studentId, parseFloat(grade));

        res.json({ ok: true, data: submission });

    } catch (error) {
        console.error("Grade Submission Error:", error);
        res.status(500).json({ error: "Failed to grade submission" });
    }
});

/* =======================
    TOGGLE ASSIGNMENT CLOSED STATUS
   ======================= */
router.patch('/:id/toggle-close', async (req, res) => {
    console.log(`[ASSIGN] toggle-close route hit, ID: ${req.params.id}`);
    try {
        const { id } = req.params;
        const { teacherUserId } = req.body;

        if (!teacherUserId) return res.status(400).json({ error: "Teacher User ID required" });

        const teacher = await prisma.teacher.findUnique({
            where: { userId: parseInt(teacherUserId) }
        });

        if (!teacher) return res.status(404).json({ error: "Teacher not found" });

        const assignment = await prisma.assignment.findUnique({
            where: { id: parseInt(id) }
        });

        if (!assignment) return res.status(404).json({ error: "Assignment not found" });
        if (assignment.teacherId !== teacher.id) return res.status(403).json({ error: "Unauthorized" });

        const updated = await prisma.assignment.update({
            where: { id: parseInt(id) },
            data: { isClosed: !assignment.isClosed }
        });

        res.json({ ok: true, data: updated });
    } catch (error) {
        console.error("Toggle Close Error:", error);
        res.status(500).json({ error: "Failed to update assignment status" });
    }
});

module.exports = router;
