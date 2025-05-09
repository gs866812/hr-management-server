const express = require("express");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const moment = require("moment");
require('dotenv').config();
const multer = require('multer');
const { uploadToCloudinary } = require("./uploadPhoto");


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
        // *******************************************************************************************
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
                const expenseBalance = expenseData.expenseAmount;

                const userRole = await userCollections.findOne({ email: mail });

                if (userRole.role == "hr_admin") {
                    if (availableBalance.balance >= expenseBalance) {
                        const addExpense = await expenseCollections.insertOne(expenseData);
                        await hrBalanceCollections.updateOne(
                            {},
                            {
                                $inc: { balance: - expenseBalance }
                            });
                        res.send(addExpense);
                    } else {
                        res.json('Insufficient balance');
                    }
                } else {
                    const addExpense = await expenseCollections.insertOne(expenseData);
                    res.send(addExpense);
                }

            } catch (error) {
                console.error("Error adding expense:", error);
                res.status(500).json({ message: 'Failed to add expense', error: error.message });
            }
        });
        // ************************************************************************************************
        app.post("/addHrBalance", async (req, res) => {
            try {
                const { parseValue, note, date } = req.body;

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
                const { parseValue, note, date } = req.body; // Assuming amount is sent in the request body
                await mainTransactionCollections.insertOne({ parseValue, note, date });

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
                console.error('Error saving employee:', error);
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

                // Push fullData into paymentHistory array of the matched client
                console.log('Client ID:', clientID);

                await clientCollections.updateOne(
                    { clientID: clientID },
                    {
                        $push: { paymentHistory: fullData }
                    }
                );

                res.send(result);
            } catch (error) {
                console.error('Error saving earnings:', error);
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
                console.error('Error adding client:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // ************************************************************************************************
        app.post('/assign-shift', async (req, res) => {
            try {
                const { employees, shift } = req.body;

                if (!employees?.length || !shift) {
                    return res.status(400).send({ message: 'Invalid input data' });
                }

                const inserted = [];
                const updated = [];
                const skipped = [];

                for (const emp of employees) {
                    const existing = await shiftingCollections.findOne({ email: emp.email });

                    if (!existing) {
                        await shiftingCollections.insertOne({
                            fullName: emp.fullName,
                            email: emp.email,
                            shiftName: shift
                        });
                        inserted.push(emp);
                    } else if (existing.shiftName !== shift) {
                        await shiftingCollections.updateOne(
                            { email: emp.email },
                            { $set: { shiftName: shift } }
                        );
                        updated.push(emp);
                    } else {
                        skipped.push(emp);
                    }
                }

                res.status(200).json({
                    message: 'Shift assignment processed',
                    insertedCount: inserted.length,
                    updatedCount: updated.length,
                    skippedCount: skipped.length,
                    insertedNames: Array.isArray(inserted) ? inserted.map(e => e.fullName) : [],
                    updatedNames: Array.isArray(updated) ? updated.map(e => e.fullName) : [],
                    skippedNames: Array.isArray(skipped) ? skipped.map(e => e.fullName) : [],
                });

            } catch (error) {
                console.error('Error assigning shift:', error);
                res.status(500).json({ message: 'Failed to assign shift' });
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
                console.error(error);
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
                console.error(error);
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
                console.error(error);
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
                console.error(error);
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
                console.error(error);
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
                console.error("Error updating expense:", error);
                res.status(500).json({ message: "Server error" });
            }
        });

        // *****************************************************************************************
        app.put("/returnHrBalance", async (req, res) => {
            try {
                const { parseValue, note, date } = req.body;

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
                console.error('Update error:', err);
                res.status(500).json({ message: 'Error updating employee' });
            }
        });




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
                res.send({ expense, count, category });

            } catch (error) {
                console.error("Error fetching expenses:", error);
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
        app.get("/getEarnings", verifyToken, async (req, res) => {

            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await earningsCollections.find().toArray();

                res.send(result);

            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch balance' });
            }
        });
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




        app.post('/uploadProfilePic', upload.single('image'), async (req, res) => {
            try {
                const userEmail = req.body.email;
                const fileBuffer = req.file?.buffer;

                console.log("File", req.file);
                console.log("Body", req.body);


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
                console.error('❌ Upload error:', error);
                res.status(500).send({ error: 'Image upload failed' });
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