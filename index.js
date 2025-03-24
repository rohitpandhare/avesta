const express = require('express');
const session = require('express-session');
// const mysql = require('mysql2/promise');
const path = require('path');
// const flash = require('express-flash');

// Initialize Express App
const app = express();
const port = 3000;

// Middleware Setup
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'rohitiscool',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    },
}));

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import Routes
const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctorRoutes');
const patientRoutes = require('./routes/patientRoutes');
const adminRoutes = require('./routes/adminRoutes');
// const prescriptionRoutes = require('./routes/prescriptionRoutes');
const publicRoutes = require('./routes/publicRoutes');

// Route Middlewares
app.use('/', publicRoutes);
app.use('/auth', authRoutes);
app.use('/doctor', doctorRoutes);
app.use('/patient', patientRoutes);
app.use('/admin', adminRoutes);
// app.use('/prescription', prescriptionRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    if (req.accepts('json')) {
        return res.status(500).json({ error: 'Internal server error' });
    }
    res.status(500).render('error', { message: 'Something went wrong!' });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
