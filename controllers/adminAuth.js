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

async function getUnderUser(req, res) {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    try {
        const user = req.session.user; // Get the user object from the session

        const currentPage = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 10;    
        const searchTerm = req.query.search || '';

        // Query to get total count of users with search filter
        let totalUsersQuery = 'SELECT COUNT(*) as total FROM user';
        let userCountParams = [];

        if (searchTerm) {
            totalUsersQuery += ' WHERE Username LIKE ? OR Email LIKE ? OR Role LIKE ?'; // Adjust columns as needed
            userCountParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
        }

        const [totalUsersResult] = await conPool.query(totalUsersQuery, userCountParams);
        const totalUserCount = totalUsersResult[0].total;
        const totalPages = Math.ceil(totalUserCount / limit); // totalPages for the general user list

        // Query to get users for the current page with search filter
        const offset = (currentPage - 1) * limit;
        let userListQuery = 'SELECT * FROM user';
        let userFetchParams = [];

        if (searchTerm) {
            userListQuery += ' WHERE Username LIKE ? OR Email LIKE ? OR Role LIKE ?'; // Adjust columns as needed
            userFetchParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
        }
        userListQuery += ' ORDER BY Username ASC LIMIT ? OFFSET ?';
        userFetchParams.push(limit, offset);

        const [userList] = await conPool.query(userListQuery, userFetchParams);

        // Render the EJS template with all the necessary data
        res.render('users/adm/adminUsers', {
            user,
            userList,
            totalPages,
            currentPage,
            limit,
            searchTerm,
            activeTab: 'users'    
            });

    } catch (err) {
        console.error('Error in getUnderUser:', err);
        res.status(500).send('Internal Server Error');
    }
}

async function getUnderDoc(req, res) {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    try {
        const user = req.session.user;

        let currentPageDoc = parseInt(req.query.page_doc) || 1;
        const limitDoc = parseInt(req.query.limit_doc) || 8;
        const searchTermDoc = req.query.search_doc || '';

        let countDocQuery = `
            SELECT COUNT(*) as totalDoctors
            FROM doctor d
            JOIN user u ON d.UserID = u.UserID
            WHERE u.Role = 'DOCTOR' AND u.Flag = 0
        `;
        const countDocQueryParams = [];

        if (searchTermDoc) {
            countDocQuery += ' AND d.Name LIKE ?'; // Corrected column name to Name
            countDocQueryParams.push(`%${searchTermDoc}%`);
        }

        const [totalDoctorsCountResult] = await conPool.query(countDocQuery, countDocQueryParams);
        const totalDoctors = totalDoctorsCountResult[0].totalDoctors;
        let totalPagesDoc = Math.ceil(totalDoctors / limitDoc);

        if (currentPageDoc < 1) {
            currentPageDoc = 1;
        } else if (totalPagesDoc > 0 && currentPageDoc > totalPagesDoc) {
            currentPageDoc = totalPagesDoc;
        } else if (totalPagesDoc === 0) {
            currentPageDoc = 1;
            totalPagesDoc = 1;
        }

        const offsetDoc = (currentPageDoc - 1) * limitDoc;

        let doctorQuery = `
            SELECT d.*, u.Username, u.UserID
            FROM doctor d
            JOIN user u ON d.UserID = u.UserID
            WHERE u.Role = 'DOCTOR' AND u.Flag = 0
        `;
        const doctorQueryParams = [];

        if (searchTermDoc) {
            doctorQuery += ' AND d.Name LIKE ?'; // Corrected column name to Name
            doctorQueryParams.push(`%${searchTermDoc}%`);
        }

        doctorQuery += ' ORDER BY Name ASC LIMIT ? OFFSET ?';
        doctorQueryParams.push(limitDoc, offsetDoc);

        const [paginatedDoctorListResult] = await conPool.query(doctorQuery, doctorQueryParams);
        const doctorList = paginatedDoctorListResult;

        // Render the EJS template with all the necessary data
        res.render('users/adm/adminDoctor', {
            user,
            doctorList,
            totalPagesDoc,
            currentPageDoc,
            limitDoc,
            searchTermDoc,
            activeTab: 'doctors' 
        });

    } catch (err) {
        console.error('Error in getUnderDoc:', err);
        res.status(500).send('Internal Server Error');
    }
}

async function getUnderPat(req, res) {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    try {
        const user = req.session.user;

        let currentPagePatient = parseInt(req.query.page_pat) || 1;
        const limitPatient = parseInt(req.query.limit_pat) || 8;
        const searchTermPatient = req.query.search_pat || '';

        let countPatQuery = `
            SELECT COUNT(*) as totalPatients
            FROM patient p
            JOIN user u ON p.UserID = u.UserID
            WHERE u.Role = 'PATIENT' AND u.Flag = 0
        `;
        const countPatQueryParams = [];

        if (searchTermPatient) {
            countPatQuery += ' AND p.Name LIKE ?'; // Corrected column name to Name
            countPatQueryParams.push(`%${searchTermPatient}%`);
        }

        const [totalPatientsCountResult] = await conPool.query(countPatQuery, countPatQueryParams);
        const totalPatients = totalPatientsCountResult[0].totalPatients;
        let totalPagesPatient = Math.ceil(totalPatients / limitPatient);

        if (currentPagePatient < 1) {
            currentPagePatient = 1;
        } else if (totalPagesPatient > 0 && currentPagePatient > totalPagesPatient) {
            currentPagePatient = totalPagesPatient;
        } else if (totalPagesPatient === 0) {
            currentPagePatient = 1;
            totalPagesPatient = 1;
        }

        const offsetPat = (currentPagePatient - 1) * limitPatient;

        let patientQuery = `
            SELECT p.*, u.Username, u.UserID
            FROM patient p
            JOIN user u ON p.UserID = u.UserID
            WHERE u.Role = 'PATIENT' AND u.Flag = 0
        `;
        const patientQueryParams = [];

        if (searchTermPatient) {
            patientQuery += ' AND p.Name LIKE ?'; // Corrected column name to Name
            patientQueryParams.push(`%${searchTermPatient}%`);
        }

        patientQuery += ' ORDER BY Name ASC LIMIT ? OFFSET ?';
        patientQueryParams.push(limitPatient, offsetPat);

        const [paginatedPatientListResult] = await conPool.query(patientQuery, patientQueryParams);
        const patientList = paginatedPatientListResult;


        // Render the EJS template with all the necessary data
        res.render('users/adm/adminPatient', {
            user,
            patientList,
            totalPagesPatient,
            currentPagePatient,
            limitPatient,
            searchTermPatient,
            activeTab: 'patients' // Set the active tab to 'patients'
        });

    } catch (err) {
        console.error('Error in getUnderPat:', err);
        res.status(500).send('Internal Server Error');
    }
}

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


