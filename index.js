const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');
require('dotenv').config();
const multer = require('multer');
const { uploadToCloudinary } = require('./uploadPhoto');

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const router = require('./routes/index.js');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 5000;

// Middleware
app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
    })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.json());

const TOKEN_SECRET = process.env.TOKEN_SECRET;
// ************************************************************************************************
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});
app.get('/', (req, res) => {
    res.send('Hello World!');
});
// ************************************************************************************************
// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).send({ message: 'Access forbidden' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'No authorization' });
    }

    jwt.verify(token, TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res
                .status(403)
                .send({ message: 'Forbidden: Invalid token' });
        }
        req.user = decoded;
        next();
    });
};
// ************************************************************************************************

// JWT token generation
// app.post("/jwt", (req, res) => {
//     const { email } = req.body;
//     if (!email) {
//         return res.status(400).send({ message: "Email is required" });
//     }

//     const token = jwt.sign({ email }, TOKEN_SECRET, {
//         expiresIn: "24h",
//     });
//     res.send({ success: true, token });
// });

// REPLACE your existing /jwt with this hardening (after client/db are ready)

// ************************************************************************************************
// JWT token validation route
app.post('/validate-token', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; // Extract token from 'Authorization' header

    if (!token) {
        return res
            .status(400)
            .send({ success: false, message: 'Forbidden access' });
    }

    // Verify the token
    jwt.verify(token, TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res
                .status(401)
                .send({ success: false, message: 'Invalid or expired token' });
        }

        // If token is valid, respond with the user data
        res.send({ success: true, user: decoded });
    });
});
// ************************************************************************************************
// Logout endpoint
app.post('/logout', (req, res) => {
    res.clearCookie('token'); // Clear the JWT cookie
    res.status(200).json({ message: 'Logged out successfully' });
});
// ************************************************************************************************

// ************************************************************************************************

