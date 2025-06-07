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
async function reviveUser(req, res) {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    // Initialize pagination parameters
    let page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8; // Default limit of 8 users per page

    try {
        // First, get the total count of deactivated users
        const [totalDeactivatedUsersCountResult] = await conPool.query('SELECT COUNT(*) as totalUsers FROM user WHERE Flag = 1');
        const totalUsers = totalDeactivatedUsersCountResult[0].totalUsers;
        let totalPages = Math.ceil(totalUsers / limit);

        // Crucial: Restrict 'page' to be within valid range
        if (page < 1) {
            page = 1;
        } else if (totalPages > 0 && page > totalPages) { // Only set to totalPages if totalPages is not 0
            page = totalPages;
        } else if (totalPages === 0) { // If there are no users, page should be 1
            page = 1;
            totalPages = 1; // Ensure totalPages is at least 1 when no results, to avoid 0/0 scenarios in EJS
        }

        const offset = (page - 1) * limit;

        // Fetch paginated deactivated users
        const [paginatedUserListResult] = await conPool.query(
            'SELECT * FROM user WHERE Flag = 1 LIMIT ? OFFSET ?',
            [limit, offset]
        );
        const userList = paginatedUserListResult;

        return res.render('users/adm/adminRevive', {
            user: req.session.user,
            userList, // This is now the paginated list of deactivated users
            currentPage: page,
            totalPages: totalPages,
            limit: limit,
            error: null // Clear any previous error messages
        });

    } catch (err) {
        console.error('Error fetching deactivated users for revival:', err);
        return res.render('users/adm/adminRevive', {
            user: req.session.user,
            userList: [],
            currentPage: 1,
            totalPages: 1,
            limit: limit,
            error: 'Failed to load deactivated users. Please try again later.'
        });
    }
};

