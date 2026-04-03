const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'school_jwt_secret_change_in_production';

/**
 * Signs a JWT for any user object.
 * @param {{ _id, role }} user
 * @returns {string} signed token (expires in 7 days)
 */
const signToken = (user) =>
    jwt.sign(
        { id: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

/**
 * Express middleware — verifies Bearer token.
 * Attaches decoded payload to req.user.
 * Returns 401 if missing/invalid, 403 if expired.
 */
const auth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided. Please log in.' });
    }

    const token = header.slice(7);
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Session expired. Please log in again.' });
        }
        return res.status(401).json({ message: 'Invalid token.' });
    }
};

module.exports = { auth, signToken };
