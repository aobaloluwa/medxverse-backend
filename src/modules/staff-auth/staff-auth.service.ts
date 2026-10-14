import crypto from 'crypto';
import { Types } from 'mongoose';
import { Staff } from '../staff/staff.model.js';
import { Account } from '../auth/auth.model.js';
import { Department } from '../communication/department.model.js';
import { JwtUtils } from '../../utils/jwt.js';
import { sendEmail } from '../../utils/email.js';
import { env } from '../../config/env.js';
import {
  StaffInvitation,
  StaffInvitationStatus,
} from './staff-invitation.model.js';
import { StaffUser, StaffPresenceStatus } from './staff-user.model.js';
import {
  AcceptStaffInvitationDTO,
  StaffAuthResponse,
  StaffLoginDTO,
  StaffUserStatus,
  ChangeStaffPasswordDTO,
  UpdateStaffProfileDTO,
} from './staff-auth.types.js';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function passwordIsStrongEnough(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(
    password
  );
}

export class StaffAuthService {
  static async createInvitation(
    hospitalId: string,
    staffId: string,
    invitedBy?: string
  ) {
    if (
      !Types.ObjectId.isValid(hospitalId) ||
      !Types.ObjectId.isValid(staffId)
    ) {
      throw new Error('Invalid hospital or staff ID');
    }

    const [staffResult, hospitalResult] = await Promise.all([
      Staff.findOne({ _id: staffId, hospitalId }).lean(),
      Account.findOne({
        _id: hospitalId,
        accountType: 'HOSPITAL',
        isActive: true,
      }).lean(),
    ]);

    const staff = staffResult as any;
    const hospital = hospitalResult as any;

    if (!staff) {
      throw new Error('Staff member not found in this hospital');
    }

    if (!hospital) {
      throw new Error('Hospital account not found or inactive');
    }

    const email = staff.contact?.email?.trim().toLowerCase();

    if (!email) {
      throw new Error(
        'The staff member must have an email address before an invitation can be sent'
      );
    }

    const existingUserResult = await StaffUser.findOne({
      hospitalId,
      staffId,
    }).lean();

    const existingUser = existingUserResult as any;

    if (
      existingUser?.status === StaffUserStatus.ACTIVE &&
      existingUser.isActive
    ) {
      throw new Error('This staff member already has an active account');
    }

    await StaffInvitation.updateMany(
      {
        hospitalId,
        staffId,
        status: StaffInvitationStatus.PENDING,
      },
      {
        $set: {
          status: StaffInvitationStatus.REVOKED,
        },
      }
    );

    const rawToken = createInvitationToken();

    const expiresAt = new Date(
      Date.now() + env.INVITATION_EXPIRES_HOURS * 60 * 60 * 1000
    );

    const invitation = await StaffInvitation.create({
      hospitalId,
      staffId,
      email,
      role: staff.role,
      tokenHash: hashToken(rawToken),
      expiresAt,
      status: StaffInvitationStatus.PENDING,
      invitedBy:
        invitedBy && Types.ObjectId.isValid(invitedBy)
          ? invitedBy
          : undefined,
    });

    const inviteUrl = `${env.APP_BASE_URL.replace(
      /\/$/,
      ''
    )}/staff/activate?token=${encodeURIComponent(rawToken)}`;

    const fullName = `${staff.firstName} ${staff.lastName}`.trim();
    const hospitalName = hospital.name;

    const emailResult = await sendEmail({
      to: email,
      subject: `You're invited to join ${hospitalName} on MHMS`,
      text: `Hello ${fullName},

You have been invited to activate your MHMS staff account for ${hospitalName}.

Activate your account: ${inviteUrl}

This invitation expires on ${expiresAt.toISOString()}.

If you did not expect this invitation, please contact your hospital administrator.`,
      html: `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2>Welcome to MHMS</h2>

    <p>Hello ${fullName},</p>

    <p>
      You have been invited to activate your staff account for
      <strong>${hospitalName}</strong>.
    </p>

    <p>
      <a
        href="${inviteUrl}"
        style="
          display: inline-block;
          padding: 12px 18px;
          background: #0f766e;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
        "
      >
        Activate your account
      </a>
    </p>

    <p>
      This invitation expires on ${expiresAt.toISOString()}.
    </p>

    <p>
      If you did not expect this invitation, please contact your hospital
      administrator.
    </p>
  </body>
</html>`,
    });

    if (!emailResult.sent && env.NODE_ENV === 'production') {
      await StaffInvitation.updateOne(
        { _id: invitation._id },
        {
          $set: {
            status: StaffInvitationStatus.REVOKED,
          },
        }
      );

      throw new Error(
        'Email delivery is not configured. Configure RESEND_API_KEY and EMAIL_FROM before sending staff invitations in production.'
      );
    }

    return {
      invitationId: invitation._id.toString(),
      expiresAt,
      email,
      sent: emailResult.sent,
      developmentInviteUrl:
        emailResult.sent || env.NODE_ENV === 'production'
          ? undefined
          : inviteUrl,
    };
  }

