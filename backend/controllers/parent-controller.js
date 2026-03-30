const bcrypt = require("bcrypt");
const Parent = require("../models/parentSchema");
const Student = require("../models/studentSchema");

// Register
const parentRegister = async (req, res) => {
    try {
        const existing = await Parent.findOne({ email: req.body.email });
        if (existing) return res.send({ message: "Email already exists" });

        const hashedPass = await bcrypt.hash(req.body.password, 10);
        const parent = new Parent({
            ...req.body,
            password: hashedPass,
            school: req.body.schoolId || req.body.school,
        });
        let result = await parent.save();
        result.password = undefined;
        res.send(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

// Login
const parentLogIn = async (req, res) => {
    try {
        const parent = await Parent.findOne({ email: req.body.email });
        if (!parent) return res.send({ message: "Parent not found" });

        const validated = await bcrypt.compare(req.body.password, parent.password);
        if (!validated) return res.send({ message: "Invalid password" });

        const result = await Parent.findById(parent._id)
            .populate("children", "name rollNum sclassName")
            .populate("school", "schoolName");

        result.password = undefined;
        res.send(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

// Get single parent
const getParentDetail = async (req, res) => {
    try {
        const parent = await Parent.findById(req.params.id)
            .populate("children", "name rollNum sclassName behaviorScore focusIndex")
            .populate("school", "schoolName");
        if (!parent) return res.send({ message: "No parent found" });
        parent.password = undefined;
        res.send(parent);
    } catch (err) {
        res.status(500).json(err);
    }
};

// Get all parents for a school
const getParents = async (req, res) => {
    try {
        const parents = await Parent.find({ school: req.params.id })
            .populate("children", "name rollNum");
        if (!parents.length) return res.send({ message: "No parents found" });
        res.send(parents.map(p => ({ ...p._doc, password: undefined })));
    } catch (err) {
        res.status(500).json(err);
    }
};

// Update parent
const updateParent = async (req, res) => {
    try {
        if (req.body.password) {
            req.body.password = await bcrypt.hash(req.body.password, 10);
        }
        const result = await Parent.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        result.password = undefined;
        res.send(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

// Delete parent
const deleteParent = async (req, res) => {
    try {
        const result = await Parent.findByIdAndDelete(req.params.id);
        res.send(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

// Link child to parent
const addChildToParent = async (req, res) => {
    try {
        const { parentId, studentId } = req.body;
        const parent = await Parent.findByIdAndUpdate(
            parentId,
            { $addToSet: { children: studentId } },
            { new: true }
        ).populate("children", "name rollNum");
        await Student.findByIdAndUpdate(studentId, { parentId });
        parent.password = undefined;
        res.send(parent);
    } catch (err) {
        res.status(500).json(err);
    }
};

module.exports = {
    parentRegister,
    parentLogIn,
    getParentDetail,
    getParents,
    updateParent,
    deleteParent,
    addChildToParent,
};
