import { Request, Response } from 'express';
import { UserRepository } from './user.repository';
import { ProfessionalRepository } from './professional.repository';
import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';

const userRepository = new UserRepository();
const professionalRepository = new ProfessionalRepository();

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
