const express = require('express');
const { loanRouter } = require('./loan.js');
const { employeeRoute } = require('./employee.js');

const router = express.Router();

const moduleRoutes = [
    {
        path: '/loans',
        route: loanRouter,
    },
    {
        path: '/employees',
        route: employeeRoute,
    },
];

moduleRoutes.forEach(({ path, route }) => {
    router.use(path, route);
});

module.exports = router;
