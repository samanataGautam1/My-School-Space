const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/TeacherDashboard/TeacherDashboard.jsx');
const lines = fs.readFileSync(p, 'utf8').split('\n');
let found = false;
for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('exam-marks') || lines[i].includes('submit-subject-marks')) {
        console.log(`Line ${i+1}: ${lines[i].trim()}`);
        for(let j=Math.max(0, i-5); j<Math.min(lines.length, i+20); j++) {
            console.log(`  ${j+1}: ${lines[j]}`);
        }
        found = true;
    }
}
