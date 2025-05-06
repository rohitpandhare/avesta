require("dotenv").config();
var myDB = require('mysql2/promise'); //importing mysql 

const conPool = myDB.createPool({ 
    connectionLimit: 100,
    host: process.env.host,
    user: process.env.user,
    password: process.env.password,
    database: process.env.database, 
    debug: false,
    waitForConnections: true,
    queueLimit: 0
});

conPool.on('error', (err) => { // when some error occur - log the err
    console.error('Database pool error:', err);
});

module.exports = { // export conpool so other func can use it
    conPool
};
