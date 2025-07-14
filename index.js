const express = require("express");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const moment = require("moment-timezone");
require('dotenv').config();
const multer = require('multer');
const { uploadToCloudinary } = require("./uploadPhoto");

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");


const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors(
    {
        origin: ["http://localhost:5173", "https://app.webbriks.com"],
        credentials: true,
    }
));
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
app.get("/", (req, res) => {
    res.send("Hello World!");
});
// ************************************************************************************************
// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];


    if (!authHeader) {
        return res.status(401).send({ message: "Access forbidden" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).send({ message: "No authorization" });
    }

    jwt.verify(token, TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: "Forbidden: Invalid token" });
        }
        req.user = decoded;
        next();
    });
};
// ************************************************************************************************

// JWT token generation
app.post("/jwt", (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).send({ message: "Email is required" });
    }

    const token = jwt.sign({ email }, TOKEN_SECRET, {
        expiresIn: "24h",
    });
    res.send({ success: true, token });
});
// ************************************************************************************************
// JWT token validation route
app.post("/validate-token", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from 'Authorization' header

    if (!token) {
        return res
            .status(400)
            .send({ success: false, message: "Forbidden access" });
    }

    // Verify the token
    jwt.verify(token, TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res
                .status(401)
                .send({ success: false, message: "Invalid or expired token" });
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
        const database = client.db("hrManagement");
        const userCollections = database.collection("userList");
        const expenseCollections = database.collection("expenseList");
        const categoryCollections = database.collection("categoryList");
        const localOrderCollections = database.collection("localOrderList");
        const clientCollections = database.collection("clientList");
        const hrBalanceCollections = database.collection("hrBalanceList");
        const hrTransactionCollections = database.collection("hrTransactionList");
        const mainBalanceCollections = database.collection("mainBalanceList");
        const mainTransactionCollections = database.collection("mainTransactionList");
        const employeeCollections = database.collection("employeeList");
        const earningsCollections = database.collection("earningsList");
        const shiftingCollections = database.collection("shiftingList");
        const shareHoldersCollections = database.collection("shareHoldersList");
        const profitShareCollections = database.collection("profitShareList");
        const checkInCollections = database.collection("checkInList");
        const checkOutCollections = database.collection("checkOutList");
        const attendanceCollections = database.collection("attendanceList");
        const OTStartCollections = database.collection("OTStartList");
        const OTStopCollections = database.collection("OTStopList");
        const PFAndSalaryCollections = database.collection("PFAndSalaryList");
        const monthlyProfitCollections = database.collection("monthlyProfitList");

        // *******************************************************************************************
        // async function exportAllEmployeesToExcel() {
        //     try {
        //         const employees = await employeeCollections
        //             .find({}, { projection: { _id: 0, email: 1, fullName: 1 } })
        //             .toArray();

        //         if (!employees.length) {
        //             console.log("⚠️ No employee data found.");
        //             return;
        //         }

        //         const worksheet = XLSX.utils.json_to_sheet(employees);
        //         const workbook = XLSX.utils.book_new();
        //         XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

        //         const filePath = path.join(__dirname, "employee_list.xlsx");
        //         XLSX.writeFile(workbook, filePath);

        //         console.log("✅ Excel file saved successfully:", filePath);
        //     } catch (error) {
        //         console.error("❌ Failed to generate Excel:", error);
        //     }
        // };

        // exportAllEmployeesToExcel();
        // *******************************************************************************************
        // *******************************************************************************************
        const date = moment(new Date()).format("DD-MMM-YYYY");

        // *******************************************************************************************
        app.post("/addExpense", async (req, res) => {
            try {
                const expenseData = req.body;
                const mail = req.body.userMail;
                const existingCategory = await categoryCollections.findOne({ expenseCategory: expenseData.expenseCategory });

                if (!existingCategory) {
                    await categoryCollections.insertOne({ expenseCategory: expenseData.expenseCategory });
                }
                const availableBalance = await hrBalanceCollections.findOne();
                const availableMainBalance = await mainBalanceCollections.findOne();
                const expenseBalance = expenseData.expenseAmount;

                const userRole = await userCollections.findOne({ email: mail });

                if (userRole.role == "HR-ADMIN") {
                    if (availableBalance.balance >= expenseBalance) {
                        const addExpense = await expenseCollections.insertOne(expenseData);
                        await hrBalanceCollections.updateOne(
                            {},
                            {
                                $inc: { balance: - expenseBalance }
                            });
                        await hrTransactionCollections.insertOne({ value: expenseBalance, note: expenseData.expenseNote, date, type: "Expense" });
                        res.send(addExpense);
                    } else {
                        res.json('Insufficient balance');
                    }
                } else {
                    if (availableMainBalance.mainBalance >= expenseBalance) {
                        const addExpense = await expenseCollections.insertOne(expenseData);
                        await mainBalanceCollections.updateOne(
                            {},
                            {
                                $inc: { mainBalance: - expenseBalance }
                            });
                        await mainTransactionCollections.insertOne({ amount: expenseBalance, note: expenseData.expenseNote, date, type: "Expense" });
                        res.send(addExpense);
                    } else {
                        res.json('Insufficient balance');
                    }
                }

            } catch (error) {
                res.status(500).json({ message: 'Failed to add expense', error: error.message });
            }
        });
        // ************************************************************************************************
        app.post("/addHrBalance", async (req, res) => {
            try {
                const { parseValue, note } = req.body;

                const availableBalance = await mainBalanceCollections.findOne();

                if (availableBalance.mainBalance >= parseValue) {
                    await hrTransactionCollections.insertOne({ value: parseValue, note, date, type: "In" });

                    let existingBalance = await hrBalanceCollections.findOne();

                    if (existingBalance) {
                        await hrBalanceCollections.updateOne(
                            {},
                            {
                                $inc: { balance: parseValue }
                            });
                    } else {
                        // Insert a new document if no balance exists
                        await hrBalanceCollections.insertOne({ balance: parseValue });
                    }

                    // deduct the amount from main balance 
                    await mainBalanceCollections.updateOne(
                        {},
                        {
                            $inc: { mainBalance: -parseValue }
                        });

                    res.status(200).json({ message: "success" });
                } else {
                    res.json({ message: "Not enough funds" });
                }


            } catch (error) {
                res.status(500).json({ message: "Failed to add balance", error: error.message });
            }
        });

        // ************************************************************************************************
        app.post("/addMainBalance", async (req, res) => {
            try {
                const { parseValue, note } = req.body; // Assuming amount is sent in the request body
                await mainTransactionCollections.insertOne({ amount: parseValue, note, date, type: "Credit" });

                let existingBalance = await mainBalanceCollections.findOne();

                if (existingBalance) {
                    // Update the first existing document by incrementing the balance
                    await mainBalanceCollections.updateOne(
                        {},
                        {
                            $inc: { mainBalance: parseValue }
                        });
                } else {
                    // Insert a new document if no balance exists
                    await mainBalanceCollections.insertOne({ mainBalance: parseValue });
                }

                res.status(200).json({ message: "Balance added successfully" });
            } catch (error) {
                res.status(500).json({ message: "Failed to add balance", error: error.message });
            }
        });
        // ************************************************************************************************
        app.post("/createLocalOrder", async (req, res) => {
            try {
                const orderData = req.body;
                const id = req.body.clientID;

                if (id) {
                    await clientCollections.updateOne(
                        { clientID: id },
                        {
                            $push: {
                                orderHistory: orderData,
                            },
                        }
                    );
                }

                const addOrder = await localOrderCollections.insertOne(orderData);

                res.send(addOrder);

            } catch (error) {
                res.status(500).json({ message: 'Failed to add expense', error: error.message }); // Include error message in response
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
                    role: "employee",
                    userName: "",
                    profilePic: "",
                });
                const result = await employeeCollections.insertOne(employeeData);


                res.send(result);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to register employee',
                    error: error.message
                });
            }
        });
        // ************************************************************************************************
        app.post('/addEarnings', async (req, res) => {
            try {
                const earningsData = req.body;
                const date = new Date();
                const clientID = req.body.clientId;
                const fullData = { ...earningsData, date: moment(date).format("DD-MM-YYYY") };
                const earningsAmount = req.body.convertedBdt;

                const result = await earningsCollections.insertOne(fullData);


                // add earnings to main balance
                await mainBalanceCollections.updateOne(
                    {},
                    {
                        $inc: { mainBalance: earningsAmount }
                    });
                // add earnings to main transactions
                await mainTransactionCollections.insertOne({
                    amount: earningsAmount,
                    note: `Earnings from ${clientID}`,
                    date,
                    type: "Earning"
                });
                // add earnings to client history
                await clientCollections.updateOne(
                    { clientID: clientID },
                    {
                        $push: { paymentHistory: fullData }
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to add earnings',
                    error: error.message
                });
            }
        });
        // ************************************************************************************************
        app.post('/addClient', async (req, res) => {
            try {
                const { clientId, country } = req.body;

                if (!clientId || !country) {
                    return res.status(400).json({ message: 'Client ID and Country are required.' });
                }

                const existingClient = await clientCollections.findOne({ clientID: clientId });

                if (existingClient) {
                    return res.json({ message: 'This ID already exists' });
                }

                const result = await clientCollections.insertOne({
                    clientID: clientId,
                    country: country,
                    orderHistory: [],
                    paymentHistory: [],
                });

                res.status(201).json({ message: 'Client added successfully', insertedId: result.insertedId });

            } catch (error) {
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // ************************************************************************************************
        // app.post('/assign-shift', async (req, res) => {
        //     try {
        //         const { employees, shift } = req.body;
        //         console.log(employees.fullName);

        //         let entryTime;
        //         if (shift === "Morning") {
        //             entryTime = "06:00 AM";
        //         } else if (shift === "Evening") {
        //             entryTime = "02:00 PM";
        //         } else if (shift === "Night") {
        //             entryTime = "10:00 PM";
        //         } else if (shift === "General") {
        //             entryTime = "10:00 AM";
        //         }


        //         if (!employees?.length || !shift) {
        //             return res.status(400).send({ message: 'Invalid input data' });
        //         }

        //         const inserted = [];
        //         const updated = [];
        //         const skipped = [];

        //         for (const emp of employees) {
        //             const existing = await shiftingCollections.findOne({ email: emp.email });

        //             if (!existing) {
        //                 await shiftingCollections.insertOne({
        //                     fullName: emp.fullName,
        //                     email: emp.email,
        //                     shiftName: shift,
        //                     entryTime,
        //                 });
        //                 inserted.push(emp);
        //             } else if (existing.shiftName !== shift) {
        //                 await shiftingCollections.updateOne(
        //                     { email: emp.email },
        //                     {
        //                         $set: {
        //                             shiftName: shift,
        //                             entryTime,
        //                         }
        //                     }
        //                 );
        //                 updated.push(emp);
        //             } else {
        //                 skipped.push(emp);
        //             }
        //         }

        //         res.status(200).json({
        //             message: 'Shift assignment processed',
        //             insertedCount: inserted.length,
        //             updatedCount: updated.length,
        //             skippedCount: skipped.length,
        //             insertedNames: Array.isArray(inserted) ? inserted.map(e => e.fullName) : [],
        //             updatedNames: Array.isArray(updated) ? updated.map(e => e.fullName) : [],
        //             skippedNames: Array.isArray(skipped) ? skipped.map(e => e.fullName) : [],
        //         });

        //     } catch (error) {
        //         console.error('Error assigning shift:', error);
        //         res.status(500).json({ message: 'Failed to assign shift' });
        //     }
        // });
        app.post('/assign-shift', async (req, res) => {
            try {
                const { employees, shift, OTFor } = req.body;

                let entryTime;
                if (shift === "Morning") {
                    entryTime = "06:00 AM";
                } else if (shift === "Evening") {
                    entryTime = "02:00 PM";
                } else if (shift === "Night") {
                    entryTime = "10:00 PM";
                } else if (shift === "General") {
                    entryTime = "10:00 AM";
                } else if (shift === "OT list") {
                    entryTime = "10:00 AM"; // or assign custom time for OT list
                }

                if (!employees?.length || !shift) {
                    return res.status(400).send({ message: 'Invalid input data' });
                }

                const inserted = [];
                const updated = [];
                const skipped = [];

                for (const emp of employees) {
                    if (shift === "OT list") {
                        // For OT list, allow duplicate entry with same email + OT marker
                        const otEmailKey = emp.email + "_OT";
                        const alreadyInOT = await shiftingCollections.findOne({ email: otEmailKey });

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
                        const existing = await shiftingCollections.findOne({ email: emp.email });

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
                                    }
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
                    insertedNames: inserted.map(e => e.fullName),
                    updatedNames: updated.map(e => e.fullName),
                    skippedNames: skipped.map(e => e.fullName),
                });

            } catch (error) {
                res.status(500).json({ message: 'Failed to assign shift' });
            }
        });

        // ************************************************************************************************
        app.post('/addProfitShareData', async (req, res) => {
            try {
                const shareData = req.body;
                const { month, year, sharedProfitBalance } = shareData;

                const date = new Date().toISOString(); // Ensure date is defined
                const profitShareData = { ...shareData, date };

                // Check if enough profit is available for the selected month
                const monthDoc = await monthlyProfitCollections.findOne({ month, year });

                if (!monthDoc) {
                    return res.json({
                        message: `No profit record found for ${month} ${year}`
                    });
                }

                if (parseFloat(monthDoc.profit) < parseFloat(sharedProfitBalance)) {
                    return res.json({
                        message: `Insufficient profit balance. Available: ${monthDoc.profit}, Requested: ${sharedProfitBalance}`
                    });
                }

                // Insert profit share record
                const result = await profitShareCollections.insertOne(profitShareData);

                // Deduct from main balance
                await mainBalanceCollections.updateOne(
                    {},
                    { $inc: { mainBalance: -sharedProfitBalance } }
                );

                // Deduct from selected month's profit
                await monthlyProfitCollections.updateOne(
                    { month, year },
                    { $inc: { profit: -sharedProfitBalance } }
                );

                // Log to HR transactions
                await hrTransactionCollections.insertOne({
                    value: sharedProfitBalance,
                    note: `Profit share for ${month} ${year}`,
                    date,
                    type: 'Share'
                });

                res.send(result);

            } catch (error) {
                console.error('Error sharing profit:', error);
                res.status(500).json({ message: 'Failed to share profit' });
            }
        });

        //************************************************************************************************
        app.post('/employee/checkIn', async (req, res) => {
            const checkInInfo = req.body;

            try {

                // Check if the user already checked in today
                const existingCheckIn = await checkInCollections.findOne({
                    email: checkInInfo.email,
                    date: checkInInfo.date, // match by email and today's date
                });

                if (existingCheckIn) {
                    return res.json({ message: 'Already checked in today' });
                };

                const shiftInfo = await shiftingCollections.findOne({ email: checkInInfo.email });


                const now = moment().tz("Asia/Dhaka"); // BD time
                const initialMorningShift = now.clone().startOf('day').add(5, 'hours').add(45, 'minutes').valueOf();
                const morningShiftStart = now.clone().startOf('day').add(6, 'hours').add(0, 'minutes').valueOf();
                const morningShiftLateCount = now.clone().startOf('day').add(6, 'hours').add(30, 'minutes').valueOf();

                const initialGeneralShift = now.clone().startOf('day').add(9, 'hours').add(45, 'minutes').valueOf();
                const generalShiftStart = now.clone().startOf('day').add(10, 'hours').add(0, 'minutes').valueOf();
                const generalShiftLateCount = now.clone().startOf('day').add(10, 'hours').add(30, 'minutes').valueOf();

                const InitialEveningShift = now.clone().startOf('day').add(13, 'hours').add(45, 'minutes').valueOf();
                const eveningShiftStart = now.clone().startOf('day').add(14, 'hours').add(5, 'minutes').valueOf();
                const eveningShiftStartForLateCount = now.clone().startOf('day').add(14, 'hours').add(5, 'minutes').valueOf();
                const eveningShiftLateCount = now.clone().startOf('day').add(17, 'hours').add(30, 'minutes').valueOf();



                if (shiftInfo.shiftName === "Morning" && now >= initialMorningShift && now <= morningShiftStart) {

                    const result = await checkInCollections.insertOne(checkInInfo);

                    if (result.insertedId) {
                        res.status(200).json({ message: 'Check-in successful' });
                    } else {
                        res.json({ message: 'Check-in failed' });
                    }
                } else if (shiftInfo.shiftName === "Morning" && now > morningShiftStart && now <= morningShiftLateCount) {
                    const lateCount = now - morningShiftStart;
                    const totalSeconds = Math.floor(lateCount / 1000);
                    const hours = Math.floor(totalSeconds / 3600) || 0;
                    const minutes = Math.floor((totalSeconds % 3600) / 60) || 0;
                    const lateCountDisplay = `${hours}h ${minutes}m`;

                    const result = await checkInCollections.insertOne({ ...checkInInfo, lateCheckIn: `${lateCountDisplay}` });

                    if (result.insertedId) {
                        res.status(200).json({ message: 'You are late today' });
                    } else {
                        res.json({ message: 'Check-in failed' });
                    }
                } else if (shiftInfo.shiftName === "General" && now >= initialGeneralShift && now <= generalShiftStart) {

                    const result = await checkInCollections.insertOne(checkInInfo);

                    if (result.insertedId) {
                        res.status(200).json({ message: 'Check-in successful' });
                    } else {
                        res.json({ message: 'Check-in failed' });
                    }
                } else if (shiftInfo.shiftName === "General" && now > generalShiftStart && now <= generalShiftLateCount) {
                    const lateCount = now - generalShiftStart; // Calculate how late the check-in is
                    const totalSeconds = Math.floor(lateCount / 1000);
                    const hours = Math.floor(totalSeconds / 3600) || 0;
                    const minutes = Math.floor((totalSeconds % 3600) / 60) || 0;
                    const lateCountDisplay = `${hours}h ${minutes}m`;

                    const result = await checkInCollections.insertOne({ ...checkInInfo, lateCheckIn: `${lateCountDisplay}` });

                    if (result.insertedId) {
                        res.status(200).json({ message: 'You are late today' });
                    } else {
                        res.json({ message: 'Check-in failed' });
                    }
                } else if (shiftInfo.shiftName === "Evening" && now > InitialEveningShift && now <= eveningShiftStart) {

                    const result = await checkInCollections.insertOne(checkInInfo);

                    if (result.insertedId) {
                        res.status(200).json({ message: 'Check-in successful' });
                    } else {
                        res.json({ message: 'Check-in failed' });
                    }
                } else if (shiftInfo.shiftName === "Evening" && now > eveningShiftStart && now <= eveningShiftLateCount) {
                    const lateCount = now - eveningShiftStartForLateCount;

                    const totalSeconds = Math.floor(lateCount / 1000);
                    const hours = Math.floor(totalSeconds / 3600) || 0;
                    const minutes = Math.floor((totalSeconds % 3600) / 60) || 0;
                    const lateCountDisplay = `${hours}h ${minutes}m`;

                    const result = await checkInCollections.insertOne({ ...checkInInfo, lateCheckIn: `${lateCountDisplay}` });

                    if (result.insertedId) {
                        res.status(200).json({ message: 'You are late today' });
                    } else {
                        res.json({ message: 'Check-in failed' });
                    }
                } else {
                    return res.json({ message: 'You are not eligible to check in at this time' });
                }

            } catch (error) {
                res.status(500).json({ message: 'Failed to check in', error: error.message });
            }
        });



        // ************************************************************************************************
        app.post('/employee/checkOut', async (req, res) => {
            const checkOutInfo = req.body;
            const email = req.body.email; // Assuming email is part of checkOutInfo
            const date = req.body.date; // Assuming date is part of checkOutInfo

            const checkInInfo = await checkInCollections.findOne({ email, date });
            const employee = await employeeCollections.findOne({ email });
            const isAttendance = await attendanceCollections.findOne({ email, date });
            const startOTInfo = await OTStartCollections.findOne({ email, date });
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

                const result = await checkOutCollections.insertOne(checkOutInfo);

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
                                    lateCheckIn: checkInInfo.lateCheckIn || false, // Preserve lateCheckIn status
                                }
                            }
                        );
                    } else {
                        await attendanceCollections.insertOne(attendanceData);
                        res.status(200).json({ message: 'Check-out successful' });
                    }

                } else {
                    res.status(500).json({ message: 'Check-out failed' });
                }
            } catch (error) {
                res.status(500).json({ message: 'Failed to check out', error: error.message });
            }
        });
        // ************************************************************************************************
        app.post('/employee/startOverTime', async (req, res) => {
            const { date, month, startingOverTime, displayTime, signInTime, email } = req.body; // Assuming email is part of checkOutInfo

            try {

                const isInOT = await shiftingCollections.findOne({ actualEmail: email, shiftName: "OT list" });
                if (!isInOT) {
                    return res.json({ message: 'You are not in OT list' });
                }


                const result = await OTStartCollections.insertOne({ date, month, startingOverTime, displayTime, signInTime, email, OTFor: isInOT.OTFor });

                if (result.insertedId) {
                    res.status(200).json({ message: 'Over time started' });
                } else {
                    res.status(500).json({ message: 'Over time started failed' });
                }
            } catch (error) {
                res.status(500).json({ message: 'Failed to start OT', error: error.message });
            }
        });
        // ************************************************************************************************
        app.post('/employee/stopOverTime', async (req, res) => {
            const { date, month, OTStopTime, displayTime, email } = req.body;


            const startOTInfo = await OTStartCollections.findOne({ email, date });
            const isAttendance = await attendanceCollections.findOne({ email, date });

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

                const result = await OTStopCollections.insertOne({ date, month, OTStopTime, displayTime, email });

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
                                }
                            }
                        );
                        res.status(200).json({ message: 'OT stop successful' });
                    } else {
                        await attendanceCollections.insertOne(OTCountingData);
                        res.status(200).json({ message: 'OT stop successful' });
                    }
                    await shiftingCollections.deleteOne({ actualEmail: email, shiftName: "OT list" });

                } else {
                    res.status(500).json({ message: 'OT stop failed' });
                }
            } catch (error) {
                res.status(500).json({ message: 'Failed to stop OT', error: error.message });
            }
        });
        // ************************************************************************************************







        app.put("/orderStatusChange/:orderId", async (req, res) => {
            try {
                const id = req.params.orderId;

                // Check if the order exists
                const isID = await localOrderCollections.findOne({ _id: new ObjectId(id) });

                if (!isID) {
                    return res.status(404).json({ message: "Order not found" });
                }

                // Update the order status to "In-progress"
                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { orderStatus: "In-progress" } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({ message: "Failed to update order status" });
            }
        });
        // ************************************************************************************************
        app.put("/orderStatusDelivered/:orderId", async (req, res) => {
            try {
                const id = req.params.orderId;

                const isID = await localOrderCollections.findOne({ _id: new ObjectId(id) });

                if (!isID) {
                    return res.status(404).json({ message: "Order not found" });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            orderStatus: "Delivered",
                        }
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({ message: "Failed to update order status" });
            }
        });
        // *****************************************************************************************
        app.put("/modifyOrderToInitial/:orderId", async (req, res) => {
            try {
                const id = req.params.orderId;

                const isID = await localOrderCollections.findOne({ _id: new ObjectId(id) });

                if (!isID) {
                    return res.status(404).json({ message: "Order not found" });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            orderStatus: "Reviewing",
                        }
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({ message: "Failed to update order status" });
            }
        });
        // *****************************************************************************************
        app.put("/orderStatusQC/:orderId", async (req, res) => {
            try {
                const id = req.params.orderId;

                const isID = await localOrderCollections.findOne({ _id: new ObjectId(id) });

                if (!isID) {
                    return res.status(404).json({ message: "Order not found" });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            orderStatus: "Ready to QC",
                        }
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({ message: "Failed to update order status" });
            }
        });
        // *****************************************************************************************
        app.put("/orderStatusHold/:orderId", async (req, res) => {
            try {
                const id = req.params.orderId;
                const { completeTime, lastUpdated } = req.body; // Time when hold was triggered

                const isID = await localOrderCollections.findOne({ _id: new ObjectId(id) });

                if (!isID) {
                    return res.status(404).json({ message: "Order not found" });
                }

                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            orderStatus: "Hold",
                            completeTime,
                            lastUpdated,
                        }
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({ message: "Failed to update order status" });
            }
        });
        // *****************************************************************************************

        app.put("/editExpense/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const {
                    userName,
                    expenseDate,
                    expenseName,
                    expenseCategory,
                    expenseAmount,
                    expenseStatus,
                    expenseNote
                } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: "Invalid expense ID" });
                }

                // Fetch existing expense
                const existingExpense = await expenseCollections.findOne({ _id: new ObjectId(id) });

                if (!existingExpense) {
                    return res.status(404).json({ message: "Expense not found" });
                }

                // Prepare update object
                let updateData = {};

                if (expenseDate && expenseDate !== existingExpense.expenseDate) updateData.expenseDate = expenseDate;
                if (expenseName && expenseName !== existingExpense.expenseName) updateData.expenseName = expenseName;
                if (expenseCategory && expenseCategory !== existingExpense.expenseCategory) updateData.expenseCategory = expenseCategory;
                if (expenseAmount && expenseAmount !== existingExpense.expenseAmount) updateData.expenseAmount = expenseAmount;
                if (expenseStatus && expenseStatus !== existingExpense.expenseStatus) updateData.expenseStatus = expenseStatus;
                if (expenseNote && expenseNote !== existingExpense.expenseNote) updateData.expenseNote = expenseNote;

                // If no updates are needed
                if (Object.keys(updateData).length === 0) {
                    return res.status(200).json({ message: "No changes detected" });
                }

                // Update expense record
                const result = await expenseCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                if (result.modifiedCount === 0) {
                    return res.status(400).json({ message: "Failed to update expense" });
                }

                // Update balance only if expenseAmount has changed
                if (expenseAmount && expenseAmount !== existingExpense.expenseAmount) {
                    const balanceChange = existingExpense.expenseAmount - expenseAmount;

                    await hrBalanceCollections.updateOne(
                        {},
                        { $inc: { balance: balanceChange } }
                    );
                }

                res.status(200).json({ message: "Expense updated successfully" });

            } catch (error) {
                res.status(500).json({ message: "Server error" });
            }
        });

        // *****************************************************************************************
        app.put("/returnHrBalance", async (req, res) => {
            try {
                const { parseValue, note } = req.body;

                const availableBalance = await hrBalanceCollections.findOne();

                if (availableBalance.balance >= parseValue) {
                    await hrBalanceCollections.updateOne(
                        {},
                        {
                            $inc: { balance: -parseValue }
                        });




                    // add the amount in main balance 
                    await mainBalanceCollections.updateOne(
                        {},
                        {
                            $inc: { mainBalance: parseValue }
                        });

                    await hrTransactionCollections.insertOne({ value: parseValue, note, date, type: "Out" });

                    res.status(200).json({ message: "success" });
                } else {
                    res.json({ message: "unsuccess" });
                }


            } catch (error) {
                res.status(500).json({ message: "Failed to add balance", error: error.message });
            }
        });
        // *****************************************************************************************
        app.put('/clients/:id', async (req, res) => {
            try {
                const clientId = req.params.id; // original client ID from the URL
                const { clientId: newClientId, clientCountry: newCountry } = req.body;

                if (!newClientId || !newCountry) {
                    return res.json({ message: 'Client ID and Country are required.' });
                }

                // Check if newClientId already exists in another document (prevent duplicate IDs)
                if (clientId !== newClientId) {
                    const existingClient = await clientCollections.findOne({ clientID: newClientId });
                    if (existingClient) {
                        return res.json({ message: 'The new Client ID already exists.' });
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

                res.json({ message: 'Client updated successfully', modifiedCount: result.modifiedCount });

            } catch (error) {
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // *****************************************************************************************
        app.put("/extendDeadline/:orderId", async (req, res) => {
            try {
                const id = req.params.orderId;
                const { newDeadline } = req.body; // Assuming new deadline is passed in the request body


                // Check if the order exists
                const isID = await localOrderCollections.findOne({ _id: new ObjectId(id) });

                if (!isID) {
                    return res.status(404).json({ message: "Order not found" });
                }

                // Update the order status to "In-progress"
                const result = await localOrderCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { orderDeadLine: newDeadline } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).json({ message: "Failed to update order status" });
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
                    { email: email },               // find by email
                    { $set: updateData }            // update the fields
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({ message: 'Employee not found or no changes made' });
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
                const result = await shiftingCollections.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 1) {
                    res.json({ message: 'success' });
                } else {
                    res.json({ message: 'fail' });
                }
            } catch (error) {
                res.status(500).json({ message: 'Failed to remove OT', error: error.message });
            }
        });

        // ************************************************************************************************
        // ************************************************************************************************


        // ************************************************************************************************
        app.get("/getCurrentUser", verifyToken, async (req, res) => {
            try {
                const requestedEmail = req.query.userEmail;  // If this is a separate check
                const tokenEmail = req.user.email;


                if (requestedEmail !== tokenEmail) {
                    return res.status(403).send({ message: "Forbidden Access" }); // 403 is more appropriate here
                }

                const user = await userCollections.findOne({ email: requestedEmail });

                if (!user) {
                    return res.status(404).send({ message: "User not found" });
                }

                res.send(user);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch user' });
            }
        });
        // ************************************************************************************************
        app.get("/getExpense", verifyToken, async (req, res) => {
            try {
                if (!req.user || !req.user.email) {
                    return res.status(401).send({ message: "Unauthorized Access" });
                }

                const userMail = req.query.userEmail;
                const email = req.user.email;
                if (userMail !== email) {
                    return res.status(403).send({ message: "Forbidden Access" });
                }

                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 10;
                const search = req.query.search || "";
                const disablePagination = req.query.disablePagination === "true";

                let numericSearch = parseFloat(search);
                numericSearch = isNaN(numericSearch) ? null : numericSearch;

                const query = search
                    ? {
                        $or: [
                            { userName: { $regex: new RegExp(search, "i") } },
                            { expenseName: { $regex: new RegExp(search, "i") } },
                            { expenseCategory: { $regex: new RegExp(search, "i") } },
                            { expenseStatus: { $regex: new RegExp(search, "i") } },
                            { expenseNote: { $regex: new RegExp(search, "i") } },
                            { expenseDate: { $regex: new RegExp(search, "i") } },
                            ...(numericSearch !== null ? [{ expenseAmount: numericSearch }] : []),
                        ],
                    }
                    : {};

                if (!expenseCollections) {
                    return res.status(500).json({ message: "Database connection issue" });
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
                res.status(500).json({ message: 'Failed to fetch expense', error: error.message });
            }
        });


        // ************************************************************************************************
        app.get("/getLocalOrder", verifyToken, async (req, res) => {
            try {
                if (!req.user || !req.user.email) {
                    return res.status(401).send({ message: "Unauthorized Access" });
                }

                const userMail = req.query.userEmail;
                const email = req.user.email;
                if (userMail !== email) {
                    return res.status(403).send({ message: "Forbidden Access" });
                }

                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 10;
                const search = req.query.search || "";

                const disablePagination = req.query.disablePagination === "true";

                let numericSearch = parseFloat(search);
                numericSearch = isNaN(numericSearch) ? null : numericSearch;

                const query = search
                    ? {
                        $or: [
                            { userName: { $regex: new RegExp(search, "i") } },
                            { clientID: { $regex: new RegExp(search, "i") } },
                            { orderName: { $regex: new RegExp(search, "i") } },
                            { orderQTY: { $regex: new RegExp(search, "i") } },
                            { orderStatus: { $regex: new RegExp(search, "i") } },
                            ...(numericSearch !== null ?
                                [
                                    { orderPrice: numericSearch },
                                ]
                                : []),
                        ],
                    }
                    : {};

                if (!localOrderCollections) {
                    return res.status(500).json({ message: "Database connection issue" });
                }

                let orders;
                if (disablePagination) {
                    orders = await localOrderCollections
                        .find(query)
                        .sort({ _id: -1 })
                        .toArray();
                } else {
                    orders = await localOrderCollections
                        .find(query)
                        .skip((page - 1) * size)
                        .limit(size)
                        .sort({ _id: -1 })
                        .toArray();
                }

                const count = await localOrderCollections.countDocuments(query);
                // const result = await localOrderCollections.find({}).sort({ _id: -1 }).toArray();
                res.send({ orders, count });
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch expense' });
            }
        });

        // ************************************************************************************************
        app.get("/getSingleOrder/:orderId", verifyToken, async (req, res) => {
            try {
                const id = req.params.orderId;
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await localOrderCollections.findOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch expense' });
            }
        });
        // ************************************************************************************************
        app.get("/getClientID", verifyToken, async (req, res) => {

            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await clientCollections.find().toArray();
                res.send(result);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch client' });
            }
        });
        // ************************************************************************************************
        app.get("/getMainBalance", verifyToken, async (req, res) => {

            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await mainBalanceCollections.find().toArray();
                res.send(result[0]);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch balance' });
            }
        });
        // ************************************************************************************************
        app.get("/getHrBalance", verifyToken, async (req, res) => {

            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await hrBalanceCollections.find().toArray();
                const balance = result[0].balance;
                const hrTransaction = await hrTransactionCollections.find().toArray();

                const expense = await expenseCollections.find().toArray(); //send expense here to decrease API call (in context API)

                res.send({ balance, hrTransaction, expense });

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch balance' });
            }
        });
        // ************************************************************************************************
        app.get("/getClient", verifyToken, async (req, res) => {

            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await clientCollections.find().sort({ _id: -1 }).toArray();

                res.send(result);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch balance' });
            }
        });
        // ************************************************************************************************
        //getEarnings
        app.get("/getEarnings", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 10;
                const search = req.query.search || "";
                const selectedMonth = req.query.month || "";

                const query = {
                    ...(search && {
                        $or: [
                            { clientId: { $regex: new RegExp(search, 'i') } },
                            { status: { $regex: new RegExp(search, 'i') } },
                            { month: { $regex: new RegExp(search, 'i') } },
                            { date: { $regex: new RegExp(search, 'i') } },
                        ],
                    }),
                    ...(selectedMonth && { month: selectedMonth })
                };

                const totalCount = await earningsCollections.countDocuments(query);

                const result = await earningsCollections.find(query)
                    .skip((page - 1) * size)
                    .limit(size)
                    .sort({ _id: -1 })
                    .toArray();

                const totalRev = await earningsCollections.find().toArray();

                const totals = await earningsCollections.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalImageQty: { $sum: "$imageQty" },
                            totalUsd: { $sum: "$totalUsd" },
                            totalRate: { $sum: "$convertRate" },
                            totalBdt: { $sum: "$convertedBdt" },
                            countRate: { $sum: 1 }
                        }
                    }
                ]).toArray();

                res.send({
                    result,
                    totalRev,
                    count: totalCount,
                    totalSummary: {
                        totalImageQty: totals[0]?.totalImageQty || 0,
                        totalUsd: totals[0]?.totalUsd || 0,
                        avgRate: totals[0]?.totalRate / (totals[0]?.countRate || 1),
                        totalBdt: totals[0]?.totalBdt || 0,
                    }
                });

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch earnings', error: error.message });
            }
        });

        //earnings


        // ************************************************************************************************
        app.get("/getEmployee", verifyToken, async (req, res) => {

            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const findEmployee = await employeeCollections.findOne({ email: userMail });

                // const result = await earningsCollections.find().toArray();

                res.send(findEmployee);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch balance' });
            }
        });
        // ************************************************************************************************
        app.get("/getEmployeeList", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;
                const search = req.query.search || "";

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const query = search
                    ? {
                        $or: [
                            { fullName: { $regex: search, $options: "i" } },
                            { email: { $regex: search, $options: "i" } },
                            { phoneNumber: { $regex: search, $options: "i" } },
                            { designation: { $regex: search, $options: "i" } }
                        ]
                    }
                    : {};

                const findEmployeeList = await employeeCollections
                    .find(query)
                    .sort({ _id: -1 })
                    .toArray();

                res.send(findEmployeeList);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch employee list' });
            }
        });

        // ************************************************************************************************
        app.get("/gethShiftedEmployee", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;
                const search = req.query.search || "";

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const findEmployeeList = await shiftingCollections
                    .find()
                    .sort()
                    .toArray();

                res.send(findEmployeeList);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch employee list' });
            }
        });
        // ************************************************************************************************
        app.get("/getProfit", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const earnings = await earningsCollections.find().toArray();
                const totalEarnings = earnings.reduce((acc, earning) => acc + Number(earning.convertedBdt), 0);

                const expense = await expenseCollections.find().toArray();
                const totalExpense = expense.reduce((acc, exp) => acc + Number(exp.expenseAmount), 0);

                const profit = parseFloat(totalEarnings) - parseFloat(totalExpense);
                res.send({ totalEarnings, totalExpense, profit });

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch employee list' });
            }
        });

        // *************************************************************************************************
        app.get("/getShareHolders", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await shareHoldersCollections.find().toArray();
                res.send(result);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch share holders list' });
            }
        });

        // ***********************getShareholderInfo*******************************************************
        app.get("/getShareholderInfo", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await profitShareCollections.find().toArray();
                res.send(result);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch share holders list' });
            }
        });
        // ************************************************************************************************
        app.get("/getCheckInInfo", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const date = req.query.date || moment(new Date()).format("DD-MMM-YYYY");
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                };
                const isExist = await checkInCollections.findOne({ email: userMail, date: date });
                res.send(isExist);



            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch check-in time' });
            }
        });
        // ************************************************************************************************
        app.get("/getCheckOutInfo", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const date = req.query.date || moment(new Date()).format("DD-MMM-YYYY");
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                };
                const isExist = await checkOutCollections.findOne({ email: userMail, date: date });
                res.send(isExist);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch check-in time' });
            }
        });
        // ************************************************************************************************
        app.get("/getStartOTInfo", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const date = req.query.date || moment(new Date()).format("DD-MMM-YYYY");
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                };
                const isExist = await OTStartCollections.findOne({ email: userMail, date: date });

                res.send(isExist);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch check-in time' });
            }
        });
        // ************************************************************************************************
        app.get("/getStopOTTime", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const date = req.query.date || moment(new Date()).format("DD-MMM-YYYY");
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                };
                const isExist = await OTStopCollections.findOne({ email: userMail, date: date });
                res.send(isExist);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch check-in time' });
            }
        });
        // ************************************************************************************************
        app.get("/getAttendance", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;


                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await attendanceCollections
                    .find({ email: userMail })
                    .sort({ _id: -1 }) // Ensures latest 7 by creation time
                    .limit(7)
                    .toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching attendance:", error.message);
                res.status(500).json({ message: "Failed to fetch attendance" });
            }
        });


        // ************************************************************************************************
        app.get("/gethWorkingShift", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const findShifting = await shiftingCollections.findOne({ email: userMail });

                res.send(findShifting.shiftName || "No Shift Assigned");

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch employee list' });
            }
        });
        // ************************************************************************************************
        app.get("/getSalaryAndPF", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;



                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await PFAndSalaryCollections
                    .find({ email: userMail })
                    .toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching attendance:", error.message);
                res.status(500).json({ message: "Failed to fetch attendance" });
            }
        });
        // ************************************************************************************************
        // Get a single shareholder by ID
        app.get("/getSingleShareholder/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const objectId = new ObjectId(id);

                const isShareholder = await shareHoldersCollections.findOne({ _id: objectId });
                const shareholder = await profitShareCollections.find({ email: isShareholder.email }).toArray();

                if (!shareholder) {
                    return res.status(404).json({ message: 'Shareholder not found' });
                }

                res.send(shareholder);
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch shareholder', error: error.message });
            }
        });

        // ************************************************************************************************
        app.get("/getMonthlyProfit", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await monthlyProfitCollections.find().toArray();
                res.send(result);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch share holders list' });
            }
        });
        // ************************************************************************************************
        app.post('/addMonthlyProfitDistribution', async (req, res) => {
            try {
                const { month, year, sharedAmount, userName } = req.body;
                const date = new Date();

                const monthDoc = await monthlyProfitCollections.findOne({ month, year });
                if (!monthDoc) {
                    return res.json({ message: `No profit record found for ${month} ${year}` });
                }

                if (parseFloat(monthDoc.profit) < parseFloat(sharedAmount)) {
                    return res.json({
                        message: `Insufficient profit balance. Available: ${monthDoc.profit}, Requested: ${sharedAmount}`
                    });
                }

                const shares = [
                    { email: 'asad4boss@gmail.com', percent: 36 },
                    { email: 'masumkamal2024@gmail.com', percent: 22 },
                    { email: 'arifulislamarif1971@gmail.com', percent: 22 },
                    { email: 'kabiritnext@gmail.com', percent: 10 },
                    { email: 'asad4graphics@gmail.com', percent: 10 }
                ];

                // Fetch full shareholder info from DB (assuming you have their data stored)
                const shareholders = await shareHoldersCollections.find({
                    email: { $in: shares.map(s => s.email) }
                }).toArray();

                const shareData = shares.map(s => {
                    const holder = shareholders.find(h => h.email === s.email);
                    return {
                        name: holder?.shareHoldersName || '',
                        mobile: holder?.mobile || '',
                        email: s.email,
                        sharedPercent: s.percent,
                        sharedProfitBalance: parseFloat((sharedAmount * s.percent / 100).toFixed(2)),
                        totalProfitBalance: parseFloat(monthDoc.profit),
                        month,
                        year,
                        date,
                        userName
                    };
                });

                const result = await profitShareCollections.insertMany(shareData);

                await monthlyProfitCollections.updateOne(
                    { month, year },
                    { $inc: { profit: -sharedAmount } }
                );

                res.send({ message: 'Profit shared successfully', insertedCount: result.insertedCount });
            } catch (error) {
                res.json({ message: 'Failed to share monthly profit' });
            }
        });

        // ************************************************************************************************
        app.post('/transferMonthlyProfit', async (req, res) => {
            try {
                const { month, year, transferAmount, userName } = req.body;
                const date = new Date();

                const monthDoc = await monthlyProfitCollections.findOne({ month, year });
                if (!monthDoc) {
                    return res.json({ message: `No profit record found for ${month} ${year}` });
                }

                if (parseFloat(monthDoc.profit) < parseFloat(transferAmount)) {
                    return res.json({
                        message: `Insufficient profit balance. Available: ${monthDoc.profit}, Requested: ${sharedAmount}`
                    });
                }

                const shareholder = await shareHoldersCollections.findOne({ email: 'asadexpert1@gmail.com' });


                const result = await profitShareCollections.insertOne({
                    name: shareholder?.shareHoldersName || '',
                    mobile: shareholder?.mobile || '',
                    email: 'asadexpert1@gmail.com',
                    transferProfitBalance: parseFloat(transferAmount),
                    totalProfitBalance: parseFloat(monthDoc.profit),
                    month,
                    year,
                    date,
                    userName
                });

                await monthlyProfitCollections.updateOne(
                    { month, year },
                    { $inc: { profit: -transferAmount } }
                );

                res.send({ message: 'Profit transfer successfully', insertedId: result.insertedId });
            } catch (error) {
                console.error(error);
                res.json({ message: 'Failed to transfer monthly profit' });
            }
        });
        // ************************************************************************************************
        app.get('/calculateMonthlyProfit', async (req, res) => {
            try {
                const allEarnings = await earningsCollections.find().toArray();
                const allExpenses = await expenseCollections.find().toArray();

                const profitByMonth = {};

                const monthMap = {
                    'January': 1, 'February': 2, 'March': 3, 'April': 4,
                    'May': 5, 'June': 6, 'July': 7, 'August': 8,
                    'September': 9, 'October': 10, 'November': 11, 'December': 12
                };

                // Process Earnings using 'month' and fallback 'date' for year
                for (const earn of allEarnings) {
                    if (!earn?.month) {
                        console.log("Skipping earning due to missing month:", earn);
                        continue;
                    }

                    const rawMonth = earn.month.toString().trim();
                    const capitalizedMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();
                    const monthIndex = monthMap[capitalizedMonth];

                    let year = earn.year?.toString().trim();

                    if (!year && earn.date && typeof earn.date === 'string') {
                        const parts = earn.date.split('-'); // Expecting DD-MM-YYYY
                        if (parts.length === 3) {
                            year = parts[2];
                        }
                    }

                    if (!monthIndex || !year) {
                        console.log("Skipping earning due to invalid month or year:", earn);
                        continue;
                    }

                    const key = `${monthIndex}-${year}`;

                    if (!profitByMonth[key]) {
                        profitByMonth[key] = { earnings: 0, expense: 0 };
                    }

                    const value = Number(earn.convertedBdt) || 0;
                    profitByMonth[key].earnings += value;
                    console.log(`Earning added for ${key}: +${value}`);
                }

                // Process Expenses using expenseDate
                for (const exp of allExpenses) {
                    if (!exp?.expenseDate) continue;
                    const expDate = new Date(exp.expenseDate);
                    if (isNaN(expDate.getTime())) continue;

                    const month = expDate.getMonth() + 1; // JS month is 0-indexed
                    const year = expDate.getFullYear();
                    const key = `${month}-${year}`;

                    if (!profitByMonth[key]) {
                        profitByMonth[key] = { earnings: 0, expense: 0 };
                    }

                    profitByMonth[key].expense += Number(exp.expenseAmount) || 0;
                }

                const documents = [];
                for (const key in profitByMonth) {
                    const [month, year] = key.split('-');
                    const monthName = new Date(`${year}-${month}-01`).toLocaleString('default', { month: 'long' });
                    const earnings = parseFloat(profitByMonth[key].earnings.toFixed(2));
                    const expense = parseFloat(profitByMonth[key].expense.toFixed(2));
                    const profit = parseFloat((earnings - expense).toFixed(2));

                    documents.push({
                        month: monthName,
                        year,
                        earnings,
                        expense,
                        profit
                    });
                }

                const insertResult = await monthlyProfitCollections.insertMany(documents);

                res.send({
                    message: 'Monthly profit calculated and stored successfully.',
                    insertedCount: insertResult.insertedCount,
                    data: documents
                });
            } catch (error) {
                res.status(500).send({ message: 'Error calculating and storing profit', error: error.message });
            }
        });
        //calculate and store monthly profit






        // ************************************************************************************************




        app.post('/uploadProfilePic', upload.single('image'), async (req, res) => {
            try {
                const userEmail = req.body.email;
                const fileBuffer = req.file?.buffer;


                if (!fileBuffer || !userEmail) {
                    return res.status(400).send({ error: 'Missing file or email' });
                }

                const imageUrl = await uploadToCloudinary(fileBuffer);

                const updateResult = await employeeCollections.updateOne(
                    { email: userEmail },
                    { $set: { photo: imageUrl } }
                );

                if (updateResult.modifiedCount === 0) {
                    return res.status(404).send({ error: 'Employee not found' });
                }

                res.send({ message: 'Image uploaded successfully', url: imageUrl });
            } catch (error) {
                res.status(500).send({ error: 'Image upload failed' });
            }
        });
        // ************************************************************************************************
        app.post('/addShareHolder', async (req, res) => {
            try {
                const data = req.body;
                const result = await shareHoldersCollections.insertOne(data);
                res.send(result);
            } catch (err) {
                res.status(500).json({ message: "Error adding shareholder" });
            }
        });

        // ************************************************************************************************

        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
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