const express = require("express");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const {
  validateName,
  validateEmail,
  validatePassword,
  validateUsername,
  validateSchoolCode,
  validateSchoolName,
  validateSubjectName,
  validateRollNo,
  validateClassNames,
  validateStudentCodes
} = require("../../utils/validators");

const prisma = new PrismaClient();
const router = express.Router();

const generateStudentCode = (schoolCode) => {
  // Ensure 4 letters from school code (pad if needed, or cut)
  const prefix = (schoolCode || 'SCHL').substring(0, 4).toUpperCase();
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars

  console.log("Generating Student Code. SchoolCode:", schoolCode);
  const code = `${prefix}${suffix}`;
  console.log("Generated Code:", code);
  return code;
};

/* ================= ADMIN SIGNUP ================= */
router.post('/admin', async (req, res) => {
  const { username, password, firstName, lastName, schoolName, schoolCode, email } = req.body;

  // Validate inputs
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: usernameValidation.error });
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.error });
  }

  const firstNameValidation = validateName(firstName, 'First Name');
  if (!firstNameValidation.valid) {
    return res.status(400).json({ error: firstNameValidation.error });
  }

  const lastNameValidation = validateName(lastName, 'Last Name');
  if (!lastNameValidation.valid) {
    return res.status(400).json({ error: lastNameValidation.error });
  }

  const schoolNameValidation = validateSchoolName(schoolName);
  if (!schoolNameValidation.valid) {
    return res.status(400).json({ error: schoolNameValidation.error });
  }

  const schoolCodeValidation = validateSchoolCode(schoolCode);
  if (!schoolCodeValidation.valid) {
    return res.status(400).json({ error: schoolCodeValidation.error });
  }

  // Validate email - REQUIRE GMAIL FOR ADMIN
  const emailValidation = validateEmail(email, false);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  try {
    // Check if school code already exists and email matches (Pre-registration check for Admin)
    const schoolExists = await prisma.school.findUnique({
      where: { code: schoolCodeValidation.value },
      select: { id: true, email: true, adminId: true }
    });

    if (schoolExists) {
      if (schoolExists.adminId) {
        return res.status(400).json({
          error: "This school already has an administrator. Please contact them or support."
        });
      }
      if (schoolExists.email && schoolExists.email !== emailValidation.value) {
        return res.status(400).json({
          error: "Email isn't registered for this school, try another"
        });
      }
    }

    // Check if username already exists
    const usernameExists = await prisma.user.findUnique({
      where: { username: usernameValidation.value }
    });
    if (usernameExists) {
      return res.status(400).json({
        error: "Username already taken. Please choose a different username."
      });
    }

    // Check if email already exists
    const emailExists = await prisma.user.findUnique({
      where: { email: emailValidation.value }
    });
    if (emailExists) {
      return res.status(400).json({
        error: "Email already registered. Please login."
      });
    }

    // Generate verification code
    const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const emailPass = (req.body.emailPass || '').trim();

    const hash = await bcrypt.hash(passwordValidation.value, 10);

    // Store in PendingRegistration
    await prisma.pendingregistration.upsert({
      where: { email: emailValidation.value },
      update: {
        data: {
          username: usernameValidation.value,
          password: hash,
          firstName: firstNameValidation.value,
          lastName: lastNameValidation.value,
          schoolName: schoolNameValidation.value,
          schoolCode: schoolCodeValidation.value,
          email: emailValidation.value,
          emailPass: emailPass,
          type: 'ADMIN'
        },
        code: verificationCode,
        expiresAt
      },
      create: {
        email: emailValidation.value,
        data: {
          username: usernameValidation.value,
          password: hash,
          firstName: firstNameValidation.value,
          lastName: lastNameValidation.value,
          schoolName: schoolNameValidation.value,
          schoolCode: schoolCodeValidation.value,
          email: emailValidation.value,
          emailPass: emailPass,
          type: 'ADMIN'
        },
        code: verificationCode,
        expiresAt
      }
    });

    const { sendVerificationEmail } = require("../../services/mailer");
    await sendVerificationEmail(
      emailValidation.value,
      verificationCode,
      firstNameValidation.value,
      { smtpUser: emailValidation.value, smtpPass: emailPass }
    );



    res.json({
      ok: true,
      message: "Welcome to School Space! A verification code has been sent to your email. Please write the OTP code to verify your account.",
      requiresVerification: true,
      email: emailValidation.value,

    });
  } catch (err) {
    console.error("Admin Registration Error:", err.message);
    res.status(500).json({
      error: "Failed to initiate admin registration. Please try again.",
      details: err.message
    });
  }
});

