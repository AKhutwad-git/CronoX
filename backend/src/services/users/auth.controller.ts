import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRepository } from './user.repository';
import { config } from '../../lib/config';
import prisma from '../../lib/prisma';

const userRepository = new UserRepository();

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body as {
      email?: string;
      password?: string;
      role?: 'buyer' | 'professional' | 'admin';
    };

    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Email, password, and role are required' });
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
                     baseRate: 100, // Default
                     currency: 'INR',
                     status: 'active'
                 }
             });
         }

         return newUser;
    });

    const signOptions: SignOptions = {
      expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
    };
    const token = jwt.sign(
      { userId: result.id, role: result.role },
      config.jwt.secret,
      signOptions
    );

    res.status(201).json({ message: 'User created successfully', userId: result.id, role: result.role, token });
  } catch (error: unknown) {
    if (getErrorMessage(error) === 'User with this email already exists') {
      return res.status(400).json({ message: 'User already exists' });
    }
    res.status(500).json({ message: 'Error registering user', error: getErrorMessage(error) });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userObj = user as { passwordHash?: string | null; password?: string | null };
    const isMatch = await bcrypt.compare(password, userObj.passwordHash || userObj.password || '');

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const signOptions: SignOptions = {
      expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
    };
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwt.secret,
      signOptions
    );

    res.json({ token, role: user.role, userId: user.id });
  } catch (error: unknown) {
    res.status(500).json({ message: 'Error logging in', error: getErrorMessage(error) });
  }
};
