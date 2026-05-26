const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync(path.join(__dirname, 'src/controllers/admin/dashboard.js'), 'utf8').split('\n');
lines.forEach((line, i) => {
    if (line.includes('publish-terminal')) {
        console.log(`Line ${i+1}: ${line.trim()}`);
    }
});
