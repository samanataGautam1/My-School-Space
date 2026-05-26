const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, allowRoles } = require('../../middleware/auth');
const fs = require('fs');
const path = require('path');
const { uploadToCloudinary, deleteFromCloudinary, isCloudinaryConfigured, extractPublicId, isCloudinaryUrl } = require('../../utils/cloudinary');
const prisma = new PrismaClient();
const router = express.Router();

// Configure Multer for File Uploads (Lazy Loaded)
const getUpload = () => {
    const multer = require('multer');

    const uploadDir = path.join(__dirname, '../../uploads/materials');
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
        limits: { fileSize: 500 * 1024 * 1024 }, // Increased to 500MB
        fileFilter: (req, file, cb) => {
            if (file.fieldname === 'video' && file.mimetype.startsWith('video/')) {
                cb(null, true);
            } else if (file.fieldname === 'thumbnail' && file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error(`Invalid file type for ${file.fieldname}. Videos must be video/* and thumbnails must be image/*.`), false);
            }
        }
    });
};

const lazyUpload = (req, res, next) => {
    const upload = getUpload();
    upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }])(req, res, next);
};

/* =======================
    TEACHER: CREATE STUDY MATERIAL
   ======================= */
router.post('/create', authMiddleware, allowRoles('TEACHER'), lazyUpload, async (req, res) => {
    try {
        const { title, description, subjectId, classId, className, subjectName, deadline, quizsets } = req.body;
        const teacherUserId = Number(req.user.userId);

        let fileUrl = req.body.fileUrl;
        let thumbnailUrl = null;
        const useCloudinary = isCloudinaryConfigured();

        if (req.files) {
            if (req.files['video'] && req.files['video'][0]) {
                if (useCloudinary) {
                    const videoResult = await uploadToCloudinary(req.files['video'][0].path, {
                        resource_type: 'video',
                        folder: 'school-space/materials'
                    });
                    fileUrl = videoResult.secure_url;
                    // Clean up local temp file
                    try { fs.unlinkSync(req.files['video'][0].path); } catch (e) { /* ignore */ }
                } else {
                    fileUrl = `/materials/${req.files['video'][0].filename}`;
                }
            }
            if (req.files['thumbnail'] && req.files['thumbnail'][0]) {
                if (useCloudinary) {
                    const thumbResult = await uploadToCloudinary(req.files['thumbnail'][0].path, {
                        resource_type: 'image',
                        folder: 'school-space/thumbnails'
                    });
                    thumbnailUrl = thumbResult.secure_url;
                    // Clean up local temp file
                    try { fs.unlinkSync(req.files['thumbnail'][0].path); } catch (e) { /* ignore */ }
                } else {
                    thumbnailUrl = `/materials/${req.files['thumbnail'][0].filename}`;
                }
            }
        }

        const teacher = await prisma.teacher.findUnique({
            where: { userId: teacherUserId }
        });

        if (!teacher) return res.status(404).json({ error: "Teacher profile not found." });

        let finalClassId = classId ? parseInt(classId) : null;
        if (!finalClassId && className) {
            const match = className.trim().match(/^(\d+)\s*([A-Za-z])$/);
            if (match) {
                const name = match[1];
                const section = match[2].toUpperCase();
                let cls = await prisma.Renamedclass.findFirst({
                    where: { schoolId: teacher.schoolId, name: name, section: section }
                });
                if (cls) finalClassId = cls.id;
            }
        }

        let finalSubjectId = subjectId ? parseInt(subjectId) : null;
        if (!finalSubjectId && subjectName) {
            let sub = await prisma.subject.findFirst({
                where: { schoolId: teacher.schoolId, name: subjectName.trim() }
            });
            if (sub) finalSubjectId = sub.id;
        }

        if (!finalClassId || !finalSubjectId) {
            return res.status(400).json({ error: "Class and Subject are required and must be valid." });
        }

        // Validate Quizzes
        let quizSetsData = [];
        try {
            quizSetsData = quizsets ? JSON.parse(quizsets) : [];
        } catch (e) {
            return res.status(400).json({ error: "Invalid quiz data format." });
        }

        if (quizSetsData.length === 0) {
            return res.status(400).json({ error: "At least one quiz set is compulsory." });
        }

        if (quizSetsData.length > 4) {
            return res.status(400).json({ error: "Maximum 4 quiz sets allowed per video." });
        }

        for (const set of quizSetsData) {
            if (!set.questions || set.questions.length < 5) {
                return res.status(400).json({ error: "Each quiz set must include at least 5 questions." });
            }
        }

        const newMaterial = await prisma.studymaterial.create({
            data: {
                title,
                description,
                subjectId: finalSubjectId,
                classId: finalClassId,
                teacherId: teacher.id,
                fileUrl: fileUrl,
                thumbnailUrl: thumbnailUrl,
                content: req.body.content,
                type: 'VIDEO',
                deadline: deadline ? new Date(deadline) : null,
                quizsets: {
                    create: quizSetsData.map(set => ({
                        questions: {
                            create: set.questions.map(q => ({
                                type: q.type,
                                text: q.text,
                                options: q.options || null
                            }))
                        }
                    }))
                }
            },
            include: { quizsets: { include: { questions: true } } }
        });

        // 2. Notify all students in the class
        const students = await prisma.student.findMany({
            where: { classId: finalClassId, isApproved: true },
            select: { id: true }
        });

        if (students.length > 0) {
            const notificationMsg = `New Study Material: ${title} assigned for Class ${className || finalClassId}${deadline ? ` (Due: ${new Date(deadline).toLocaleDateString()})` : ''}`;
            await prisma.notification.createMany({
                data: students.map(s => ({
                    message: notificationMsg,
                    studentId: s.id,
                    schoolId: teacher.schoolId,
                    type: 'INFO'
                }))
            });
        }

        res.json({ ok: true, data: newMaterial });
    } catch (error) {
        console.error("Create Material Error:", error);
        res.status(500).json({ error: "Failed to create material" });
    }
});

