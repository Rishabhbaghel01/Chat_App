const express = require('express');
const router = express.Router();
const { Chat } = require("../models/Chat");
const { Group } = require("../models/Group");
const { auth } = require("../middleware/auth");

router.get("/getChats", auth, async (req, res) => {
    const groupId = req.query.groupId;
    let query = {};

    if (groupId && groupId !== 'general') {
        try {
            const group = await Group.findById(groupId);
            if (!group) {
                return res.status(404).send("Group not found");
            }
            if (!group.members.some(m => m.toString() === req.user._id.toString())) {
                return res.status(403).send("Not authorized to view this group's chat");
            }
            query.group = groupId;
        } catch (err) {
            return res.status(500).send(err);
        }
    } else {
        query = {
            $or: [
                { group: null },
                { group: { $exists: false } }
            ]
        };
    }

    await Chat.find(query)
        .populate("sender")
        .exec((err, chats) => {
            if(err) return res.status(400).send(err);
            res.status(200).send(chats)
        })
});

router.post("/groups/create", auth, (req, res) => {
    const group = new Group({
        name: req.body.name,
        description: req.body.description,
        createdBy: req.user._id,
        members: req.body.members || [req.user._id]
    });

    if (!group.members.includes(req.user._id)) {
        group.members.push(req.user._id);
    }

    group.save((err, doc) => {
        if (err) return res.status(400).json({ success: false, err });

        Group.findById(doc._id)
            .populate("members")
            .exec((populateErr, populatedGroup) => {
                if (!populateErr && populatedGroup) {
                    const io = req.app.get('io');
                    if (io) {
                        populatedGroup.members.forEach(m => {
                            const memberId = m._id.toString();
                            io.to(`user_${memberId}`).emit("groupCreated", { group: populatedGroup });
                        });
                    }
                    return res.status(200).json({ success: true, group: populatedGroup });
                } else {
                    return res.status(200).json({ success: true, group: doc });
                }
            });
    });
});

router.get("/groups", auth, (req, res) => {
    Group.find({
        members: req.user._id,
        hiddenBy: { $ne: req.user._id }
    })
    .populate("members")
    .sort({ updatedAt: -1 })
    .exec((err, groups) => {
        if (err) return res.status(400).send(err);
        res.status(200).json(groups);
    });
});
// Delete a chat message
router.delete('/delete/:id', auth, async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.id);
        if (!chat) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }
        // Only author or admin can delete
        if (chat.sender.toString() !== req.user._id && req.user.role !== 0) {
            return res.status(403).json({ success: false, message: "Not authorized to delete this message" });
        }
        await chat.remove();
        return res.status(200).json({ success: true, _id: req.params.id });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/remove-user', auth, async (req, res) => {
    const { groupId, userId } = req.body;
    if (!groupId || !userId) {
        return res.status(400).json({ success: false, message: 'groupId and userId required' });
    }
    try {
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }
        // Only admin (role 0), group creator, or the user themselves can remove
        const currentUserId = req.user._id.toString();
        if (req.user.role !== 0 && group.createdBy.toString() !== currentUserId && userId !== currentUserId) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (userId === currentUserId) {
            // User is leaving/hiding the chat
            if (!group.hiddenBy.includes(userId)) {
                group.hiddenBy.push(userId);
                await group.save();
            }
        } else {
            // Admin/creator removing another user
            group.members.pull(userId);
            await group.save();
        }

        // Notify the user in real-time via their personal socket room
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('userRemovedFromGroup', { groupId });
        }

        return res.status(200).json({ success: true, group });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;