  static async getInvitation(token: string) {
    if (!token || token.length < 32) {
      throw new Error('Invalid invitation token');
    }

    const invitationResult = await StaffInvitation.findOne({
      tokenHash: hashToken(token),
      status: StaffInvitationStatus.PENDING,
    })
      .populate(
        'staffId',
        'firstName lastName role contact.email staffId'
      )
      .populate('hospitalId', 'name code logoUrl')
      .lean();

    const invitation = invitationResult as any;

    if (!invitation) {
      throw new Error('Invitation is invalid, revoked, or already used');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      await StaffInvitation.updateOne(
        { _id: invitation._id },
        {
          $set: {
            status: StaffInvitationStatus.EXPIRED,
          },
        }
      );

      throw new Error(
        'Invitation has expired. Please request a new invitation.'
      );
    }

    const staff = invitation.staffId as any;
    const hospital = invitation.hospitalId as any;

    return {
      id: invitation._id.toString(),
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,

      staff: staff
        ? {
            id: staff._id.toString(),
            staffId: staff.staffId,
            firstName: staff.firstName,
            lastName: staff.lastName,
            role: staff.role,
          }
        : undefined,

      hospital: hospital
        ? {
            id: hospital._id.toString(),
            name: hospital.name,
            code: hospital.code,
            logoUrl: hospital.logoUrl,
          }
        : undefined,
    };
  }

  static async acceptInvitation(
    dto: AcceptStaffInvitationDTO
  ): Promise<StaffAuthResponse> {
    if (!passwordIsStrongEnough(dto.password)) {
      throw new Error(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      );
    }

    const tokenHash = hashToken(dto.token);

    const invitationResult = await StaffInvitation.findOne({
      tokenHash,
      status: StaffInvitationStatus.PENDING,
    });

    const invitation = invitationResult as any;

    if (!invitation) {
      throw new Error('Invitation is invalid, revoked, or already used');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      invitation.status = StaffInvitationStatus.EXPIRED;
      await invitation.save();

      throw new Error(
        'Invitation has expired. Please request a new invitation.'
      );
    }

    const staffResult = await Staff.findOne({
      _id: invitation.staffId,
      hospitalId: invitation.hospitalId,
    });

    const staff = staffResult as any;

    if (
      !staff ||
      !staff.isActive ||
      staff.status === 'TERMINATED'
    ) {
      throw new Error(
        'This staff account is no longer eligible for activation'
      );
    }

    const existingUserResult = await StaffUser.findOne({
      hospitalId: invitation.hospitalId,
      staffId: staff._id,
    });

    const existingUser = existingUserResult as any;

    if (existingUser) {
      existingUser.email = invitation.email;
      existingUser.password = dto.password;
      existingUser.role = staff.role;
      existingUser.status = StaffUserStatus.ACTIVE;
      existingUser.isActive = true;

      await existingUser.save();

      invitation.status = StaffInvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      invitation.acceptedBy = existingUser._id;

      await invitation.save();

      staff.userAccountId = existingUser._id;
      await staff.save();

      return this.issueStaffToken(existingUser._id.toString());
    }

    const userResult = await StaffUser.create({
      hospitalId: invitation.hospitalId,
      staffId: staff._id,
      email: invitation.email,
      password: dto.password,
      role: staff.role,
      status: StaffUserStatus.ACTIVE,
      isActive: true,
    });

    const user = userResult as any;

    staff.userAccountId = user._id;
    await staff.save();

    invitation.status = StaffInvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    invitation.acceptedBy = user._id;

    await invitation.save();

    return this.issueStaffToken(user._id.toString());
  }

