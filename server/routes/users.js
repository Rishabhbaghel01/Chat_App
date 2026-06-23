const express = require('express');
const router = express.Router();
const { User } = require("../models/User");
const { Group } = require("../models/Group");

const { auth } = require("../middleware/auth");

//=================================
//             User
//=================================

router.get("/auth", auth, (req, res) => {
    res.status(200).json({
        _id: req.user._id,
        isAdmin: req.user.role === 0 ? false : true,
        isAuth: true,
        email: req.user.email,
        name: req.user.name,
        lastname: req.user.lastname,
        role: req.user.role,
        image: req.user.image,
    });
});

router.post("/register", (req, res) => {

    const user = new User(req.body);

    user.save((err, doc) => {
        if (err) return res.json({ success: false, err });
        return res.status(200).json({
            success: true
        });
    });
});

router.post("/login", (req, res) => {
    User.findOne({ email: req.body.email }, (err, user) => {
        if (!user)
            return res.json({
                loginSuccess: false,
                message: "Auth failed, email not found"
            });

        user.comparePassword(req.body.password, (err, isMatch) => {
            if (!isMatch)
                return res.json({ loginSuccess: false, message: "Wrong password" });

            user.generateToken((err, user) => {
                if (err) return res.status(400).send(err);
                res.cookie("w_authExp", user.tokenExp);
                res
                    .cookie("w_auth", user.token)
                    .status(200)
                    .json({
                        loginSuccess: true, userId: user._id
                    });
            });
        });
    });
});

router.get("/logout", auth, (req, res) => {
    User.findOneAndUpdate({ _id: req.user._id }, { token: "", tokenExp: "" }, (err, doc) => {
        if (err) return res.json({ success: false, err });
        return res.status(200).send({
            success: true
        });
    });
});

router.get("/getUsers", auth, (req, res) => {
    User.find({}, (err, users) => {
        if (err) return res.status(400).send(err);
        res.status(200).json(users);
    });
});

router.put("/update", auth, (req, res) => {
    User.findOneAndUpdate(
        { _id: req.user._id },
        { name: req.body.name, lastname: req.body.lastname },
        { new: true },
        (err, doc) => {
            if (err) return res.status(400).json({ success: false, err });
            return res.status(200).json({ success: true, user: doc });
        }
    );
});

router.delete("/delete", auth, (req, res) => {
    // 1. Remove user from all groups
    Group.updateMany(
        {},
        { $pull: { members: req.user._id, hiddenBy: req.user._id } },
        (err) => {
            if (err) console.log("Error pulling user from groups: ", err);
            
            // 2. Delete the user document
            User.findOneAndDelete({ _id: req.user._id }, (err, doc) => {
                if (err) return res.status(400).json({ success: false, err });
                return res.status(200).json({ success: true });
            });
        }
    );
});

module.exports = router;
