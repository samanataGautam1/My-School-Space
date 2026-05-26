/**
 * validators.js
 * Centralized validation logic for authentication and data integrity.
 */

const validateName = (name, fieldName = 'Name') => {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return { valid: false, error: `${fieldName} must be at least 2 characters long` };
    }
    return { valid: true, value: name.trim() };
};

const validateEmail = (email, requireGmail = false) => {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmedEmail)) {
        return { valid: false, error: 'Invalid email format' };
    }
    
    if (requireGmail && !trimmedEmail.endsWith('@gmail.com')) {
        return { valid: false, error: 'Only Gmail addresses are allowed' };
    }
    
    return { valid: true, value: trimmedEmail };
};

const validatePassword = (password) => {
    if (!password || typeof password !== 'string' || password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters long' };
    }
    return { valid: true, value: password };
};

const validateUsername = (username) => {
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return { valid: false, error: 'Username must be at least 3 characters long' };
    }
    return { valid: true, value: username.trim() };
};

const validateSchoolCode = (code) => {
    if (!code || typeof code !== 'string' || code.trim().length < 4) {
        return { valid: false, error: 'School code must be at least 4 characters long' };
    }
    return { valid: true, value: code.trim().toUpperCase() };
};

const validateSchoolName = (name) => {
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
        return { valid: false, error: 'School name must be at least 3 characters long' };
    }
    return { valid: true, value: name.trim() };
};

const validateSubjectName = (name) => {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return { valid: false, error: 'Subject name must be at least 2 characters long' };
    }
    return { valid: true, value: name.trim() };
};

const validateRollNo = (rollNo) => {
    const num = parseInt(rollNo);
    if (isNaN(num) || num <= 0) {
        return { valid: false, error: 'Roll number must be a positive integer' };
    }
    return { valid: true, value: num };
};

const validateClassNames = (classNames) => {
    if (!Array.isArray(classNames) || classNames.length === 0) {
        return { valid: false, error: 'At least one class name is required' };
    }
    return { valid: true, value: classNames };
};

const validateStudentCodes = (codes) => {
    if (!Array.isArray(codes) || codes.length === 0) {
        return { valid: false, error: 'At least one student code is required' };
    }
    return { valid: true, value: codes.map(c => c.trim().toUpperCase()) };
};

module.exports = {
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
};