  static async login(
    dto: StaffLoginDTO
  ): Promise<StaffAuthResponse> {
    const email = dto.email.trim().toLowerCase();

    let hospitalId: string | undefined;

    if (dto.hospitalCode?.trim()) {
      const hospitalResult = await Account.findOne({
        code: dto.hospitalCode.trim().toUpperCase(),
        accountType: 'HOSPITAL',
        isActive: true,
      })
        .select('_id')
        .lean();

      const hospital = hospitalResult as any;

      if (!hospital) {
        throw new Error('Hospital code not found');
      }

      hospitalId = hospital._id.toString();
    }

    const query: Record<string, any> = {
      email,
    };

    if (hospitalId) {
      query.hospitalId = hospitalId;
    }

    const users = await StaffUser.find(query)
      .select('+password')
      .limit(2);

    if (!users.length) {
      throw new Error('Invalid email or password');
    }

    if (users.length > 1) {
      throw new Error(
        'This email belongs to more than one hospital. Please provide the hospital code.'
      );
    }

    const user = users[0];

    if (
      user.status !== StaffUserStatus.ACTIVE ||
      !user.isActive
    ) {
      throw new Error(
        'This staff account has been deactivated or suspended'
      );
    }

    if (!(await user.comparePassword(dto.password))) {
      throw new Error('Invalid email or password');
    }

    user.lastLoginAt = new Date();
    user.presenceStatus = StaffPresenceStatus.ONLINE;
    user.lastSeenAt = new Date();
    await user.save();

    return this.issueStaffToken(user._id.toString());
  }

  static async getProfile(userId: string, hospitalId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(hospitalId)) {
      throw new Error('Invalid staff or hospital ID');
    }

    const user = await StaffUser.findOne({
      _id: userId,
      hospitalId,
      isActive: true,
      status: StaffUserStatus.ACTIVE,
    }).lean();

    if (!user) throw new Error('Active staff account not found');

    const staff = await Staff.findOne({
      _id: user.staffId,
      hospitalId,
    }).lean();

    const hospitalResult = await Account.findOne({
      _id: hospitalId,
      accountType: 'HOSPITAL',
      isActive: true,
    })
      .select('name code email phone address logoUrl')
      .lean();

    if (!staff) throw new Error('Linked staff record not found');
    if (!hospitalResult) throw new Error('Hospital account not found or inactive');

    // Keep the hospital shape explicit. Mongoose can otherwise infer a
    // document-or-array union here when this model is used with populate
    // elsewhere in the project, which causes false TypeScript errors for
    // properties such as _id, name, code, and logoUrl.
    const hospital: {
      _id: Types.ObjectId;
      name: string;
      code?: string;
      email: string;
      phone: string;
      address?: string;
      logoUrl?: string;
    } = hospitalResult as unknown as {
      _id: Types.ObjectId;
      name: string;
      code?: string;
      email: string;
      phone: string;
      address?: string;
      logoUrl?: string;
    };

    const departmentId = (staff as any).employment?.departmentId;
    const department = departmentId && Types.ObjectId.isValid(String(departmentId))
      ? await Department.findOne({ _id: departmentId, hospitalId }).select('name code').lean()
      : null;

