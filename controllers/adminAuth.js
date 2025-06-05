const { conPool } = require('../config/dbHandler')

async function getAdmin(req, res){
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    const [userList] = await conPool.query('SELECT * FROM user');

    const [doctorList] = await conPool.query(`
        SELECT d.*, u.Username
        FROM doctor d
        JOIN user u ON d.UserID = u.UserID
        WHERE u.Role = 'DOCTOR'
    `);

    const [prescriptionStats] = await conPool.query(`
        SELECT 
            d.Specialty, 
            SUM(CASE WHEN p.Status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN p.Status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
        FROM prescription p
        JOIN doctor d ON p.DoctorID = d.DoctorID
        GROUP BY d.Specialty
    `);

    const [patientList] = await conPool.query(`
        SELECT p.*, u.Username
        FROM patient p
        JOIN user u ON p.UserID = u.UserID
        WHERE u.Role = 'PATIENT'
    `);

    const specialtyStats = {};
    doctorList.forEach(doctor => {
        const spec = doctor.Specialty || 'Other';
        if (!specialtyStats[spec]) {
            specialtyStats[spec] = {
                doctorCount: 0,
                activePrescriptions: 0,
                completedPrescriptions: 0
            };
        }
        specialtyStats[spec].doctorCount++;
    });

    prescriptionStats.forEach(row => {
        const spec = row.Specialty || 'Other';
        if (specialtyStats[spec]) {
            specialtyStats[spec].activePrescriptions = row.active;
            specialtyStats[spec].completedPrescriptions = row.completed;
        }
    });

    const specialties = Object.entries(specialtyStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.doctorCount - a.doctorCount);

    return res.render('users/admin', {
        user: req.session.user,
        specialties,
        userList,
        doctorList,
        prescriptionStats,
        patientList
    });
};

