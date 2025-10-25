const express = require('express');
const { loanRouter } = require('./loan.js');

const router = express.Router();

const moduleRoutes = [
    {
        path: '/loans',
        route: loanRouter,
    },
];

moduleRoutes.forEach(({ path, route }) => {
    router.use(path, route);
});

module.exports = router;
