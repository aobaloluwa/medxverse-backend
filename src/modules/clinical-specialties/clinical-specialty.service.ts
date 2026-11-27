import { SpecialtyEncounterModel } from './clinical-specialty.model.js';
import {
  CreateSpecialtyEncounterInput,
  GetSpecialtyEncountersQuery,
  ISpecialtyEncounterDocument,
  ClinicalSpecialty,
  SpecialtyEncounterStatus,
} from './clinical-specialty.types.js';

export class ClinicalSpecialtyService {
  public async createEncounter(
    input: CreateSpecialtyEncounterInput
  ): Promise<ISpecialtyEncounterDocument> {
    const encounter = await SpecialtyEncounterModel.create({
      ...input,
      status: SpecialtyEncounterStatus.COMPLETED,
      encounterDate: new Date(),
      completedAt: new Date(),
    });
    return encounter;
  }

  public async getEncounters(
    hospitalId: string,
    query: GetSpecialtyEncountersQuery
  ): Promise<{ encounters: ISpecialtyEncounterDocument[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { hospitalId };

    if (query.specialty) filter.specialty = query.specialty;
    if (query.patientId) filter.patientId = query.patientId;
    if (query.doctorId) filter.doctorId = query.doctorId;
    if (query.status) filter.status = query.status;

    const [encounters, total] = await Promise.all([
      SpecialtyEncounterModel.find(filter)
        .populate('patientId', 'firstName lastName mrn gender dateOfBirth phone')
        .populate('doctorId', 'firstName lastName role specialty')
        .sort({ encounterDate: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      SpecialtyEncounterModel.countDocuments(filter),
    ]);

    return {
      encounters,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async getEncounterById(
    id: string,
    hospitalId: string
  ): Promise<ISpecialtyEncounterDocument | null> {
    return SpecialtyEncounterModel.findOne({ _id: id, hospitalId })
      .populate('patientId', 'firstName lastName mrn gender dateOfBirth phone')
      .populate('doctorId', 'firstName lastName role specialty')
      .exec();
  }

  public async getSpecialtyStats(hospitalId: string): Promise<Record<string, number>> {
    const counts = await SpecialtyEncounterModel.aggregate([
      { $match: { hospitalId } },
      { $group: { _id: '$specialty', count: { $sum: 1 } } },
    ]);

    const stats: Record<string, number> = {};
    Object.values(ClinicalSpecialty).forEach((spec) => {
      stats[spec] = 0;
    });

    counts.forEach((item) => {
      if (item._id) {
        stats[item._id] = item.count;
      }
    });

    return stats;
  }
}

export const clinicalSpecialtyService = new ClinicalSpecialtyService();
