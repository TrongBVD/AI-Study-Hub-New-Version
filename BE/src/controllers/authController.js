const loginController = require('./auth/loginController');
const registerController = require('./auth/registerController');
const passwordController = require('./auth/passwordController');
const accountController = require('./auth/accountController');

module.exports = {
    ...loginController,
    ...registerController,
    ...passwordController,
    ...accountController,
};
