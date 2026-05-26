/**
 * Potential Score Calculator
 *
 * Potential = Effort (40) + Curiosity (40) + Learning Speed (20)
 *
 * Effort:
 *   Part 1 — Assignment Submission (20 pts): ((onTime - late - missed) / total) * 20
 *   Part 2 — Timely Material Watching (20 pts): ((onTimeWatched - lateWatched) / total) * 20
 *
 * Curiosity:
 *   Part 1 — Quiz Completion (30 pts): ((solved - notSolved) / totalQuestions) * 30 [auto]
 *   Part 2 — Teacher MCQ Score (10 pts): teacher input 0-10 [manual]
 *
 * Learning Speed:
 *   ((correct - incorrect - missed) / totalQuestions) * 20
 */

/**
 * Effort Part 1: Assignment Submission Score (max ±20)
 * @param {Array} assignments - All assignments for this class before snapshot
 * @param {Array} submissions - Student's submissions for those assignments
 */
function calculateEffortAssignment(assignments, submissions) {
  const total = assignments.length;
  if (total === 0) return 0;

  const submissionMap = new Map();
  for (const sub of submissions) {
    submissionMap.set(sub.assignmentId, sub);
  }

  let onTime = 0, late = 0, missed = 0;

  for (const asg of assignments) {
    const sub = submissionMap.get(asg.id);
    if (!sub) {
      missed++;
    } else if (asg.dueDate && sub.submittedAt && new Date(sub.submittedAt) > new Date(asg.dueDate)) {
      late++;
    } else {
      onTime++;
    }
  }

  return parseFloat((((onTime - late - missed) / total) * 20).toFixed(2));
}

/**
 * Effort Part 2: Timely Study Material Watching Score (max ±20)
 * @param {Array} materials - All materials for class before snapshot
 * @param {Array} progressRecords - Student's material status records
 */
function calculateEffortMaterials(materials, progressRecords) {
  const total = materials.length;
  if (total === 0) return 0;

  const progressMap = new Map();
  for (const p of progressRecords) {
    progressMap.set(p.studyMaterialId, p);
  }

  let onTimeWatched = 0, lateWatched = 0;

  for (const mat of materials) {
    const prog = progressMap.get(mat.id);
    if (!prog || prog.status !== 'COMPLETED') continue; // not completed = 0 contribution

    if (mat.deadline && prog.completedAt) {
      if (new Date(prog.completedAt) <= new Date(mat.deadline)) {
        onTimeWatched++;
      } else {
        lateWatched++;
      }
    } else {
      // No deadline set = on time
      onTimeWatched++;
    }
  }

  return parseFloat((((onTimeWatched - lateWatched) / total) * 20).toFixed(2));
}

/**
 * Curiosity Part 1: Quiz Completion Score (max ±30)
 * @param {number} totalQuestions - Total quiz questions across all materials
 * @param {number} totalSolved - Questions student attempted
 */
function calculateCuriosityQuiz(totalQuestions, totalSolved) {
  if (totalQuestions === 0) return 0;

  const notSolved = totalQuestions - totalSolved;
  return parseFloat((((totalSolved - notSolved) / totalQuestions) * 30).toFixed(2));
}

/**
 * Learning Speed Score (max ±20)
 * @param {number} correct - Correct quiz answers
 * @param {number} incorrect - Incorrect quiz answers
 * @param {number} missed - Questions never attempted
 * @param {number} totalQuestions - Total questions
 */
function calculateLearningSpeed(correct, incorrect, missed, totalQuestions) {
  if (totalQuestions === 0) return 0;

  return parseFloat((((correct - incorrect - missed) / totalQuestions) * 20).toFixed(2));
}

/**
 * Calculate all potential components for a student
 * curiosityMcq is null (teacher fills in later)
 */
function calculatePotential(assignments, submissions, materials, progressRecords, totalQuestions, totalSolved, correctAnswers, incorrectAnswers) {
  const effortAssignment = calculateEffortAssignment(assignments, submissions);
  const effortMaterials = calculateEffortMaterials(materials, progressRecords);
  const effortTotal = parseFloat((effortAssignment + effortMaterials).toFixed(2));

  const curiosityQuiz = calculateCuriosityQuiz(totalQuestions, totalSolved);
  // curiosityMcq = null (teacher input, 0-10)
  // curiosityTotal = null (set after teacher input)

  const missed = totalQuestions - totalSolved;
  const learningSpeed = calculateLearningSpeed(correctAnswers, incorrectAnswers, missed, totalQuestions);

  return {
    effortAssignment,
    effortMaterials,
    effortTotal,
    curiosityQuiz,
    curiosityMcq: null,
    curiosityTotal: null,
    learningSpeed,
    potentialTotal: null // set after teacher fills curiosityMcq
  };
}

module.exports = {
  calculateEffortAssignment,
  calculateEffortMaterials,
  calculateCuriosityQuiz,
  calculateLearningSpeed,
  calculatePotential
};
