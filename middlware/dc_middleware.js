const { sendResponse } = require('../controllers/helperAuth'); //use of helper func
const { conPool } = require('../config/dbHandler');

const chkLogin = (req, res, next) => {
    console.log('Session User:', req.session.user);
    if (req.session.loggedIn) {
        next(); //proceed on logged in
    } else {
        return sendResponse(res, "Unauthorized: Please log in", {}, true, 401);
         // err
    }
};

// middlware/dc_middleware.js
const checkProfileComplete = async (req, res, next) => {
    try {
        if (req.session.user.Role === 'DOCTOR') {
            const [doctor] = await conPool.query(
                'SELECT DoctorID FROM doctor WHERE UserID = ?',
                [req.session.user.UserID]
            );
            req.session.user.profileComplete = !!doctor.length;
        } else if (req.session.user.Role === 'PATIENT') {
            const [patient] = await conPool.query(
                'SELECT PatientID FROM patient WHERE UserID = ?',
                [req.session.user.UserID]
            );
            req.session.user.profileComplete = !!patient.length;
        }

        if (!req.session.user.profileComplete) {
            return res.redirect(`/${req.session.user.Role.toLowerCase()}/profile`);
        }

        next();
    } catch (err) {
        console.error('Error in profile completion check:', err);
        return res.status(500).send('Server Error');
    }
};

// middleware/auth.js
const checkAuth = (req, res, next) => {
    if (!req.session.loggedIn) {
        return res.redirect('/login');
    }
    next();
};

const checkRole = (roles = []) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        if (!roles.includes(req.session.user.Role.toLowerCase())) {
            return res.status(403).render('error', {
                message: 'Access Denied'
            });
        }
        next();
    };
};


function checkRequiredFields(fields, data) {
    const missing = fields.filter(field => !data[field] || data[field].toString().trim() === '');
    if (missing.length) {
      throw new Error(`Missing required field(s): ${missing.join(', ')}`);
    }
  }

module.exports = { chkLogin, checkProfileComplete, checkAuth, checkRole, checkRequiredFields };
