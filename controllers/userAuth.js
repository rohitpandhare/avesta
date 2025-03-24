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
function doLogin(req, res) {
    const { Username, Password, Role } = req.body; // extract data from req.body
    const hashedPassword = md5(Password); // hash password

    const query = 'SELECT UserID, Email, Role FROM user WHERE Username = ? AND Password = ? AND Role = ?';

    conPool.query(query, [Username, hashedPassword, Role], (err, results) => {
        if (err) {
            return res.status(500).render('dashboard/login', {
                error: "Database error occurred"
            });
        }

        if (results.length === 0) { // if no user found
            return res.status(401).render('dashboard/login', {
                error: "Invalid credentials"
            });
        }

        const user = results[0]; // get the first user
        req.session.loggedIn = true; // this varible is used in Index.js for AUthorized routing
        req.session.user = user; // store user data in session' 
        req.session.lastActivity = Date.now(); // store last activity time

        // Update last login timestamp
        conPool.query('UPDATE user SET LastLogin = CURRENT_TIMESTAMP WHERE UserID = ?', [user.UserID]);

        // Redirect based on user role
        switch (user.Role.toLowerCase()) {
            case 'admin':
                res.redirect('/admin');
                break;
            case 'doctor':
                res.redirect('/doctor');
                break;
            case 'patient':
                res.redirect('/patient');
                break;
            default:
                res.redirect('/index');
        }
    });
}

// Reset Password Route
function reserPass(req, res){
    const { Username, newPassword, confirmPassword } = req.body;
    
    if (newPassword !== confirmPassword) { // if password is not same
        return res.status(400).render('resetPass', {
            error: 'Passwords do not match'
        });
    }

    const hashedPassword = md5(newPassword); // new hash pw to check with old hashed pw

    const query = 'UPDATE user SET Password = ? WHERE Username = ?';

    conPool.query(query, [hashedPassword, Username],(err, result) => {
        if(err){
            console.log(err);
            return sendResponse(res,"Error in resetting password",{message: err.message},true,500);
            }  
        
        //if pw is updated successfully
        if(result.affectedRows > 0){
            res.redirect('/login');
        } else{
            sendResponse(res,"User not found",{},true,404);
        }    
    });
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
    reserPass,
    logout
};
