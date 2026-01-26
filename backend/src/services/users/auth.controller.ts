import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRepository } from './user.repository';
import { config } from '../../lib/config';
import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';

const userRepository = new UserRepository();

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export const register = async (req: Request, res: Response) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';
    const { email, password, role, fullName } = req.body as {
      email?: string;
      password?: string;
      role?: 'buyer' | 'professional' | 'admin';
      fullName?: string;
    };

    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Email, password, and role are required' });
    }

    const normalizedRole = role.toLowerCase() as 'buyer' | 'professional' | 'admin';
    if (!['buyer', 'professional', 'admin'].includes(normalizedRole)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    logger.info('[auth] Register request received', {
      correlationId,
      email: normalizedEmail,
      role: normalizedRole,
      hasFullName: Boolean(fullName?.trim()),
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: hashedPassword,
          role: normalizedRole,
        }
      });

      switch (normalizedRole) {
        case 'professional':
          await tx.professional.create({
            data: {
              userId: newUser.id,
              baseRate: 100,
              currency: 'INR',
              status: 'active'
            }
          });
          break;
        case 'buyer':
        case 'admin':
          break;
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
    logger.info('[auth] Register success', {
      correlationId,
      userId: result.id,
      role: result.role,
    });

    res.status(201).json({
      message: 'User created successfully',
      userId: result.id,
      role: result.role,
      token,
      correlationId,
    });
  } catch (error: unknown) {
    const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';
    const message = getErrorMessage(error);

    logger.error('[auth] Register failed', error, {
      correlationId,
      email: req.body?.email,
      role: req.body?.role,
    });

    if (message === 'User with this email already exists') {
      return res.status(400).json({ message: 'User already exists', correlationId });
    }

    return res.status(500).json({
      message: 'Error registering user',
      error: message,
      correlationId,
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    logger.info('[auth] Login attempt', {
      correlationId,
      email,
    });

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
    logger.info('[auth] Login success', {
      correlationId,
      userId: user.id,
      role: user.role,
    });

    res.json({ token, role: user.role, userId: user.id, correlationId });
  } catch (error: unknown) {
    const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';
    logger.error('[auth] Login failed', error, {
      correlationId,
      email: req.body?.email,
    });
    res.status(500).json({ message: 'Error logging in', error: getErrorMessage(error), correlationId });
  }
};
