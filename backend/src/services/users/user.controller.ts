import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { UserRepository } from './user.repository';
import { ProfessionalRepository } from './professional.repository';
import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AuditLogRepository } from '../auditing/audit-log.repository';

const userRepository = new UserRepository();
const professionalRepository = new ProfessionalRepository();
const auditLogRepository = new AuditLogRepository();

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body as {
      email?: string;
      password?: string;
      role?: 'buyer' | 'professional' | 'admin';
    };

    if (!email || !role) {
      return res.status(400).json({ message: 'Email and role are required' });
    }

    // Require password for new users
    if (!password) {
        return res.status(400).json({ message: 'Password is required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
        // 1. Check if user exists
        const existingUser = await tx.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // 2. Create User
        const newUser = await tx.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                role,
            }
        });

        // 3. Create Professional profile if needed
        if (role === 'professional') {
            await tx.professional.create({
                data: {
                    userId: newUser.id,
                    baseRate: 100,
                    currency: 'INR',
                    status: 'active'
                }
            });
        }

        return newUser;
    });

    // Fetch the complete user object (with professional relation if needed)
    // For now just return what we have, or fetch again.
    // Let's fetch again to be sure and consistent with previous return
    const createdUser = await userRepository.findById(result.id);
    res.status(201).json(createdUser);

  } catch (error: unknown) {
    if (getErrorMessage(error) === 'User with this email already exists') {
      return res.status(400).json({ message: 'User already exists' });
    }
    res.status(500).json({ message: 'Error creating user', error: getErrorMessage(error) });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await userRepository.findAll();
    res.json(users);
  } catch (error: unknown) {
    res.status(500).json({ message: 'Error fetching users', error: getErrorMessage(error) });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await userRepository.findById(req.params.id as string);
    if (user) {
      res.json(user);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error: unknown) {
    res.status(500).json({ message: 'Error fetching user', error: getErrorMessage(error) });
  }
};

export const getProfessionals = async (req: Request, res: Response) => {
  try {
    const professionals = await professionalRepository.findAll();
    res.json(professionals);
  } catch (error: unknown) {
    res.status(500).json({ message: 'Error fetching professionals', error: getErrorMessage(error) });
  }
};

export const getProfessionalById = async (req: Request, res: Response) => {
  try {
    const professional = await professionalRepository.findById(req.params.id as string);
    if (professional) {
      res.json(professional);
    } else {
      res.status(404).send('Professional not found');
    }
  } catch (error: unknown) {
    res.status(500).json({ message: 'Error fetching professional', error: getErrorMessage(error) });
  }
};

export const getProfessionalMe = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (user.role !== 'professional') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const professional = await professionalRepository.findByUserId(user.userId);
    if (!professional) {
      return res.status(404).json({ message: 'Professional profile not found' });
    }
    res.json(professional);
  } catch (error: unknown) {
    res.status(500).json({ message: 'Error fetching professional', error: getErrorMessage(error) });
  }
};

export const updateProfessionalProfile = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (user.role !== 'professional') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { skills, certifications } = req.body as {
    skills?: string[];
    certifications?: string[];
  };

  if (skills && !Array.isArray(skills)) {
    return res.status(400).json({ message: 'skills must be an array of strings' });
  }
  if (certifications && !Array.isArray(certifications)) {
    return res.status(400).json({ message: 'certifications must be an array of strings' });
  }

  try {
    const professional = await professionalRepository.findByUserId(user.userId);
    if (!professional) {
      return res.status(404).json({ message: 'Professional profile not found' });
    }

    const updated = await professionalRepository.update(professional.id, {
      skills: skills ?? professional.skills,
      certifications: certifications ?? professional.certifications
    });

    await auditLogRepository.create({
      entityType: 'Professional',
      entityId: professional.id,
      eventType: 'ProfessionalProfileUpdated',
      metadata: {
        skillsCount: skills?.length ?? professional.skills.length,
        certificationsCount: certifications?.length ?? professional.certifications.length
      } as Prisma.InputJsonValue
    });

    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ message: 'Error updating professional', error: getErrorMessage(error) });
  }
};

export const updateProfessionalVerification = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { status } = req.body as { status?: 'unverified' | 'pending' | 'verified' | 'rejected' };
  if (!status || !['unverified', 'pending', 'verified', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Valid status is required' });
  }

  try {
    const professional = await professionalRepository.findById(req.params.id as string);
    if (!professional) {
      return res.status(404).json({ message: 'Professional not found' });
    }

    const updated = await professionalRepository.update(professional.id, {
      verificationStatus: status
    });

    await auditLogRepository.create({
      entityType: 'Professional',
      entityId: professional.id,
      eventType: 'ProfessionalVerificationUpdated',
      metadata: {
        status
      } as Prisma.InputJsonValue
    });

    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ message: 'Error updating verification', error: getErrorMessage(error) });
  }
};
