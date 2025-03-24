var myDB = require('mysql2'); //importing mysql 

const conPool = myDB.createPool({ //creating conpool connection - so all the func can acess them
    connectionLimit: 1000,
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: "doctorsync_db", //created DB
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
