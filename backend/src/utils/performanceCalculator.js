/**
 * Performance Score Calculator
 *
 * Performance = Exam (50%) + Assignment (30%) + Attendance (20%)
 * Range: approximately -100 to +100
 */

/**
 * Exam Score: (avgExamPercentage - 50) * 0.5
 * Range: -25 to +25
 */
function calculateExamScore(examMarks) {
  if (!examMarks || examMarks.length === 0) return 0;

  const percentages = examMarks.map(m => {
    const full = m.fullMarks || 100;
    return full > 0 ? ((m.marks || 0) / full) * 100 : 0;
  });

  const avgPct = percentages.reduce((s, p) => s + p, 0) / percentages.length;
  return parseFloat(((avgPct - 50) * 0.5).toFixed(2));
}

/**
 * Assignment Score: sum of (each grade - 50) * 0.3
 * Only graded submissions are counted. Grades are out of 100.
 * Range: varies based on number of assignments
 */
function calculateAssignmentScore(gradedSubmissions) {
  if (!gradedSubmissions || gradedSubmissions.length === 0) return 0;

  const deviationSum = gradedSubmissions.reduce((sum, sub) => {
    const grade = sub.grade || 0;
    return sum + (grade - 50);
  }, 0);

  return parseFloat((deviationSum * 0.3).toFixed(2));
}

/**
 * Attendance Score: ((present - absent) / (totalDays - holidays)) * 0.2
 * Late (L) counts as present.
 * Range: approximately -0.2 to +0.2 (normalized)
 *
 * To make the scale meaningful, we multiply by 100 to get -20 to +20 range.
 */
function calculateAttendanceScore(attendanceRecords, totalSchoolDays) {
  if (!attendanceRecords || attendanceRecords.length === 0 || totalSchoolDays <= 0) return 0;

  const present = attendanceRecords.filter(a => a.status === 'P' || a.status === 'L').length;
  const absent = attendanceRecords.filter(a => a.status === 'A').length;
  const activeDays = present + absent; // days with any record

  if (activeDays === 0) return 0;

  const score = ((present - absent) / activeDays) * 20;
  return parseFloat(score.toFixed(2));
}

/**
 * Total Performance Score
 */
function calculatePerformance(examMarks, gradedSubmissions, attendanceRecords, totalSchoolDays) {
  const examScore = calculateExamScore(examMarks);
  const assignmentScore = calculateAssignmentScore(gradedSubmissions);
  const attendanceScore = calculateAttendanceScore(attendanceRecords, totalSchoolDays);

  return {
    examScore,
    assignmentScore,
    attendanceScore,
    performanceTotal: parseFloat((examScore + assignmentScore + attendanceScore).toFixed(2))
  };
}

module.exports = {
  calculateExamScore,
  calculateAssignmentScore,
  calculateAttendanceScore,
  calculatePerformance
};
