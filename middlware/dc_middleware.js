const { sendResponse } = require('../controllers/helperAuth'); //use of helper func

const chkLogin = (req, res, next) => {
    if (req.session.loggedIn) {
        next(); //proceed on logged in
    } else {
        return sendResponse(res, "Unauthorized: Please log in", {}, true, 401);
         // err
    }
};

module.exports = { chkLogin };
