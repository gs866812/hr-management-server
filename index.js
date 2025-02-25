const express = require("express");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const moment = require("moment");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors(
    {
        origin: ["http://localhost:5173",],
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
        // ************************************************************************************************
        // ************************************************************************************************
        const database = client.db("hrManagement");
        const userCollections = database.collection("userList");
        const expenseCollections = database.collection("expenseList");
        const categoryCollections = database.collection("categoryList");
        const localOrderCollections = database.collection("localOrderList");
        const clientCollections = database.collection("clientList");
        // ************************************************************************************************
        // ************************************************************************************************
        app.post("/addExpense", async (req, res) => {
            try {
                const expenseData = req.body;
                const addExpense = await expenseCollections.insertOne(expenseData);

                // Check if the category already exists
                const existingCategory = await categoryCollections.findOne({ expenseCategory: expenseData.expenseCategory });

                if (!existingCategory) {
                    await categoryCollections.insertOne({ expenseCategory: expenseData.expenseCategory });
                }
                res.send(addExpense);

            } catch (error) {
                console.error("Error adding expense:", error); // Log the error for debugging
                res.status(500).json({ message: 'Failed to add expense', error: error.message }); // Include error message in response
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
                    { $set: { orderStatus: "In-progress" }}
                );

                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Failed to update order status" });
            }
        });
        // ************************************************************************************************
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
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await expenseCollections.find({}).sort({ _id: -1 }).toArray();
                const category = await categoryCollections.find({}).toArray();
                res.send({ result, category });
            } catch (error) {
                res.status(500).json({ message: 'Failed to fetch expense' });
            }
        });
        // ************************************************************************************************
        app.get("/getLocalOrder", verifyToken, async (req, res) => {
            try {
                const userMail = req.query.userEmail;
                const email = req.user.email;

                if (userMail !== email) {
                    return res.status(401).send({ message: "Forbidden Access" });
                }

                const result = await localOrderCollections.find({}).sort({ _id: -1 }).toArray();
                res.send(result);
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
        app.put("/editExpense/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { userName, expenseDate, expenseName, expenseCategory, expenseAmount, expenseStatus, expenseNote } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: 'Invalid expense ID' });
                }

                const existingExpense = await expenseCollections.findOne({ _id: new ObjectId(id) });

                if (!existingExpense) {
                    return res.status(404).json({ message: 'Expense not found' });
                }

                let updateData = {};

                if (userName !== existingExpense.userName) updateData.userName = userName;
                if (expenseDate !== existingExpense.expenseDate) updateData.expenseDate = expenseDate;
                if (expenseName !== existingExpense.expenseName) updateData.expenseName = expenseName;
                if (expenseCategory !== existingExpense.expenseCategory) updateData.expenseCategory = expenseCategory;
                if (expenseAmount !== existingExpense.expenseAmount) updateData.expenseAmount = expenseAmount;
                if (expenseStatus !== existingExpense.expenseStatus) updateData.expenseStatus = expenseStatus;
                if (expenseNote !== existingExpense.expenseNote) updateData.expenseNote = expenseNote;

                if (Object.keys(updateData).length === 0) {
                    return res.status(200).json({ message: 'No changes found' }); // Or 204 No Content
                }

                const result = await expenseCollections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({ message: 'No changes found' }); // This should not happen now
                }

                res.status(200).json({ message: 'Expense updated successfully' });

            } catch (error) {
                console.error("Error updating expense:", error);
                res.status(500).json({ message: 'Server error' });
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