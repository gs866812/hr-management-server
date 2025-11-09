const { Router } = require('express');
const { client } = require('../lib/db');

const router = Router();
const database = client.db('hrManagement');

const shiftCollection = database.collection('workingShiftList');
const userCollections = database.collection('userList');

router.post('/new-shift', async (req, res) => {
    try {
        const {
            shiftName,
            branch,
            startTime,
            endTime,
            lateAfterMinutes,
            absentAfterMinutes,
            allowOT,
            userEmail
        } = req.body;

        const userDoc = await userCollections.findOne(
            { email: userEmail },
            { projection: { role: 1 } }
        );

        const allowedRoles = ['admin', 'hr-admin', 'developer'];
        if (!userDoc || !allowedRoles.includes(userDoc.role.toLowerCase())) {
            return res.status(403).json({
                success: false,
                message:
                    'Only Admin, HR Admin, or Developer can create a working shift.',
            });
        }

        if (!shiftName || !branch || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message:
                    'Shift name, branch, startTime, and endTime are required.',
            });
        }

        const existing = await shiftCollection.findOne({ shiftName, branch });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Shift "${shiftName}" already exists for branch "${branch}".`,
            });
        }

        const shiftDoc = {
            shiftName,
            branch,
            startTime,
            endTime,
            lateAfterMinutes: lateAfterMinutes ?? 5,
            absentAfterMinutes: absentAfterMinutes ?? 60,
            allowOT: allowOT ?? true,
            createdBy: userEmail,
            createdAt: new Date(),
        };

        const result = await shiftCollection.insertOne(shiftDoc);

        return res.status(201).json({
            success: true,
            message: `Shift "${shiftName}" created successfully for branch "${branch}".`,
            insertedId: result.insertedId,
        });
    } catch (error) {
        console.error('Error creating shift:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create shift',
            error: error.message,
        });
    }
});

const shiftRoute = router;
module.exports = { shiftRoute };
