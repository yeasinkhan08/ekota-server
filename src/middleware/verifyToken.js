import "dotenv/config";
import { createRemoteJWKSet, jwtVerify, errors } from "jose";

// Must exactly match the baseURL of your Better Auth app (no trailing slash).
const AUTH_BASE_URL = (
  process.env.BETTER_AUTH_URL || "http://localhost:3000"
).replace(/\/+$/, "");

// Better Auth publishes its public signing keys here.
const JWKS_URL = new URL("/api/auth/jwks", AUTH_BASE_URL);

// Create once; jose caches the keys.
const JWKS = createRemoteJWKSet(JWKS_URL);

const isDev = process.env.NODE_ENV !== "production";

export const verifyToken = async (req, res, next) => {
  try {
    // 1. Read and validate the Authorization header.
    const authHeader = req.headers.authorization;
    const match = authHeader?.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. A valid Bearer token is required.",
      });
    }

    const token = match[1];

    // 2. Verify signature + claims.
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_BASE_URL,
      audience: AUTH_BASE_URL,
    });

    // 3. Make sure the token contains an email.
    if (typeof payload.email !== "string" || !payload.email.trim()) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User email is missing.",
      });
    }

    // 4. Attach verified user to the request.
    req.user = {
      ...payload,
      email: payload.email.trim().toLowerCase(),
    };

    return next();
  } catch (error) {
    // Detailed server-side log so you can see the real reason.
    console.error("JWT verification failed:", {
      name: error.name,
      code: error.code,
      message: error.message,
      claim: error.claim, // set on claim validation errors (iss, aud, exp...)
      reason: error.reason,
      jwksUrl: JWKS_URL.href,
      expectedIssuer: AUTH_BASE_URL,
    });

    let message = "Invalid or expired token.";
    if (error instanceof errors.JWTExpired) {
      message = "Token expired.";
    }

    return res.status(401).json({
      success: false,
      message,
      // Only exposed in development to help debugging.
      ...(isDev && {
        debug: {
          code: error.code,
          claim: error.claim,
          detail: error.message,
        },
      }),
    });
  }
};
