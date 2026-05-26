/**
 * Nepal NEB (National Examination Board) Grading System
 * Based on official NEB grading scale for school-level examinations.
 *
 * Grade Scale:
 *   A+  = 90-100%  (GPA 4.0)  — Outstanding
 *   A   = 80-89%   (GPA 3.6)  — Excellent
 *   B+  = 70-79%   (GPA 3.2)  — Very Good
 *   B   = 60-69%   (GPA 2.8)  — Good
 *   C+  = 50-59%   (GPA 2.4)  — Satisfactory
 *   C   = 40-49%   (GPA 2.0)  — Acceptable
 *   D+  = 30-39%   (GPA 1.6)  — Partially Acceptable
 *   D   = 20-29%   (GPA 1.2)  — Insufficient
 *   E   = 1-19%    (GPA 0.8)  — Very Insufficient
 *   N   = 0 / Abs  (GPA 0.0)  — Not Graded / Absent
 *
 * Pass criteria:
 *   - Individual subject: minimum D+ (≥30%, GPA 1.6) in EACH component (theory + practical)
 *   - Overall: minimum GPA 1.6 across all subjects
 *   - Both theory and practical must independently meet pass marks
 */

const GRADE_TABLE = [
  { grade: 'A+', gpa: 4.0, min: 90, max: 100, description: 'Outstanding', color: '#059669' },
  { grade: 'A',  gpa: 3.6, min: 80, max: 89,  description: 'Excellent', color: '#10b981' },
  { grade: 'B+', gpa: 3.2, min: 70, max: 79,  description: 'Very Good', color: '#3b82f6' },
  { grade: 'B',  gpa: 2.8, min: 60, max: 69,  description: 'Good', color: '#6366f1' },
  { grade: 'C+', gpa: 2.4, min: 50, max: 59,  description: 'Satisfactory', color: '#8b5cf6' },
  { grade: 'C',  gpa: 2.0, min: 40, max: 49,  description: 'Acceptable', color: '#d97706' },
  { grade: 'D+', gpa: 1.6, min: 30, max: 39,  description: 'Partially Acceptable', color: '#ea580c' },
  { grade: 'D',  gpa: 1.2, min: 20, max: 29,  description: 'Insufficient', color: '#dc2626' },
  { grade: 'E',  gpa: 0.8, min: 1,  max: 19,  description: 'Very Insufficient', color: '#991b1b' },
  { grade: 'N',  gpa: 0.0, min: 0,  max: 0,   description: 'Not Graded', color: '#6b7280' },
];

// Minimum GPA to pass a subject
const PASS_GPA = 2.4;       // C+ minimum
const PASS_PERCENTAGE = 50;  // 50% minimum for C+

/**
 * Get letter grade and GPA from percentage
 * @param {number} percentage - 0 to 100
 * @returns {{ grade: string, gpa: number, description: string, color: string }}
 */
function getGradeFromPercentage(percentage) {
  if (percentage == null || isNaN(percentage) || percentage <= 0) {
    return { grade: 'N', gpa: 0.0, description: 'Not Graded', color: '#6b7280' };
  }
  const pct = Math.round(percentage * 10) / 10; // round to 1 decimal
  for (const entry of GRADE_TABLE) {
    if (pct >= entry.min && pct <= entry.max) {
      return { grade: entry.grade, gpa: entry.gpa, description: entry.description, color: entry.color };
    }
  }
  return { grade: 'N', gpa: 0.0, description: 'Not Graded', color: '#6b7280' };
}

/**
 * Get grade from obtained marks and full marks
 * @param {number} obtained
 * @param {number} fullMarks
 * @returns {{ grade: string, gpa: number, percentage: number, description: string, color: string }}
 */
function getGradeFromMarks(obtained, fullMarks) {
  if (!fullMarks || fullMarks <= 0) {
    return { grade: 'N', gpa: 0.0, percentage: 0, description: 'Not Graded', color: '#6b7280' };
  }
  const percentage = (obtained / fullMarks) * 100;
  const gradeInfo = getGradeFromPercentage(percentage);
  return { ...gradeInfo, percentage: Math.round(percentage * 10) / 10 };
}

