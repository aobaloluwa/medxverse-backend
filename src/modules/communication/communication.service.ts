import { Types } from 'mongoose';
import { PatientModel } from '../patient/patient.model.js';
import { Staff } from '../staff/staff.model.js';
import { StaffUser, StaffPresenceStatus } from '../staff-auth/staff-user.model.js';
import { Conversation, Message, Ticket } from './communication.model.js';
import { Department } from './department.model.js';
import {
  ConversationPriority,
  ConversationType,
  MessageType,
  ParticipantType,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './communication.types.js';
import { communicationEvents } from './communication.events.js';

function oid(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new Error(`Invalid ${label}`);
  return new Types.ObjectId(value);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(String))];
}

async function ensureStaffUserInHospital(userId: string, hospitalId: string) {
  const user = await StaffUser.findOne({ _id: userId, hospitalId, isActive: true, status: 'ACTIVE' }).lean();
  if (!user) throw new Error('Staff member is not active or does not belong to this hospital');
  return user;
}

async function ensurePatientInHospital(patientId: string, hospitalId: string) {
  const patient = await PatientModel.findOne({ _id: patientId, hospitalId, active: true }).lean();
  if (!patient) throw new Error('Patient not found in this hospital');
  return patient;
}


async function resolveStaffUserIds(hospitalId: string, ids: string[]): Promise<Types.ObjectId[]> {
  const uniqueIds = uniqueStrings(ids);
  if (!uniqueIds.length) return [];

  const validObjectIds = uniqueIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));

  const users = await StaffUser.find({
    hospitalId,
    $or: [
      { _id: { $in: validObjectIds } },
      { staffId: { $in: validObjectIds } },
    ],
    isActive: true,
    status: 'ACTIVE',
  }).select('_id staffId').lean();

  const byRequestedId = new Map<string, Types.ObjectId>();
  for (const user of users) {
    byRequestedId.set(String(user._id), user._id as Types.ObjectId);
    byRequestedId.set(String(user.staffId), user._id as Types.ObjectId);
  }

  const unresolved = uniqueIds.filter((id) => !byRequestedId.has(id));
  if (unresolved.length) {
    throw new Error('One or more selected staff members do not belong to this hospital');
  }

  return uniqueIds.map((id) => byRequestedId.get(id)!);
}

async function departmentStaffUserIds(hospitalId: string, departmentId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const staff = await Staff.find({
    hospitalId,
    isActive: true,
    status: 'ACTIVE',
    'employment.departmentId': departmentId,
  }).select('_id').lean();

  if (!staff.length) return [];

  const users = await StaffUser.find({
    hospitalId,
    staffId: { $in: staff.map((member: any) => member._id) },
    isActive: true,
    status: 'ACTIVE',
  }).select('_id').lean();

  return users.map((user: any) => user._id as Types.ObjectId);
}

async function authorizedConversationFilter(hospitalId: string, userId: string) {
  const user = await ensureStaffUserInHospital(userId, hospitalId);
  const departmentIds = user.staffId
    ? await Staff.find({
        _id: user.staffId,
        hospitalId,
        isActive: true,
      }).select('employment.departmentId').lean()
    : [];

  const departmentId = departmentIds[0]?.employment?.departmentId;

  const clauses: any[] = [
    { 'participants.userId': user._id },
  ];

  if (departmentId) {
    clauses.push({
      type: ConversationType.DEPARTMENT,
      departmentId,
    });
  }

  return { user, filter: { hospitalId: oid(hospitalId, 'hospital ID'), archivedAt: { $exists: false }, $or: clauses } };
}

