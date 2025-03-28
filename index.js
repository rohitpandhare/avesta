const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CORS configuration
const corsOptions = {
    credentials: true,
    origin: ['http://localhost:3001', 'http://localhost:3005'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Session middleware
app.use(session({
    secret: 'rohitiscool',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

const dashboardLinks = require('./routes/dashboardRoutes');
app.use('/', dashboardLinks)

const publicLinks = require('./routes/publicRoutes'); 
app.use('/', publicLinks);

const testLinks = require('./routes/testRoutes'); 
app.use('/', testLinks);

const authlinks = require('./routes/auth'); 
app.use('/auth', authlinks);

const adminLinks = require('./routes/adminRoutes'); 
app.use('/admin', adminLinks);

const doctorLinks = require('./routes/doctorRoutes'); 
app.use('/doctor', doctorLinks);

const patientLinks = require('./routes/patientRoutes'); 
app.use('/patient', patientLinks);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).render('error', {
        message: 'Internal Server Error'
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