// Inside your Node.js controller file (e.g., adminAuth.js or similar)
async function getUnderUser(req, res) {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    // Initialize pagination parameters
    let page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8; // Default limit of 8 users per page
    const searchTerm = req.query.search || ''; // Ensure searchTerm is always defined

    // --- Start User List with Search and Pagination ---
    let countUserQuery = 'SELECT COUNT(*) as totalUsers FROM user WHERE Flag = 0';
    const countUserQueryParams = [];

    if (searchTerm) {
        countUserQuery += ' AND Username LIKE ?';
        countUserQueryParams.push(`%${searchTerm}%`);
    }

    const [totalUsersCountResult] = await conPool.query(countUserQuery, countUserQueryParams);
    const totalUsers = totalUsersCountResult[0].totalUsers;
    let totalPages = Math.ceil(totalUsers / limit);

    // Crucial: Restrict 'page' to be within valid range
    if (page < 1) {
        page = 1;
    } else if (totalPages > 0 && page > totalPages) { // Only set to totalPages if totalPages is not 0
        page = totalPages;
    } else if (totalPages === 0) { // If there are no users, page should be 1
        page = 1;
        totalPages = 1; // Ensure totalPages is at least 1 when no results, to avoid 0/0 scenarios in EJS
    }

    const offset = (page - 1) * limit;

    let userQuery = 'SELECT * FROM user WHERE Flag = 0';
    const userQueryParams = [];

    if (searchTerm) {
        userQuery += ' AND Username LIKE ?';
        userQueryParams.push(`%${searchTerm}%`);
    }

    userQuery += ' LIMIT ? OFFSET ?';
    userQueryParams.push(limit, offset);

    const [paginatedUserListResult] = await conPool.query(userQuery, userQueryParams);
    const userList = paginatedUserListResult;
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

// Function to get admin logs with pagination and search
async function getLogs(req, res) {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    try {
        let page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        // Determine the log type from the query parameter, default to 'admin'
        const logType = req.query.type || 'admin';

        let totalLogs = 0;
        let totalPages = 1;
        let currentLogs = []; // This will hold the logs for the currently active tab

        // Fetch total count and logs based on the requested type
        if (logType === 'admin') {
            const [totalLogsCountResult] = await conPool.query(`
                SELECT COUNT(*) as totalLogs FROM admin_activity
            `);
            totalLogs = totalLogsCountResult[0].totalLogs;
            totalPages = Math.ceil(totalLogs / limit);

            // Restrict 'page' to be within valid range for the current log type
            if (page < 1) page = 1;
            else if (totalPages > 0 && page > totalPages) page = totalPages;
            else if (totalPages === 0) page = 1;

            const offset = (page - 1) * limit;

            [currentLogs] = await conPool.query(`
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
                LIMIT ? OFFSET ?
            `, [limit, offset]);
        } else if (logType === 'doctor') {
            const [totalLogsCountResult] = await conPool.query(`
                SELECT COUNT(*) as totalLogs FROM doctor_activity
            `);
            totalLogs = totalLogsCountResult[0].totalLogs;
            totalPages = Math.ceil(totalLogs / limit);

            // Restrict 'page' to be within valid range for the current log type
            if (page < 1) page = 1;
            else if (totalPages > 0 && page > totalPages) page = totalPages;
            else if (totalPages === 0) page = 1;

            const offset = (page - 1) * limit;

            [currentLogs] = await conPool.query(`
                SELECT
                    da.ActivityID,
                    d.Name AS Doctorname,
                    da.ActionPerformed,
                    da.Description,
                    da.TargetType,
                    da.TargetID,
                    da.ActivityTimestamp
                FROM
                    doctor_activity da
                JOIN
                    doctor d ON da.DoctorID = d.DoctorID
                ORDER BY
                    da.ActivityTimestamp DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
        } else if (logType === 'patient') {
            const [totalLogsCountResult] = await conPool.query(`
                SELECT COUNT(*) as totalLogs FROM patient_activity
            `);
            totalLogs = totalLogsCountResult[0].totalLogs;
            totalPages = Math.ceil(totalLogs / limit);

            // Restrict 'page' to be within valid range for the current log type
            if (page < 1) page = 1;
            else if (totalPages > 0 && page > totalPages) page = totalPages;
            else if (totalPages === 0) page = 1;

            const offset = (page - 1) * limit;

            [currentLogs] = await conPool.query(`
                SELECT
                    pa.ActivityID,
                    p.Name AS Patientname,
                    pa.ActionPerformed,
                    pa.Description,
                    pa.TargetType,
                    pa.TargetID,
                    pa.ActivityTimestamp
                FROM
                    patient_activity pa
                JOIN
                    patient p ON pa.PatientID = p.PatientID
                ORDER BY
                    pa.ActivityTimestamp DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
        }

        return res.render('users/adm/logs', {
            user: req.session.user,
            logs: currentLogs, // Pass the logs for the *current* tab
            currentPage: page,
            totalPages: totalPages, // Total pages for the *current* tab
            limit: limit,
            currentLogType: logType, // Pass the active tab type to EJS
            searchTerm: ''
        });
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.render('users/adm/logs', {
            user: req.session.user,
            logs: [], // Ensure logs is an empty array on error
            currentPage: 1,
            totalPages: 1,
            limit: 9,
            currentLogType: req.query.type || 'admin',
            searchTerm: '',
            error: 'Error retrieving logs'
        });
    }
}

async function activateUser(req, res) {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const { userID } = req.params;

    try {
        // Update user Flag to 0 (active)
        const [updateResult] = await conPool.query(
            'UPDATE user SET Flag = 0 WHERE UserID = ?',
            [userID]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'User not found or already active.' });
        }

        // Log admin activity for activation
        await conPool.query(
            'INSERT INTO admin_activity (AdminUserID, ActionPerformed, TargetType, TargetID, Description) VALUES (?, ?, ?, ?, ?)',
            [req.session.user.UserID, 'Activated User', 'User', userID, `User ID ${userID} was reactivated.`]
        );

        return res.json({ success: true, message: 'User activated successfully!' });

    } catch (err) {
        console.error('Error activating user:', err);
        return res.status(500).json({ success: false, error: 'Internal server error during user activation.' });
    }
}

module.exports = {
    getAdmin,
    deleteUser,
    deleteDoctor,
    deletePatient,
    reviveUser,
    getUnderUser,
    getUnderDoc,
    getUnderPat,
    getLogs,
    activateUser
};