// DELETE user - look to see
async function deleteUser(req, res) {
    const userId = req.params.id;

    try {
        const [result] = await conPool.query(
            'UPDATE user SET Flag = 1 WHERE UserID = ?',
            [userId]
        );

        if (result.affectedRows > 0) {
             // Insert log into admin_activity table
             await conPool.query(
                'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                [req.session.user.UserID, 'DEACTIVATE', 'Admin deactivated user', 'USER', userId]
            );
            return res.status(200).json({ success: true, message: 'User soft deleted' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        console.error('DB delete error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}
// DELETE doctor
async function deleteDoctor (req, res) {
    const doctorId = req.params.id;
    
    try {
        const [result] = await conPool.query(
            'UPDATE doctor SET Flag = 1 WHERE DoctorID = ?',
            [doctorId]
        );

        await conPool.query(
            'UPDATE user SET Flag = 1 WHERE UserID = (SELECT UserID FROM doctor WHERE DoctorID = ?)',[doctorId])

        if (result.affectedRows > 0) {
            await conPool.query(
                'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                [req.session.user.UserID, 'DEACTIVATE', 'Admin deactivated doctor', 'DOCTOR', doctorId]
            );
            return res.status(200).json({ success: true, message: 'User soft deleted' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

    } catch (err) {
        console.error('DB delete error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
// DELETE patient
async function deletePatient (req, res) {
    const patientId = req.params.id;
    
    try {
        const [result] = await conPool.query(
            'UPDATE patient SET Flag = 1 WHERE PatientID = ?',
            [patientId]
        );

        await conPool.query('UPDATE user SET Flag = 1 WHERE UserID = (SELECT UserID FROM patient WHERE PatientID = ?)',[patientId])
        
        if (result.affectedRows > 0) {
            // Insert log into admin_activity table
            await conPool.query(
                'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                [req.session.user.UserID, 'DEACTIVATE', 'Admin deactivated patient', 'PATIENT', patientId]
            );
            return res.status(200).json({ success: true, message: 'User soft deleted' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

    } catch (err) {
        console.error('DB delete error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


// REACTIVATE user
async function reviveUser(req, res){
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    try {
        const [userList] = await conPool.query('SELECT * FROM user WHERE Flag = 1');
        return res.render('users/adm/reviveUser', {
            user: req.session.user,
            userList
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

async function getUnderUser(req, res){
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    // Initialize pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // Default limit of 10 users per page
    const offset = (page - 1) * limit;

    // Initialize search parameters
    const searchTerm = req.query.search || ''; // Ensure searchTerm is always defined

    // --- User List with Search and Pagination ---
    // ...
let userQuery = 'SELECT * FROM user WHERE Flag = 0'; // <-- IMPORTANT CHANGE HERE
let countUserQuery = 'SELECT COUNT(*) as totalUsers FROM user WHERE Flag = 0'; // <-- IMPORTANT CHANGE HERE
const userQueryParams = [];
const countUserQueryParams = [];

if (searchTerm) {
    userQuery += ' AND Username LIKE ?'; // Use AND because WHERE Flag = 0 is already there
    countUserQuery += ' AND Username LIKE ?';
    userQueryParams.push(`%${searchTerm}%`);
    countUserQueryParams.push(`%${searchTerm}%`);
}

userQuery += ' LIMIT ? OFFSET ?';
userQueryParams.push(limit, offset);
// ...

    const [paginatedUserListResult] = await conPool.query(userQuery, userQueryParams);
    const [totalUsersCountResult] = await conPool.query(countUserQuery, countUserQueryParams);

    const userList = paginatedUserListResult; // Direct result if not using [0] for multiple results
    const totalUsers = totalUsersCountResult[0].totalUsers;
    const totalPages = Math.ceil(totalUsers / limit);
    // --- End User List with Search and Pagination ---


    // --- Existing Doctor List Query ---
    const [doctorListResult] = await conPool.query(`
        SELECT d.*, u.Username, u.UserID
        FROM doctor d
        JOIN user u ON d.UserID = u.UserID
        WHERE u.Role = 'DOCTOR'
    `);
    const doctorList = doctorListResult;
    // --- End Doctor List Query ---


    // --- Existing Prescription Stats Query ---
    const [prescriptionStatsResult] = await conPool.query(`
        SELECT
            d.Specialty,
            SUM(CASE WHEN p.Status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN p.Status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
        FROM prescription p
        JOIN doctor d ON p.DoctorID = d.DoctorID
        GROUP BY d.Specialty
    `);
    const prescriptionStats = prescriptionStatsResult;
    // --- End Prescription Stats Query ---


    // --- Existing Patient List Query ---
    const [patientListResult] = await conPool.query(`
        SELECT p.*, u.Username, u.UserID
        FROM patient p
        JOIN user u ON p.UserID = u.UserID
        WHERE u.Role = 'PATIENT'
    `);
    const patientList = patientListResult;
    // --- End Patient List Query ---


    const specialtyStats = {};
    doctorList.forEach(doctor => {
        const spec = doctor.Specialty || 'Other';
        if (!specialtyStats[spec]) {
            specialtyStats[spec] = {
                doctorCount: 0,
                activePrescriptions: 0,
                completedPrescriptions: 0
            };
        }
        specialtyStats[spec].doctorCount++;
    });

    prescriptionStats.forEach(row => {
        const spec = row.Specialty || 'Other';
        if (specialtyStats[spec]) {
            specialtyStats[spec].activePrescriptions = row.active;
            specialtyStats[spec].completedPrescriptions = row.completed;
        }
    });

    const specialties = Object.entries(specialtyStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.doctorCount - a.doctorCount);

    return res.render('users/adm/adminUsers', {
        user: req.session.user,
        specialties,
        userList, // This is now the paginated and searched list
        doctorList,
        prescriptionStats,
        patientList,
        currentPage: page, // Pass pagination variables
        totalPages: totalPages,
        limit: limit,
        searchTerm: searchTerm // Pass the search term
    });
};

async function getUnderDoc (req, res){
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    const [userList] = await conPool.query('SELECT * FROM user');

    const [doctorList] = await conPool.query(`
        SELECT d.*, u.Username, u.UserID
        FROM doctor d
        JOIN user u ON d.UserID = u.UserID
        WHERE u.Role = 'DOCTOR'
    `);

    return res.render('users/adm/adminDoc', {
        user: req.session.user,
        doctorList,
        userList
    });
};

async function getUnderPat (req, res){
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }
    const [userList] = await conPool.query('SELECT * FROM user');

    const [patientList] = await conPool.query(`
        SELECT p.*, u.Username, u.UserID
        FROM patient p
        JOIN user u ON p.UserID = u.UserID
        WHERE u.Role = 'PATIENT'
    `);

    return res.render('users/adm/adminPat', {
        user: req.session.user,
        patientList,
        userList
    });
};

async function getLogs (req, res) {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    const [logs] = await conPool.query(`
        SELECT
            aa.ActivityID,
            u.Username AS AdminUsername,
            aa.ActionPerformed,
            aa.Description,
            aa.TargetType,
            aa.TargetID,
            aa.ActivityTimestamp
        FROM
            admin_activity aa
        JOIN
            user u ON aa.AdminUserID = u.UserID
        ORDER BY
            aa.ActivityTimestamp DESC
    `);

    return res.render('users/adm/logs', {
        user: req.session.user,
        logs
    });
};

module.exports = {
    getAdmin,
    deleteUser,
    deleteDoctor,
    deletePatient,
    reviveUser,
    getUnderUser,
    getUnderDoc,
    getUnderPat,
    getLogs
};


