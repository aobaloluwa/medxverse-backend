import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type AccountType = 'HOSPITAL' | 'HMO';

export interface AuthRequest extends Request {
  account?: {
    accountId: string;
    accountType: AccountType;
    name: string;
    email: string;
    role?: string;
    userType?: 'ACCOUNT' | 'STAFF' | 'PATIENT';
    [key: string]: unknown;
  };

  user?: {
    _id: string;
    hospitalId?: string;
    hmoId?: string;
    accountId?: string;
    accountType?: AccountType;
    name?: string;
    email?: string;
    role?: string;
    userType?: 'ACCOUNT' | 'STAFF' | 'PATIENT';
    [key: string]: unknown;
  };
}

interface JwtPayload {
  _id?: string;
  id?: string;
  accountId?: string;

  hospitalId?: string;
  hmoId?: string;

  hospital?: string;
  hmo?: string;

  accountType?: AccountType | string;

  name?: string;
  email?: string;
  role?: string;
  userType?: 'ACCOUNT' | 'STAFF' | 'PATIENT';

  [key: string]: unknown;
}

export const authenticateAccount = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret_key'
    ) as JwtPayload;

    if (decoded.userType === 'PATIENT' && !req.originalUrl.split('?')[0].includes('/telemedicine') && !req.originalUrl.split('?')[0].includes('/patient-portal/auth/connection')) {
      res.status(403).json({ success: false, message: 'Patient portal tokens may only access telemedicine endpoints or restore their saved hospital connection.' });
      return;
    }

    const accountType =
      decoded.accountType === 'HMO' || decoded.accountType === 'HOSPITAL'
        ? decoded.accountType
        : undefined;

    /*
     * Resolve the authenticated account/user ID.
     *
     * accountId is the preferred tenant/account identifier.
     * _id/id are supported for compatibility with older JWTs.
     */
    const accountId =
      decoded.accountId ??
      decoded._id ??
      decoded.id;

    const userId =
      decoded._id ??
      decoded.id ??
      decoded.accountId;

    if (!accountId) {
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token: account ID is missing.',
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token: user ID is missing.',
      });
      return;
    }

    /*
     * Resolve tenant IDs independently.
     *
     * For HMO accounts:
     *   req.user.hmoId MUST be populated.
     *
     * For hospital accounts:
     *   req.user.hospitalId MUST be populated.
     */
    const resolvedHmoId =
      decoded.hmoId ??
      decoded.hmo ??
      (accountType === 'HMO' ? accountId : undefined);

    const resolvedHospitalId =
      decoded.hospitalId ??
      decoded.hospital ??
      (accountType === 'HOSPITAL' ? accountId : undefined);

    /*
     * Preserve the decoded JWT as req.account.
     */
    req.account = {
      ...decoded,
      accountId,
      accountType: accountType as AccountType,
      name: String(decoded.name ?? ''),
      email: String(decoded.email ?? ''),
      role: decoded.role ? String(decoded.role) : undefined,
      userType: decoded.userType || 'ACCOUNT',
    };

    /*
     * Normalize req.user for every downstream module.
     *
     * This is the important part for the HMO modules:
     *
     * req.user.hmoId
     */
    req.user = {
      ...decoded,

      _id: userId,
      accountId,
      accountType,

      hospitalId: resolvedHospitalId,
      hmoId: resolvedHmoId,

      name: decoded.name ? String(decoded.name) : undefined,
      email: decoded.email ? String(decoded.email) : undefined,
      role: decoded.role ? String(decoded.role) : undefined,
      userType: decoded.userType || 'ACCOUNT',
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

/**
 * Restrict access based on AccountType or User Role.
 *
 * Example:
 *   restrictTo('HMO')
 *   restrictTo('HOSPITAL')
 *   restrictTo('ADMIN')
 */
export const restrictTo = (...allowedRoles: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (req.user?.userType === 'PATIENT' && !allowedRoles.includes('PATIENT')) {
      res.status(403).json({ success: false, message: 'Patient portal access is limited to patient-enabled features.' });
      return;
    }

    const role =
      req.user?.role ??
      req.user?.accountType ??
      req.account?.accountType;

    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({
        success: false,
        message:
          'Forbidden. You do not have permission to perform this action.',
      });
      return;
    }

    next();
  };
};

/**
 * Compatibility aliases for existing routes.
 */
export const protect = authenticateAccount;
export const authenticate = authenticateAccount;
export const authorize = restrictTo;