import { StaffUser } from './staff-user.model.js';
import { StaffInvitation, StaffInvitationStatus } from './staff-invitation.model.js';
/** Blocks staff communication until the invited staff member has accepted an invitation. */
export async function requireAcceptedStaffInvitation(req, res, next) {
    try {
        const user = req.user;
        if (user?.userType !== 'STAFF') {
            next();
            return;
        }
        const loginId = String(user._id || '');
        const hospitalId = String(user.hospitalId || '');
        if (!loginId || !hospitalId) {
            res.status(403).json({ success: false, message: 'Staff account context is missing. Accept your staff invitation before using chat.' });
            return;
        }
        const staffUser = await StaffUser.findOne({ _id: loginId, hospitalId, isActive: true, status: 'ACTIVE' }).select('_id staffId').lean();
        if (!staffUser?.staffId) {
            res.status(403).json({ success: false, message: 'Activate your staff account by accepting the hospital invitation before using chat.' });
            return;
        }
        const acceptedInvitation = await StaffInvitation.exists({
            hospitalId,
            staffId: staffUser.staffId,
            status: StaffInvitationStatus.ACCEPTED,
        });
        if (!acceptedInvitation) {
            res.status(403).json({ success: false, message: 'Your staff invitation must be accepted before you can start chatting.' });
            return;
        }
        next();
    }
    catch (error) {
        next(error);
    }
}
