const bcrypt = require('bcrypt');
const Admin = require('../models/adminSchema.js');
const Sclass = require('../models/sclassSchema.js');
const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Subject = require('../models/subjectSchema.js');
const Notice = require('../models/noticeSchema.js');
const Complain = require('../models/complainSchema.js');
const { withCache, invalidate } = require('../utils/cache.js');
const { signToken } = require('../middleware/auth.js');

// const adminRegister = async (req, res) => {
//     try {
//         const salt = await bcrypt.genSalt(10);
//         const hashedPass = await bcrypt.hash(req.body.password, salt);

//         const admin = new Admin({
//             ...req.body,
//             password: hashedPass
//         });

//         const existingAdminByEmail = await Admin.findOne({ email: req.body.email });
//         const existingSchool = await Admin.findOne({ schoolName: req.body.schoolName });

//         if (existingAdminByEmail) {
//             res.send({ message: 'Email already exists' });
//         }
//         else if (existingSchool) {
//             res.send({ message: 'School name already exists' });
//         }
//         else {
//             let result = await admin.save();
//             result.password = undefined;
//             res.send(result);
//         }
//     } catch (err) {
//         res.status(500).json(err);
//     }
// };

// const adminLogIn = async (req, res) => {
//     if (req.body.email && req.body.password) {
//         let admin = await Admin.findOne({ email: req.body.email });
//         if (admin) {
//             const validated = await bcrypt.compare(req.body.password, admin.password);
//             if (validated) {
//                 admin.password = undefined;
//                 res.send(admin);
//             } else {
//                 res.send({ message: "Invalid password" });
//             }
//         } else {
//             res.send({ message: "User not found" });
//         }
//     } else {
//         res.send({ message: "Email and password are required" });
//     }
// };

const adminRegister = async (req, res) => {
    try {
        const existingAdminByEmail = await Admin.findOne({ email: req.body.email });
        const existingSchool = await Admin.findOne({ schoolName: req.body.schoolName });

        if (existingAdminByEmail) {
            return res.send({ message: 'Email already exists' });
        }
        if (existingSchool) {
            return res.send({ message: 'School name already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(req.body.password, salt);

        const admin = new Admin({ ...req.body, password: hashedPass });
        let result = await admin.save();
        result.password = undefined;
        res.send(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

const adminLogIn = async (req, res) => {
    if (req.body.email && req.body.password) {
        let admin = await Admin.findOne({ email: req.body.email });
        if (admin) {
            const validated = await bcrypt.compare(req.body.password, admin.password);
            if (validated) {
                const token = signToken(admin);
                admin.password = undefined;
                res.send({ ...admin.toObject(), token });
            } else {
                res.send({ message: "Invalid password" });
            }
        } else {
            res.send({ message: "User not found" });
        }
    } else {
        res.send({ message: "Email and password are required" });
    }
};

// GET /Admin/:id — also used as session validation
const getAdminDetail = async (req, res) => {
    try {
        const data = await withCache(`admin:${req.params.id}`, async () => {
            const admin = await Admin.findById(req.params.id);
            if (!admin) return null;
            const obj = admin.toObject();
            delete obj.password;
            return obj;
        }, 300);

        if (data) {
            res.send(data);
        } else {
            res.status(404).send({ message: "No admin found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
}

// const deleteAdmin = async (req, res) => {
//     try {
//         const result = await Admin.findByIdAndDelete(req.params.id)

//         await Sclass.deleteMany({ school: req.params.id });
//         await Student.deleteMany({ school: req.params.id });
//         await Teacher.deleteMany({ school: req.params.id });
//         await Subject.deleteMany({ school: req.params.id });
//         await Notice.deleteMany({ school: req.params.id });
//         await Complain.deleteMany({ school: req.params.id });

//         res.send(result)
//     } catch (error) {
//         res.status(500).json(err);
//     }
// }

const updateAdmin = async (req, res) => {
    try {
        const { name, email, schoolName, schoolAddress, phone, logoUrl } = req.body;

        // Check for duplicate email (excluding current admin)
        if (email) {
            const existing = await Admin.findOne({ email, _id: { $ne: req.params.id } });
            if (existing) {
                return res.status(409).json({ message: 'Email already used by another account' });
            }
        }

        const updateFields = {};
        if (name !== undefined) updateFields.name = name;
        if (email !== undefined) updateFields.email = email;
        if (schoolName !== undefined) updateFields.schoolName = schoolName;
        if (schoolAddress !== undefined) updateFields.schoolAddress = schoolAddress;
        if (phone !== undefined) updateFields.phone = phone;
        if (logoUrl !== undefined) updateFields.logoUrl = logoUrl;

        // Handle logo upload via multer (file on req.file)
        if (req.file) {
            updateFields.logoUrl = req.file.path || req.file.secure_url || req.file.location;
        }

        let result = await Admin.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        );

        if (!result) return res.status(404).json({ message: 'Admin not found' });

        result.password = undefined;
        invalidate(`admin:${req.params.id}`);
        res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const updateAdminPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'currentPassword and newPassword are required' });
        }

        const admin = await Admin.findById(req.params.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        const valid = await bcrypt.compare(currentPassword, admin.password);
        if (!valid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(newPassword, salt);
        await admin.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json(error);
    }
};

module.exports = { adminRegister, adminLogIn, getAdminDetail, updateAdmin, updateAdminPassword };
