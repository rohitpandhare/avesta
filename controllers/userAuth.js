// Importing required modules
const { conPool } = require('../config/dbHandler'); // importing conpool for DB operations
const md5 = require('md5'); // for hashing passwords
const { sendResponse } = require('./helperAuth'); // helper func

// FROM Crud - Creating User
const createUser = async (req, res) => {
  const { Username, Email, Password, Role } = req.body;

  // Validation
  if (!Username || !Email || !Password || !Role) {
      return res.status(400).render('dashboard/signup', {
          error: "All fields are required"
      });
  }

  if (!['PATIENT', 'DOCTOR', 'ADMIN'].includes(Role)) {
      return res.status(400).render('dashboard/signup', {
          error: "Invalid user role"
      });
  }

  try {
      // Create user in database
      const hashedPassword = md5(Password);
      const [result] = await conPool.query(
          `INSERT INTO USER (Username, Email, Password, Role)
           VALUES (?, ?, ?, ?)`,
          [Username, Email, hashedPassword, Role]
      );

      // Set session with incomplete profile flag
      req.session.user = {
          UserID: result.insertId,
          Username,
          Role,
          profileComplete: false
      };

      // Redirect to profile completion
      if (Role === 'DOCTOR') {
          res.redirect('/doctor/profile');
      } else if (Role === 'PATIENT') {
          res.redirect('/patient/profile');
      } else {
          req.session.user.profileComplete = true;
          res.redirect('/admin');
      }

  } catch (err) {
      console.error("Signup error:", err);
      const errorMessage = err.code === 'ER_DUP_ENTRY' 
          ? "Username or email already exists" 
          : "Registration failed";
      
      res.status(400).render('dashboard/signup', { error: errorMessage });
  }
};

// User login 
async function doLogin(req, res) {
  try {
      const { Username, Password, Role } = req.body;

      if (!Username || !Password || !Role) {
          return res.status(400).render('dashboard/login', {
              error: 'All fields are required',
              username: Username,
              role: Role,
          });
      }

      const hashedPassword = md5(Password);
      const [users] = await conPool.query(
          'SELECT UserID, Username, Role FROM user WHERE Username = ? AND Password = ? AND Role = ?',
          [Username, hashedPassword, Role]
      );

      if (!users || users.length === 0) {
          return res.status(401).render('dashboard/login', { error: 'Invalid credentials' });
      }

      // Session Setup
      req.session.user = {
          UserID: users[0].UserID,
          Username: users[0].Username,
          Role: users[0].Role,
          profileComplete: false,
      };

      // Role-based redirection
      if (Role === 'DOCTOR') {
          return res.redirect('/doctor');
      } else if (Role === 'PATIENT') {
          return res.redirect('/patient');
      } else if (Role === 'ADMIN') {
          req.session.user.profileComplete = true;
          return res.redirect('/admin');
      }

  } catch (err) {
      console.error('Login error:', err);
      return res.status(500).render('dashboard/login', { error: 'Server error during login' });
  }
}

// Reset Password Route
async function resetPass (req, res) {
    try {
      const { Username, newPassword, confirmPassword } = req.body;
  
      if (newPassword !== confirmPassword) { // if password is not same
        return res.status(400).render('resetPass', {
          error: 'Passwords do not match'
        });
      }
  
      const hashedPassword = md5(newPassword); // new hash pw to check with old hashed pw
  
      const query = 'UPDATE user SET Password = ? WHERE Username = ?';
  
      const [result] = await conPool.query(query, [hashedPassword, Username]);
  
      if (result.affectedRows > 0) {
        res.redirect('/login');
      } else {
        res.status(404).render('resetPass', {
          error: 'User not found'
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).render('resetPass', {
        error: 'Error in resetting password'
      });
    }
  };
  

function logout(req, res){
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to log out' });
        }
        res.redirect('/'); // to index page
    });
};

module.exports = {
    createUser,
    doLogin,
    resetPass,
    logout
};