/* ================= TEACHER SIGNUP ================= */
router.post("/teacher", async (req, res) => {
  console.log("Teacher Signup Request Body:", JSON.stringify(req.body, null, 2)); // Debug log

  const { username, password, firstName, lastName, email, schoolCode, assignments } = req.body;

  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: usernameValidation.error });
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.error });
  }

  // Validate first name
  const firstNameValidation = validateName(firstName, "First name");
  if (!firstNameValidation.valid) {
    return res.status(400).json({ error: firstNameValidation.error });
  }

  // Validate last name
  const lastNameValidation = validateName(lastName, "Last name");
  if (!lastNameValidation.valid) {
    return res.status(400).json({ error: lastNameValidation.error });
  }

  // Validate school code
  const schoolCodeValidation = validateSchoolCode(schoolCode);
  if (!schoolCodeValidation.valid) {
    return res.status(400).json({ error: schoolCodeValidation.error });
  }

  // Validate assignments structure
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: "At least one subject-class assignment is required" });
  }

  const invalidAssignments = [];
  for (const assign of assignments) {
    const { subject: subName, className: clsInput } = assign;

    // Validate Subject Name
    const subNameValidation = validateSubjectName(subName);
    if (!subNameValidation.valid) {
      invalidAssignments.push(`${subName || 'Empty Subject'} (${subNameValidation.error})`);
      continue;
    }

    // Validate Class Format
    if (!clsInput || typeof clsInput !== 'string') {
      invalidAssignments.push(`${subName} (Missing Class)`);
      continue;
    }
    const classMatch = clsInput.trim().match(/^(\d+)\s*([A-Za-z])$/);
    if (!classMatch) {
      invalidAssignments.push(`${subName} for ${clsInput} (Invalid Class Format - use '10A')`);
    }
  }

  if (invalidAssignments.length > 0) {
    return res.status(400).json({
      error: `Invalid assignments: ${invalidAssignments.join(", ")}. Class format must be like '10A'.`
    });
  }

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  try {
    // Check if school exists
    const school = await prisma.school.findUnique({
      where: { code: schoolCodeValidation.value },
      select: { id: true, code: true, email: true, emailPass: true }
    });

    if (!school) {
      return res.status(400).json({
        error: "Invalid school code. Please check with your school administrator."
      });
    }

    // Role-specific check is removed to allow self-registration
    // We only check if the user already exists in the User table (handled below)

    // Check for Class Head conflict (if signing up as class teacher)
    const { classTeacherFor } = req.body;
    if (classTeacherFor) {
      const classMatch = classTeacherFor.trim().match(/^(\d+)\s*([A-Za-z])$/);
      if (classMatch) {
        const gradeName = classMatch[1];
        const sectionName = classMatch[2].toUpperCase();

        console.log(`[TEACHER_SIGNUP] Checking class head conflict for ${gradeName}${sectionName}. Prisma keys:`, Object.keys(prisma).filter(k => k.toLowerCase().includes('class')));
        const classModel = prisma.renamedclass || prisma.Renamedclass;
        const existingClassHead = await classModel.findFirst({
          where: {
            name: gradeName,
            section: sectionName,
            schoolId: school.id,
            NOT: { classHeadId: null }
          }
        });

        if (existingClassHead) {
          return res.status(400).json({
            error: `Class ${gradeName}${sectionName} already has a designated class teacher.`
          });
        }

        // Check if anyone else has a PENDING registration for the same class
        const allPending = await prisma.pendingregistration.findMany();
        const conflict = allPending.find(p => {
          const pData = p.data;
          return pData.type === 'TEACHER' &&
            pData.classTeacherFor &&
            pData.classTeacherFor.trim().toUpperCase() === classTeacherFor.trim().toUpperCase();
        });

        if (conflict) {
          return res.status(400).json({
            error: `Someone else has already initiated registration as the class teacher for ${classTeacherFor}.`
          });
        }
      }
    }

    // Check if username already exists (in User table)
    const usernameExists = await prisma.user.findUnique({
      where: { username: usernameValidation.value }
    });
    if (usernameExists) {
      return res.status(400).json({
        error: "Username already taken. Please choose a different username."
      });
    }

    // Check if email already exists (in User table)
    const emailExists = await prisma.user.findUnique({
      where: { email: emailValidation.value }
    });
    if (emailExists) {
      return res.status(400).json({
        error: "Email already registered. Please login."
      });
    }

    const hash = await bcrypt.hash(passwordValidation.value, 10);

    // Generate OTP
    const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
    const verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store in PendingRegistration (matching Admin logic)
    // First, clear any existing pending registration for this email
    await prisma.pendingregistration.deleteMany({
      where: { email: emailValidation.value }
    });

    await prisma.pendingregistration.create({
      data: {
        email: emailValidation.value,
        code: verificationCode,
        expiresAt: verificationCodeExpiresAt,
        data: {
          type: 'TEACHER',
          username: usernameValidation.value,
          password: hash,
          firstName: firstNameValidation.value,
          lastName: lastNameValidation.value,
          email: emailValidation.value,
          schoolCode: schoolCodeValidation.value,
          assignments: assignments,
          classTeacherFor: classTeacherFor
        }
      }
    });

    const { sendVerificationEmail } = require("../../services/mailer");
    console.log(`[TEACHER_SIGNUP] Attempting to send verification email to: ${emailValidation.value}`);
    try {
      await sendVerificationEmail(
        emailValidation.value,
        verificationCode,
        firstNameValidation.value,
        { smtpUser: school.email, smtpPass: school.emailPass }
      );
      console.log(`[TEACHER_SIGNUP] Email dispatch triggered successfully.`);
    } catch (mailErr) {
      console.error(`[TEACHER_SIGNUP] EMAIL DISPATCH FAILED: ${mailErr.message}`);
      return res.status(500).json({
        error: "Failed to send verification email. " + mailErr.message,
        details: mailErr.message
      });
    }



    // Notify School Admin
    if (school && school.id) {
      try {
        const schoolWithAdmin = await prisma.school.findUnique({
          where: { id: school.id },
          select: { adminId: true }
        });
        if (schoolWithAdmin && schoolWithAdmin.adminId) {
          await prisma.notification.create({
            data: {
              adminId: schoolWithAdmin.adminId,
              message: `New Teacher Signup Attempt: ${firstNameValidation.value} ${lastNameValidation.value}`,
              schoolId: school.id
            }
          });
        }
      } catch (notifErr) {
        console.error("Failed to create teacher notification:", notifErr);
      }
    }

    res.json({
      ok: true,
      message: "Welcome to School Space! A verification code has been sent to your email. Please write the OTP code to verify your account.",
      requiresVerification: true,
      email: emailValidation.value,

    });
  } catch (err) {
    console.error("Teacher Registration Error:", err.message);
    res.status(500).json({ error: "Failed to initiate teacher registration. Please try again." });
  }
});

