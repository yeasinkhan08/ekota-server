import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Must match the baseURL configured in your Better Auth application.
const AUTH_BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

// Better Auth publishes its public signing keys here.
const JWKS_URL = new URL("/api/auth/jwks", AUTH_BASE_URL);

// Create the JWKS client once.
// jose automatically caches the keys.
const JWKS = createRemoteJWKSet(JWKS_URL);

export const verifyToken = async (req, res, next) => {
  try {
    // 1. Read the Authorization header.
    const authHeader = req.headers.authorization;

    // 2. Validate Bearer token format.
    const match = authHeader?.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. A valid Bearer token is required.",
      });
    }

    const token = match[1];

    // 3. Verify token signature and claims.
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_BASE_URL,
      audience: AUTH_BASE_URL,
    });

    // 4. Make sure the token contains a valid email.
    if (typeof payload.email !== "string" || !payload.email.trim()) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User email is missing.",
      });
    }

    // 5. Attach verified user information to the request.
    req.user = {
      ...payload,
      email: payload.email.trim().toLowerCase(),
    };

    // 6. Continue to the protected route.
    return next();
  } catch (error) {
    console.error("JWT verification failed:", error.code || error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};
