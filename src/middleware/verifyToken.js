import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(new URL("http://localhost:3000/api/auth/jwks"));

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized. Token is required.",
      });
    }

    const token = authHeader.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: "http://localhost:3000",
      audience: "http://localhost:3000",
    });

    req.user = payload;

    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
};