/* ================= STUDENT SIGNUP ================= */
router.post("/student", async (req, res) => {
  const { username, password, firstName, lastName, schoolCode, className, rollNo } = req.body;

  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: usernameValidation.error });
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.error });
  }

  // Validate first name
  const firstNameValidation = validateName(firstName, "First name");
  if (!firstNameValidation.valid) {
    return res.status(400).json({ error: firstNameValidation.error });
  }

  // Validate last name
  const lastNameValidation = validateName(lastName, "Last name");
  if (!lastNameValidation.valid) {
    return res.status(400).json({ error: lastNameValidation.error });
  }

  // Validate school code
  const schoolCodeValidation = validateSchoolCode(schoolCode);
  if (!schoolCodeValidation.valid) {
    return res.status(400).json({ error: schoolCodeValidation.error });
  }

  // Validate class name
  if (!className || typeof className !== 'string' || className.trim().length === 0) {
    return res.status(400).json({ error: "Class name is required" });
  }

  // Parse class name
  const classInput = className.trim();
  const classMatch = classInput.match(/^(\d+)\s*([A-Za-z])$/);

  if (!classMatch) {
    return res.status(400).json({
      error: "Invalid class format. Please use format like '10A' (grade number + section letter)"
    });
  }

  const gradeName = classMatch[1];
  const sectionName = classMatch[2].toUpperCase();

  // Validate roll number
  const rollNoValidation = validateRollNo(rollNo);
  if (!rollNoValidation.valid) {
    return res.status(400).json({ error: rollNoValidation.error });
  }

  try {
    // Check if school exists
    const school = await prisma.school.findUnique({
      where: { code: schoolCodeValidation.value },
      select: { id: true, adminId: true }
    });
    if (!school) {
      return res.status(400).json({ error: "Invalid school code." });
    }

    // Check if username already exists
    const usernameExists = await prisma.user.findUnique({
      where: { username: usernameValidation.value }
    });
    if (usernameExists) {
      return res.status(400).json({ error: "Username already taken." });
    }

    // Find or Create Class (Lazy Creation)
    const classModel = prisma.renamedclass || prisma.Renamedclass;
    let cls = await classModel.findFirst({
      where: {
        schoolId: school.id,
        name: gradeName,
        section: sectionName
      }
    });

    if (!cls) {
      cls = await classModel.create({
        data: {
          name: gradeName,
          section: sectionName,
          schoolId: school.id
        }
      });
    }

    // Check if roll number already exists in this class (including unapproved ones)
    const rollNoExists = await prisma.student.findFirst({
      where: { classId: cls.id, rollNo: rollNoValidation.value }
    });
    if (rollNoExists) {
      return res.status(400).json({
        error: `Roll number ${rollNoValidation.value} is already assigned in this class.`
      });
    }

    const hash = await bcrypt.hash(passwordValidation.value, 10);

    // Create User (Inactive) and Student (Unapproved)
    const newUser = await prisma.user.create({
      data: {
        username: usernameValidation.value,
        password: hash,
        firstName: firstNameValidation.value,
        lastName: lastNameValidation.value,
        role: 'STUDENT',
        schoolId: school.id,
        isActive: false, // Student cannot login until approved
        emailVerified: true // Bypassing email verification
      }
    });

    const newStudent = await prisma.student.create({
      data: {
        firstName: firstNameValidation.value,
        lastName: lastNameValidation.value,
        rollNo: rollNoValidation.value,
        studentCode: generateStudentCode(schoolCodeValidation.value),
        userId: newUser.id,
        schoolId: school.id,
        classId: cls.id,
        isApproved: false
      }
    });

    // Notify the Class Teacher
    if (cls.classHeadId) {
      try {
        await prisma.notification.create({
          data: {
            teacherId: cls.classHeadId, // Assuming notification can take teacherId or we use adminId logic
            message: `New student registration request for Class ${gradeName}${sectionName}: ${firstNameValidation.value} ${lastNameValidation.value}`,
            schoolId: school.id,
            type: 'APPROVAL_REQUEST'
          }
        });
      } catch (notifErr) {
        console.error("Failed to notify class teacher:", notifErr);
      }
    } else {
      // Notify admin if no class head
      if (school.adminId) {
        await prisma.notification.create({
          data: {
            adminId: school.adminId,
            message: `New student registration for Class ${gradeName}${sectionName} (No Class Head assigned): ${firstNameValidation.value} ${lastNameValidation.value}`,
            schoolId: school.id,
            type: 'APPROVAL_REQUEST'
          }
        });
      }
    }

    res.json({
      ok: true,
      message: "Registration successful! Your account is pending approval by your class head.",
      requiresApproval: true
    });
  } catch (err) {
    console.error("Student Registration Error:", err);
    res.status(500).json({ error: "Failed to process registration." });
  }
});