async function run() {
    try {
        // ******************************************************************************************
        // ******************************************************************************************
        const database = client.db('hrManagement');
        const userCollections = database.collection('userList');
        const expenseCollections = database.collection('expenseList');
        const categoryCollections = database.collection('categoryList');
        const localOrderCollections = database.collection('localOrderList');
        const clientCollections = database.collection('clientList');
        const hrBalanceCollections = database.collection('hrBalanceList');
        const hrTransactionCollections =
            database.collection('hrTransactionList');
        const mainBalanceCollections = database.collection('mainBalanceList');
        const mainTransactionCollections = database.collection(
            'mainTransactionList'
        );
        const balanceCollection = client
            .db('hrManagement')
            .collection('loanBalance');
        const employeeCollections = database.collection('employeeList');
        const earningsCollections = database.collection('earningsList');
        const shiftingCollections = database.collection('shiftingList');
        const shareHoldersCollections = database.collection('shareHoldersList');
        const profitShareCollections = database.collection('profitShareList');
        const checkInCollections = database.collection('checkInList');
        const checkOutCollections = database.collection('checkOutList');
        const attendanceCollections = database.collection('attendanceList');
        const OTStartCollections = database.collection('OTStartList');
        const OTStopCollections = database.collection('OTStopList');
        const PFAndSalaryCollections = database.collection('PFAndSalaryList');
        const monthlyProfitCollections =
            database.collection('monthlyProfitList');
        const unpaidCollections = database.collection('unpaidList');
        const adminNotificationCollections = database.collection(
            'adminNotificationList'
        );
        const employeeNotificationCollections = database.collection(
            'employeeNotificationList'
        );
        const appliedLeaveCollections = database.collection('appliedLeaveList');
        const leaveBalanceCollections = database.collection('leaveBalanceList');
        const noticeBoardCollections = database.collection('noticeBoardList');
        const leaveApplicationsCollections =
            database.collection('leaveApplications');
        const salaryAndPFCollections = database.collection('salaryAndPFList');
        const workingShiftCollections = database.collection('workingShiftList');

        // ******************store unpaid once********************************************************

        // *******************************************************************************************
        // JWT token generation (must be inside run() so it can see employeeCollections)
        app.post('/jwt', async (req, res) => {
            try {
                const { email } = req.body || {};
                if (!email)
                    return res
                        .status(400)
                        .send({ message: 'Email is required' });
                if (!TOKEN_SECRET)
                    return res.status(500).send({
                        message: 'Server misconfiguration (TOKEN_SECRET)',
                    });

                const normEmail = String(email).trim().toLowerCase();

                // If employee exists and is deactivated, block issuing token
                const emp = await employeeCollections.findOne(
                    { email: normEmail },
                    { projection: { status: 1 } }
                );

                if (emp && String(emp.status).toLowerCase() === 'de-activate') {
                    return res.status(403).send({
                        message:
                            'Your account has been deactivated. Please contact HR.',
                    });
                }

                const token = jwt.sign({ email: normEmail }, TOKEN_SECRET, {
                    expiresIn: '24h',
                });
                res.send({ success: true, token });
            } catch (err) {
                console.error('POST /jwt failed:', err?.message || err);
                res.status(500).send({ message: 'Failed to create token' });
            }
        });

        // ******************store unpaid once********************************************************
        // const unpaidEntries = await earningsCollections.find({ status: { $ne: 'Paid' } }).toArray();

        // const monthTotals = {};

        // unpaidEntries.forEach(entry => {
        //     const month = entry.month;
        //     if (!monthTotals[month]) {
        //         monthTotals[month] = {
        //             month,
        //             totalConvertedBdt: 0,
        //             status: 'Unpaid',
        //         };
        //     }

        //     monthTotals[month].totalConvertedBdt += parseFloat(entry.convertedBdt || 0);
        // });

        // // Step 3: Convert to array and insert into unpaidCollections
        // const unpaidData = Object.values(monthTotals);

        // if (unpaidData.length > 0) {
        //     await unpaidCollections.insertMany(unpaidData);
        //     console.log(`✅ Inserted ${unpaidData.length} month-wise unpaid summaries.`);
        // } else {
        //     console.log('⚠️ No unpaid entries found.');
        // }

        // *******************************************************************************************
        //insert from another collection
        // async function initializeLeaveBalance() {
        //     try {
        //         const employees = await employeeCollections
        //             .find({}, { projection: { _id: 0, email: 1, fullName: 1, eid: 1 } })
        //             .toArray();

        //         if (!employees.length) {
        //             console.log("⚠️ No employee data found.");
        //             return;
        //         }

        //         const leaveData = employees.map(emp => ({
        //             fullName: emp.fullName,
        //             email: emp.email,
        //             eid: emp.eid,
        //             casualLeave: 0,
        //             sickLeave: 0
        //         }));

        //         const result = await leaveBalanceCollections.insertMany(leaveData);

        //         console.log(`✅ Inserted ${result.insertedCount} leave balance records.`);
        //     } catch (error) {
        //         console.error("❌ Failed to initialize leave balances:", error);
        //     }
        // }

        // initializeLeaveBalance();

        // ******************************************************************************************
        // SMTP transporter
        const mailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false otherwise
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // ******************************************************************************************
        function normRole(role) {
            return String(role || '')
                .trim()
                .toLowerCase();
        }

        async function ensureCanPostNotice(email) {
            const u = await userCollections.findOne(
                { email },
                { projection: { role: 1 } }
            );
            const allowed = new Set(['admin', 'hr-admin', 'developer']); // roles in userCollections
            if (!u || !allowed.has(normRole(u.role))) {
                const err = new Error(
                    'Only Admin, HR-ADMIN, or Developer can post notices'
                );
                err.status = 403;
                throw err;
            }
        }

        // ******************************************************************************************
        async function uploadPdfBufferOrNull(file) {
            if (!file) return null;
            if (file.mimetype !== 'application/pdf') {
                const err = new Error('Only PDF files are allowed');
                err.status = 400;
                throw err;
            }
            // your helper: uploadToCloudinary(buffer) -> url
            const url = await uploadToCloudinary(file.buffer);
            return url;
        }

        // ******************************************************************************************
        async function emailAllEmployees({
            title,
            body,
            fileUrl,
            effectiveDate,
            createdBy,
        }) {
            const cursor = employeeCollections.find(
                {},
                { projection: { email: 1, fullName: 1 } }
            );
            const emails = [];
            await cursor.forEach((doc) => {
                if (doc?.email) emails.push(doc.email);
            });
            if (!emails.length) return;

            const subject = `Notice: ${title}`;
            const html = `
    <div style="font-family:sans-serif;">
      <h2 style="margin:0 0 8px;">${title}</h2>
      <div style="color:#555;margin:0 0 12px;">Effective: ${
          effectiveDate ? new Date(effectiveDate).toDateString() : '—'
      }</div>
      <div style="white-space:pre-wrap;margin-bottom:12px;">${(
          body || ''
      ).replace(/\n/g, '<br/>')}</div>
      ${
          fileUrl
              ? `<p><a href="${fileUrl}" target="_blank">View / Download PDF</a></p>`
              : ''
      }
      <hr/>
      <small>Posted by ${
          createdBy?.fullName || createdBy?.email || 'Admin'
      }</small>
    </div>
  `;

            // Batch BCC to avoid SMTP limits (e.g., 50 per batch)
            const batchSize = 50;
            for (let i = 0; i < emails.length; i += batchSize) {
                const slice = emails.slice(i, i + batchSize);
                await mailTransporter.sendMail({
                    from: process.env.EMAIL_FROM,
                    to: process.env.EMAIL_FROM, // primary "to" (your org address)
                    bcc: slice,
                    subject,
                    html,
                });
            }
        }

        // ******************************************************************************************
        // Helper function to determine role based on designation
        function roleForDesignation(designation) {
            const t = (designation || '').toString().trim().toLowerCase();
            // Explicit mappings (case/spacing tolerant)
            if (t === 'admin') return 'Admin';
            if (t === 'hr-admin' || t === 'hr admin' || t === 'hr')
                return 'HR-ADMIN';
            if (t === 'team leader' || t === 'team-leader' || t === 'tl')
                return 'teamLeader';
            if (t === 'developer' || t.includes('developer'))
                return 'Developer';
            if (t === 'employee' || t.includes('employee')) return 'employee';
            // Everyone else is a normal employee
            return 'employee';
        }

        // ******************************************************************************************
        // put this near your other helpers (after ensureCanPostNotice)
        function norm(role) {
            return String(role || '')
                .trim()
                .toLowerCase();
        }
        async function ensureCanManageEmployees(email) {
            const u = await userCollections.findOne(
                { email },
                { projection: { role: 1 } }
            );
            const allowed = new Set(['admin', 'hr-admin', 'developer']);
            if (!u || !allowed.has(norm(u.role))) {
                const err = new Error(
                    'Only Admin, HR-ADMIN, or Developer can change employee status'
                );
                err.status = 403;
                throw err;
            }
        }

        // ******************************************************************************************
        const date = moment(new Date()).format('DD-MMM-YYYY');

        // *******************************************************************************************
        app.post('/addExpense', async (req, res) => {
            try {
                const expenseData = req.body;
                const month = moment(expenseData.expenseDate).format('MMMM');
                const year = moment(expenseData.expenseDate).format('YYYY');

                const mail = req.body.userMail;
                const existingCategory = await categoryCollections.findOne({
                    expenseCategory: expenseData.expenseCategory,
                });

                if (!existingCategory) {
                    await categoryCollections.insertOne({
                        expenseCategory: expenseData.expenseCategory,
                    });
                }
                const availableBalance = await hrBalanceCollections.findOne();
                const availableMainBalance =
                    await mainBalanceCollections.findOne();
                const expenseBalance = expenseData.expenseAmount;

                const findMonthInMonthlyProfit =
                    await monthlyProfitCollections.findOne({ month, year });
                if (findMonthInMonthlyProfit) {
                    // If month already exists, update the earnings and profit
                    await monthlyProfitCollections.updateOne(
                        { month, year },
                        {
                            $inc: {
                                expense: expenseBalance,
                                profit: -expenseBalance,
                                remaining: -expenseBalance,
                            },
                        }
                    );
                } else {
                    // If month does not exist, create a new entry
                    if (availableMainBalance.mainBalance >= expenseBalance) {
                        await monthlyProfitCollections.insertOne({
                            month,
                            year,
                            earnings: 0,
                            expense: expenseBalance,
                            profit: -expenseBalance,
                            remaining: -expenseBalance,
                            shared: [],
                        });
                    }
                }

                if (availableMainBalance.mainBalance >= expenseBalance) {
                    const addExpense = await expenseCollections.insertOne(
                        expenseData
                    );
                    await mainBalanceCollections.updateOne(
                        {},
                        {
                            $inc: { mainBalance: -expenseBalance },
                        }
                    );
                    await mainTransactionCollections.insertOne({
                        amount: expenseBalance,
                        note: expenseData.expenseNote,
                        date,
                        type: 'Expense',
                    });
                    res.send(addExpense);
                } else {
                    res.json('Insufficient balance');
                }
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to add expense',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        app.post('/addHrBalance', async (req, res) => {
            try {
                const { parseValue, note } = req.body;

                const availableBalance = await mainBalanceCollections.findOne();

                if (availableBalance.mainBalance >= parseValue) {
                    await hrTransactionCollections.insertOne({
                        value: parseValue,
                        note,
                        date,
                        type: 'In',
                    });

                    let existingBalance = await hrBalanceCollections.findOne();

                    if (existingBalance) {
                        await hrBalanceCollections.updateOne(
                            {},
                            {
                                $inc: { balance: parseValue },
                            }
                        );
                    } else {
                        // Insert a new document if no balance exists
                        await hrBalanceCollections.insertOne({
                            balance: parseValue,
                        });
                    }

                    // deduct the amount from main balance
                    await mainBalanceCollections.updateOne(
                        {},
                        {
                            $inc: { mainBalance: -parseValue },
                        }
                    );

                    res.status(200).json({ message: 'success' });
                } else {
                    res.json({ message: 'Not enough funds' });
                }
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to add balance',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        app.post('/addMainBalance', async (req, res) => {
            try {
                const { parseValue, note } = req.body; // Assuming amount is sent in the request body
                await mainTransactionCollections.insertOne({
                    amount: parseValue,
                    note,
                    date,
                    type: 'Credit',
                });

                let existingBalance = await mainBalanceCollections.findOne();

                if (existingBalance) {
                    // Update the first existing document by incrementing the balance
                    await mainBalanceCollections.updateOne(
                        {},
                        {
                            $inc: { mainBalance: parseValue },
                        }
                    );
                } else {
                    // Insert a new document if no balance exists
                    await mainBalanceCollections.insertOne({
                        mainBalance: parseValue,
                    });
                }

                res.status(200).json({ message: 'Balance added successfully' });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to add balance',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        app.post('/createLocalOrder', async (req, res) => {
            try {
                const orderData = req.body;
                const id = req.body.clientID;

                if (id) {
                    await clientCollections.updateOne(
                        { clientID: id },
                        { $push: { orderHistory: orderData } }
                    );
                }

                // 👉 ensure isLocked is present and false by default
                const addOrder = await localOrderCollections.insertOne({
                    ...orderData,
                    isLocked: orderData.isLocked ?? false,
                });

                res.send(addOrder);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to add expense',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        app.post('/registerEmployees', async (req, res) => {
            try {
                const employeeData = req.body;
                const email = req.body.email;
                // console.log(employeeData);

                await userCollections.insertOne({
                    email: email,
                    role: 'employee',
                    userName: '',
                    profilePic: '',
                });
                const result = await employeeCollections.insertOne(
                    employeeData
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to register employee',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        // at top of your index.js (if not already)
        app.post('/addEarnings', async (req, res) => {
            try {
                const {
                    month: rawMonth,
                    clientId,
                    totalUsd,
                    charge,
                    receivable,
                    convertRate,
                    imageQty,
                    convertedBdt,
                    status, // "Paid" | "Unpaid"
                    userEmail,
                } = req.body || {};

                // 🧱 Validate required fields
                if (!rawMonth)
                    return res
                        .status(400)
                        .json({ success: false, message: 'Month is required' });
                if (!clientId)
                    return res.status(400).json({
                        success: false,
                        message: 'Client ID is required',
                    });
                if (!status)
                    return res.status(400).json({
                        success: false,
                        message: 'Status is required',
                    });

                // 🧮 Normalize & parse
                const month = String(rawMonth).toLowerCase(); // e.g. "august"
                const usdTotal = Number(totalUsd) || 0;
                const usdCharge = Number(charge) || 0;
                const usdReceivable =
                    Number(receivable) || Math.max(0, usdTotal - usdCharge);
                const rate = Number(convertRate) || 0;
                const earningsAmount =
                    Number(convertedBdt) ||
                    Number((usdReceivable * rate).toFixed(2)); // BDT

                // 🕒 Date (Asia/Dhaka)
                const nowDhaka = moment().tz('Asia/Dhaka');
                const date = nowDhaka.format('DD-MM-YYYY');
                const year = nowDhaka.format('YYYY');

                // 🧾 Build stored document
                const fullData = {
                    month,
                    year,
                    imageQty: Number(imageQty) || 0,
                    clientId: String(clientId),
                    status, // Paid/Unpaid
                    totalUsd: usdTotal,
                    charge: usdCharge,
                    receivable: usdReceivable,
                    convertRate: rate,
                    convertedBdt: earningsAmount,
                    date, // human-readable
                    createdAt: new Date(),
                    userEmail: userEmail || '',
                };

                // 🪙 1) Track unpaid monthly bucket (only if Unpaid)
                if (status === 'Unpaid') {
                    const findMonth = await unpaidCollections.findOne({
                        month,
                        year,
                    });

                    if (findMonth) {
                        await unpaidCollections.updateOne(
                            { month, year },
                            { $inc: { totalConvertedBdt: earningsAmount } }
                        );
                    } else {
                        await unpaidCollections.insertOne({
                            month,
                            year,
                            totalConvertedBdt: earningsAmount,
                            status: 'Unpaid',
                            createdAt: new Date(),
                        });
                    }
                }

                // 💰 2) Monthly profit tracking
                const findMonthProfit = await monthlyProfitCollections.findOne({
                    month,
                    year,
                });
                if (findMonthProfit) {
                    await monthlyProfitCollections.updateOne(
                        { month, year },
                        {
                            $inc: {
                                earnings: earningsAmount,
                                profit: earningsAmount,
                                remaining: earningsAmount,
                            },
                            $setOnInsert: { expense: 0, shared: [] },
                        }
                    );
                } else {
                    await monthlyProfitCollections.insertOne({
                        month,
                        year,
                        earnings: earningsAmount,
                        expense: 0,
                        profit: earningsAmount,
                        remaining: earningsAmount,
                        shared: [],
                        createdAt: new Date(),
                    });
                }

                // 🧾 3) Insert earnings record
                const result = await earningsCollections.insertOne(fullData);

                // 🏦 4) When Paid → main balance, transactions, and client history
                if (status === 'Paid') {
                    await mainBalanceCollections.updateOne(
                        {},
                        { $inc: { mainBalance: earningsAmount } },
                        { upsert: true }
                    );

                    await mainTransactionCollections.insertOne({
                        amount: earningsAmount,
                        note: `Earnings from Client_${clientId}`,
                        date: new Date(),
                        type: 'Earning',
                        meta: {
                            month,
                            year,
                            clientId,
                            currency: 'BDT',
                            usdReceivable,
                            rate,
                        },
                    });

                    await clientCollections.updateOne(
                        { clientID: clientId },
                        { $push: { paymentHistory: fullData } },
                        { upsert: true }
                    );
                }

                return res.send({
                    success: true,
                    insertedId: result.insertedId,
                });
            } catch (error) {
                console.error('❌ addEarnings error:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to add earnings',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        app.post('/addClient', async (req, res) => {
            try {
                const { clientId, country } = req.body;

                if (!clientId || !country) {
                    return res.status(400).json({
                        message: 'Client ID and Country are required.',
                    });
                }

                const existingClient = await clientCollections.findOne({
                    clientID: clientId,
                });

                if (existingClient) {
                    return res.json({ message: 'This ID already exists' });
                }

                const result = await clientCollections.insertOne({
                    clientID: clientId,
                    country: country,
                    orderHistory: [],
                    paymentHistory: [],
                });

                res.status(201).json({
                    message: 'Client added successfully',
                    insertedId: result.insertedId,
                });
            } catch (error) {
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // ************************************************************************************************

        app.post('/assign-shift', async (req, res) => {
            try {
                const { employees, shift, OTFor } = req.body;

                let entryTime;
                if (shift === 'Morning') {
                    entryTime = '06:00 AM';
                } else if (shift === 'Evening') {
                    entryTime = '02:00 PM';
                } else if (shift === 'Night') {
                    entryTime = '10:00 PM';
                } else if (shift === 'General') {
                    entryTime = '10:00 AM';
                } else if (shift === 'OT list') {
                    entryTime = '10:00 AM'; // or assign custom time for OT list
                }

                if (!employees?.length || !shift) {
                    return res
                        .status(400)
                        .send({ message: 'Invalid input data' });
                }

                const inserted = [];
                const updated = [];
                const skipped = [];

                for (const emp of employees) {
                    if (shift === 'OT list') {
                        // For OT list, allow duplicate entry with same email + OT marker
                        const otEmailKey = emp.email + '_OT';
                        const alreadyInOT = await shiftingCollections.findOne({
                            email: otEmailKey,
                        });

                        if (!alreadyInOT) {
                            await shiftingCollections.insertOne({
                                fullName: emp.fullName,
                                email: otEmailKey, // Mark as OT entry
                                actualEmail: emp.email, // Keep original email as reference
                                shiftName: shift,
                                entryTime,
                                OTFor,
                            });
                            inserted.push(emp);
                        } else {
                            skipped.push(emp);
                        }
                    } else {
                        const existing = await shiftingCollections.findOne({
                            email: emp.email,
                        });

                        if (!existing) {
                            await shiftingCollections.insertOne({
                                fullName: emp.fullName,
                                email: emp.email,
                                shiftName: shift,
                                entryTime,
                            });
                            inserted.push(emp);
                        } else if (existing.shiftName !== shift) {
                            await shiftingCollections.updateOne(
                                { email: emp.email },
                                {
                                    $set: {
                                        shiftName: shift,
                                        entryTime,
                                    },
                                }
                            );
                            updated.push(emp);
                        } else {
                            skipped.push(emp);
                        }
                    }
                }

                res.status(200).json({
                    message: 'Shift assignment processed',
                    insertedCount: inserted.length,
                    updatedCount: updated.length,
                    skippedCount: skipped.length,
                    insertedNames: inserted.map((e) => e.fullName),
                    updatedNames: updated.map((e) => e.fullName),
                    skippedNames: skipped.map((e) => e.fullName),
                });
            } catch (error) {
                res.status(500).json({ message: 'Failed to assign shift' });
            }
        });

        //************************************************************************************************
        app.post('/employee/checkIn', async (req, res) => {
            const checkInInfo = req.body;

            // helper: seed/refresh today's attendance snapshot at (first) check-in
            async function seedAttendanceSnapshot(lateCheckInValue) {
                // get some employee fields for nicer reporting (if you keep these in attendance)
                const emp = await employeeCollections.findOne(
                    { email: checkInInfo.email },
                    {
                        projection: {
                            fullName: 1,
                            designation: 1,
                            phoneNumber: 1,
                            NID: 1,
                            DOB: 1,
                            emergencyContact: 1,
                            address: 1,
                            status: 1,
                            eid: 1,
                        },
                    }
                );

                // month fallback from date if not provided
                const monthFromDate =
                    checkInInfo.month ||
                    moment(checkInInfo.date, 'DD-MMM-YYYY').format('MMMM');

                // Upsert so the row exists for admin dashboard immediately
                await attendanceCollections.updateOne(
                    { email: checkInInfo.email, date: checkInInfo.date },
                    {
                        $setOnInsert: {
                            email: checkInInfo.email,
                            date: checkInInfo.date,
                            month: monthFromDate,
                            fullName: emp?.fullName || '',
                            designation: emp?.designation || '',
                            phoneNumber: emp?.phoneNumber || '',
                            NID: emp?.NID || '',
                            DOB: emp?.DOB || '',
                            emergencyContact: emp?.emergencyContact || '',
                            address: emp?.address || '',
                            status: emp?.status || '',
                            eid: emp?.eid || '',
                        },
                        $set: {
                            checkInTime: checkInInfo.checkInTime,
                            lateCheckIn: lateCheckInValue || false,
                        },
                    },
                    { upsert: true }
                );
            }

            try {
                // prevent duplicate check-in for the same day
                const existingCheckIn = await checkInCollections.findOne({
                    email: checkInInfo.email,
                    date: checkInInfo.date, // "DD-MMM-YYYY"
                });
                if (existingCheckIn) {
                    return res.json({ message: 'Already checked in today' });
                }

                // shift info
                const shiftInfo = await shiftingCollections.findOne({
                    email: checkInInfo.email,
                });
                if (!shiftInfo?.shiftName) {
                    return res.json({ message: 'No shift assigned' });
                }

                const now = moment().tz('Asia/Dhaka');
                const nowTs = now.valueOf();

                // Morning shift windows
                const initialMorningShift = now
                    .clone()
                    .startOf('day')
                    .add(5, 'hours')
                    .add(45, 'minutes')
                    .valueOf();
                const morningShiftStart = now
                    .clone()
                    .startOf('day')
                    .add(6, 'hours')
                    .add(0, 'minutes')
                    .valueOf();
                const morningShiftLateCount = now
                    .clone()
                    .startOf('day')
                    .add(12, 'hours')
                    .add(0, 'minutes')
                    .valueOf();

                // General shift windows
                const initialGeneralShift = now
                    .clone()
                    .startOf('day')
                    .add(9, 'hours')
                    .add(45, 'minutes')
                    .valueOf();
                const generalShiftStart = now
                    .clone()
                    .startOf('day')
                    .add(10, 'hours')
                    .add(0, 'minutes')
                    .valueOf();
                const generalShiftLateCount = now
                    .clone()
                    .startOf('day')
                    .add(16, 'hours')
                    .add(0, 'minutes')
                    .valueOf();

                // Evening shift windows
                const InitialEveningShift = now
                    .clone()
                    .startOf('day')
                    .add(13, 'hours')
                    .add(45, 'minutes')
                    .valueOf();
                const eveningShiftStart = now
                    .clone()
                    .startOf('day')
                    .add(14, 'hours')
                    .add(5, 'minutes')
                    .valueOf();
                const eveningShiftStartForLateCount = now
                    .clone()
                    .startOf('day')
                    .add(14, 'hours')
                    .add(5, 'minutes')
                    .valueOf();
                const eveningShiftLateCount = now
                    .clone()
                    .startOf('day')
                    .add(18, 'hours')
                    .add(30, 'minutes')
                    .valueOf();

                // ---------- Morning ----------
                if (
                    shiftInfo.shiftName === 'Morning' &&
                    nowTs >= initialMorningShift &&
                    nowTs <= morningShiftStart
                ) {
                    const result = await checkInCollections.insertOne(
                        checkInInfo
                    );
                    if (result.insertedId) {
                        await seedAttendanceSnapshot(null);
                        return res
                            .status(200)
                            .json({ message: 'Check-in successful' });
                    }
                    return res.json({ message: 'Check-in failed' });
                } else if (
                    shiftInfo.shiftName === 'Morning' &&
                    nowTs > morningShiftStart &&
                    nowTs <= morningShiftLateCount
                ) {
                    const lateCount = nowTs - morningShiftStart;
                    const totalSeconds = Math.floor(lateCount / 1000);
                    const hours = Math.floor(totalSeconds / 3600) || 0;
                    const minutes = Math.floor((totalSeconds % 3600) / 60) || 0;
                    const lateCheckIn = `${hours}h ${minutes}m`;

                    const result = await checkInCollections.insertOne({
                        ...checkInInfo,
                        lateCheckIn,
                    });
                    if (result.insertedId) {
                        await seedAttendanceSnapshot(lateCheckIn);
                        return res
                            .status(200)
                            .json({ message: 'You are late today' });
                    }
                    return res.json({ message: 'Check-in failed' });
                }

                // ---------- General ----------
                if (
                    shiftInfo.shiftName === 'General' &&
                    nowTs >= initialGeneralShift &&
                    nowTs <= generalShiftStart
                ) {
                    const result = await checkInCollections.insertOne(
                        checkInInfo
                    );
                    if (result.insertedId) {
                        await seedAttendanceSnapshot(null);
                        return res
                            .status(200)
                            .json({ message: 'Check-in successful' });
                    }
                    return res.json({ message: 'Check-in failed' });
                } else if (
                    shiftInfo.shiftName === 'General' &&
                    nowTs > generalShiftStart &&
                    nowTs <= generalShiftLateCount
                ) {
                    const lateCount = nowTs - generalShiftStart;
                    const totalSeconds = Math.floor(lateCount / 1000);
                    const hours = Math.floor(totalSeconds / 3600) || 0;
                    const minutes = Math.floor((totalSeconds % 3600) / 60) || 0;
                    const lateCheckIn = `${hours}h ${minutes}m`;

                    const result = await checkInCollections.insertOne({
                        ...checkInInfo,
                        lateCheckIn,
                    });
                    if (result.insertedId) {
                        await seedAttendanceSnapshot(lateCheckIn);
                        return res
                            .status(200)
                            .json({ message: 'You are late today' });
                    }
                    return res.json({ message: 'Check-in failed' });
                }

                // ---------- Evening ----------
                if (
                    shiftInfo.shiftName === 'Evening' &&
                    nowTs > InitialEveningShift &&
                    nowTs <= eveningShiftStart
                ) {
                    const result = await checkInCollections.insertOne(
                        checkInInfo
                    );
                    if (result.insertedId) {
                        await seedAttendanceSnapshot(null);
                        return res
                            .status(200)
                            .json({ message: 'Check-in successful' });
                    }
                    return res.json({ message: 'Check-in failed' });
                } else if (
                    shiftInfo.shiftName === 'Evening' &&
                    nowTs > eveningShiftStart &&
                    nowTs <= eveningShiftLateCount
                ) {
                    const lateCount = nowTs - eveningShiftStartForLateCount;
                    const totalSeconds = Math.floor(lateCount / 1000);
                    const hours = Math.floor(totalSeconds / 3600) || 0;
                    const minutes = Math.floor((totalSeconds % 3600) / 60) || 0;
                    const lateCheckIn = `${hours}h ${minutes}m`;

                    const result = await checkInCollections.insertOne({
                        ...checkInInfo,
                        lateCheckIn,
                    });
                    if (result.insertedId) {
                        await seedAttendanceSnapshot(lateCheckIn);
                        return res
                            .status(200)
                            .json({ message: 'You are late today' });
                    }
                    return res.json({ message: 'Check-in failed' });
                }

                // none matched
                return res.json({
                    message: 'You are not eligible to check in at this time',
                });
            } catch (error) {
                console.error('Check-in error:', error);
                res.status(500).json({
                    message: 'Failed to check in',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        app.post('/employee/checkOut', async (req, res) => {
            const checkOutInfo = req.body;
            const email = req.body.email; // Assuming email is part of checkOutInfo
            const date = req.body.date; // Assuming date is part of checkOutInfo

            const checkInInfo = await checkInCollections.findOne({
                email,
                date,
            });
            const employee = await employeeCollections.findOne({ email });
            const isAttendance = await attendanceCollections.findOne({
                email,
                date,
            });
            const startOTInfo = await OTStartCollections.findOne({
                email,
                date,
            });
            const stopOTInfo = await OTStopCollections.findOne({ email, date });

            // Update attendance collection
            const inTime = checkInInfo.checkInTime;
            const outTime = checkOutInfo.checkOutTime;
            const calculateTime = outTime - inTime;

            const totalSeconds = Math.floor(calculateTime / 1000);
            const hours = Math.floor(totalSeconds / 3600) || 0;
            const minutes = Math.floor((totalSeconds % 3600) / 60) || 0;
            // const seconds = totalSeconds % 60;
            const workingDisplay = `${hours}h ${minutes}m`;

            const OTStartTime = startOTInfo ? startOTInfo.startingOverTime : 0;
            const OTStopTime = stopOTInfo ? stopOTInfo.OTStopTime : 0;
            const calculateOTTime = OTStopTime - OTStartTime;
            const otTotalSeconds = Math.floor(calculateOTTime / 1000);
            const otHours = Math.floor(otTotalSeconds / 3600) || 0;
            const otMinutes = Math.floor((otTotalSeconds % 3600) / 60) || 0;
            const displayOTHour = `${otHours}h ${otMinutes}m`; // Format OT time as "Xh Ym"

            try {
                // Check if the user already check out today
                const existingCheckOut = await checkOutCollections.findOne({
                    email,
                    date, // match by email and today's date
                });

                if (existingCheckOut) {
                    return res.json({ message: 'Already check out' });
                }

                const result = await checkOutCollections.insertOne(
                    checkOutInfo
                );

                if (result.insertedId) {
                    const attendanceData = {
                        email: email,
                        fullName: employee.fullName, // Assuming fullName is part of employee document
                        designation: employee.designation, // Assuming designation is part of employee document
                        phoneNumber: employee.phoneNumber, // Assuming phoneNumber is part of employee document
                        NID: employee.NID, // Assuming NID is part of employee document
                        DOB: employee.DOB, // Assuming DOB is part of employee document
                        emergencyContact: employee.emergencyContact, // Assuming emergencyContact is part of employee document
                        address: employee.address, // Assuming address is part of employee document
                        status: employee.status, // Assuming status is part of employee document
                        date: date,
                        month: checkOutInfo.month, // Assuming month is part of checkOutInfo
                        checkInTime: checkInInfo.checkInTime,
                        checkOutTime: checkOutInfo.checkOutTime,
                        workingDisplay,
                        workingHourInSeconds: calculateTime, // Store the total milliseconds
                        lateCheckIn: checkInInfo.lateCheckIn || false, // Preserve lateCheckIn status
                    };
                    if (isAttendance) {
                        await attendanceCollections.updateOne(
                            { email, date },
                            {
                                $set: {
                                    fullName: employee.fullName, // Assuming fullName is part of employee document
                                    designation: employee.designation, // Assuming designation is part of employee document
                                    phoneNumber: employee.phoneNumber, // Assuming phoneNumber is part of employee document
                                    NID: employee.NID, // Assuming NID is part of employee document
                                    DOB: employee.DOB, // Assuming DOB is part of employee document
                                    emergencyContact: employee.emergencyContact, // Assuming emergencyContact is part of employee document
                                    address: employee.address, // Assuming address is part of employee document
                                    status: employee.status, // Assuming status is part of employee document
                                    month: checkOutInfo.month, // Assuming month is part of checkOutInfo
                                    checkInTime: checkInInfo.checkInTime,
                                    checkOutTime: checkOutInfo.checkOutTime,
                                    workingDisplay,
                                    workingHourInSeconds: calculateTime, // Store the total milliseconds
                                    lateCheckIn:
                                        checkInInfo.lateCheckIn || false, // Preserve lateCheckIn status
                                },
                            }
                        );
                    } else {
                        await attendanceCollections.insertOne(attendanceData);
                        res.status(200).json({
                            message: 'Check-out successful',
                        });
                    }
                } else {
                    res.status(500).json({ message: 'Check-out failed' });
                }
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to check out',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        app.post('/employee/startOverTime', async (req, res) => {
            const {
                date,
                month,
                startingOverTime,
                displayTime,
                signInTime,
                email,
            } = req.body; // Assuming email is part of checkOutInfo

            try {
                const isInOT = await shiftingCollections.findOne({
                    actualEmail: email,
                    shiftName: 'OT list',
                });
                if (!isInOT) {
                    return res.json({ message: 'You are not in OT list' });
                }

                const result = await OTStartCollections.insertOne({
                    date,
                    month,
                    startingOverTime,
                    displayTime,
                    signInTime,
                    email,
                    OTFor: isInOT.OTFor,
                });

                if (result.insertedId) {
                    res.status(200).json({ message: 'Over time started' });
                } else {
                    res.status(500).json({
                        message: 'Over time started failed',
                    });
                }
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to start OT',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        app.post('/employee/stopOverTime', async (req, res) => {
            const { date, month, OTStopTime, displayTime, email } = req.body;

            const startOTInfo = await OTStartCollections.findOne({
                email,
                date,
            });
            const isAttendance = await attendanceCollections.findOne({
                email,
                date,
            });

            // Update attendance collection
            const otStartTime = startOTInfo.startingOverTime;
            const calculateOTTime = OTStopTime - otStartTime;

            const totalSeconds = Math.floor(calculateOTTime / 1000);
            const hours = Math.floor(totalSeconds / 3600) || 0;
            const minutes = Math.floor((totalSeconds % 3600) / 60) || 0;
            // const seconds = totalSeconds % 60;
            const displayOTHour = `${hours}h ${minutes}m`;

            try {
                // Check if the user already check out today
                const existingOT = await OTStopCollections.findOne({
                    email,
                    date, // match by email and today's date
                });

                if (existingOT) {
                    return res.json({ message: 'Already stop OT' });
                }

                const result = await OTStopCollections.insertOne({
                    date,
                    month,
                    OTStopTime,
                    displayTime,
                    email,
                });

                if (result.insertedId) {
                    const OTCountingData = {
                        email: email,
                        date,
                        otStartTime: startOTInfo.startingOverTime,
                        otStopTime: OTStopTime,
                        displayOTHour,
                        totalOTInSeconds: calculateOTTime, // Store the total milliseconds
                    };
                    if (isAttendance) {
                        await attendanceCollections.updateOne(
                            { email, date },
                            {
                                $set: {
                                    otStartTime: startOTInfo.startingOverTime,
                                    otStopTime: OTStopTime,
                                    displayOTHour,
                                    totalOTInSeconds: calculateOTTime, // Update total OT in seconds
                                },
                            }
                        );
                        res.status(200).json({ message: 'OT stop successful' });
                    } else {
                        await attendanceCollections.insertOne(OTCountingData);
                        res.status(200).json({ message: 'OT stop successful' });
                    }
                    await shiftingCollections.deleteOne({
                        actualEmail: email,
                        shiftName: 'OT list',
                    });
                } else {
                    res.status(500).json({ message: 'OT stop failed' });
                }
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to stop OT',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        app.post('/appliedLeave', async (req, res) => {
            try {
                const leaveData = req.body;
                const { email, totalDays } = leaveData;
                // check if the user has remaining leave balance
                const leaveBalance = await leaveBalanceCollections.findOne({
                    email,
                });
                if (leaveBalance.casualLeave < totalDays) {
                    return res.json({
                        message: 'You have no remaining leave balance',
                    });
                }

                // Check if the user already has a pending leave request
                const existingLeave = await appliedLeaveCollections.findOne({
                    email,
                    status: 'Pending',
                });

                if (existingLeave) {
                    return res.json({
                        message: 'You already have a pending leave request',
                    });
                }

                // Insert the new leave request
                const result = await appliedLeaveCollections.insertOne(
                    leaveData
                );
                await adminNotificationCollections.insertOne({
                    notification: `New leave request received`,
                    email: email,
                    link: '/appliedLeave',
                });

                if (result.insertedId) {
                    res.json({ message: 'success' });
                } else {
                    res.json({ message: 'Failed to submit leave request' });
                }
            } catch (error) {
                res.json({
                    message: 'Failed to submit leave request',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        // ************************************************************************************************

        app.put('/orderStatusChange/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;

                // Check if the order exists
                const isID = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });

                if (!isID) {
                    return res.status(404).json({ message: 'Order not found' });
                }

                if (isID.isLocked) {
                    return res.status(423).json({
                        message:
                            'Order is locked. Extend the deadline to reopen.',
                    });
                }

                // Update the order status to "In-progress"
                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { orderStatus: 'In-progress' } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update order status',
                });
            }
        });
        // ************************************************************************************************
        app.put('/orderStatusDelivered/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;

                const isID = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!isID) {
                    return res.status(404).json({ message: 'Order not found' });
                }
                if (isID.isLocked) {
                    return res.status(423).json({
                        message:
                            'Order is locked. Extend the deadline to reopen.',
                    });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { orderStatus: 'Delivered' } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update order status',
                });
            }
        });

        // *****************************************************************************************
        app.put('/modifyOrderToInitial/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;

                const isID = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!isID) {
                    return res.status(404).json({ message: 'Order not found' });
                }
                if (isID.isLocked) {
                    return res.status(423).json({
                        message:
                            'Order is locked. Extend the deadline to reopen.',
                    });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { orderStatus: 'Reviewing' } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update order status',
                });
            }
        });

        // *****************************************************************************************
        app.put('/orderStatusQC/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;

                const isID = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!isID) {
                    return res.status(404).json({ message: 'Order not found' });
                }
                if (isID.isLocked) {
                    return res.status(423).json({
                        message:
                            'Order is locked. Extend the deadline to reopen.',
                    });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { orderStatus: 'Ready to QC' } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update order status',
                });
            }
        });

        // *****************************************************************************************
        app.put('/orderStatusHold/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;
                const { completeTime, lastUpdated } = req.body;

                const isID = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!isID) {
                    return res.status(404).json({ message: 'Order not found' });
                }
                if (isID.isLocked) {
                    return res.status(423).json({
                        message:
                            'Order is locked. Extend the deadline to reopen.',
                    });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            orderStatus: 'Hold',
                            completeTime,
                            lastUpdated,
                        },
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update order status',
                });
            }
        });

        // *****************************************************************************************

        app.put('/editExpense/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const {
                    userName,
                    expenseDate,
                    expenseName,
                    expenseCategory,
                    expenseAmount,
                    expenseStatus,
                    expenseNote,
                } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res
                        .status(400)
                        .json({ message: 'Invalid expense ID' });
                }

                // Fetch existing expense
                const existingExpense = await expenseCollections.findOne({
                    _id: new ObjectId(id),
                });

                if (!existingExpense) {
                    return res
                        .status(404)
                        .json({ message: 'Expense not found' });
                }

                // Prepare update object
                let updateData = {};

                if (expenseDate && expenseDate !== existingExpense.expenseDate)
                    updateData.expenseDate = expenseDate;
                if (expenseName && expenseName !== existingExpense.expenseName)
                    updateData.expenseName = expenseName;
                if (
                    expenseCategory &&
                    expenseCategory !== existingExpense.expenseCategory
                )
                    updateData.expenseCategory = expenseCategory;
                if (
                    expenseAmount &&
                    expenseAmount !== existingExpense.expenseAmount
                )
                    updateData.expenseAmount = expenseAmount;
                if (
                    expenseStatus &&
                    expenseStatus !== existingExpense.expenseStatus
                )
                    updateData.expenseStatus = expenseStatus;
                if (expenseNote && expenseNote !== existingExpense.expenseNote)
                    updateData.expenseNote = expenseNote;

                // If no updates are needed
                if (Object.keys(updateData).length === 0) {
                    return res
                        .status(200)
                        .json({ message: 'No changes detected' });
                }

                // Update expense record
                const result = await expenseCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                if (result.modifiedCount === 0) {
                    return res
                        .status(400)
                        .json({ message: 'Failed to update expense' });
                }

                // Update balance only if expenseAmount has changed
                if (
                    expenseAmount &&
                    expenseAmount !== existingExpense.expenseAmount
                ) {
                    const balanceChange =
                        existingExpense.expenseAmount - expenseAmount;

                    await hrBalanceCollections.updateOne(
                        {},
                        { $inc: { balance: balanceChange } }
                    );
                }

                res.status(200).json({
                    message: 'Expense updated successfully',
                });
            } catch (error) {
                res.status(500).json({ message: 'Server error' });
            }
        });

        // *****************************************************************************************
        app.put('/returnHrBalance', async (req, res) => {
            try {
                const { parseValue, note } = req.body;

                const availableBalance = await hrBalanceCollections.findOne();

                if (availableBalance.balance >= parseValue) {
                    await hrBalanceCollections.updateOne(
                        {},
                        {
                            $inc: { balance: -parseValue },
                        }
                    );

                    // add the amount in main balance
                    await mainBalanceCollections.updateOne(
                        {},
                        {
                            $inc: { mainBalance: parseValue },
                        }
                    );

                    await hrTransactionCollections.insertOne({
                        value: parseValue,
                        note,
                        date,
                        type: 'Out',
                    });

                    res.status(200).json({ message: 'success' });
                } else {
                    res.json({ message: 'unsuccess' });
                }
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to add balance',
                    error: error.message,
                });
            }
        });
        // *****************************************************************************************
        app.put('/clients/:id', async (req, res) => {
            try {
                const clientId = req.params.id; // original client ID from the URL
                const { clientId: newClientId, clientCountry: newCountry } =
                    req.body;

                if (!newClientId || !newCountry) {
                    return res.json({
                        message: 'Client ID and Country are required.',
                    });
                }

                // Check if newClientId already exists in another document (prevent duplicate IDs)
                if (clientId !== newClientId) {
                    const existingClient = await clientCollections.findOne({
                        clientID: newClientId,
                    });
                    if (existingClient) {
                        return res.json({
                            message: 'The new Client ID already exists.',
                        });
                    }
                }

                const result = await clientCollections.updateOne(
                    { clientID: clientId },
                    {
                        $set: {
                            clientID: newClientId,
                            country: newCountry,
                        },
                    }
                );

                if (result.matchedCount === 0) {
                    return res.json({ message: 'Client not found.' });
                }

                res.json({
                    message: 'Client updated successfully',
                    modifiedCount: result.modifiedCount,
                });
            } catch (error) {
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // *****************************************************************************************
        app.put('/extendDeadline/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;
                const { newDeadline } = req.body;

                const isID = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!isID) {
                    return res.status(404).json({ message: 'Order not found' });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            orderDeadLine: newDeadline,
                            orderStatus: 'Pending',
                            isLocked: false,
                            completeTime: 0,
                            lastUpdated: 0,
                        },
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update order status',
                });
            }
        });

        // *****************************************************************************************
        app.put('/changeEarningStatus/:id', async (req, res) => {
            try {
                const { id } = req.params;
                let { year, month: bodyMonth, newStatus,  } = req.body || {};
                console.log(req.body)

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid earning ID',
                    });
                }
                if (!['Paid', 'Unpaid'].includes(newStatus)) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'Invalid status. Must be either "Paid" or "Unpaid".',
                    });
                }

                // Load existing doc
                const existing = await earningsCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!existing) {
                    return res.status(404).json({
                        success: false,
                        message: 'Earning record not found.',
                    });
                }

                // Helpers
                const num = (v, def = 0) => {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : def;
                };
                const normMonth = (m) =>
                    typeof m === 'string' ? m.toLowerCase() : m;

                // Derive year (prefer body > existing.year > from existing.date > current)
                const deriveYear = () => {
                    if (year) return String(year);
                    if (existing.year) return String(existing.year);
                    // parse DD-MM-YYYY if available
                    if (typeof existing.date === 'string') {
                        const parts = existing.date.split(/[-.\/]/g);
                        if (parts.length === 3) {
                            const y = parts[2];
                            if (/^\d{4}$/.test(y)) return y;
                        }
                    }
                    return new Date().getFullYear().toString();
                };
                year = deriveYear();

                // Incoming potential edits (amount-related & month)
                const {
                    // any of these may come (optional)
                    totalUsd,
                    totalDollar,
                    charge,
                    receivable,
                    rate,
                    convertRate,
                    bdtAmount,
                    convertedBdt,

                    // other optional fields you might pass
                    imageQty,
                    clientId,
                    clientID,
                    month: maybeMonth,
                } = req.body || {};

                // Decide target month: prefer body.month, else keep existing.month
                const targetMonth = normMonth(
                    bodyMonth || maybeMonth || existing.month
                );

                // Compute NEW amount (BDT) from the most explicit to least:
                // 1) convertedBdt / bdtAmount
                // 2) (totalUsd/totalDollar - charge) * rate
                // 3) totalUsd/totalDollar * convertRate/rate
                // 4) fallback to existing.convertedBdt
                const usd = num(totalUsd ?? totalDollar, undefined);
                const chg = num(charge, 0);
                const r1 = num(rate ?? convertRate, undefined);
                const explicitBDT = convertedBdt ?? bdtAmount;

                let newAmount;
                if (explicitBDT !== undefined) {
                    newAmount = num(explicitBDT, 0);
                } else if (
                    usd !== undefined &&
                    r1 !== undefined &&
                    !Number.isNaN(usd) &&
                    !Number.isNaN(r1)
                ) {
                    if (charge !== undefined) {
                        newAmount = num((usd - chg) * r1, 0);
                    } else if (receivable !== undefined) {
                        newAmount = num(num(receivable) * r1, 0);
                    } else {
                        newAmount = num(usd * r1, 0);
                    }
                } else {
                    newAmount = num(existing.convertedBdt, 0);
                }

                if (!Number.isFinite(newAmount) || newAmount < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid computed amount.',
                    });
                }

                // Old snapshot
                const oldStatus = existing.status || 'Unpaid';
                const oldAmount = num(existing.convertedBdt, 0);
                const oldMonth = existing.month;

                // Build $set only for changed fields
                const fieldsToUpdate = {};
                const maybeSet = (key, val) => {
                    if (val !== undefined && val !== existing[key])
                        fieldsToUpdate[key] = val;
                };

                // Persist normalized month and any edited primitives we can trust
                maybeSet('month', targetMonth);
                maybeSet('status', newStatus);

                // If you also pass fresh primitives, store them (not required)
                // Keep your canonical numeric fields:
                if (totalUsd !== undefined || totalDollar !== undefined) {
                    maybeSet('totalUsd', usd ?? existing.totalUsd);
                }
                if (rate !== undefined || convertRate !== undefined) {
                    maybeSet('convertRate', r1 ?? existing.convertRate);
                }
                if (charge !== undefined) {
                    maybeSet('charge', num(charge, 0));
                }
                if (receivable !== undefined) {
                    maybeSet('receivable', num(receivable, 0));
                }
                if (imageQty !== undefined) {
                    maybeSet('imageQty', num(imageQty, 0));
                }
                if (clientId !== undefined || clientID !== undefined) {
                    maybeSet('clientId', clientId ?? clientID);
                }

                // Always set convertedBdt to the recomputed newAmount if it differs
                if (newAmount !== oldAmount) {
                    fieldsToUpdate.convertedBdt = newAmount;
                }

                // If nothing changed (status + amount + month unchanged)
                if (
                    Object.keys(fieldsToUpdate).length === 0 &&
                    oldStatus === newStatus &&
                    oldMonth === targetMonth
                ) {
                    return res.status(200).json({
                        success: true,
                        message: `No changes detected.`,
                        changeApplied: 0,
                        previous: {
                            status: oldStatus,
                            amount: oldAmount,
                            month: oldMonth,
                        },
                        updated: {
                            status: newStatus,
                            amount: oldAmount,
                            month: targetMonth,
                        },
                    });
                }

                // Compute balanceDiff in a status-transition-safe way:
                // contribution(old) = oldStatus=='Paid' ? oldAmount : 0
                // contribution(new) = newStatus=='Paid' ? newAmount : 0
                // diff = contribution(new) - contribution(old)
                const oldPaid = oldStatus === 'Paid' ? oldAmount : 0;
                const newPaid = newStatus === 'Paid' ? newAmount : 0;
                const balanceDiff = newPaid - oldPaid;

                // ---- Unpaid summary deltas (bucketed by (month,year))
                // We want unpaid buckets to equal the sum of all Unpaid earnings per (month,year).
                // Remove old unpaid contribution; add new unpaid contribution (move between months if needed).
                // old unpaid contribution:
                const oldUnpaid = oldStatus === 'Unpaid' ? oldAmount : 0;
                // new unpaid contribution:
                const newUnpaid = newStatus === 'Unpaid' ? newAmount : 0;

                const unpaidOps = [];

                // If month changed, we may need to decrement old bucket and increment new bucket
                if (oldMonth !== targetMonth) {
                    if (oldUnpaid > 0) {
                        unpaidOps.push({
                            filter: { month: oldMonth, year },
                            inc: { totalConvertedBdt: -oldUnpaid },
                        });
                    }
                    if (newUnpaid > 0) {
                        unpaidOps.push({
                            filter: { month: targetMonth, year },
                            inc: { totalConvertedBdt: +newUnpaid },
                        });
                    }
                } else {
                    // same month: apply net change
                    const netUnpaidChange = newUnpaid - oldUnpaid; // could be +, -, or 0
                    if (netUnpaidChange !== 0) {
                        unpaidOps.push({
                            filter: { month: targetMonth, year },
                            inc: { totalConvertedBdt: netUnpaidChange },
                        });
                    }
                }

                // ---- Apply DB updates

                // 1) Upsert unpaid buckets as needed
                for (const op of unpaidOps) {
                    const found = await unpaidCollections.findOne(op.filter);
                    if (!found) {
                        await unpaidCollections.insertOne({
                            ...op.filter,
                            totalConvertedBdt: 0,
                            status: 'Unpaid',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                    }
                    await unpaidCollections.updateOne(op.filter, {
                        $inc: op.inc,
                        $set: { updatedAt: new Date() },
                    });
                }

                // 2) Update earning doc
                fieldsToUpdate.updatedAt = new Date();
                await earningsCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: fieldsToUpdate }
                );

                // 3) Re-compute summary status for affected buckets (old and new if month changed)
                const bucketsToCheck = Array.from(
                    new Set([`${oldMonth}|${year}`, `${targetMonth}|${year}`])
                ).map((k) => {
                    const [m, y] = k.split('|');
                    return { month: m, year: y };
                });

                for (const b of bucketsToCheck) {
                    const sumDoc = await unpaidCollections.findOne(b);
                    const sumAmount = num(sumDoc?.totalConvertedBdt, 0);
                    const bucketStatus = sumAmount > 0 ? 'Unpaid' : 'Paid';
                    await unpaidCollections.updateOne(b, {
                        $set: { status: bucketStatus, updatedAt: new Date() },
                    });
                }

                // 4) Main balance & transaction log
                if (balanceDiff !== 0) {
                    await mainBalanceCollections.updateOne(
                        {},
                        { $inc: { mainBalance: balanceDiff } },
                        { upsert: true }
                    );

                    await mainTransactionCollections.insertOne({
                        amount: Math.abs(balanceDiff),
                        note:
                            balanceDiff > 0
                                ? `Earning adjustment (+) for ${
                                      existing.clientId ||
                                      fieldsToUpdate.clientId ||
                                      'Unknown Client'
                                  }`
                                : `Earning adjustment (−) for ${
                                      existing.clientId ||
                                      fieldsToUpdate.clientId ||
                                      'Unknown Client'
                                  }`,
                        date: new Date(),
                        type:
                            balanceDiff > 0
                                ? 'Adjustment (+)'
                                : 'Adjustment (-)',
                        meta: {
                            earningId: id,
                            old: {
                                status: oldStatus,
                                amount: oldAmount,
                                month: oldMonth,
                            },
                            new: {
                                status: newStatus,
                                amount: newAmount,
                                month: targetMonth,
                            },
                            year,
                        },
                    });
                }

                // Optionally adjust monthlyProfitCollections the same way you treat add/update elsewhere.
                // If you only count PAID into profit, the delta is (newPaid - oldPaid):
                /*
    if (balanceDiff !== 0) {
      await monthlyProfitCollections.updateOne(
        { month: targetMonth, year },
        { $inc: { earnings: balanceDiff, profit: balanceDiff, remaining: balanceDiff } },
        { upsert: true }
      );
    }
    if (oldMonth !== targetMonth && oldPaid !== 0) {
      // Move paid value out of old month if needed
      await monthlyProfitCollections.updateOne(
        { month: oldMonth, year },
        { $inc: { earnings: -oldPaid, profit: -oldPaid, remaining: -oldPaid } },
        { upsert: true }
      );
    }
    */

                return res.status(200).json({
                    success: true,
                    message: `Earning status/amount updated successfully.`,
                    previous: {
                        status: oldStatus,
                        amount: oldAmount,
                        month: oldMonth,
                    },
                    updated: {
                        status: newStatus,
                        amount: newAmount,
                        month: targetMonth,
                    },
                    balanceDiff,
                    unpaidAffected: unpaidOps.map((o) => ({
                        filter: o.filter,
                        inc: o.inc,
                    })),
                });
            } catch (error) {
                console.error('❌ Error updating earning status:', error);
                return res.status(500).json({
                    success: false,
                    message:
                        error.message || 'Failed to update earning status.',
                });
            }
        });

        // *****************************************************************************************
        app.put('/markAsRead/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const isID = await adminNotificationCollections.findOne({
                    _id: new ObjectId(id),
                });

                if (!isID) {
                    return res
                        .status(404)
                        .json({ message: 'Notification not found' });
                }

                const result = await adminNotificationCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { isRead: true } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to mark notification as read',
                });
            }
        });
        // *****************************************************************************************
        app.put('/employeeNotificationMarkAsRead/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const isID = await employeeNotificationCollections.findOne({
                    _id: new ObjectId(id),
                });

                if (!isID) {
                    return res
                        .status(404)
                        .json({ message: 'Notification not found' });
                }

                const result = await employeeNotificationCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { isRead: true } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to mark notification as read',
                });
            }
        });
        // *****************************************************************************************
        app.put('/acceptLeave/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const isID = await appliedLeaveCollections.findOne({
                    _id: new ObjectId(id),
                });
                const email = isID.email;
                const totalDays = isID.totalDays;

                if (!isID) {
                    return res.json({ message: 'Application not found' });
                }

                // Reduce leave balance
                await leaveBalanceCollections.updateOne(
                    { email: email },
                    { $inc: { casualLeave: -totalDays } } // Decrease casual leave balance by totalDays
                );

                const result = await appliedLeaveCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'Approved' } }
                );
                await employeeNotificationCollections.insertOne({
                    notification: `Leave request approved`,
                    email: email,
                    link: '/leave',
                    isRead: false,
                });
                // Update employee status
                await employeeCollections.updateOne(
                    { email: email },
                    {
                        $set: { status: 'On Leave' }, // Update employee status to 'On Leave'
                    }
                );

                res.send(result);
            } catch (error) {
                res.json({ message: 'Failed to mark notification as read' });
            }
        });
        // *****************************************************************************************
        // PUT /declineLeave/:id
        app.put('/declineLeave/:id', async (req, res) => {
            try {
                const { id } = req.params;
                if (!ObjectId.isValid(id)) {
                    return res
                        .status(400)
                        .json({ message: 'Invalid leave ID' });
                }

                // 1) Read the leave doc to get the email (and verify it exists)
                const leaveDoc = await appliedLeaveCollections.findOne(
                    { _id: new ObjectId(id) },
                    { projection: { email: 1, status: 1 } }
                );
                if (!leaveDoc) {
                    return res
                        .status(404)
                        .json({ message: 'Leave application not found' });
                }

                // Optional: if already not Pending, you can short-circuit
                // if (leaveDoc.status !== 'Pending') {
                //   return res.json({ message: `Already ${leaveDoc.status}`, modifiedCount: 0 });
                // }

                // 2) Update status to Declined
                const update = await appliedLeaveCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'Declined' } }
                );

                // 3) Insert employee notification using the email from the doc
                if (update.modifiedCount > 0 && leaveDoc.email) {
                    await employeeNotificationCollections.insertOne({
                        notification: 'Leave request declined',
                        email: leaveDoc.email,
                        link: '/leave',
                        isRead: false,
                    });
                }

                res.send(update); // { matchedCount, modifiedCount, ... }
            } catch (err) {
                res.status(500).json({
                    message: 'Failed to decline leave',
                    error: err?.message,
                });
            }
        });

        // *****************************************************************************************
        // Mark order as Completed and lock it
        app.put('/orderStatusComplete/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;
                const isID = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });

                if (!isID) {
                    return res.status(404).json({ message: 'Order not found' });
                }
                if (isID.isLocked) {
                    return res.status(423).json({
                        message:
                            'Order is locked. Extend the deadline to reopen.',
                    });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { orderStatus: 'Completed', isLocked: true } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update order status',
                });
            }
        });

        // *****************************************************************************************
        // Set status to "Ready to Upload"
        app.put('/orderStatusReadyToUpload/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;

                const isID = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!isID) {
                    return res.status(404).json({ message: 'Order not found' });
                }
                if (isID.isLocked) {
                    return res.status(423).json({
                        message:
                            'Order is locked. Extend the deadline to reopen.',
                    });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { orderStatus: 'Ready to Upload' } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update order status',
                });
            }
        });

        // *****************************************************************************************

        // ******************************************************************************************
        // ******************************************************************************************
        app.patch('/updateEmployee/:email', async (req, res) => {
            const { email } = req.params;
            const updateData = req.body;

            try {
                const result = await employeeCollections.updateOne(
                    { email: email }, // find by email
                    { $set: updateData } // update the fields
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({
                        message: 'Employee not found or no changes made',
                    });
                }

                res.json({ message: 'Employee updated successfully' });
            } catch (err) {
                res.status(500).json({ message: 'Error updating employee' });
            }
        });

        // ************************************************************************************************
        // ************************************************************************************************

        app.delete('/removeOT/:id', async (req, res) => {
            const id = req.params.id;

            try {
                const result = await shiftingCollections.deleteOne({
                    _id: new ObjectId(id),
                });

                if (result.deletedCount === 1) {
                    res.json({ message: 'success' });
                } else {
                    res.json({ message: 'fail' });
                }
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to remove OT',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        // DELETE /orders/:id  (Admin or Developer suggested at UI; server can keep it open to authorized users or add role checks)
        app.delete('/orders/:id', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;
                const tokenEmail = req.user.email;
                if (requestedEmail !== tokenEmail) {
                    return res
                        .status(403)
                        .json({ message: 'Forbidden Access' });
                }

                const { id } = req.params;
                if (!ObjectId.isValid(id)) {
                    return res
                        .status(400)
                        .json({ message: 'Invalid order id' });
                }

                // Optionally block locked/finalized here too:
                const order = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!order)
                    return res.status(404).json({ message: 'Order not found' });
                if (
                    order.isLocked ||
                    ['Completed', 'Delivered'].includes(
                        String(order.orderStatus)
                    )
                ) {
                    return res.status(423).json({
                        message:
                            'Order is locked/finalized and cannot be deleted',
                    });
                }

                const result = await localOrderCollections.deleteOne({
                    _id: new ObjectId(id),
                });
                if (!result.deletedCount) {
                    return res
                        .status(400)
                        .json({ message: 'Failed to delete order' });
                }

                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ message: 'Failed to delete order' });
            }
        });

        // ************************************************************************************************

        // ************************************************************************************************
        app.get('/getCurrentUser', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail; // If this is a separate check
                const tokenEmail = req.user.email;

                if (requestedEmail !== tokenEmail) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' }); // 403 is more appropriate here
                }

                const user = await userCollections.findOne({
                    email: requestedEmail,
                });

                if (!user) {
                    return res.status(404).send({ message: 'User not found' });
                }

                res.send(user);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch user' });
            }
        });
        // ************************************************************************************************
        app.get('/getExpense', verifyToken, async (req, res) => {
            try {
                if (!req.user || !req.user.email) {
                    return res
                        .status(401)
                        .send({ message: 'Unauthorized Access' });
                }

                const userMail = req.query.userEmail;
                const email = req.user.email;
                if (userMail !== email) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }

                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 10;
                const search = req.query.search || '';
                const disablePagination =
                    req.query.disablePagination === 'true';

                let numericSearch = parseFloat(search);
                numericSearch = isNaN(numericSearch) ? null : numericSearch;

                const query = search
                    ? {
                          $or: [
                              { userName: { $regex: new RegExp(search, 'i') } },
                              {
                                  expenseName: {
                                      $regex: new RegExp(search, 'i'),
                                  },
                              },
                              {
                                  expenseCategory: {
                                      $regex: new RegExp(search, 'i'),
                                  },
                              },
                              {
                                  expenseStatus: {
                                      $regex: new RegExp(search, 'i'),
                                  },
                              },
                              {
                                  expenseNote: {
                                      $regex: new RegExp(search, 'i'),
                                  },
                              },
                              {
                                  expenseDate: {
                                      $regex: new RegExp(search, 'i'),
                                  },
                              },
                              ...(numericSearch !== null
                                  ? [{ expenseAmount: numericSearch }]
                                  : []),
                          ],
                      }
                    : {};

                if (!expenseCollections) {
                    return res
                        .status(500)
                        .json({ message: 'Database connection issue' });
                }
                const allExpense = await expenseCollections.find().toArray();

                let expense;
                if (disablePagination) {
                    expense = await expenseCollections
                        .find(query)
                        .sort({ _id: -1 })
                        .toArray();
                } else {
                    expense = await expenseCollections
                        .find(query)
                        .skip((page - 1) * size)
                        .limit(size)
                        .sort({ _id: -1 })
                        .toArray();
                }

                const count = await expenseCollections.countDocuments(query);

                const category = await categoryCollections.find({}).toArray();
                res.send({ expense, count, category, allExpense });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch expense',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        const monthMap = {
            january: 1,
            february: 2,
            march: 3,
            april: 4,
            may: 5,
            june: 6,
            july: 7,
            august: 8,
            september: 9,
            october: 10,
            november: 11,
            december: 12,
        };

        app.get('/getLocalOrder', verifyToken, async (req, res) => {
            try {
                if (!req.user || !req.user.email) {
                    return res
                        .status(401)
                        .send({ message: 'Unauthorized Access' });
                }

                const userMail = req.query.userEmail;
                const email = req.user.email;
                if (userMail !== email) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }

                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 10;
                const search = req.query.search || '';
                const disablePagination =
                    req.query.disablePagination === 'true';
                const selectedMonth = req.query.selectedMonth; // <-- e.g. "january"

                let numericSearch = parseFloat(search);
                numericSearch = isNaN(numericSearch) ? null : numericSearch;

                const match = search
                    ? {
                          $or: [
                              { userName: { $regex: new RegExp(search, 'i') } },
                              { clientID: { $regex: new RegExp(search, 'i') } },
                              {
                                  orderName: {
                                      $regex: new RegExp(search, 'i'),
                                  },
                              },
                              { orderQTY: { $regex: new RegExp(search, 'i') } },
                              {
                                  orderStatus: {
                                      $regex: new RegExp(search, 'i'),
                                  },
                              },
                              ...(numericSearch !== null
                                  ? [{ orderPrice: numericSearch }]
                                  : []),
                          ],
                      }
                    : {};

                const pipeline = [
                    { $match: match },
                    {
                        $addFields: {
                            _tryISO: {
                                $convert: {
                                    input: '$date',
                                    to: 'date',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            _tryDmyMon: {
                                $dateFromString: {
                                    dateString: '$date',
                                    format: '%d-%b-%Y',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            _tryDmyDash: {
                                $dateFromString: {
                                    dateString: '$date',
                                    format: '%d-%m-%Y',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            _tryDeadlineFmt: {
                                $dateFromString: {
                                    dateString: '$orderDeadLine',
                                    format: '%d-%b-%Y %H:%M:%S',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            _tryDeadlineISO: {
                                $convert: {
                                    input: '$orderDeadLine',
                                    to: 'date',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                        },
                    },
                    {
                        $addFields: {
                            _rawDateKey: {
                                $ifNull: [
                                    '$_tryISO',
                                    {
                                        $ifNull: [
                                            '$_tryDmyMon',
                                            {
                                                $ifNull: [
                                                    '$_tryDmyDash',
                                                    {
                                                        $ifNull: [
                                                            '$_tryDeadlineFmt',
                                                            '$_tryDeadlineISO',
                                                        ],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                    {
                        $addFields: {
                            dateKey: {
                                $cond: [
                                    { $ne: ['$_rawDateKey', null] },
                                    {
                                        $dateTrunc: {
                                            date: '$_rawDateKey',
                                            unit: 'day',
                                            timezone: 'Asia/Dhaka',
                                        },
                                    },
                                    new Date(0),
                                ],
                            },
                            _lastUpdatedOrZero: {
                                $ifNull: ['$lastUpdated', 0],
                            },
                        },
                    },
                ];

                // 🗓️ Filter by month if provided
                if (selectedMonth && monthMap[selectedMonth]) {
                    const monthNumber = monthMap[selectedMonth];

                    pipeline.push({
                        $addFields: {
                            month: { $month: '$dateKey' },
                        },
                    });

                    pipeline.push({
                        $match: { month: monthNumber },
                    });
                }

                // 🧾 Sort
                pipeline.push({
                    $sort: { dateKey: -1, _lastUpdatedOrZero: -1, _id: -1 },
                });

                const count = await localOrderCollections.countDocuments(match);

                let orders;
                if (disablePagination) {
                    orders = await localOrderCollections
                        .aggregate(pipeline)
                        .toArray();
                } else {
                    orders = await localOrderCollections
                        .aggregate([
                            ...pipeline,
                            { $skip: (page - 1) * size },
                            { $limit: size },
                        ])
                        .toArray();
                }

                res.send({ orders, count });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch orders',
                    error: error?.message,
                });
            }
        });

        app.get('/getLocalOrderSummary', verifyToken, async (req, res) => {
            try {
                if (!req.user || !req.user.email) {
                    return res
                        .status(401)
                        .send({ message: 'Unauthorized Access' });
                }

                const userMail = req.query.userEmail;
                const email = req.user.email;
                if (userMail !== email) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }

                const selectedMonth = req.query.selectedMonth;

                const selectedMonthNum = selectedMonth
                    ? monthMap[selectedMonth]
                    : null;

                const now = new Date();
                const currentMonth = now.getMonth() + 1;
                const currentYear = now.getFullYear();
                const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
                const prevYear =
                    currentMonth === 1 ? currentYear - 1 : currentYear;

                const pipeline = [
                    // parse all date formats
                    {
                        $addFields: {
                            _tryISO: {
                                $convert: {
                                    input: '$date',
                                    to: 'date',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            _tryDmyMon: {
                                $dateFromString: {
                                    dateString: '$date',
                                    format: '%d-%b-%Y',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            _tryDmyDash: {
                                $dateFromString: {
                                    dateString: '$date',
                                    format: '%d-%m-%Y',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            _tryDeadlineFmt: {
                                $dateFromString: {
                                    dateString: '$orderDeadLine',
                                    format: '%d-%b-%Y %H:%M:%S',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            _tryDeadlineISO: {
                                $convert: {
                                    input: '$orderDeadLine',
                                    to: 'date',
                                    onError: null,
                                    onNull: null,
                                },
                            },
                        },
                    },
                    {
                        $addFields: {
                            _rawDateKey: {
                                $ifNull: [
                                    '$_tryISO',
                                    {
                                        $ifNull: [
                                            '$_tryDmyMon',
                                            {
                                                $ifNull: [
                                                    '$_tryDmyDash',
                                                    {
                                                        $ifNull: [
                                                            '$_tryDeadlineFmt',
                                                            '$_tryDeadlineISO',
                                                        ],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                    {
                        $addFields: {
                            dateKey: {
                                $cond: [
                                    { $ne: ['$_rawDateKey', null] },
                                    {
                                        $dateTrunc: {
                                            date: '$_rawDateKey',
                                            unit: 'day',
                                            timezone: 'Asia/Dhaka',
                                        },
                                    },
                                    null,
                                ],
                            },
                        },
                    },
                    // Extract month/year after ensuring dateKey exists
                    {
                        $addFields: {
                            month: { $month: '$dateKey' },
                            year: { $year: '$dateKey' },
                            priceValue: {
                                $cond: [
                                    { $isNumber: '$orderPrice' },
                                    '$orderPrice',
                                    {
                                        $toDouble: {
                                            $ifNull: ['$orderPrice', 0],
                                        },
                                    },
                                ],
                            },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalAmountAll: { $sum: '$priceValue' },
                            totalAmountCurrentMonth: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                {
                                                    $eq: [
                                                        '$month',
                                                        currentMonth,
                                                    ],
                                                },
                                                { $eq: ['$year', currentYear] },
                                            ],
                                        },
                                        '$priceValue',
                                        0,
                                    ],
                                },
                            },
                            totalAmountPreviousMonth: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $eq: ['$month', prevMonth] },
                                                { $eq: ['$year', prevYear] },
                                            ],
                                        },
                                        '$priceValue',
                                        0,
                                    ],
                                },
                            },
                            totalAmountSelectedMonth: {
                                $sum: {
                                    $cond: [
                                        selectedMonthNum
                                            ? {
                                                  $eq: [
                                                      '$month',
                                                      selectedMonthNum,
                                                  ],
                                              }
                                            : false,
                                        '$priceValue',
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ];

                const [totals] = await localOrderCollections
                    .aggregate(pipeline)
                    .toArray();

                res.send(
                    totals || {
                        totalAmountAll: 0,
                        totalAmountCurrentMonth: 0,
                        totalAmountPreviousMonth: 0,
                        totalAmountSelectedMonth: 0,
                    }
                );
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch order summary',
                    error: error?.message,
                });
            }
        });

        app.get('/getClientsByMonth', verifyToken, async (req, res) => {
            try {
                // 🔐 Auth check
                if (!req.user || !req.user.email) {
                    return res
                        .status(401)
                        .json({ message: 'Unauthorized Access' });
                }

                const userMail = req.query.userEmail;
                const email = req.user.email;
                if (userMail !== email) {
                    return res
                        .status(403)
                        .json({ message: 'Forbidden Access' });
                }

                const selectedMonth = req.query.selectedMonth?.toLowerCase();
                if (!selectedMonth) {
                    return res
                        .status(400)
                        .json({ message: 'Month is required' });
                }

                const monthMap = {
                    january: 1,
                    february: 2,
                    march: 3,
                    april: 4,
                    may: 5,
                    june: 6,
                    july: 7,
                    august: 8,
                    september: 9,
                    october: 10,
                    november: 11,
                    december: 12,
                };

                const selectedMonthNum = monthMap[selectedMonth];
                if (!selectedMonthNum) {
                    return res
                        .status(400)
                        .json({ message: 'Invalid month name' });
                }

                // 🕒 Get current year
                const currentYear = new Date().getFullYear();

                // 🧮 Aggregation pipeline (fast and minimal)
                const pipeline = [
                    {
                        $addFields: {
                            parsedDate: {
                                $ifNull: [
                                    {
                                        $convert: {
                                            input: '$date',
                                            to: 'date',
                                            onError: null,
                                            onNull: null,
                                        },
                                    },
                                    {
                                        $ifNull: [
                                            {
                                                $dateFromString: {
                                                    dateString: '$date',
                                                    format: '%d-%b-%Y',
                                                    onError: null,
                                                    onNull: null,
                                                },
                                            },
                                            {
                                                $dateFromString: {
                                                    dateString: '$date',
                                                    format: '%d-%m-%Y',
                                                    onError: null,
                                                    onNull: null,
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                    {
                        $addFields: {
                            month: { $month: '$parsedDate' },
                            year: { $year: '$parsedDate' },
                        },
                    },
                    {
                        $match: {
                            month: selectedMonthNum,
                            year: currentYear,
                        },
                    },
                    {
                        $group: {
                            _id: '$clientID',
                            totalUsd: {
                                $sum: {
                                    $cond: [
                                        { $isNumber: '$orderPrice' },
                                        '$orderPrice',
                                        {
                                            $toDouble: {
                                                $ifNull: ['$orderPrice', 0],
                                            },
                                        },
                                    ],
                                },
                            },
                            imageQty: {
                                $sum: {
                                    $cond: [
                                        { $isNumber: '$orderQTY' },
                                        '$orderQTY',
                                        {
                                            $toInt: {
                                                $ifNull: ['$orderQTY', 0],
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            clientID: '$_id',
                            totalUsd: { $round: ['$totalUsd', 2] },
                            imageQty: 1,
                        },
                    },
                    { $sort: { totalUsd: -1 } },
                ];

                const results = await localOrderCollections
                    .aggregate(pipeline)
                    .toArray();

                return res.status(200).json({
                    success: true,
                    month: selectedMonth,
                    year: currentYear,
                    totalClients: results.length,
                    clients: results,
                });
            } catch (error) {
                console.error('❌ /getClientsByMonth error:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch client data by month',
                    error: error.message,
                });
            }
        });

        // GET /getClientOrders?search=&page=1&size=10&clientId=&month=
        app.get('/getClientOrders', async (req, res) => {
            try {
                const {
                    search = '',
                    page = 1,
                    size = 10,
                    clientId = '',
                    month = '',
                } = req.query;

                const pageNum = Math.max(parseInt(page, 10) || 1, 1);
                const pageSize = Math.min(
                    Math.max(parseInt(size, 10) || 10, 1),
                    100
                );

                // Build $match
                const match = {};

                // Exact client filter
                if (clientId) match.clientID = String(clientId).trim();

                // Month filter: accept 'august'/'August'/etc
                if (month) {
                    const wanted = String(month).trim().toLowerCase(); // e.g., 'august'
                    // We’ll compute a derivedMonth and match that below with $expr
                    match.$expr = {
                        $eq: [
                            {
                                $toLower: {
                                    $ifNull: [
                                        '$month', // preferred if orders already store month text
                                        {
                                            // else derive from orderDate or createdAt
                                            $dateToString: {
                                                date: {
                                                    $ifNull: [
                                                        {
                                                            $toDate:
                                                                '$orderDate',
                                                        }, // if stored as ISO/string
                                                        {
                                                            $ifNull: [
                                                                '$createdAt',
                                                                '$$NOW',
                                                            ],
                                                        },
                                                    ],
                                                },
                                                format: '%B', // Full month name (e.g., "August")
                                            },
                                        },
                                    ],
                                },
                            },
                            wanted,
                        ],
                    };
                }

                // Text search (regex) across a few fields
                const searchText = String(search || '').trim();
                const searchRegex = searchText
                    ? new RegExp(
                          searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                          'i'
                      )
                    : null;

                const pipeline = [];

                // Optional join to clients (for country search)
                pipeline.push({
                    $lookup: {
                        from: 'clientList',
                        localField: 'clientID',
                        foreignField: 'clientID',
                        as: 'clientDoc',
                    },
                });

                pipeline.push({
                    $addFields: {
                        // derive a month label if needed
                        _derivedMonth: {
                            $ifNull: [
                                '$month',
                                {
                                    $dateToString: {
                                        date: {
                                            $ifNull: [
                                                { $toDate: '$orderDate' },
                                                {
                                                    $ifNull: [
                                                        '$createdAt',
                                                        '$$NOW',
                                                    ],
                                                },
                                            ],
                                        },
                                        format: '%B',
                                    },
                                },
                            ],
                        },
                        _country: {
                            $ifNull: [
                                { $arrayElemAt: ['$clientDoc.country', 0] },
                                '',
                            ],
                        },
                    },
                });

                // Match block (clientId/month)
                if (Object.keys(match).length) pipeline.push({ $match: match });

                // Search filter
                if (searchRegex) {
                    pipeline.push({
                        $match: {
                            $or: [
                                { clientID: searchRegex },
                                { orderName: searchRegex },
                                { status: searchRegex },
                                { _country: searchRegex },
                            ],
                        },
                    });
                }

                // Total count (before paging)
                pipeline.push(
                    { $sort: { createdAt: -1, orderDate: -1, _id: -1 } },
                    {
                        $facet: {
                            items: [
                                { $skip: (pageNum - 1) * pageSize },
                                { $limit: pageSize },
                                {
                                    $project: {
                                        _id: 1,
                                        clientID: 1,
                                        orderName: 1,
                                        status: 1,
                                        imageQty: 1,
                                        // Try to keep your naming consistent with the rest of app:
                                        totalUsd: {
                                            $ifNull: [
                                                '$totalUsd',
                                                {
                                                    $ifNull: [
                                                        '$priceUSD',
                                                        '$totalDollar',
                                                    ],
                                                },
                                            ],
                                        },
                                        convertRate: 1,
                                        convertedBdt: {
                                            $ifNull: [
                                                '$convertedBdt',
                                                '$totalBdt',
                                            ],
                                        },
                                        orderDate: 1,
                                        createdAt: 1,
                                        month: '$_derivedMonth',
                                        country: '$_country',
                                        isLocked: {
                                            $ifNull: ['$isLocked', false],
                                        },
                                    },
                                },
                            ],
                            meta: [{ $count: 'count' }],
                        },
                    }
                );

                const agg = await localOrderCollections
                    .aggregate(pipeline)
                    .toArray();
                const items = agg?.[0]?.items || [];
                const count = agg?.[0]?.meta?.[0]?.count || 0;

                res.status(200).json({
                    success: true,
                    result: items,
                    count,
                    page: pageNum,
                    size: pageSize,
                    totalPages: Math.ceil(count / pageSize) || 1,
                });
            } catch (err) {
                console.error('GET /getClientOrders error:', err);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch client orders',
                    error: err.message,
                });
            }
        });

        // ************************************************************************************************
        app.get('/getSingleOrder/:orderId', verifyToken, async (req, res) => {
            try {
                const id = req.params.orderId;
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const result = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                res.send(result);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch expense' });
            }
        });
        // ************************************************************************************************
        app.get('/getClientID', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const result = await clientCollections.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch client' });
            }
        });
        // ************************************************************************************************
        app.get('/getMainBalance', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const result = await mainBalanceCollections.find().toArray();
                res.send(result[0]);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch balance' });
            }
        });
        // ************************************************************************************************
        app.get('/getHrBalance', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const result = await hrBalanceCollections.find().toArray();
                const balance = result[0].balance;
                const hrTransaction = await hrTransactionCollections
                    .find()
                    .toArray();

                const expense = await expenseCollections.find().toArray(); //send expense here to decrease API call (in context API)

                res.send({ balance, hrTransaction, expense });
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch balance' });
            }
        });
        // ************************************************************************************************
        app.get('/getClient', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const result = await clientCollections
                    .find()
                    .sort({ _id: -1 })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch balance' });
            }
        });

        // ✅ GET /clientDetails/:clientId — fetch client info + payment history with pagination
        app.get('/clientDetails/:clientId', async (req, res) => {
            try {
                const clientId = req.params.clientId;
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const search = req.query.search || '';
                console.log('clientId', clientId);
                // Find client info
                const client = await clientCollections.findOne({
                    clientID: clientId,
                });
                if (!client) {
                    return res
                        .status(404)
                        .json({ message: 'Client not found' });
                }

                // Search payment history (inside earningsList)
                const query = {
                    clientId: clientId,
                    ...(search
                        ? {
                              $or: [
                                  {
                                      projectName: {
                                          $regex: search,
                                          $options: 'i',
                                      },
                                  },
                                  { status: { $regex: search, $options: 'i' } },
                                  { month: { $regex: search, $options: 'i' } },
                              ],
                          }
                        : {}),
                };

                const total = await earningsCollections.countDocuments(query);
                const payments = await earningsCollections
                    .find(query)
                    .sort({ date: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .toArray();

                res.json({
                    success: true,
                    client,
                    payments,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                });
            } catch (error) {
                console.error('Error fetching client details:', error);
                res.status(500).json({
                    success: false,
                    message: 'Server error fetching client details',
                });
            }
        });

        // ************************************************************************************************
        //getEarnings
        app.get('/getEarnings', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 10;
                const search = req.query.search || '';
                const selectedMonth = req.query.month || '';

                const query = {
                    ...(search && {
                        $or: [
                            { clientId: { $regex: new RegExp(search, 'i') } },
                            { status: { $regex: new RegExp(search, 'i') } },
                            { month: { $regex: new RegExp(search, 'i') } },
                            { date: { $regex: new RegExp(search, 'i') } },
                        ],
                    }),
                    ...(selectedMonth && { month: selectedMonth }),
                };

                const totalCount = await earningsCollections.countDocuments(
                    query
                );

                const result = await earningsCollections
                    .find(query)
                    .skip((page - 1) * size)
                    .limit(size)
                    .sort({ _id: -1 })
                    .toArray();

                const totalRev = await earningsCollections.find().toArray();

                const totals = await earningsCollections
                    .aggregate([
                        { $match: query },
                        {
                            $group: {
                                _id: null,
                                totalImageQty: { $sum: '$imageQty' },
                                totalUsd: { $sum: '$totalUsd' },
                                totalRate: { $sum: '$convertRate' },
                                totalBdt: { $sum: '$convertedBdt' },
                                countRate: { $sum: 1 },
                            },
                        },
                    ])
                    .toArray();

                res.send({
                    result,
                    totalRev,
                    count: totalCount,
                    totalSummary: {
                        totalImageQty: totals[0]?.totalImageQty || 0,
                        totalUsd: totals[0]?.totalUsd || 0,
                        avgRate:
                            totals[0]?.totalRate / (totals[0]?.countRate || 1),
                        totalBdt: totals[0]?.totalBdt || 0,
                    },
                });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch earnings',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        // Get single earning by ID
        app.get('/getSingleEarning/:id', async (req, res) => {
            try {
                const { id } = req.params;

                // Validate ObjectId
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid earning ID',
                    });
                }

                // Find earning record
                const earning = await earningsCollections.findOne({
                    _id: new ObjectId(id),
                });

                if (!earning) {
                    return res.status(404).json({
                        success: false,
                        message: 'Earning not found',
                    });
                }

                // Send back the earning
                res.status(200).json({
                    success: true,
                    message: 'Earning fetched successfully',
                    data: earning,
                });
            } catch (error) {
                console.error('❌ Error fetching single earning:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch earning',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************

        // ************************************************************************************************
        // Update earning by ID (with secure validation)
        app.put('/updateEarnings/:id', async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id))
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid earning ID',
                    });

                const existing = await earningsCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!existing)
                    return res
                        .status(404)
                        .json({ success: false, message: 'Earning not found' });

                const body = req.body || {};
                const num = (v, def = 0) =>
                    Number.isFinite(Number(v)) ? Number(v) : def;

                const incoming = {
                    month: body.month?.toLowerCase(),
                    clientId: body.clientId,
                    imageQty: num(body.imageQty),
                    totalUsd: num(body.totalUsd),
                    charge: num(body.charge),
                    receivable: num(body.receivable),
                    convertRate: num(body.convertRate),
                    convertedBdt: num(
                        body.convertedBdt || body.receivable * body.convertRate
                    ),
                    status: body.status,
                    updatedBy: body.userEmail,
                    updatedAt: new Date(),
                };

                const allowedFields = Object.keys(incoming);
                const updates = {};

                for (const key of allowedFields) {
                    if (
                        incoming[key] !== undefined &&
                        incoming[key] !== existing[key]
                    ) {
                        updates[key] = incoming[key];
                    }
                }

                if (!Object.keys(updates).length) {
                    return res.status(400).json({
                        success: false,
                        message: 'No valid fields changed.',
                    });
                }

                const oldAmount = num(existing.convertedBdt, 0);
                const newAmount = num(
                    updates.convertedBdt ?? existing.convertedBdt,
                    oldAmount
                );

                const oldStatus = existing.status || 'Unpaid';
                const newStatus = updates.status ?? oldStatus;

                let balanceDiff = 0;
                if (
                    oldStatus === 'Paid' &&
                    newStatus === 'Paid' &&
                    newAmount !== oldAmount
                )
                    balanceDiff = newAmount - oldAmount;
                else if (oldStatus === 'Unpaid' && newStatus === 'Paid')
                    balanceDiff = newAmount;
                else if (oldStatus === 'Paid' && newStatus === 'Unpaid')
                    balanceDiff = -oldAmount;

                await earningsCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );

                if (balanceDiff !== 0) {
                    await mainBalanceCollections.updateOne(
                        {},
                        { $inc: { mainBalance: balanceDiff } },
                        { upsert: true }
                    );

                    await mainTransactionCollections.insertOne({
                        amount: Math.abs(balanceDiff),
                        type:
                            balanceDiff > 0
                                ? 'Adjustment (+)'
                                : 'Adjustment (-)',
                        note:
                            balanceDiff > 0
                                ? `Earning increased by ৳${balanceDiff} for Client_${incoming.clientId}`
                                : `Earning decreased by ৳${Math.abs(
                                      balanceDiff
                                  )} for Client_${incoming.clientId}`,
                        date: new Date(),
                        meta: {
                            id,
                            oldStatus,
                            newStatus,
                            oldAmount,
                            newAmount,
                            updatedBy: body.userEmail,
                        },
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'Earning updated successfully',
                    updated: updates,
                    balanceDiff,
                });
            } catch (error) {
                console.error('❌ updateEarnings error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message,
                });
            }
        });

        // ************************************************************************************************

        //earnings

        // ************************************************************************************************
        app.get('/getEmployee', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const findEmployee = await employeeCollections.findOne({
                    email: userMail,
                });

                // const result = await earningsCollections.find().toArray();

                res.send(findEmployee);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch balance' });
            }
        });
        // ************************************************************************************************
        app.get('/getEmployeeList', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;
                const search = req.query.search || '';

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const query = search
                    ? {
                          $or: [
                              { fullName: { $regex: search, $options: 'i' } },
                              { email: { $regex: search, $options: 'i' } },
                              {
                                  phoneNumber: {
                                      $regex: search,
                                      $options: 'i',
                                  },
                              },
                              {
                                  designation: {
                                      $regex: search,
                                      $options: 'i',
                                  },
                              },
                          ],
                      }
                    : {};

                const findEmployeeList = await employeeCollections
                    .find(query)
                    .sort({ _id: -1 })
                    .toArray();

                res.send(findEmployeeList);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch employee list',
                });
            }
        });

        // ************************************************************************************************
        app.get('/gethShiftedEmployee', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;
                const search = req.query.search || '';

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const findEmployeeList = await shiftingCollections
                    .find()
                    .sort()
                    .toArray();

                res.send(findEmployeeList);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch employee list',
                });
            }
        });
        // ************************************************************************************************
        app.get('/getProfit', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const earnings = await earningsCollections.find().toArray();
                const totalEarnings = earnings.reduce(
                    (acc, earning) => acc + Number(earning.convertedBdt),
                    0
                );

                const expense = await expenseCollections.find().toArray();
                const totalExpense = expense.reduce(
                    (acc, exp) => acc + Number(exp.expenseAmount),
                    0
                );

                const profit =
                    parseFloat(totalEarnings) - parseFloat(totalExpense);
                res.send({ totalEarnings, totalExpense, profit });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch employee list',
                });
            }
        });

        // *************************************************************************************************
        app.get('/getShareHolders', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const result = await shareHoldersCollections.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch share holders list',
                });
            }
        });

        // ***********************getShareholderInfo*******************************************************
        app.get('/getShareholderInfo', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const result = await profitShareCollections.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch share holders list',
                });
            }
        });
        // ************************************************************************************************
        app.get('/getCheckInInfo', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const date =
                    req.query.date || moment(new Date()).format('DD-MMM-YYYY');
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }
                const isExist = await checkInCollections.findOne({
                    email: userMail,
                    date: date,
                });
                res.send(isExist);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch check-in time',
                });
            }
        });
        // ************************************************************************************************
        app.get('/getCheckOutInfo', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const date =
                    req.query.date || moment(new Date()).format('DD-MMM-YYYY');
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }
                const isExist = await checkOutCollections.findOne({
                    email: userMail,
                    date: date,
                });
                res.send(isExist);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch check-in time',
                });
            }
        });
        // ************************************************************************************************
        app.get('/getStartOTInfo', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const date =
                    req.query.date || moment(new Date()).format('DD-MMM-YYYY');
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }
                const isExist = await OTStartCollections.findOne({
                    email: userMail,
                    date: date,
                });

                res.send(isExist);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch check-in time',
                });
            }
        });
        // ************************************************************************************************
        app.get('/getStopOTTime', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const date =
                    req.query.date || moment(new Date()).format('DD-MMM-YYYY');
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }
                const isExist = await OTStopCollections.findOne({
                    email: userMail,
                    date: date,
                });
                res.send(isExist);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch check-in time',
                });
            }
        });
        // ************************************************************************************************
        app.get('/getAttendance', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const result = await attendanceCollections
                    .find({ email: userMail })
                    .sort({ _id: -1 }) // Ensures latest 7 by creation time
                    .limit(7)
                    .toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching attendance:', error.message);
                res.status(500).json({ message: 'Failed to fetch attendance' });
            }
        });

        // ************************************************************************************************
        // Working shift for the logged-in employee (secure)
        app.get('/gethWorkingShift', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;
                if (requestedEmail !== req.user.email) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }

                const shiftDoc = await shiftingCollections.findOne({
                    email: requestedEmail,
                });
                res.send(shiftDoc?.shiftName || 'No Shift Assigned');
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch working shift',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        // /getSalaryAndPF – always return an array with one safe object
        // Salary & PF for the logged-in employee (secure)
        app.get('/getSalaryAndPF', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;
                if (requestedEmail !== req.user.email) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }

                const docs = await PFAndSalaryCollections.find({
                    email: requestedEmail,
                }).toArray();
                if (!docs.length) {
                    // Safe default so UI doesn't break
                    return res.send([
                        {
                            email: requestedEmail,
                            salary: 0,
                            pfContribution: 0,
                            pfStatus: 'inactive',
                        },
                    ]);
                }
                res.send(docs);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch salary/PF',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        // Get a single shareholder by ID
        app.get('/getSingleShareholder/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const objectId = new ObjectId(id);

                const isShareholder = await shareHoldersCollections.findOne({
                    _id: objectId,
                });
                const shareholder = await profitShareCollections
                    .find({ email: isShareholder.email })
                    .toArray();

                if (!shareholder) {
                    return res
                        .status(404)
                        .json({ message: 'Shareholder not found' });
                }

                res.send(shareholder);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch shareholder',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        app.get('/getMonthlyProfit', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const result = await monthlyProfitCollections.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch share holders list',
                });
            }
        });
        // ************************************************************************************************
        app.post('/addMonthlyProfitDistribution', async (req, res) => {
            try {
                const {
                    month,
                    year,
                    sharedAmount,
                    userName,
                    note,
                    netAmount,
                    name,
                    email,
                    mobile,
                } = req.body;
                const date = new Date();

                const amountToShare = parseFloat(sharedAmount) || 0;

                if (netAmount < amountToShare) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient balance. Available: ${netAmount.toFixed(
                            2
                        )}, Requested: ${amountToShare.toFixed(2)}`,
                    });
                }

                // ✅ Step 5: Prepare document to insert
                const profitShareDocToInsert = {
                    name,
                    email,
                    mobile,
                    month,
                    year,
                    date,
                    sharedProfitBalance: amountToShare,
                    userName,
                    note: note || '',
                };

                // ✅ Step 6: Save record
                const result = await profitShareCollections.insertOne(
                    profitShareDocToInsert
                );

                res.json({
                    success: true,
                    message: 'Profit distribution record saved successfully',
                    insertedId: result.insertedId,
                    availableBalance: netAmount - amountToShare,
                });
            } catch (error) {
                console.error('Error saving profit distribution:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to save profit distribution',
                });
            }
        });

        // ************************************************************************************************
        app.post('/transferMonthlyProfit', async (req, res) => {
            try {
                const { month, year, transferAmount, userName } = req.body;
                const date = new Date();

                const monthDoc = await monthlyProfitCollections.findOne({
                    month,
                    year,
                });
                if (!monthDoc) {
                    return res.json({
                        message: `No profit record found for ${month} ${year}`,
                    });
                }

                if (parseFloat(monthDoc.profit) < parseFloat(transferAmount)) {
                    return res.json({
                        message: `Insufficient profit balance. Available: ${monthDoc.profit}, Requested: ${transferAmount}`,
                    });
                }

                const shareholder = await shareHoldersCollections.findOne({
                    email: 'asadexpert1@gmail.com',
                });

                const result = await profitShareCollections.insertOne({
                    name: shareholder?.shareHoldersName || '',
                    mobile: shareholder?.mobile || '',
                    email: 'asadexpert1@gmail.com',
                    transferProfitBalance: parseFloat(transferAmount),
                    totalProfitBalance: parseFloat(monthDoc.profit),
                    month,
                    year,
                    date,
                    userName,
                });

                await monthlyProfitCollections.updateOne(
                    { month, year },
                    {
                        $inc: { remaining: -transferAmount },
                        $push: {
                            shared: {
                                date,
                                amount: parseFloat(transferAmount),
                            },
                        },
                    }
                );

                res.send({
                    message: 'Profit transfer successfully',
                    insertedId: result.insertedId,
                });
            } catch (error) {
                console.error(error);
                res.json({ message: 'Failed to transfer monthly profit' });
            }
        });
        // ************************************************************************************************
        // duplicate route
        // app.get('/calculateMonthlyProfit', async (req, res) => {
        //     try {
        //         const allEarnings = await earningsCollections.find().toArray();
        //         const allExpenses = await expenseCollections.find().toArray();

        //         const profitByMonth = {};

        //         const monthMap = {
        //             'January': 1, 'February': 2, 'March': 3, 'April': 4,
        //             'May': 5, 'June': 6, 'July': 7, 'August': 8,
        //             'September': 9, 'October': 10, 'November': 11, 'December': 12
        //         };

        //         // Process Earnings using 'month' and fallback 'date' for year
        //         for (const earn of allEarnings) {
        //             if (!earn?.month) {
        //                 console.log("Skipping earning due to missing month:", earn);
        //                 continue;
        //             }

        //             const rawMonth = earn.month.toString().trim();
        //             const capitalizedMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();
        //             const monthIndex = monthMap[capitalizedMonth];

        //             let year = earn.year?.toString().trim();

        //             if (!year && earn.date && typeof earn.date === 'string') {
        //                 const parts = earn.date.split('-'); // Expecting DD-MM-YYYY
        //                 if (parts.length === 3) {
        //                     year = parts[2];
        //                 }
        //             }

        //             if (!monthIndex || !year) {
        //                 console.log("Skipping earning due to invalid month or year:", earn);
        //                 continue;
        //             }

        //             const key = `${monthIndex}-${year}`;

        //             if (!profitByMonth[key]) {
        //                 profitByMonth[key] = { earnings: 0, expense: 0 };
        //             }

        //             const value = Number(earn.convertedBdt) || 0;
        //             profitByMonth[key].earnings += value;
        //             console.log(`Earning added for ${key}: +${value}`);
        //         }

        //         // Process Expenses using expenseDate
        //         for (const exp of allExpenses) {
        //             if (!exp?.expenseDate) continue;
        //             const expDate = new Date(exp.expenseDate);
        //             if (isNaN(expDate.getTime())) continue;

        //             const month = expDate.getMonth() + 1; // JS month is 0-indexed
        //             const year = expDate.getFullYear();
        //             const key = `${month}-${year}`;

        //             if (!profitByMonth[key]) {
        //                 profitByMonth[key] = { earnings: 0, expense: 0 };
        //             }

        //             profitByMonth[key].expense += Number(exp.expenseAmount) || 0;
        //         }

        //         const documents = [];
        //         for (const key in profitByMonth) {
        //             const [month, year] = key.split('-');
        //             const monthName = new Date(`${year}-${month}-01`).toLocaleString('default', { month: 'long' });
        //             const earnings = parseFloat(profitByMonth[key].earnings.toFixed(2));
        //             const expense = parseFloat(profitByMonth[key].expense.toFixed(2));
        //             const profit = parseFloat((earnings - expense).toFixed(2));

        //             documents.push({
        //                 month: monthName,
        //                 year,
        //                 earnings,
        //                 expense,
        //                 profit
        //             });
        //         }

        //         const insertResult = await monthlyProfitCollections.insertMany(documents);

        //         res.send({
        //             message: 'Monthly profit calculated and stored successfully.',
        //             insertedCount: insertResult.insertedCount,
        //             data: documents
        //         });
        //     } catch (error) {
        //         res.status(500).send({ message: 'Error calculating and storing profit', error: error.message });
        //     }
        // });
        // same
        // app.get('/calculateMonthlyProfit', async (req, res) => {
        //     try {
        //         const allEarnings = await earningsCollections.find().toArray();
        //         const allExpenses = await expenseCollections.find().toArray();

        //         const profitByMonth = {};

        //         const monthMap = {
        //             'January': 1, 'February': 2, 'March': 3, 'April': 4,
        //             'May': 5, 'June': 6, 'July': 7, 'August': 8,
        //             'September': 9, 'October': 10, 'November': 11, 'December': 12
        //         };

        //         for (const earn of allEarnings) {
        //             if (!earn?.month) {
        //                 console.log("Skipping earning due to missing month:", earn);
        //                 continue;
        //             }

        //             const rawMonth = earn.month.toString().trim();
        //             const capitalizedMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();
        //             const monthIndex = monthMap[capitalizedMonth];

        //             let year = earn.year?.toString().trim();

        //             if (!year && earn.date && typeof earn.date === 'string') {
        //                 const parts = earn.date.split('-'); // Expecting DD-MM-YYYY
        //                 if (parts.length === 3) {
        //                     year = parts[2];
        //                 }
        //             }

        //             if (!monthIndex || !year) {
        //                 console.log("Skipping earning due to invalid month or year:", earn);
        //                 continue;
        //             }

        //             const key = `${monthIndex}-${year}`;

        //             if (!profitByMonth[key]) {
        //                 profitByMonth[key] = { earnings: 0, expense: 0 };
        //             }

        //             const value = Number(earn.convertedBdt) || 0;
        //             profitByMonth[key].earnings += value;
        //             console.log(`Earning added for ${key}: +${value}`);
        //         }

        //         for (const exp of allExpenses) {
        //             if (!exp?.expenseDate) continue;
        //             const expDate = new Date(exp.expenseDate);
        //             if (isNaN(expDate.getTime())) continue;

        //             const month = expDate.getMonth() + 1;
        //             const year = expDate.getFullYear();
        //             const key = `${month}-${year}`;

        //             if (!profitByMonth[key]) {
        //                 profitByMonth[key] = { earnings: 0, expense: 0 };
        //             }

        //             profitByMonth[key].expense += Number(exp.expenseAmount) || 0;
        //         }

        //         const documents = [];

        //         for (const key in profitByMonth) {
        //             const [month, year] = key.split('-');
        //             const monthName = new Date(`${year}-${month}-01`).toLocaleString('default', { month: 'long' });
        //             const earnings = parseFloat(profitByMonth[key].earnings.toFixed(2));
        //             const expense = parseFloat(profitByMonth[key].expense.toFixed(2));
        //             const profit = parseFloat((earnings - expense).toFixed(2));
        //             const remaining = profit;

        //             documents.push({
        //                 month: monthName,
        //                 year,
        //                 earnings,
        //                 expense,
        //                 profit,
        //                 remaining,
        //                 shared: []
        //             });
        //         }

        //         const insertResult = await monthlyProfitCollections.insertMany(documents);

        //         res.send({
        //             message: 'Monthly profit calculated and stored successfully.',
        //             insertedCount: insertResult.insertedCount,
        //             data: documents
        //         });
        //     } catch (error) {
        //         res.status(500).send({ message: 'Error calculating and storing profit', error: error.message });
        //     }
        // });

        //calculate and store monthly profit
        // ************************************************************************************************
        app.get('/getUnpaidAmount', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const unpaidData = await unpaidCollections.find().toArray();

                // ✅ Use reduce to calculate the total unpaid amount
                const totalUnpaid = unpaidData.reduce((sum, item) => {
                    return sum + parseFloat(item.totalConvertedBdt || 0);
                }, 0);

                res.send({ totalUnpaid });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch unpaid amount',
                    error: error.message,
                });
            }
        });

        // *************************************************************************************************
        app.get('/getSharedProfit', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const sharedProfit = await profitShareCollections
                    .find()
                    .toArray();

                // ✅ Use reduce to calculate the total unpaid amount
                const totalProfitShared = sharedProfit.reduce((sum, item) => {
                    return (
                        sum +
                        parseFloat(
                            item.sharedProfitBalance ||
                                item.transferProfitBalance
                        )
                    );
                }, 0);

                res.send({ totalProfitShared });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch unpaid amount',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************

        app.get('/getAdminNotification', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const notification = await adminNotificationCollections
                    .find()
                    .sort({ _id: -1 })
                    .toArray();

                res.send(notification);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch unpaid amount',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        // All leave applications (secure); client can filter own entries
        // All leave applications (secure); client can filter own entries
        app.get('/getAppliedLeave', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;
                if (requestedEmail !== req.user.email) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }

                const appliedLeave = await appliedLeaveCollections
                    .find({})
                    .sort({ _id: -1 })
                    .toArray();

                res.send(appliedLeave);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch applied leaves',
                    error: error.message,
                });
            }
        });

        // ************************************************************************************************
        app.get('/getEmployeeNotification', verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res
                        .status(401)
                        .send({ message: 'Forbidden Access' });
                }

                const notification = await employeeNotificationCollections
                    .find({ email: userMail })
                    .sort({ _id: -1 })
                    .toArray();

                res.send(notification);
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to fetch unpaid amount',
                    error: error.message,
                });
            }
        });
        // ************************************************************************************************
        // --- Admin Attendance across employees ---
        // Admin/employee attendance list (secure)
        app.get('/admin/attendance/list', verifyToken, async (req, res) => {
            try {
                const { userEmail, start, end, employeeEmail, q } = req.query;

                // Gate: only the logged-in user can call this
                if (userEmail !== req.user.email) {
                    return res
                        .status(403)
                        .json({ message: 'Forbidden Access' });
                }

                if (!start || !end) {
                    return res.status(400).json({
                        message: 'start and end (YYYY-MM-DD) are required',
                    });
                }

                // Convert YYYY-MM-DD to ms (inclusive day window)
                const startMs = new Date(start + 'T00:00:00Z').getTime();
                const endMs = new Date(end + 'T23:59:59Z').getTime();

                const match = {
                    $expr: {
                        $and: [
                            { $gte: ['$checkInTime', startMs] },
                            { $lte: ['$checkInTime', endMs] },
                        ],
                    },
                };
                if (employeeEmail) match.email = employeeEmail;

                // Sort by checkInTime (NOT by _id), oldest→newest so tables render in order
                const base = await attendanceCollections
                    .find(match)
                    .project({
                        email: 1,
                        fullName: 1,
                        date: 1,
                        month: 1,
                        checkInTime: 1,
                        checkOutTime: 1,
                        workingHourInSeconds: 1,
                        workingDisplay: 1,
                        lateCheckIn: 1,
                        totalOTInSeconds: 1,
                        displayOTHour: 1,
                    })
                    .sort({ checkInTime: 1 })
                    .toArray();

                // Optional simple text filter on name/email
                const filtered = q
                    ? base.filter(
                          (r) =>
                              (r.fullName || '')
                                  .toLowerCase()
                                  .includes(q.toLowerCase()) ||
                              (r.email || '')
                                  .toLowerCase()
                                  .includes(q.toLowerCase())
                      )
                    : base;

                res.send(filtered);
            } catch (e) {
                res.status(500).json({
                    message: 'Failed to load attendance',
                    error: e?.message,
                });
            }
        });

        // ************************************************************************************************

        app.post(
            '/uploadProfilePic',
            upload.single('image'),
            async (req, res) => {
                try {
                    const userEmail = req.body.email;
                    const fileBuffer = req.file?.buffer;

                    if (!fileBuffer || !userEmail) {
                        return res
                            .status(400)
                            .send({ error: 'Missing file or email' });
                    }

                    const imageUrl = await uploadToCloudinary(fileBuffer);

                    const updateResult = await employeeCollections.updateOne(
                        { email: userEmail },
                        { $set: { photo: imageUrl } }
                    );

                    if (updateResult.modifiedCount === 0) {
                        return res
                            .status(404)
                            .send({ error: 'Employee not found' });
                    }

                    res.send({
                        message: 'Image uploaded successfully',
                        url: imageUrl,
                    });
                } catch (error) {
                    res.status(500).send({ error: 'Image upload failed' });
                }
            }
        );
        // ************************************************************************************************
        // --- OT aggregation buckets ---
        app.get('/admin/ot/list', verifyToken, async (req, res) => {
            try {
                const {
                    userEmail,
                    start,
                    end,
                    employeeEmail,
                    groupBy = 'daily',
                } = req.query;
                if (userEmail !== req.user.email)
                    return res
                        .status(401)
                        .json({ message: 'Forbidden Access' });

                const startMs = new Date(start + 'T00:00:00Z').getTime();
                const endMs = new Date(end + 'T23:59:59Z').getTime();

                const match = {
                    $and: [
                        {
                            $expr: {
                                $and: [
                                    { $gte: ['$checkInTime', startMs] },
                                    { $lte: ['$checkInTime', endMs] },
                                ],
                            },
                        },
                    ],
                    totalOTInSeconds: { $gt: 0 },
                };
                if (employeeEmail) match.email = employeeEmail;

                const all = await attendanceCollections.find(match).toArray();

                const fmt = (ts) => {
                    const d = new Date(ts);
                    if (groupBy === 'yearly') return `${d.getUTCFullYear()}`;
                    if (groupBy === 'monthly')
                        return `${d.getUTCFullYear()}-${String(
                            d.getUTCMonth() + 1
                        ).padStart(2, '0')}`;
                    if (groupBy === 'weekly') {
                        const onejan = new Date(
                            Date.UTC(d.getUTCFullYear(), 0, 1)
                        );
                        const week = Math.ceil(
                            ((d - onejan) / 86400000 + onejan.getUTCDay() + 1) /
                                7
                        );
                        return `${d.getUTCFullYear()}-W${String(week).padStart(
                            2,
                            '0'
                        )}`;
                    }
                    // daily
                    return `${d.getUTCFullYear()}-${String(
                        d.getUTCMonth() + 1
                    ).padStart(2, '0')}-${String(d.getUTCDate()).padStart(
                        2,
                        '0'
                    )}`;
                };

                const map = new Map();
                for (const r of all) {
                    const bucket = fmt(
                        r.checkInTime || r.otStartTime || Date.now()
                    );
                    const key = `${bucket}|${r.email}`;
                    const prev = map.get(key) || {
                        bucket,
                        email: r.email,
                        fullName: r.fullName,
                        totalOTInSeconds: 0,
                    };
                    prev.totalOTInSeconds += r.totalOTInSeconds || 0;
                    map.set(key, prev);
                }

                const out = Array.from(map.values()).map((v) => ({
                    bucketLabel: v.bucket,
                    email: v.email,
                    fullName: v.fullName,
                    totalOTInSeconds: v.totalOTInSeconds,
                }));

                res.send(out);
            } catch (e) {
                res.status(500).json({
                    message: 'Failed to load OT',
                    error: e?.message,
                });
            }
        });
        // ************************************************************************************************
        app.post('/addShareHolder', async (req, res) => {
            try {
                const data = req.body;
                const result = await shareHoldersCollections.insertOne(data);
                res.send(result);
            } catch (err) {
                res.status(500).json({ message: 'Error adding shareholder' });
            }
        });

        // ************************************************************************************************
        app.get('/admin/designations', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;
                const tokenEmail = req.user.email;
                if (requestedEmail !== tokenEmail) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }

                if (!employeeCollections) {
                    // This happens if the route was registered outside run()
                    return res.status(500).json({
                        message: 'employeeCollections not initialized',
                    });
                }

                // distinct needs no filter, but pass {} explicitly
                const list = await employeeCollections.distinct(
                    'designation',
                    {}
                );
                const cleaned = (Array.isArray(list) ? list : [])
                    .filter(Boolean)
                    .map((v) => String(v))
                    .sort((a, b) => a.localeCompare(b));

                res.send(cleaned);
            } catch (error) {
                console.error('GET /admin/designations failed:', error); // <— add this
                res.status(500).json({
                    message: 'Failed to fetch designations',
                });
            }
        });

        // ************************************************************************************************
        app.put(
            '/admin/employee/:id/designation',
            verifyToken,
            async (req, res) => {
                try {
                    const requestedEmail = req.query.userEmail;
                    const tokenEmail = req.user.email;
                    if (requestedEmail !== tokenEmail) {
                        return res
                            .status(403)
                            .send({ message: 'Forbidden Access' });
                    }

                    const { id } = req.params;
                    const { newDesignation } = req.body;

                    if (!ObjectId.isValid(id)) {
                        return res
                            .status(400)
                            .json({ message: 'Invalid employee id' });
                    }
                    if (!newDesignation || typeof newDesignation !== 'string') {
                        return res
                            .status(400)
                            .json({ message: 'newDesignation is required' });
                    }

                    const emp = await employeeCollections.findOne({
                        _id: new ObjectId(id),
                    });
                    if (!emp)
                        return res
                            .status(404)
                            .json({ message: 'Employee not found' });

                    // 1) Update employee designation
                    await employeeCollections.updateOne(
                        { _id: new ObjectId(id) },
                        { $set: { designation: newDesignation } }
                    );

                    // 2) Upsert role in userCollections based on designation
                    const role = roleForDesignation(newDesignation);
                    if (emp.email) {
                        const exists = await userCollections.findOne({
                            email: emp.email,
                        });
                        if (exists) {
                            await userCollections.updateOne(
                                { email: emp.email },
                                { $set: { role } }
                            );
                        } else {
                            // fallback: create if missing
                            await userCollections.insertOne({
                                email: emp.email,
                                role,
                                userName: emp.fullName || '',
                                profilePic: emp.photo || '',
                            });
                        }
                    }

                    res.send({ success: true, newDesignation, role });
                } catch (error) {
                    res.status(500).json({
                        message: 'Failed to update designation',
                        error: error?.message,
                    });
                }
            }
        );

        // ************************************************************************************************
        app.get('/notice/list', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;
                const tokenEmail = req.user.email;
                if (requestedEmail !== tokenEmail) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }

                const list = await noticeBoardCollections
                    .find({})
                    .sort({ effectiveDate: -1, createdAt: -1 })
                    .toArray();

                res.send(list);
            } catch (error) {
                res.status(500).json({ message: 'Failed to load notices' });
            }
        });

        // ************************************************************************************************
        // GET /admin/pf-salary?userEmail=<admin>&employeeEmail=<emp>
        app.get('/admin/pf-salary', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;
                if (requestedEmail !== req.user.email) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }
                const employeeEmail = req.query.employeeEmail;
                if (!employeeEmail)
                    return res
                        .status(400)
                        .send({ message: 'employeeEmail required' });

                const doc = await PFAndSalaryCollections.findOne({
                    email: employeeEmail,
                });
                res.send(
                    doc
                        ? {
                              email: doc.email,
                              salary: doc.salary,
                              pfContribution: doc.pfContribution,
                              pfStatus: doc.pfStatus,
                          }
                        : {
                              email: employeeEmail,
                              salary: 0,
                              pfContribution: 0,
                              pfStatus: 'inactive',
                          }
                );
            } catch {
                res.status(500).json({ message: 'Failed to fetch PF/Salary' });
            }
        });

        // ************************************************************************************************
        app.get('/employee/leave-balance', verifyToken, async (req, res) => {
            try {
                const { userEmail } = req.query;
                if (!userEmail)
                    return res
                        .status(400)
                        .json({ message: 'userEmail is required' });

                // same-user guard (tightest). If you want Admin override, add role check here.
                const tokenEmail = req.user.email;
                if (!tokenEmail)
                    return res.status(401).json({ message: 'Unauthorized' });
                if (tokenEmail !== userEmail)
                    return res.status(403).json({ message: 'Forbidden' });

                const doc = await leaveBalanceCollections.findOne({
                    email: userEmail,
                });

                if (!doc) return res.json([]);

                // Map your schema: casualLeave, sickLeave are REMAINING days
                const out = [
                    {
                        name: 'Casual Leave',
                        remaining: Number(doc.casualLeave ?? 0),
                    },
                    {
                        name: 'Sick Leave',
                        remaining: Number(doc.sickLeave ?? 0),
                    },
                ];

                return res.json(out);
            } catch (e) {
                console.error('leave-balance error:', e);
                return res.status(500).json({ message: 'Server error' });
            }
        });
        // ************************************************************************************************
        // GET /admin/checkins/list?userEmail=...&date=YYYY-MM-DD&employeeEmail=optional
        app.get('/admin/checkins/list', verifyToken, async (req, res) => {
            try {
                const { userEmail, date, employeeEmail } = req.query;

                if (userEmail !== req.user.email) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }
                if (!userEmail || !date) {
                    return res
                        .status(400)
                        .json({ message: 'userEmail and date are required' });
                }

                const tz = 'Asia/Dhaka';
                const m = moment.tz(
                    date,
                    ['YYYY-MM-DD', 'DD-MMM-YYYY'],
                    true,
                    tz
                );
                if (!m.isValid()) {
                    return res.status(400).json({ message: 'Invalid date' });
                }

                const dayKey = m.format('DD-MMM-YYYY'); // matches your checkInCollections `date`
                const query = { date: dayKey };
                if (employeeEmail) query.email = employeeEmail;

                const docs = await checkInCollections.find(query).toArray();
                res.json(docs || []);
            } catch (e) {
                res.status(500).json({
                    message: 'Failed to load check-ins',
                    error: e.message,
                });
            }
        });

        // ************************************************************************************************
        app.post(
            '/notice/create',
            verifyToken,
            upload.single('file'),
            async (req, res) => {
                try {
                    const requestedEmail = req.query.userEmail;
                    const tokenEmail = req.user.email;
                    if (requestedEmail !== tokenEmail) {
                        return res
                            .status(403)
                            .send({ message: 'Forbidden Access' });
                    }

                    // Admin only
                    await ensureCanPostNotice(tokenEmail);

                    const {
                        title,
                        body,
                        priority,
                        effectiveDate,
                        expiryDate,
                        sendEmail,
                    } = req.body;
                    if (!title || !title.trim())
                        return res
                            .status(400)
                            .json({ message: 'Title is required' });

                    // upload PDF (optional)
                    let fileUrl = null;
                    if (req.file) {
                        fileUrl = await uploadPdfBufferOrNull(req.file);
                    }

                    // author info
                    const emp = await employeeCollections.findOne(
                        { email: tokenEmail },
                        { projection: { fullName: 1, email: 1 } }
                    );
                    const createdBy = {
                        email: tokenEmail,
                        fullName: emp?.fullName || '',
                    };

                    const now = new Date();
                    const doc = {
                        title: String(title || '').trim(),
                        body: String(body || '').trim(),
                        priority: ['info', 'high', 'normal'].includes(
                            String(priority)
                        )
                            ? priority
                            : 'normal',
                        effectiveDate: effectiveDate
                            ? new Date(effectiveDate)
                            : now,
                        expiryDate: expiryDate ? new Date(expiryDate) : null,
                        fileUrl,
                        fileName: req.file?.originalname || null,
                        createdAt: now,
                        createdBy,
                    };

                    const result = await noticeBoardCollections.insertOne(doc);

                    // optional email blast
                    if (String(sendEmail).toLowerCase() === 'true') {
                        try {
                            await emailAllEmployees({
                                title: doc.title,
                                body: doc.body,
                                fileUrl: doc.fileUrl,
                                effectiveDate: doc.effectiveDate,
                                createdBy,
                            });
                        } catch (mailErr) {
                            // Don’t fail the API if email sending fails—just report
                            console.error(
                                'Email send failed:',
                                mailErr?.message || mailErr
                            );
                        }
                    }

                    res.send({ insertedId: result.insertedId, ...doc });
                } catch (error) {
                    const code = error?.status || 500;
                    res.status(code).json({
                        message: error?.message || 'Failed to create notice',
                    });
                }
            }
        );

        // ************************************************************************************************
        // NEW: toggle (or set) employee status. Accepts { status: "Active" | "De-activate" }
        app.put('/admin/employee/:id/status', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;
                const tokenEmail = req.user.email;
                if (requestedEmail !== tokenEmail) {
                    return res
                        .status(403)
                        .send({ message: 'Forbidden Access' });
                }

                // gate by role
                await ensureCanManageEmployees(tokenEmail);

                const { id } = req.params;
                const { status } = req.body; // "Active" or "De-activate"
                if (!ObjectId.isValid(id))
                    return res
                        .status(400)
                        .json({ message: 'Invalid employee id' });
                if (!['Active', 'De-activate'].includes(String(status))) {
                    return res.status(400).json({ message: 'Invalid status' });
                }

                const emp = await employeeCollections.findOne(
                    { _id: new ObjectId(id) },
                    { projection: { email: 1, fullName: 1, status: 1 } }
                );
                if (!emp)
                    return res
                        .status(404)
                        .json({ message: 'Employee not found' });

                await employeeCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                // create an in-app employee notification
                if (emp.email) {
                    const note =
                        status === 'De-activate'
                            ? 'Your account has been de-activated. You can no longer access the portal.'
                            : 'Your account has been re-activated. You can access the portal again.';
                    await employeeNotificationCollections.insertOne({
                        notification: note,
                        email: emp.email,
                        link: '/',
                        isRead: false,
                        createdAt: new Date(),
                    });
                }

                res.send({ success: true, status });
            } catch (error) {
                res.status(error?.status || 500).json({
                    message: error?.message || 'Failed to update status',
                });
            }
        });

        // ************************************************************************************************
        // Update an order's editable fields (everything except status & userName)
        // Edit an existing local order (no status/user edits, and blocked if locked)
        app.put('/orders/:id/edit', verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;
                const tokenEmail = req.user.email;
                if (requestedEmail !== tokenEmail) {
                    return res
                        .status(403)
                        .json({ message: 'Forbidden Access' }); // stay consistent with other admin routes
                }

                const { id } = req.params;
                if (!ObjectId.isValid(id)) {
                    return res
                        .status(400)
                        .json({ message: 'Invalid order id' });
                }

                // find order and ensure not locked
                const order = await localOrderCollections.findOne(
                    { _id: new ObjectId(id) },
                    { projection: { isLocked: 1 } }
                );
                if (!order)
                    return res.status(404).json({ message: 'Order not found' });
                if (
                    order.isLocked ||
                    ['Completed', 'Delivered'].includes(
                        String(order.orderStatus)
                    )
                ) {
                    return res.status(423).json({
                        message:
                            'Order is locked/completed/delivered and cannot be edited.',
                    });
                }

                // Allowed fields (EXCLUDES orderStatus and userName)
                let {
                    clientID,
                    orderName,
                    orderQTY,
                    orderPrice,
                    orderDeadLine,
                    orderInstructions,
                    needServices,
                    returnFormat,
                    colorCode,
                    imageResize,
                    date, // same "DD-MMM-YYYY" format you already use
                } = req.body || {};

                // Gentle normalization (optional)
                if (orderQTY !== undefined) {
                    const n = Number(orderQTY);
                    orderQTY = Number.isFinite(n) ? n : 0;
                }
                if (orderPrice !== undefined) {
                    const n = Number(orderPrice);
                    orderPrice = Number.isFinite(n) ? n : 0;
                }
                if (
                    needServices !== undefined &&
                    !Array.isArray(needServices)
                ) {
                    needServices = []; // ensure array
                }

                const update = {
                    ...(clientID !== undefined && {
                        clientID: String(clientID),
                    }),
                    ...(orderName !== undefined && {
                        orderName: String(orderName),
                    }),
                    ...(orderQTY !== undefined && { orderQTY }),
                    ...(orderPrice !== undefined && { orderPrice }),
                    ...(orderDeadLine !== undefined && {
                        orderDeadLine: String(orderDeadLine),
                    }),
                    ...(orderInstructions !== undefined && {
                        orderInstructions: String(orderInstructions),
                    }),
                    ...(needServices !== undefined && { needServices }),
                    ...(returnFormat !== undefined && {
                        returnFormat: String(returnFormat),
                    }),
                    ...(colorCode !== undefined && {
                        colorCode: String(colorCode),
                    }),
                    ...(imageResize !== undefined && {
                        imageResize: String(imageResize),
                    }),
                    ...(date !== undefined && { date: String(date) }),
                    lastUpdated: Date.now(),
                };

                // If nothing to update, short-circuit
                if (Object.keys(update).length === 1) {
                    // only lastUpdated present
                    return res
                        .status(200)
                        .json({ message: 'No changes detected' });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: update }
                );

                if (result.modifiedCount === 0) {
                    return res
                        .status(200)
                        .json({ message: 'No changes detected' });
                }

                res.json({ message: 'Order updated successfully' });
            } catch (err) {
                res.status(500).json({
                    message: 'Failed to update order',
                    error: err?.message,
                });
            }
        });

        // ************************************************************************************************
        // --- SALARY PIN: set or change ---
        app.post('/employee/salary-pin/set', async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;

                const { currentPin, newPin } = req.body || {};
                if (
                    !newPin ||
                    typeof newPin !== 'string' ||
                    newPin.length < 4 ||
                    newPin.length > 12
                ) {
                    return res
                        .status(400)
                        .json({ message: 'PIN must be 4-12 characters' });
                }

                const emp = await employeeCollections.findOne(
                    { email: requestedEmail },
                    { projection: { salaryPinHash: 1 } }
                );
                if (!emp)
                    return res
                        .status(404)
                        .json({ message: 'Employee not found' });

                // If a pin already exists, require currentPin
                if (emp.salaryPinHash) {
                    if (!currentPin)
                        return res
                            .status(400)
                            .json({ message: 'Current PIN is required' });
                    const ok = await bcrypt.compare(
                        currentPin,
                        emp.salaryPinHash
                    );
                    if (!ok)
                        return res
                            .status(401)
                            .json({ message: 'Current PIN is incorrect' });
                }

                const salt = await bcrypt.genSalt(10);
                const salaryPinHash = await bcrypt.hash(newPin, salt);

                await employeeCollections.updateOne(
                    { email: requestedEmail },
                    { $set: { salaryPinHash, salaryPinUpdatedAt: new Date() } }
                );

                res.json({ success: true, message: 'PIN saved successfully' });
            } catch (e) {
                res.status(500).json({ message: 'Failed to set PIN' });
            }
        });

        // --- SALARY PIN: verify (unlock) ---
        app.post('/employee/salary-pin/verify', async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;

                const { pin } = req.body || {};
                if (!pin)
                    return res.status(400).json({ message: 'PIN required' });

                const emp = await employeeCollections.findOne(
                    { email: requestedEmail },
                    { projection: { salaryPinHash: 1 } }
                );
                if (!emp?.salaryPinHash) {
                    return res.status(404).json({ message: 'No PIN set' });
                }

                const ok = await bcrypt.compare(pin, emp.salaryPinHash);
                if (!ok)
                    return res.status(401).json({ message: 'Invalid PIN' });

                res.json({ success: true });
            } catch (e) {
                res.status(500).json({ message: 'Failed to verify PIN' });
            }
        });

        // ************************************************************************************************
        // Cancel an order: lock it and set status = "Cancel"
        app.put('/orderStatusCancel/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;

                const order = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!order)
                    return res.status(404).json({ message: 'Order not found' });

                // You may also want to freeze timers. We'll keep existing times as-is.
                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            orderStatus: 'Cancel',
                            isLocked: true,
                        },
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({ message: 'Failed to cancel order' });
            }
        });

        // Restore a canceled order: unlock it and set status = "Pending"
        app.put('/orderStatusRestore/:orderId', async (req, res) => {
            try {
                const id = req.params.orderId;

                const order = await localOrderCollections.findOne({
                    _id: new ObjectId(id),
                });
                if (!order)
                    return res.status(404).json({ message: 'Order not found' });

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            orderStatus: 'Pending',
                            isLocked: false,
                        },
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({ message: 'Failed to restore order' });
            }
        });

        // fuyad's
        app.use(router);

        // ************************************************************************************************

        // ************************************************************************************************

        // ************************************************************************************************

        // ************************************************************************************************
        // ************************************************************************************************
        // ************************************************************************************************

        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        );
    } finally {
        // Ensures that the client will close when you finish/error
        //   await client.close();
    }
}
run().catch(console.dir);

// ************************************************************************************************
// ************************************************************************************************
// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
// ************************************************************************************************
