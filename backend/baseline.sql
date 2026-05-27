-- CreateTable
CREATE TABLE `assignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `classId` INTEGER NOT NULL,
    `subjectId` INTEGER NULL,
    `contentUrl` VARCHAR(191) NULL,
    `submissionType` VARCHAR(191) NULL DEFAULT 'BOTH',
    `dueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `teacherId` INTEGER NULL,
    `isClosed` BOOLEAN NOT NULL DEFAULT false,
    `sessionYear` INTEGER NULL,

    INDEX `Assignment_classId_fkey`(`classId`),
    INDEX `Assignment_subjectId_fkey`(`subjectId`),
    INDEX `Assignment_teacherId_fkey`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL,
    `studentId` INTEGER NOT NULL,
    `classId` INTEGER NOT NULL,
    `teacherId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Attendance_classId_fkey`(`classId`),
    INDEX `Attendance_teacherId_fkey`(`teacherId`),
    UNIQUE INDEX `Attendance_studentId_date_key`(`studentId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `section` VARCHAR(191) NOT NULL,
    `schoolId` INTEGER NOT NULL,
    `classHeadId` INTEGER NULL,

    UNIQUE INDEX `Class_classHeadId_key`(`classHeadId`),
    INDEX `Class_schoolId_fkey`(`schoolId`),
    UNIQUE INDEX `Class_name_section_schoolId_key`(`name`, `section`, `schoolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `classId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Enrollment_classId_fkey`(`classId`),
    UNIQUE INDEX `Enrollment_studentId_classId_year_key`(`studentId`, `classId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exammark` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `marks` DOUBLE NOT NULL,
    `passMarks` DOUBLE NULL,
    `fullMarks` DOUBLE NULL,
    `examTerminal` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `enteredById` INTEGER NULL,
    `practicalFullMarks` DOUBLE NULL,
    `practicalMarks` DOUBLE NULL,
    `practicalPassMarks` DOUBLE NULL,
    `status` VARCHAR(191) NULL DEFAULT 'PASSED',
    `theoryFullMarks` DOUBLE NULL,
    `theoryMarks` DOUBLE NULL,
    `theoryPassMarks` DOUBLE NULL,
    `totalFullMarks` DOUBLE NULL,
    `totalPassMarks` DOUBLE NULL,

    INDEX `ExamMark_enteredById_fkey`(`enteredById`),
    INDEX `ExamMark_subjectId_fkey`(`subjectId`),
    UNIQUE INDEX `ExamMark_studentId_subjectId_examTerminal_key`(`studentId`, `subjectId`, `examTerminal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `dueDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Fee_studentId_fkey`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `strength` VARCHAR(191) NULL,
    `weakness` VARCHAR(191) NULL,
    `opportunity` VARCHAR(191) NULL,
    `threat` VARCHAR(191) NULL,
    `suggestion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Feedback_studentId_fkey`(`studentId`),
    INDEX `Feedback_teacherId_fkey`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedbackrequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parentId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `teacherId` INTEGER NULL,
    `preference` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FeedbackRequest_parentId_fkey`(`parentId`),
    INDEX `FeedbackRequest_studentId_fkey`(`studentId`),
    INDEX `FeedbackRequest_teacherId_fkey`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromUserId` INTEGER NOT NULL,
    `toUserId` INTEGER NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` MEDIUMTEXT NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_fromUserId_fkey`(`fromUserId`),
    INDEX `Message_toUserId_fkey`(`toUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `message` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `type` VARCHAR(191) NOT NULL DEFAULT 'INFO',
    `adminId` INTEGER NULL,
    `studentId` INTEGER NULL,
    `schoolId` INTEGER NOT NULL,
    `teacherId` INTEGER NULL,
    `parentId` INTEGER NULL,

    INDEX `Notification_adminId_fkey`(`adminId`),
    INDEX `Notification_schoolId_fkey`(`schoolId`),
    INDEX `Notification_studentId_fkey`(`studentId`),
    INDEX `Notification_teacherId_fkey`(`teacherId`),
    INDEX `Notification_parentId_fkey`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `schoolId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Parent_email_key`(`email`),
    UNIQUE INDEX `Parent_userId_key`(`userId`),
    INDEX `Parent_schoolId_fkey`(`schoolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `passwordresetrequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `isUsed` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `PasswordResetRequest_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pendingregistration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PendingRegistration_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `potentialmetric` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `session` VARCHAR(191) NOT NULL DEFAULT '1st Session',
    `sessionYear` INTEGER NOT NULL DEFAULT 2026,
    `terminal` VARCHAR(191) NULL,
    `snapshotAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `examScore` DOUBLE NULL,
    `assignmentScore` DOUBLE NULL,
    `attendanceScore` DOUBLE NULL,
    `performanceTotal` DOUBLE NULL,
    `effortAssignment` DOUBLE NULL,
    `effortMaterials` DOUBLE NULL,
    `effortTotal` DOUBLE NULL,
    `curiosityQuiz` DOUBLE NULL,
    `curiosityMcq` DOUBLE NULL,
    `curiosityTotal` DOUBLE NULL,
    `learningSpeed` DOUBLE NULL,
    `potentialTotal` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_TEACHER_REVIEW',
    `monthYear` VARCHAR(191) NULL,
    `effort` DOUBLE NULL,
    `teacherMarks` DOUBLE NULL,
    `curiosity` INTEGER NULL,
    `curiosityData` JSON NULL,
    `learningSpeedData` JSON NULL,
    `examDeviation` DOUBLE NULL,
    `attendanceDeviation` DOUBLE NULL,

    UNIQUE INDEX `PotentialMetric_studentId_session_sessionYear_key`(`studentId`, `session`, `sessionYear`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rating` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `subjectId` INTEGER NULL,
    `classId` INTEGER NULL,
    `score` DOUBLE NOT NULL,
    `review` VARCHAR(191) NULL,
    `session` VARCHAR(191) NULL,
    `sessionYear` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Rating_classId_fkey`(`classId`),
    INDEX `Rating_studentId_fkey`(`studentId`),
    INDEX `Rating_subjectId_fkey`(`subjectId`),
    INDEX `Rating_teacherId_fkey`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `school` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `adminId` INTEGER NULL,
    `ratingsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `parentMessagingEnabled` BOOLEAN NOT NULL DEFAULT false,
    `multiClassTeachersEnabled` BOOLEAN NOT NULL DEFAULT false,
    `studentAnalyticsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `activeRatingYear` INTEGER NULL,
    `activePerformanceSession` VARCHAR(191) NULL,
    `activePerformanceYear` INTEGER NULL,
    `activeExamTerminal` VARCHAR(191) NULL,
    `activeRatingSession` VARCHAR(191) NULL,
    `emailPass` VARCHAR(255) NULL,
    `address` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,

    UNIQUE INDEX `School_code_key`(`code`),
    UNIQUE INDEX `School_adminId_key`(`adminId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessioncompletion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `classId` INTEGER NOT NULL,
    `teacherId` INTEGER NOT NULL,
    `session` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `schoolId` INTEGER NULL,

    INDEX `sessioncompletion_schoolId_fkey`(`schoolId`),
    INDEX `sessioncompletion_teacherId_fkey`(`teacherId`),
    UNIQUE INDEX `sessioncompletion_classId_session_year_key`(`classId`, `session`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schoolcoderequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `SchoolCodeRequest_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentCode` VARCHAR(191) NOT NULL,
    `rollNo` INTEGER NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `schoolId` INTEGER NOT NULL,
    `classId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `email` VARCHAR(191) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `promotionStatus` VARCHAR(191) NULL DEFAULT 'NONE',
    `graduatedAt` DATETIME(3) NULL,
    `graduationYear` INTEGER NULL,
    `promotionAcknowledgedAt` DATETIME(3) NULL,
    `previousClass` VARCHAR(191) NULL,

    UNIQUE INDEX `Student_studentCode_key`(`studentCode`),
    UNIQUE INDEX `Student_userId_key`(`userId`),
    UNIQUE INDEX `Student_email_key`(`email`),
    INDEX `Student_schoolId_fkey`(`schoolId`),
    UNIQUE INDEX `Student_classId_rollNo_key`(`classId`, `rollNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `studentmaterialstatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `studyMaterialId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'TODO',
    `lastPosition` DOUBLE NOT NULL DEFAULT 0,
    `totalDuration` DOUBLE NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `StudentMaterialStatus_studyMaterialId_fkey`(`studyMaterialId`),
    UNIQUE INDEX `StudentMaterialStatus_studentId_studyMaterialId_key`(`studentId`, `studyMaterialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `studymaterial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `fileUrl` VARCHAR(191) NULL,
    `thumbnailUrl` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'VIDEO',
    `content` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `teacherId` INTEGER NOT NULL,
    `classId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `deadline` DATETIME(3) NULL,

    INDEX `StudyMaterial_classId_fkey`(`classId`),
    INDEX `StudyMaterial_subjectId_fkey`(`subjectId`),
    INDEX `StudyMaterial_teacherId_fkey`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `schoolId` INTEGER NOT NULL,

    INDEX `Subject_schoolId_fkey`(`schoolId`),
    UNIQUE INDEX `Subject_name_schoolId_key`(`name`, `schoolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assignmentId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `grade` DOUBLE NULL,
    `gradedById` INTEGER NULL,
    `fileUrl` VARCHAR(191) NULL,
    `feedback` VARCHAR(191) NULL,

    INDEX `Submission_assignmentId_fkey`(`assignmentId`),
    INDEX `Submission_gradedById_fkey`(`gradedById`),
    INDEX `Submission_studentId_fkey`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `isClassTeacher` BOOLEAN NOT NULL DEFAULT false,
    `schoolId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('PENDING', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `email` VARCHAR(191) NULL,

    UNIQUE INDEX `Teacher_userId_key`(`userId`),
    UNIQUE INDEX `Teacher_email_key`(`email`),
    INDEX `Teacher_schoolId_fkey`(`schoolId`),
    UNIQUE INDEX `Teacher_userId_schoolId_key`(`userId`, `schoolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teachermessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `parentId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeacherMessage_parentId_fkey`(`parentId`),
    INDEX `TeacherMessage_studentId_fkey`(`studentId`),
    INDEX `TeacherMessage_teacherId_fkey`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teachersubject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `classId` INTEGER NOT NULL,

    INDEX `TeacherSubject_classId_fkey`(`classId`),
    INDEX `TeacherSubject_subjectId_fkey`(`subjectId`),
    UNIQUE INDEX `TeacherSubject_teacherId_subjectId_classId_key`(`teacherId`, `subjectId`, `classId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `feeId` INTEGER NULL,
    `studentId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `method` VARCHAR(191) NULL,

    INDEX `Transaction_feeId_fkey`(`feeId`),
    INDEX `Transaction_studentId_fkey`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'TEACHER', 'STUDENT', 'PARENT') NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `recoveryCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verificationCode` VARCHAR(191) NULL,
    `verificationCodeExpiresAt` DATETIME(3) NULL,
    `schoolId` INTEGER NULL,
    `failedAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockoutUntil` DATETIME(3) NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_schoolId_fkey`(`schoolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quizset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studyMaterialId` INTEGER NOT NULL,
    `timestamp` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quizset_studyMaterialId_fkey`(`studyMaterialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quizSetId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'MCQ',
    `text` TEXT NOT NULL,
    `options` JSON NULL,

    INDEX `question_quizSetId_fkey`(`quizSetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quizresponse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `answer` TEXT NOT NULL,
    `isCorrect` BOOLEAN NULL,
    `feedback` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quizresponse_questionId_fkey`(`questionId`),
    UNIQUE INDEX `quizresponse_studentId_questionId_key`(`studentId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjectexamsubmission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `classId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `examTerminal` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SUBMITTED',
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `teacherId` INTEGER NULL,

    INDEX `subjectexamsubmission_classId_idx`(`classId`),
    INDEX `subjectexamsubmission_subjectId_idx`(`subjectId`),
    INDEX `subjectexamsubmission_teacherId_idx`(`teacherId`),
    UNIQUE INDEX `subjectexamsubmission_classId_subjectId_examTerminal_key`(`classId`, `subjectId`, `examTerminal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classexamsubmission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `classId` INTEGER NOT NULL,
    `examTerminal` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SUBMITTED',
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `teacherId` INTEGER NULL,

    INDEX `classexamsubmission_classId_idx`(`classId`),
    INDEX `classexamsubmission_teacherId_idx`(`teacherId`),
    UNIQUE INDEX `classexamsubmission_classId_examTerminal_key`(`classId`, `examTerminal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schoolexampublish` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `schoolId` INTEGER NOT NULL,
    `examTerminal` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PUBLISHED',
    `calculationStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED',
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `calculationSnapshotAt` DATETIME(3) NULL,
    `adminId` INTEGER NULL,

    INDEX `schoolexampublish_schoolId_idx`(`schoolId`),
    INDEX `schoolexampublish_adminId_fkey`(`adminId`),
    UNIQUE INDEX `schoolexampublish_schoolId_examTerminal_key`(`schoolId`, `examTerminal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_classteachers` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_classteachers_AB_unique`(`A`, `B`),
    INDEX `_classteachers_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_parentstudents` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_parentstudents_AB_unique`(`A`, `B`),
    INDEX `_parentstudents_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `assignment` ADD CONSTRAINT `Assignment_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment` ADD CONSTRAINT `Assignment_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment` ADD CONSTRAINT `Assignment_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `Attendance_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `Attendance_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `Attendance_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class` ADD CONSTRAINT `Class_classHeadId_fkey` FOREIGN KEY (`classHeadId`) REFERENCES `teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class` ADD CONSTRAINT `Class_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment` ADD CONSTRAINT `Enrollment_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment` ADD CONSTRAINT `Enrollment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exammark` ADD CONSTRAINT `ExamMark_enteredById_fkey` FOREIGN KEY (`enteredById`) REFERENCES `teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exammark` ADD CONSTRAINT `ExamMark_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exammark` ADD CONSTRAINT `ExamMark_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee` ADD CONSTRAINT `Fee_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `Feedback_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `Feedback_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedbackrequest` ADD CONSTRAINT `FeedbackRequest_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `parent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedbackrequest` ADD CONSTRAINT `FeedbackRequest_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedbackrequest` ADD CONSTRAINT `FeedbackRequest_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `Message_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `Message_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `Notification_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `Notification_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `parent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `Notification_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `Notification_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `Notification_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent` ADD CONSTRAINT `Parent_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent` ADD CONSTRAINT `Parent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `passwordresetrequest` ADD CONSTRAINT `PasswordResetRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `potentialmetric` ADD CONSTRAINT `PotentialMetric_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rating` ADD CONSTRAINT `Rating_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rating` ADD CONSTRAINT `Rating_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rating` ADD CONSTRAINT `Rating_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rating` ADD CONSTRAINT `Rating_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school` ADD CONSTRAINT `School_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessioncompletion` ADD CONSTRAINT `sessioncompletion_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessioncompletion` ADD CONSTRAINT `sessioncompletion_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessioncompletion` ADD CONSTRAINT `sessioncompletion_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schoolcoderequest` ADD CONSTRAINT `SchoolCodeRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student` ADD CONSTRAINT `Student_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student` ADD CONSTRAINT `Student_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student` ADD CONSTRAINT `Student_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `studentmaterialstatus` ADD CONSTRAINT `StudentMaterialStatus_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `studentmaterialstatus` ADD CONSTRAINT `StudentMaterialStatus_studyMaterialId_fkey` FOREIGN KEY (`studyMaterialId`) REFERENCES `studymaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `studymaterial` ADD CONSTRAINT `StudyMaterial_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `studymaterial` ADD CONSTRAINT `StudyMaterial_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `studymaterial` ADD CONSTRAINT `StudyMaterial_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subject` ADD CONSTRAINT `Subject_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission` ADD CONSTRAINT `Submission_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `assignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission` ADD CONSTRAINT `Submission_gradedById_fkey` FOREIGN KEY (`gradedById`) REFERENCES `teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission` ADD CONSTRAINT `Submission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher` ADD CONSTRAINT `Teacher_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher` ADD CONSTRAINT `Teacher_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachermessage` ADD CONSTRAINT `TeacherMessage_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `parent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachermessage` ADD CONSTRAINT `TeacherMessage_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachermessage` ADD CONSTRAINT `TeacherMessage_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachersubject` ADD CONSTRAINT `TeacherSubject_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachersubject` ADD CONSTRAINT `TeacherSubject_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachersubject` ADD CONSTRAINT `TeacherSubject_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction` ADD CONSTRAINT `Transaction_feeId_fkey` FOREIGN KEY (`feeId`) REFERENCES `fee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction` ADD CONSTRAINT `Transaction_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `User_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quizset` ADD CONSTRAINT `quizset_studyMaterialId_fkey` FOREIGN KEY (`studyMaterialId`) REFERENCES `studymaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question` ADD CONSTRAINT `question_quizSetId_fkey` FOREIGN KEY (`quizSetId`) REFERENCES `quizset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quizresponse` ADD CONSTRAINT `quizresponse_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quizresponse` ADD CONSTRAINT `quizresponse_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjectexamsubmission` ADD CONSTRAINT `subjectexamsubmission_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjectexamsubmission` ADD CONSTRAINT `subjectexamsubmission_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjectexamsubmission` ADD CONSTRAINT `subjectexamsubmission_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classexamsubmission` ADD CONSTRAINT `classexamsubmission_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classexamsubmission` ADD CONSTRAINT `classexamsubmission_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schoolexampublish` ADD CONSTRAINT `schoolexampublish_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schoolexampublish` ADD CONSTRAINT `schoolexampublish_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_classteachers` ADD CONSTRAINT `_classteachers_A_fkey` FOREIGN KEY (`A`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_classteachers` ADD CONSTRAINT `_classteachers_B_fkey` FOREIGN KEY (`B`) REFERENCES `teacher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_parentstudents` ADD CONSTRAINT `_parentstudents_A_fkey` FOREIGN KEY (`A`) REFERENCES `parent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_parentstudents` ADD CONSTRAINT `_parentstudents_B_fkey` FOREIGN KEY (`B`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

