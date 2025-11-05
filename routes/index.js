const express = require('express');
const { loanRouter } = require('./loan.js');
const { employeeRoute } = require('./employee.js');
const { expenseRoute } = require('./expanse.js');

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
    {
        path: '/expenses',
        route: expenseRoute,
    },
];

moduleRoutes.forEach(({ path, route }) => {
    router.use(path, route);
});

module.exports = router;
