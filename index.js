const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');
const flash = require('express-flash');

//Intialize the Express App
const app = express();
const port = 3000;

//Database Connection Pool
const conPool = mysql.createPool({
    connectionLimit: 1000,
    host: "localhost",
    user: "root",
    password: "root",
    database: "doctorsync_db",
    debug: false
});

//Middleware to handle req parsing
app.use(express.json());
app.use(express.urlencoded({extended:true}));

//Setup the views files 
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(
    session({
      secret: 'rohitiscool',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
      },
    })
  );

//Importing middlware and routes
const authLinks = require('./routes/auth');
app.use('/auth', authLinks);


// Add these middlewares
app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: false }));

app.use(flash());
// const doctorLinks = require('./routes/doctorRoutes');
// app.use('/doctor', doctorLinks);

const doctorRoutes = require('./routes/doctorRoutes');
app.use('/doctor', doctorRoutes); // This makes routes available at /doctor and /doctor/patients/add

//Render The created EJS file - via get or post
app.get('/',(req,res)=>{
    res.render('dashboard/index');
})

app.get('/login',(req,res)=>{
  res.render('dashboard/login');
})

app.get('/signup', (req, res) => {
  res.render('dashboard/signup'); 
});

app.get('/reset', (req, res) => {
  res.render('dashboard/resetPass');
});

app.get('/findDr', async (req, res) => {
  try {
      // Query to get all doctors with their details
      const [doctors] = await conPool.query(`
          SELECT 
              DoctorID,
              Name,
              Specialty,
              Phone,
              LicenseNumber,
              Qualifications
          FROM DOCTOR
          ORDER BY Name
      `);
      
      res.render('dashboard/findDr', { doctors });
  } catch (err) {
      console.error('Error fetching doctors:', err);
      res.render('dataRelated/doctors', { 
          doctors: [],
          error: 'Error retrieving doctors list'
      });
  }
});

// Add search functionality
app.get('/findDr/search', async (req, res) => {
  try {
      const searchTerm = req.query.search || '';
      const [doctors] = await conPool.query(`
          SELECT 
              DoctorID,
              Name,
              Specialty,
              Phone,
              LicenseNumber,
              Qualifications
          FROM DOCTOR 
          WHERE 
              Name LIKE ? 
              OR Specialty LIKE ?
      `, [`%${searchTerm}%`, `%${searchTerm}%`]);
      
      res.render('dashboard/findDr', { doctors });
  } catch (err) {
      console.error('Error searching doctors:', err);
      res.render('findDr', { 
          doctors: [],
          error: 'Error searching doctors'
      });
  }
});

// GET route for prescription form
app.get('/viewPres',(req,res)=>{
  res.render('dashboard/viewPres')
})

// POST route to handle prescription lookup
app.post('/viewPres', async (req, res) => {
  try {
      const refId = req.body.refId;

      const [prescriptions] = await conPool.query(
          `SELECT p.PrescriptionID, p.DateIssued, p.DiagnosisNotes, p.Medicines, p.Status, 
           p.GlobalReferenceID, d.Name as DoctorName
           FROM PRESCRIPTION p
           JOIN DOCTOR d ON p.DoctorID = d.DoctorID
           WHERE p.GlobalReferenceID = ?`,
          [refId]
      );

      if (prescriptions.length === 0) {
          return res.render('dashboard/viewPres', { error: 'No prescription found with this reference ID' });
      }

      res.render('dashboard/viewPres', { prescription: prescriptions[0] });

  } catch (err) {
      console.error('Error fetching prescription:', err);
      res.render('dashboard/viewPres', { error: 'Database error, please try again later' });
  }
});

// Role check middleware
const checkRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.session.loggedIn) {
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

// Protected routes with improved role checking
app.get('/admin', checkRole(['admin']), async (req, res) => {
  try {
      // Get the admin user details
      const [adminDetails] = await conPool.query(
          'SELECT Username FROM user WHERE UserID = ?',
          [req.session.user.UserID]
      );

      // Fetch all required data in parallel
      const [userList, doctorList, patientList] = await Promise.all([
          conPool.query('SELECT UserID, Username, Email, Role, CreatedAt FROM user'),
          conPool.query('SELECT DoctorID, Name, Specialty, Phone, LicenseNumber, Qualifications FROM doctor'),
          conPool.query('SELECT PatientID, Name, Address, Phone, DOB, BloodGroup FROM patient')
      ]);
      
      res.render('users/admin', { 
          user: adminDetails[0] || { Username: 'Admin' },  // Provide a default
          userList: userList[0],
          doctorList: doctorList[0],
          patientList: patientList[0]
      });
  } catch (err) {
      console.error('Error fetching data:', err);
      res.render('users/admin', { 
          user: { Username: 'Admin' },  // Provide a default
          userList: [],
          doctorList: [],
          patientList: []
      });
  }
});

// Add delete routes
app.post('/admin/delete-doctor/:id', checkRole(['admin']), async (req, res) => {
  try {
      await conPool.query('DELETE FROM doctor WHERE DoctorID = ?', [req.params.id]);
      res.json({ success: true });
  } catch (err) {
      console.error('Error deleting doctor:', err);
      res.status(500).json({ success: false });
  }
});

app.post('/admin/delete-patient/:id', checkRole(['admin']), async (req, res) => {
  try {
      await conPool.query('DELETE FROM patient WHERE PatientID = ?', [req.params.id]);
      res.json({ success: true });
  } catch (err) {
      console.error('Error deleting patient:', err);
      res.status(500).json({ success: false });
  }
});

// Update the doctor route in index.js
app.get('/doctor', checkRole(['doctor']), async (req, res) => {
  try {
    // Add debug log
    console.log('Doctor session:', req.session.user);
    
    // Render the dashboard first
    res.render('users/doctor', { 
      user: req.session.user,
      stats: { 
        totalPatients: 0, // Temporary placeholder
        upcomingAppointments: 0 
      } 
    });
    
    // Optional: Call getPatients separately via AJAX later
  } catch (err) {
    console.error("Doctor dashboard error: ", err);
    res.render('users/doctor', { 
      user: req.session.user,
      error: "Failed to load dashboard" 
    });
  }
});

app.get('/patient',checkRole(['patient']), async (req,res)=>{
  res.render('users/patient')
})

// Error handling middleware (add at the end)
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  if (req.accepts('json')) {
      res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: err.message
      });
  } else {
      res.status(500).send('Internal Server Error');
  }
});

//Port mapping
app.listen(port, () => {
    console.log(`The server is running on http://localhost:${port}`);
  });