async function decorateConversationParticipants(conversations: any[]) {
  const staffIds = [...new Set(
    conversations.flatMap((conversation: any) => (conversation.participants || []))
      .map((participant: any) => {
        const user = participant?.userId;
        return user && typeof user === 'object' ? String(user.staffId || '') : '';
      })
      .filter(Boolean),
  )];

  if (!staffIds.length) return conversations;

  const staff = await Staff.find({ _id: { $in: staffIds } })
    .select('firstName lastName staffId role jobTitle profilePhotoUrl')
    .lean();
  const byId = new Map(staff.map((member: any) => [String(member._id), member]));

  return conversations.map((conversation: any) => ({
    ...conversation,
    participants: (conversation.participants || []).map((participant: any) => {
      const user = participant?.userId;
      const member = user && typeof user === 'object' ? byId.get(String(user.staffId)) : undefined;
      return {
        ...participant,
        displayName: member
          ? `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.jobTitle || member.role || user?.email || 'Staff member'
          : user?.email || 'Staff member',
        staff: member,
      };
    }),
  }));
}

export class CommunicationService {
  static async listInbox(hospitalId: string, userId: string, page = 1, limit = 30) {
    const h = oid(hospitalId, 'hospital ID');
    const u = oid(userId, 'user ID');
    const { filter } = await authorizedConversationFilter(hospitalId, userId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [items, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .populate('departmentId', 'name code')
        .populate('patientId', 'firstName lastName mrn phone')
        .populate('participants.userId', 'email role staffId')
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    const conversationIds = items.map((item) => item._id);
    const unread = conversationIds.length
      ? await Message.aggregate([
          {
            $match: {
              hospitalId: h,
              conversationId: { $in: conversationIds },
              senderUserId: { $ne: u },
              deletedAt: { $exists: false },
              $nor: [{ readBy: { $elemMatch: { userId: u } } }],
            },
          },
          { $group: { _id: '$conversationId', count: { $sum: 1 } } },
        ])
      : [];

    const unreadMap = new Map(unread.map((row: any) => [String(row._id), row.count]));
    const decoratedItems = await decorateConversationParticipants(
      items.map((item: any) => ({ ...item, unreadCount: unreadMap.get(String(item._id)) || 0 })),
    );

    return {
      items: decoratedItems,
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    };
  }

  static async setPresence(hospitalId: string, userId: string, status: StaffPresenceStatus) {
    await ensureStaffUserInHospital(userId, hospitalId);
    if (!Object.values(StaffPresenceStatus).includes(status)) throw new Error('Invalid presence status');
    return StaffUser.findOneAndUpdate({ _id: userId, hospitalId }, { $set: { presenceStatus: status, lastSeenAt: new Date() } }, { new: true }).select('_id presenceStatus lastSeenAt').lean();
  }

  static async myPatients(hospitalId: string, userId: string, search?: string) {
    await ensureStaffUserInHospital(userId, hospitalId);
    const conversations = await Conversation.find({
      hospitalId,
      patientId: { $exists: true },
      'participants.userId': userId,
    }).select('patientId lastMessageAt priority title').sort({ lastMessageAt: -1 }).lean();

    const ids = [...new Set(conversations.map((c: any) => String(c.patientId)).filter(Boolean))];
    if (!ids.length) return [];
    const query: any = { hospitalId, _id: { $in: ids }, active: true };
    if (search?.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ firstName: regex }, { lastName: regex }, { mrn: regex }, { phone: regex }];
    }
    const patients = await PatientModel.find(query).select('firstName lastName mrn phone gender dateOfBirth isFlagged flagReason').lean();
    const byId = new Map(patients.map((p: any) => [String(p._id), p]));
    return conversations
      .map((c: any) => ({ patient: byId.get(String(c.patientId)), lastMessageAt: c.lastMessageAt, priority: c.priority, conversationId: c._id }))
      .filter((item: any) => item.patient);
  }

  static async searchMessages(hospitalId: string, userId: string, search: string, limit = 50) {
    const { filter } = await authorizedConversationFilter(hospitalId, userId);
    if (!search?.trim()) throw new Error('Search text is required');
    const conversations = await Conversation.find(filter).select('_id').lean();
    const ids = conversations.map((c) => c._id);
    if (!ids.length) return [];
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return Message.find({ hospitalId, conversationId: { $in: ids }, body: { $regex: escaped, $options: 'i' }, deletedAt: { $exists: false } })
      .sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, limit))).lean();
  }

  static async searchStaff(hospitalId: string, userId: string, search: string, limit = 30) {
    await ensureStaffUserInHospital(userId, hospitalId);
    const safe = search.trim();
    if (safe.length < 2) throw new Error('Search must contain at least 2 characters');
    const regex = new RegExp(safe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const safeLimit = Math.min(50, Math.max(1, limit));

    const staff = await Staff.find({
      hospitalId,
      isActive: true,
      status: 'ACTIVE',
      $or: [
        { firstName: regex },
        { lastName: regex },
        { staffId: regex },
        { jobTitle: regex },
        { role: regex },
        { professionalTitle: regex },
      ],
    }).select('firstName lastName staffId role jobTitle professionalTitle profilePhotoUrl employment.departmentId').limit(safeLimit).lean();

    const staffIds = staff.map((member: any) => member._id);
    const users = staffIds.length
      ? await StaffUser.find({
          hospitalId,
          staffId: { $in: staffIds },
          isActive: true,
          status: 'ACTIVE',
        }).select('_id email role staffId').lean()
      : [];

    const byStaff = new Map(users.map((user: any) => [String(user.staffId), user]));

    return staff.map((member: any) => {
      const user = byStaff.get(String(member._id));
      return {
        id: user ? String(user._id) : String(member._id),
        email: user?.email,
        role: user?.role || member.role,
        staff: member,
      };
    });
  }

  static async createDirectConversation(hospitalId: string, creatorId: string, targetUserId: string) {
    const creator = await ensureStaffUserInHospital(creatorId, hospitalId);
    const resolved = await resolveStaffUserIds(hospitalId, [targetUserId]);
    const targetId = resolved[0];
    const target = await ensureStaffUserInHospital(String(targetId), hospitalId);
    if (String(creator._id) === String(target._id)) throw new Error('You cannot create a direct conversation with yourself');

    const directKey = [String(creator._id), String(target._id)].sort().join(':');
    let conversation = await Conversation.findOne({ hospitalId, type: ConversationType.DIRECT, directKey });
    if (conversation) return conversation;

    try {
      conversation = await Conversation.create({
        hospitalId,
        type: ConversationType.DIRECT,
        directKey,
        participants: [
          { type: ParticipantType.STAFF, userId: creator._id, joinedAt: new Date() },
          { type: ParticipantType.STAFF, userId: target._id, joinedAt: new Date() },
        ],
        createdBy: creator._id,
        priority: ConversationPriority.NORMAL,
      });

      communicationEvents.emit('event', {
        type: 'conversation.created',
        hospitalId,
        userIds: [String(creator._id), String(target._id)],
        conversationId: String(conversation._id),
        payload: conversation.toObject(),
        occurredAt: new Date().toISOString(),
      });

      return conversation;
    } catch (error: any) {
      if (error?.code === 11000) return Conversation.findOne({ hospitalId, type: ConversationType.DIRECT, directKey });
      throw error;
    }
  }

  static async createGroupConversation(hospitalId: string, creatorId: string, title: string, memberIds: string[]) {
    const creator = await ensureStaffUserInHospital(creatorId, hospitalId);
    if (!title?.trim()) throw new Error('Group title is required');

    const resolvedIds = await resolveStaffUserIds(hospitalId, [creatorId, ...memberIds]);
    const ids = [...new Set(resolvedIds.map((id) => String(id)))].map((id) => new Types.ObjectId(id));

    if (ids.length < 2) throw new Error('A group must contain at least two staff members');

    const conversation = await Conversation.create({
      hospitalId,
      type: ConversationType.GROUP,
      title: title.trim(),
      participants: ids.map((id) => ({ type: ParticipantType.STAFF, userId: id, joinedAt: new Date() })),
      createdBy: creator._id,
      priority: ConversationPriority.NORMAL,
    });

    communicationEvents.emit('event', {
      type: 'conversation.created',
      hospitalId,
      userIds: ids.map(String),
      conversationId: String(conversation._id),
      payload: conversation.toObject(),
      occurredAt: new Date().toISOString(),
    });

    return conversation;
  }

  static async createDepartment(hospitalId: string, creatorId: string, name: string, code: string, description?: string) {
    await ensureStaffUserInHospital(creatorId, hospitalId);
    if (!name?.trim() || !code?.trim()) throw new Error('Department name and code are required');
    return Department.create({ hospitalId, name: name.trim(), code: code.trim().toUpperCase(), description, createdBy: creatorId });
  }

  static async listDepartments(hospitalId: string, userId: string) {
    await ensureStaffUserInHospital(userId, hospitalId);
    return Department.find({ hospitalId, isActive: true }).sort({ name: 1 }).lean();
  }

  static async createDepartmentConversation(hospitalId: string, creatorId: string, departmentId: string, title?: string) {
    const creator = await ensureStaffUserInHospital(creatorId, hospitalId);
    const department = await Department.findOne({ _id: oid(departmentId, 'department ID'), hospitalId, isActive: true }).lean();
    if (!department) throw new Error('Department not found in this hospital');

    const departmentUsers = await departmentStaffUserIds(hospitalId, department._id as Types.ObjectId);
    const allUserIds = [...new Set([String(creator._id), ...departmentUsers.map(String)])].map((id) => new Types.ObjectId(id));

    let conversation = await Conversation.findOne({ hospitalId, type: ConversationType.DEPARTMENT, departmentId: department._id });
    if (conversation) {
      const existing = new Set(conversation.participants.map((p: any) => String(p.userId)));
      for (const userId of allUserIds) {
        if (!existing.has(String(userId))) {
          conversation.participants.push({ type: ParticipantType.STAFF, userId, joinedAt: new Date() });
        }
      }
      if (!conversation.title) conversation.title = title?.trim() || department.name;
      await conversation.save();
    } else {
      conversation = await Conversation.create({
        hospitalId,
        type: ConversationType.DEPARTMENT,
        title: title?.trim() || department.name,
        departmentId: department._id,
        participants: allUserIds.map((id) => ({ type: ParticipantType.STAFF, userId: id, joinedAt: new Date() })),
        createdBy: creator._id,
        priority: ConversationPriority.NORMAL,
      });
    }

    communicationEvents.emit('event', {
      type: 'conversation.created',
      hospitalId,
      userIds: allUserIds.map(String),
      conversationId: String(conversation._id),
      payload: conversation.toObject(),
      occurredAt: new Date().toISOString(),
    });

    return conversation;
  }

  static async createPatientCareConversation(hospitalId: string, creatorId: string, patientId: string, memberIds: string[], title?: string) {
    throw new Error('Patient messaging is currently disabled for staff messaging');
    const creator = await ensureStaffUserInHospital(creatorId, hospitalId);
    const patient = await ensurePatientInHospital(patientId, hospitalId);
    const ids = uniqueStrings([creatorId, ...memberIds]);
    const users = await StaffUser.find({ hospitalId, _id: { $in: ids }, isActive: true, status: 'ACTIVE' }).select('_id').lean();
    if (users.length !== ids.length) throw new Error('One or more staff members do not belong to this hospital');

    const conversation = await Conversation.create({
      hospitalId,
      type: ConversationType.PATIENT_CARE,
      title: title?.trim() || `${patient.firstName} ${patient.lastName} Care Team`,
      patientId: patient._id,
      participants: ids.map((id) => ({ type: ParticipantType.STAFF, userId: id, joinedAt: new Date() })),
      createdBy: creator._id,
      priority: ConversationPriority.NORMAL,
    });

    return conversation;
  }

  static async getConversation(hospitalId: string, userId: string, conversationId: string) {
    const { user, filter } = await authorizedConversationFilter(hospitalId, userId);
    const conversation = await Conversation.findOne({
      ...filter,
      _id: oid(conversationId, 'conversation ID'),
    })
      .populate('departmentId', 'name code')
      .populate('patientId', 'firstName lastName mrn phone gender dateOfBirth')
      .populate('participants.userId', 'email role staffId')
      .lean();
    if (!conversation) throw new Error('Conversation not found or access denied');
    return (await decorateConversationParticipants([conversation]))[0];
  }

  static async listMessages(hospitalId: string, userId: string, conversationId: string, page = 1, limit = 50) {
    await this.getConversation(hospitalId, userId, conversationId);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [messages, total] = await Promise.all([
      Message.find({ hospitalId, conversationId, deletedAt: { $exists: false } })
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      Message.countDocuments({ hospitalId, conversationId, deletedAt: { $exists: false } }),
    ]);
    return { items: messages.reverse(), page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) };
  }

  static async sendMessage(hospitalId: string, senderId: string, conversationId: string, body: string, type = MessageType.TEXT, attachments: any[] = []) {
    const conversation = await this.getConversation(hospitalId, senderId, conversationId);
    if (type === MessageType.TEXT && !body?.trim()) throw new Error('Message body is required');
    if (type !== MessageType.TEXT && !attachments.length && !body?.trim()) throw new Error('Message content or attachment is required');
    if (!Array.isArray(attachments) || attachments.length > 5) throw new Error('You can attach a maximum of 5 files per message.');
    const allowedAttachmentTypes = new Set([
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'text/plain', 'text/csv', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/rtf',
    ]);
    for (const attachment of attachments) {
      if (!attachment || typeof attachment.url !== 'string' || !attachment.url.startsWith('https://res.cloudinary.com/')) {
        throw new Error('Each attachment must be uploaded through MedXVerse file storage first.');
      }
      if (!attachment.name || !allowedAttachmentTypes.has(String(attachment.mimeType || '').toLowerCase())) {
        throw new Error('An attachment has an unsupported file type or missing filename.');
      }
      if (Number(attachment.size || 0) > 10 * 1024 * 1024) throw new Error('Each attachment must be 10 MB or smaller.');
    }

    const sender = await ensureStaffUserInHospital(senderId, hospitalId);
    const message = await Message.create({
      hospitalId,
      conversationId: conversation._id,
      senderType: ParticipantType.STAFF,
      senderUserId: sender._id,
      body: body?.trim() || undefined,
      type,
      attachments,
      readBy: [{ userId: sender._id, readAt: new Date() }],
    });

    const preview = body?.trim() ? body.trim().slice(0, 200) : `[${type.toLowerCase()}]`;
    await Conversation.updateOne(
      { _id: conversation._id, hospitalId },
      { $set: { lastMessageAt: new Date(), lastMessagePreview: preview } }
    );

    const recipientSet = new Set(
      conversation.participants
        .filter((p: any) => p.userId && String(p.userId) !== String(sender._id))
        .map((p: any) => String(p.userId)),
    );

    if (conversation.type === ConversationType.DEPARTMENT && conversation.departmentId) {
      const departmentUsers = await departmentStaffUserIds(hospitalId, conversation.departmentId as Types.ObjectId);
      for (const userId of departmentUsers) {
        if (String(userId) !== String(sender._id)) recipientSet.add(String(userId));
      }
    }

    const recipientIds = [...recipientSet];

    communicationEvents.emit('event', {
      type: 'message.created',
      hospitalId,
      userIds: recipientIds,
      conversationId: String(conversation._id),
      messageId: String(message._id),
      payload: message.toObject(),
      occurredAt: new Date().toISOString(),
    });

    return message;
  }

  static async markConversationRead(hospitalId: string, userId: string, conversationId: string) {
    const conversation = await this.getConversation(hospitalId, userId, conversationId);
    const now = new Date();
    await Message.updateMany(
      { hospitalId, conversationId: conversation._id, 'readBy.userId': { $ne: oid(userId, 'user ID') } },
      { $push: { readBy: { userId, readAt: now } } }
    );
    await Conversation.updateOne(
      { _id: conversation._id, hospitalId, 'participants.userId': userId },
      { $set: { 'participants.$.lastReadAt': now } }
    );
    communicationEvents.emit('event', {
      type: 'conversation.read',
      hospitalId,
      userIds: conversation.participants.filter((p: any) => p.userId).map((p: any) => String(p.userId)),
      conversationId: String(conversation._id),
      payload: { userId, readAt: now.toISOString() },
      occurredAt: now.toISOString(),
    });
    return { readAt: now };
  }

  static async joinDepartmentConversation(hospitalId: string, userId: string, conversationId: string) {
    const user = await ensureStaffUserInHospital(userId, hospitalId);
    const conversation = await Conversation.findOne({
      _id: conversationId,
      hospitalId,
      type: ConversationType.DEPARTMENT,
    });
    if (!conversation) throw new Error('Department conversation not found');
    if (conversation.participants.some((p: any) => String(p.userId) === String(user._id))) return conversation;

    if (conversation.departmentId) {
      const staff = await Staff.findOne({
        _id: user.staffId,
        hospitalId,
        'employment.departmentId': conversation.departmentId,
      }).select('_id').lean();
      if (!staff && user.role !== 'HOSPITAL_ADMIN') {
        throw new Error('You are not assigned to this department');
      }
    }

    conversation.participants.push({ type: ParticipantType.STAFF, userId: user._id, joinedAt: new Date() });
    await conversation.save();
    return conversation;
  }

  static async updateTicket(hospitalId: string, actorId: string, ticketId: string, input: any) {
    await ensureStaffUserInHospital(actorId, hospitalId);
    const ticket = await Ticket.findOne({ _id: ticketId, hospitalId });
    if (!ticket) throw new Error('Ticket not found');

    if (input.assignedTo !== undefined) {
      if (input.assignedTo === null || input.assignedTo === '') {
        ticket.assignedTo = undefined;
      } else {
        const assignee = await ensureStaffUserInHospital(String(input.assignedTo), hospitalId);
        ticket.assignedTo = assignee._id;
      }
    }
    if (input.assignedDepartmentId !== undefined) {
      if (input.assignedDepartmentId === null || input.assignedDepartmentId === '') {
        ticket.assignedDepartmentId = undefined;
      } else {
        const department = await Department.findOne({ _id: input.assignedDepartmentId, hospitalId, isActive: true }).lean();
        if (!department) throw new Error('Assigned department not found in this hospital');
        ticket.assignedDepartmentId = department._id;
      }
    }
    if (input.status) ticket.status = input.status;
    if (input.priority) ticket.priority = input.priority;
    if (input.category) ticket.category = input.category;
    if (input.description !== undefined) ticket.description = String(input.description);
    if (input.escalationReason !== undefined) ticket.escalationReason = String(input.escalationReason);

    if (ticket.status === TicketStatus.RESOLVED && !ticket.resolvedAt) ticket.resolvedAt = new Date();
    if (ticket.status === TicketStatus.CLOSED && !ticket.closedAt) ticket.closedAt = new Date();
    if (ticket.priority === TicketPriority.CRITICAL || ticket.priority === TicketPriority.HIGH) {
      ticket.escalatedAt ||= new Date();
    }

    await ticket.save();
    communicationEvents.emit('event', {
      type: 'ticket.updated',
      hospitalId,
      userIds: [String(actorId), ...(ticket.assignedTo ? [String(ticket.assignedTo)] : [])],
      ticketId: String(ticket._id),
      payload: ticket.toObject(),
      occurredAt: new Date().toISOString(),
    });
    return ticket;
  }

  static async createTicket(hospitalId: string, creatorId: string, input: any) {
    await ensureStaffUserInHospital(creatorId, hospitalId);
    if (input.conversationId) await this.getConversation(hospitalId, creatorId, input.conversationId);
    if (input.patientId) await ensurePatientInHospital(input.patientId, hospitalId);
    if (input.assignedTo) await ensureStaffUserInHospital(input.assignedTo, hospitalId);
    if (input.assignedDepartmentId) {
      const department = await Department.findOne({ _id: input.assignedDepartmentId, hospitalId, isActive: true }).lean();
      if (!department) throw new Error('Assigned department not found in this hospital');
    }

    const ticket = await Ticket.create({
      hospitalId,
      conversationId: input.conversationId,
      patientId: input.patientId,
      subject: input.subject,
      category: input.category || TicketCategory.GENERAL,
      priority: input.priority || TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      assignedTo: input.assignedTo,
      assignedDepartmentId: input.assignedDepartmentId,
      createdBy: creatorId,
      description: input.description,
      escalationReason: input.escalationReason,
      ...(input.priority === TicketPriority.CRITICAL || input.priority === TicketPriority.HIGH ? { escalatedAt: new Date(), escalationReason: input.escalationReason || 'High priority ticket' } : {}),
    });

    communicationEvents.emit('event', {
      type: 'ticket.created',
      hospitalId,
      userIds: input.assignedTo ? [String(input.assignedTo)] : undefined,
      ticketId: String(ticket._id),
      conversationId: input.conversationId,
      payload: ticket.toObject(),
      occurredAt: new Date().toISOString(),
    });
    return ticket;
  }

  static async listTickets(hospitalId: string, userId: string, filters: any = {}) {
    await ensureStaffUserInHospital(userId, hospitalId);
    const query: Record<string, any> = { hospitalId };
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.category) query.category = filters.category;
    if (filters.assignedTo) query.assignedTo = filters.assignedTo;
    if (filters.patientId) query.patientId = filters.patientId;

    return Ticket.find(query)
      .sort({ priority: -1, updatedAt: -1 })
      .populate('patientId', 'firstName lastName mrn')
      .populate('assignedTo', 'email role')
      .populate('assignedDepartmentId', 'name code')
      .lean();
  }
}
