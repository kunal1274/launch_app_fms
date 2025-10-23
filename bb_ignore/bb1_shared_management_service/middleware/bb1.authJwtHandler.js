// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';

export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization; // Expect: "Bearer <token>"
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ msg: 'Forbidden' });
      }
      req.user = decoded; // Attach the decoded payload (e.g., email) to req.user
      next();
    });
  } else {
    res.status(401).json({ msg: 'Unauthorized' });
  }
};