/* =======================
    TEACHER: GET OWN MATERIALS
   ======================= */
router.get('/teacher', authMiddleware, allowRoles('TEACHER'), async (req, res) => {
    try {
        const teacher = await prisma.teacher.findUnique({
            where: { userId: Number(req.user.userId) }
        });

        if (!teacher) return res.status(404).json({ error: "Teacher not found" });

        const materials = await prisma.studymaterial.findMany({
            where: { teacherId: teacher.id },
            include: { 
                Renamedclass: true, 
                subject: true,
                quizsets: {
                    include: { questions: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ ok: true, data: materials });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch materials" });
    }
});

/* =======================
    STUDENT: GET MATERIALS
   ======================= */
router.get('/student', authMiddleware, allowRoles('STUDENT'), async (req, res) => {
    try {
        const student = await prisma.student.findUnique({
            where: { userId: Number(req.user.userId) },
            include: { Renamedclass: true }
        });

        if (!student || !student.classId) {
            return res.status(404).json({ error: "Student or class not found" });
        }

        const materials = await prisma.studymaterial.findMany({
            where: { classId: student.classId },
            include: {
                teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
                subject: true,
                quizsets: { include: { questions: true } },
                studentmaterialstatus: { where: { studentId: student.id } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Get all response IDs for this student to quickly check completion (only non-empty answers)
        const studentResponses = await prisma.quizresponse.findMany({
            where: { 
                studentId: student.id,
                NOT: { answer: "" }
            },
            select: { questionId: true, answer: true }
        });
        
        // Further filter for whitespace only in JS
        const validRespondedQuestionIds = new Set(
            studentResponses
                .filter(r => r.answer && r.answer.trim() !== "")
                .map(r => r.questionId)
        );

        const formatted = materials.map(m => ({
            id: m.id,
            title: m.title,
            description: m.description,
            subject: m.subject?.name || 'General',
            fileUrl: m.fileUrl,
            thumbnailUrl: m.thumbnailUrl || null,
            content: m.content,
            teacher: m.teacher ? `${m.teacher.user.firstName} ${m.teacher.user.lastName}` : 'Unknown',
            createdAt: m.createdAt,
            deadline: m.deadline,
            quizsets: m.quizsets.map(qs => ({
                ...qs,
                isSubmitted: qs.questions.length > 0 && qs.questions.every(q => validRespondedQuestionIds.has(q.id))
            })),
            status: m.studentmaterialstatus[0]?.status || 'TODO',
            lastPosition: m.studentmaterialstatus[0]?.lastPosition || 0,
            totalDuration: m.studentmaterialstatus[0]?.totalDuration || 0,
            completedAt: m.studentmaterialstatus[0]?.completedAt || null
        }));

        res.json({ ok: true, data: formatted });
    } catch (error) {
        console.error("Failed to fetch materials error:", error);
        res.status(500).json({ error: "Failed to fetch materials" });
    }
});

/* =======================
    STUDENT: UPDATE PROGRESS
   ======================= */
router.post('/progress', authMiddleware, allowRoles('STUDENT'), async (req, res) => {
    try {
        const { materialId, position, totalDuration } = req.body;
        const student = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });

        if (!student) return res.status(404).json({ error: "Student not found" });

        const numericPosition = parseFloat(position) || 0;
        const numericTotal = parseFloat(totalDuration) || 0;

        let statusRecord = await prisma.studentmaterialstatus.findUnique({
            where: {
                studentId_studyMaterialId: {
                    studentId: student.id,
                    studyMaterialId: parseInt(materialId)
                }
            }
        });

        let newStatus = 'IN_PROGRESS';
        if (numericTotal > 0 && numericPosition >= numericTotal * 0.95) {
            newStatus = 'DONE';
        } else if (statusRecord && statusRecord.status === 'DONE') {
            newStatus = 'DONE';
        } else if (numericPosition === 0 && (!statusRecord || statusRecord.lastPosition === 0)) {
            newStatus = 'TODO';
        }

        const updated = await prisma.studentmaterialstatus.upsert({
            where: {
                studentId_studyMaterialId: {
                    studentId: student.id,
                    studyMaterialId: parseInt(materialId)
                }
            },
            update: {
                lastPosition: numericPosition,
                totalDuration: numericTotal,
                status: newStatus,
                updatedAt: new Date(),
                completedAt: (newStatus === 'DONE' && (!statusRecord || statusRecord.status !== 'DONE')) ? new Date() : (statusRecord ? statusRecord.completedAt : null)
            },
            create: {
                studentId: student.id,
                studyMaterialId: parseInt(materialId),
                lastPosition: numericPosition,
                totalDuration: numericTotal,
                status: newStatus,
                completedAt: newStatus === 'DONE' ? new Date() : null
            }
        });

        res.json({ ok: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: "Failed to update progress" });
    }
});

/* =======================
    TEACHER: GET MATERIAL ANALYTICS
   ======================= */
router.get('/analytics/:id', authMiddleware, allowRoles('TEACHER'), async (req, res) => {
    try {
        const materialId = parseInt(req.params.id);
        const teacherUserId = Number(req.user.userId);

        // Verify teacher owns this material
        const material = await prisma.studymaterial.findFirst({
            where: {
                id: materialId,
                teacher: { userId: teacherUserId }
            },
            include: { Renamedclass: true }
        });

        if (!material) {
            return res.status(404).json({ error: "Material not found or access denied" });
        }

        // Get all students in the class
        const students = await prisma.student.findMany({
            where: { classId: material.classId },
            include: { user: { select: { firstName: true, lastName: true } } },
            orderBy: { rollNo: 'asc' }
        });

        // Get status for each student
        const statuses = await prisma.studentmaterialstatus.findMany({
            where: { studyMaterialId: materialId }
        });

        // Get total questions for this material
        const totalQuestions = await prisma.question.count({
            where: {
                quizset: {
                    studyMaterialId: materialId
                }
            }
        });

        // Map status to student
        const analytics = await Promise.all(students.map(async student => {
            const statusRecord = statuses.find(s => s.studentId === student.id);
            
            // Get responses for this student and material
            const responses = await prisma.quizresponse.findMany({
                where: {
                    studentId: student.id,
                    question: {
                        quizset: {
                            studyMaterialId: materialId
                        }
                    }
                },
                include: {
                    question: true
                }
            });

            const validResponses = responses.filter(r => r.answer && r.answer.trim() !== "");
            const filteredCount = validResponses.length;
            

            return {
                studentId: student.id,
                name: `${student.user.firstName} ${student.user.lastName}`,
                rollNo: student.rollNo,
                status: statusRecord ? statusRecord.status : 'TODO',
                watched: statusRecord ? (statusRecord.totalDuration > 0 ? Math.round((statusRecord.lastPosition / statusRecord.totalDuration) * 100) : 0) : 0,
                lastActive: statusRecord ? statusRecord.updatedAt : null,
                solvedQuestions: filteredCount,
                responses: responses.map(r => ({
                    id: r.id,
                    questionText: r.question.text,
                    answer: r.answer,
                    feedback: r.feedback,
                    isCorrect: r.isCorrect
                }))
            };
        }));

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({ ok: true, data: analytics, totalQuestions });
    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

/* =======================
    STUDENT: SUBMIT QUIZ ANSWERS
   ======================= */
router.post('/quiz/submit', authMiddleware, allowRoles('STUDENT'), async (req, res) => {
    try {
        const { responses } = req.body; // Array of { questionId, answer }
        const student = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });

        if (!student) return res.status(404).json({ error: "Student not found" });
        if (!responses || !Array.isArray(responses) || responses.length === 0) {
            return res.status(400).json({ error: "No responses provided" });
        }

        // Check if student already answered any of these questions (no retakes allowed)
        const questionIds = responses.map(r => parseInt(r.questionId));
        const existingResponses = await prisma.quizresponse.findMany({
            where: {
                studentId: student.id,
                questionId: { in: questionIds }
            },
            select: { questionId: true }
        });

        if (existingResponses.length > 0) {
            return res.status(400).json({
                error: "You have already submitted answers for this quiz. Retakes are not allowed.",
                alreadyAnswered: existingResponses.map(r => r.questionId)
            });
        }

        // Create new responses (no upsert — first attempt only)
        const operations = responses.map(resp => prisma.quizresponse.create({
            data: {
                studentId: student.id,
                questionId: parseInt(resp.questionId),
                answer: resp.answer
            }
        }));

        await Promise.all(operations);
        res.json({ ok: true, message: "Quiz submitted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to submit quiz responses" });
    }
});

/* =======================
    STUDENT: GET QUIZ HISTORY
   ======================= */
router.get('/quiz/history', authMiddleware, allowRoles('STUDENT'), async (req, res) => {
    try {
        const student = await prisma.student.findUnique({
            where: { userId: Number(req.user.userId) }
        });

        if (!student) return res.status(404).json({ error: "Student not found" });

        const history = await prisma.quizresponse.findMany({
            where: { studentId: student.id },
            include: {
                question: {
                    include: {
                        quizset: {
                            include: {
                                studymaterial: {
                                    include: { subject: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ ok: true, data: history });
    } catch (error) {
        console.error("Quiz History Error:", error);
        res.status(500).json({ error: "Failed to fetch quiz history" });
    }
});

/* =======================
    TEACHER: ADD FEEDBACK TO QUIZ RESPONSE
   ======================= */
router.post('/quiz/feedback', authMiddleware, allowRoles('TEACHER'), async (req, res) => {
    try {
        const { responseId, feedback, isCorrect } = req.body;
        
        const updated = await prisma.quizresponse.update({
            where: { id: parseInt(responseId) },
            data: {
                feedback,
                isCorrect: isCorrect === null ? null : (isCorrect === true || isCorrect === 'true')
            }
        });

        res.json({ ok: true, data: updated });
    } catch (error) {
        console.error("Quiz Feedback Error:", error);
        res.status(500).json({ error: "Failed to save feedback" });
    }
});
/* =======================
    DELETE STUDY MATERIAL
   ======================= */
router.delete('/:id', authMiddleware, allowRoles('TEACHER'), async (req, res) => {
    try {
        const materialId = parseInt(req.params.id);
        const userId = Number(req.user.userId);

        // Find the material first to get file paths and verify ownership
        const material = await prisma.studymaterial.findUnique({
            where: { id: materialId },
            include: { teacher: true }
        });

        if (!material) return res.status(404).json({ error: "Material not found" });

        // Verify that the teacher owns this material
        if (material.teacher.userId !== userId) {
            return res.status(403).json({ error: "You are not authorized to delete this material" });
        }

        // 1. Delete associated files (Cloudinary or local)
        const deleteFile = (relativeUrl) => {
            if (!relativeUrl) return;
            const fileName = path.basename(relativeUrl);
            const filePath = path.join(__dirname, '../../uploads/materials', fileName);

            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted file: ${filePath}`);
                } catch (err) {
                    console.error(`Error deleting file ${filePath}:`, err);
                }
            }
        };

        // Delete from Cloudinary if URLs are Cloudinary URLs
        if (isCloudinaryUrl(material.fileUrl)) {
            const publicId = extractPublicId(material.fileUrl);
            if (publicId) {
                try { await deleteFromCloudinary(publicId, 'video'); } catch (err) { console.error('Cloudinary video delete error:', err); }
            }
        } else {
            deleteFile(material.fileUrl);
        }

        if (isCloudinaryUrl(material.thumbnailUrl)) {
            const publicId = extractPublicId(material.thumbnailUrl);
            if (publicId) {
                try { await deleteFromCloudinary(publicId, 'image'); } catch (err) { console.error('Cloudinary thumbnail delete error:', err); }
            }
        } else {
            deleteFile(material.thumbnailUrl);
        }

        // 2. Delete the database record (Cascade will handle quizsets, questions, statuses)
        await prisma.studymaterial.delete({
            where: { id: materialId }
        });

        res.json({ ok: true, message: "Material and associated files deleted successfully" });
    } catch (error) {
        console.error("Delete Material Error:", error);
        res.status(500).json({ error: "Failed to delete material" });
    }
});

module.exports = router;

