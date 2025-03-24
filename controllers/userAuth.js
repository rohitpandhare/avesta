// Importing required modules
const { conPool } = require('../config/dbHandler'); // importing conpool for DB operations
const md5 = require('md5'); // for hashing passwords
const { sendResponse } = require('./helperAuth'); // helper func

// FROM Crud - Creating User
function createUser(req, res) {
    const { Username, Email, Password, Role } = req.body; // extract data from req.body

    if (!Username || !Email || !Password || !Role) { // err when any field is blank 
        return res.status(400).render('signup', {
            error: "Missing required fields"
        });
    }

    const validUserTypes = ['patient', 'doctor', 'admin']; // valid user array
    const normalizedUserType = Role.toLowerCase(); // lowercase to avoid case sensitivity

    // err handling 
    if (!validUserTypes.includes(normalizedUserType)) { // if not from valid user array - err
        return res.status(400).render('signup', {
                    error: `Invalid user type. Must be one of: ${validUserTypes.join(', ')}`
                    }
                );
        }

    const hashedPassword = md5(Password);
    
    // Two-step transaction for user creation ( getConnection and beginTransaction)
    conPool.getConnection((err, connection) => {
        if (err) { // err handling
            return res.status(500).render('signup', {
                error: "Database connection error"
            });
        }

        connection.beginTransaction(err => {
            if (err) {
                connection.release(); // release connection 
                return res.status(500).render('signup', {
                    error: "Transaction error"
                    });
            }
            // Create user query
            const query = `
                INSERT INTO user
                (Username, Email, Password, Role) 
                VALUES (?, ?, ?, ?)
            `;
            
            //core logic here
            connection.query(query, [Username, Email, hashedPassword, normalizedUserType], (err) => {
                if (err) {
                    // Rollback transaction on error
                    connection.rollback(() => {
                        connection.release();
                        if (err.code === 'ER_DUP_ENTRY') {
                            return res.status(400).render('signup', {
                                error: "Username or email already exists"
                            });
                        }
                        return res.status(500).render('signup', {
                            error: "Error creating user: " + err.message
                        });
                    });
                    return; //exit
                }

                connection.commit(err => {
                    if (err) {
                        connection.rollback(() => {
                            connection.release();
                            return res.status(500).render('signup', {
                                error: "Error finalizing user creation"
                            });
                        });
                        return;
                    }
                    
                    connection.release();
                    res.redirect('/login');
                });
            });
        });
    });
}

// User login 
async function doLogin(req, res) {
    try {
      const { Username, Password, Role } = req.body;
      const hashedPassword = md5(Password);
  
      const [results] = await conPool.query(
        'SELECT UserID, Username, Email, Role, Password FROM user WHERE Username = ? AND Role = ?',
        [Username, Role]
      );
  
      if (results.length === 0 || results[0].Password !== hashedPassword) {
        return res.status(401).render('dashboard/login', {
          error: 'Invalid username or password'
        });
      }
  
      // Set session properly
      req.session.loggedIn = true;
      req.session.user = {
        UserID: results[0].UserID,
        Username: results[0].Username,
        Role: results[0].Role
      };
  
      // Force session save
      req.session.save(err => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).render('error', { message: 'Session error' });
        }
        
        // Redirect after successful session save
        switch (results[0].Role.toLowerCase()) {
          case 'admin':
            return res.redirect('/admin');
          case 'doctor':
            return res.redirect('/doctor');
          case 'patient':
            return res.redirect('/patient');
          default:
            return res.redirect('/');
        }
      });
  
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).render('dashboard/login', {
        error: 'Internal server error'
      });
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