/**
 * Determine if a subject is passed based on Nepal NEB rules
 * Both theory AND practical must individually meet pass marks.
 * Overall subject percentage must be ≥ 30% (D+ grade minimum).
 *
 * @param {object} marks - { theoryMarks, theoryFullMarks, theoryPassMarks, practicalMarks, practicalFullMarks, practicalPassMarks, marks (total), fullMarks }
 * @returns {{ passed: boolean, status: string, grade: string, gpa: number, percentage: number, theoryPassed: boolean, practicalPassed: boolean, reason: string|null }}
 */
function evaluateSubjectResult(marks) {
  const {
    theoryMarks = 0, theoryFullMarks = 0, theoryPassMarks = 0,
    practicalMarks = 0, practicalFullMarks = 0, practicalPassMarks = 0,
    marks: totalMarks = 0, fullMarks = 0
  } = marks;

  // Calculate total if not provided
  const obtained = totalMarks || (theoryMarks + practicalMarks);
  const full = fullMarks || (theoryFullMarks + practicalFullMarks);

  // Get grade from total percentage
  const gradeInfo = getGradeFromMarks(obtained, full);

  // Check theory component
  let theoryPassed = true;
  if (theoryFullMarks > 0) {
    theoryPassed = theoryPassMarks > 0
      ? theoryMarks >= theoryPassMarks
      : (theoryFullMarks > 0 ? (theoryMarks / theoryFullMarks) * 100 >= PASS_PERCENTAGE : true);
  }

  // Check practical component
  let practicalPassed = true;
  if (practicalFullMarks > 0) {
    practicalPassed = practicalPassMarks > 0
      ? practicalMarks >= practicalPassMarks
      : (practicalFullMarks > 0 ? (practicalMarks / practicalFullMarks) * 100 >= PASS_PERCENTAGE : true);
  }

  // Overall pass: both components pass AND grade ≥ D+ (GPA ≥ 1.6)
  const gradePass = gradeInfo.gpa >= PASS_GPA;
  const passed = theoryPassed && practicalPassed && gradePass;

  let reason = null;
  if (!passed) {
    if (!theoryPassed) reason = 'Theory below pass marks';
    else if (!practicalPassed) reason = 'Practical below pass marks';
    else if (!gradePass) reason = `Grade ${gradeInfo.grade} below minimum D+`;
  }

  return {
    passed,
    status: passed ? 'PASSED' : 'FAILED',
    grade: gradeInfo.grade,
    gpa: gradeInfo.gpa,
    percentage: gradeInfo.percentage,
    description: gradeInfo.description,
    color: gradeInfo.color,
    theoryPassed,
    practicalPassed,
    reason
  };
}

/**
 * Calculate overall GPA from array of subject results
 * @param {Array<{ gpa: number }>} subjectResults
 * @returns {{ gpa: number, grade: string, passed: boolean }}
 */
function calculateOverallGPA(subjectResults) {
  if (!subjectResults || subjectResults.length === 0) {
    return { gpa: 0, grade: 'N', passed: false };
  }

  const totalGPA = subjectResults.reduce((sum, r) => sum + (r.gpa || 0), 0);
  const avgGPA = totalGPA / subjectResults.length;
  const roundedGPA = Math.round(avgGPA * 100) / 100;

  // Find the matching grade for this GPA
  const avgPercentage = (roundedGPA / 4.0) * 100;
  const gradeInfo = getGradeFromPercentage(avgPercentage);

  // Pass if all subjects passed AND overall GPA ≥ 1.6
  const allSubjectsPassed = subjectResults.every(r => r.passed !== false && r.status !== 'FAILED');
  const overallPass = allSubjectsPassed && roundedGPA >= PASS_GPA;

  return {
    gpa: roundedGPA,
    grade: gradeInfo.grade,
    description: gradeInfo.description,
    passed: overallPass
  };
}

/**
 * Get the full grade table (for frontend display)
 */
function getGradeTable() {
  return GRADE_TABLE;
}

module.exports = {
  getGradeFromPercentage,
  getGradeFromMarks,
  evaluateSubjectResult,
  calculateOverallGPA,
  getGradeTable,
  GRADE_TABLE,
  PASS_GPA,
  PASS_PERCENTAGE
};