    return {
      account: {
        id: String(user._id),
        email: user.email,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        presenceStatus: user.presenceStatus,
        lastSeenAt: user.lastSeenAt,
      },
      staff: {
        id: String(staff._id),
        staffId: staff.staffId,
        firstName: staff.firstName,
        middleName: staff.middleName,
        lastName: staff.lastName,
        title: staff.title,
        professionalTitle: staff.professionalTitle,
        jobTitle: staff.jobTitle,
        profilePhotoUrl: staff.profilePhotoUrl,
        role: staff.role,
        category: staff.category,
        classification: staff.classification,
        contact: staff.contact || {},
        department: department
          ? { id: String(department._id), name: department.name, code: department.code }
          : undefined,
      },
      hospital: {
        id: String(hospital._id),
        name: hospital.name,
        code: hospital.code,
        email: hospital.email,
        phone: hospital.phone,
        address: hospital.address,
        logoUrl: hospital.logoUrl,
      },
    };
  }

  static async updateProfile(userId: string, hospitalId: string, dto: UpdateStaffProfileDTO) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(hospitalId)) {
      throw new Error('Invalid staff or hospital ID');
    }

    const user = await StaffUser.findOne({
      _id: userId,
      hospitalId,
      isActive: true,
      status: StaffUserStatus.ACTIVE,
    }).lean();
    if (!user) throw new Error('Active staff account not found');

    const staff = await Staff.findOne({ _id: user.staffId, hospitalId });
    if (!staff) throw new Error('Linked staff record not found');

    const allowedTextFields = ['firstName', 'middleName', 'lastName', 'title', 'jobTitle', 'profilePhotoUrl'] as const;
    for (const field of allowedTextFields) {
      if (dto[field] !== undefined) {
        const value = String(dto[field] ?? '').trim();
        if ((field === 'firstName' || field === 'lastName') && !value) {
          throw new Error(`${field} is required`);
        }
        (staff as any)[field] = value || undefined;
      }
    }

    if (!(staff as any).contact) (staff as any).contact = {};
    if (dto.phone !== undefined) staff.contact.phone = String(dto.phone).trim();
    if (dto.alternatePhone !== undefined) staff.contact.alternatePhone = String(dto.alternatePhone).trim();
    if (dto.address !== undefined) staff.contact.address = String(dto.address).trim();
    if (dto.city !== undefined) staff.contact.city = String(dto.city).trim();
    if (dto.state !== undefined) staff.contact.state = String(dto.state).trim();
    if (dto.country !== undefined) staff.contact.country = String(dto.country).trim();

    await staff.save();
    return this.getProfile(userId, hospitalId);
  }

  static async changePassword(userId: string, hospitalId: string, dto: ChangeStaffPasswordDTO) {
    if (!dto.currentPassword || !dto.newPassword) throw new Error('Current password and new password are required');
    if (dto.confirmPassword !== undefined && dto.newPassword !== dto.confirmPassword) {
      throw new Error('New password and confirmation do not match');
    }
    if (dto.currentPassword === dto.newPassword) throw new Error('New password must be different from the current password');
    if (!passwordIsStrongEnough(dto.newPassword)) {
      throw new Error('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');
    }

    const user = await StaffUser.findOne({
      _id: userId,
      hospitalId,
      isActive: true,
      status: StaffUserStatus.ACTIVE,
    }).select('+password');

    if (!user) throw new Error('Active staff account not found');
    if (!(await user.comparePassword(dto.currentPassword))) throw new Error('Current password is incorrect');

    user.password = dto.newPassword;
    await user.save();

    return { changedAt: new Date().toISOString() };
  }

  private static async issueStaffToken(
    userId: string
  ): Promise<StaffAuthResponse> {
    const userResult = await StaffUser.findById(userId).lean();

    const user = userResult as any;

    if (!user) {
      throw new Error('Staff account not found');
    }

    const staffResult = await Staff.findOne({
      _id: user.staffId,
      hospitalId: user.hospitalId,
    }).lean();

    const staff = staffResult as any;

    if (!staff) {
      throw new Error('Linked staff record not found');
    }

    const token = JwtUtils.generateAccessToken({
      id: user._id.toString(),
      accountId: user.hospitalId.toString(),
      userType: 'STAFF',
      email: user.email,
      accountType: 'HOSPITAL' as any,
      role: user.role,
      hospitalId: user.hospitalId.toString(),
    });

    return {
      token,
      staff: {
        id: user._id.toString(),
        staffId: staff.staffId,
        hospitalId: user.hospitalId.toString(),
        email: user.email,
        role: user.role,
        firstName: staff.firstName,
        lastName: staff.lastName,
      },
    };
  }
}