/* ================= PARENT SIGNUP ================= */
router.post("/parent", async (req, res) => {
  const { username, password, firstName, lastName, email, studentCodes } = req.body;

  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: usernameValidation.error });
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.error });
  }

  // Validate first name
  const firstNameValidation = validateName(firstName, "First name");
  if (!firstNameValidation.valid) {
    return res.status(400).json({ error: firstNameValidation.error });
  }

  // Validate last name
  const lastNameValidation = validateName(lastName, "Last name");
  if (!lastNameValidation.valid) {
    return res.status(400).json({ error: lastNameValidation.error });
  }

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  // Validate student codes
  const studentCodesValidation = validateStudentCodes(studentCodes);
  if (!studentCodesValidation.valid) {
    return res.status(400).json({ error: studentCodesValidation.error });
  }

  try {
    // 1. Role-specific pre-registration check removed to allow self-registration
    // We will verify student codes below to ensure valid linking.

    // Check if students exist
    const students = await prisma.student.findMany({
      where: { studentCode: { in: studentCodesValidation.value } }
    });

    if (!students.length) {
      return res.status(400).json({
        error: "No valid student codes found. Please check the student codes."
      });
    }

    if (students.length < studentCodesValidation.value.length) {
      const foundCodes = students.map(s => s.studentCode);
      const notFound = studentCodesValidation.value.filter(c => !foundCodes.includes(c));
      return res.status(400).json({
        error: `Some student codes were not found: ${notFound.join(", ")}`
      });
    }

    // Check if username already exists
    const usernameExists = await prisma.user.findUnique({
      where: { username: usernameValidation.value }
    });
    if (usernameExists) {
      return res.status(400).json({
        error: "Username already taken. Please choose a different username."
      });
    }

    // Check if email already exists
    const emailExists = await prisma.user.findUnique({
      where: { email: emailValidation.value }
    });
    if (emailExists) {
      return res.status(400).json({
        error: "Email already registered. Please login."
      });
    }

    const passwordHash = await bcrypt.hash(passwordValidation.value, 10);

    // Generate OTP
    const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
    const verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store in PendingRegistration
    await prisma.pendingregistration.deleteMany({
      where: { email: emailValidation.value }
    });

    await prisma.pendingregistration.create({
      data: {
        email: emailValidation.value,
        code: verificationCode,
        expiresAt: verificationCodeExpiresAt,
        data: {
          type: 'PARENT',
          username: usernameValidation.value,
          password: passwordHash,
          firstName: firstNameValidation.value,
          lastName: lastNameValidation.value,
          email: emailValidation.value,
          studentCodes: studentCodesValidation.value,
          schoolId: students[0].schoolId
        }
      }
    });

    // Get school info for SMTP fallback
    const school = await prisma.school.findUnique({
      where: { id: students[0].schoolId },
      select: { email: true, emailPass: true }
    });

    const { sendVerificationEmail } = require("../../services/mailer");
    console.log(`[PARENT_SIGNUP] Attempting to send verification email to: ${emailValidation.value}`);
    try {
      await sendVerificationEmail(
        emailValidation.value,
        verificationCode,
        firstNameValidation.value,
        { smtpUser: school?.email, smtpPass: school?.emailPass }
      );
      console.log(`[PARENT_SIGNUP] Email dispatch triggered successfully.`);
    } catch (mailErr) {
      console.error(`[PARENT_SIGNUP] EMAIL DISPATCH FAILED: ${mailErr.message}`);
      return res.status(500).json({
        error: "Failed to send verification email. " + mailErr.message,
        details: mailErr.message
      });
    }



    res.json({
      ok: true,
      message: "Welcome to School Space! A verification code has been sent to your email. Please write the OTP code to verify your account.",
      requiresVerification: true,
      email: emailValidation.value,

    });
  } catch (err) {
    console.error("Parent Registration Error:", err.message);
    res.status(500).json({ error: "Failed to initiate parent registration. Please try again." });
  }
});

module.exports = router;
