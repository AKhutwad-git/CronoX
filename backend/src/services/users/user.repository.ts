import prisma from '../../lib/prisma';
import { Prisma, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';

export interface CreateUserData {
  email: string;
  password: string;
  role: 'buyer' | 'professional' | 'admin';
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  role?: 'buyer' | 'professional' | 'admin';
}

export class UserRepository extends BaseRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput> {
  protected get model() {
    return prisma.user as unknown as RepositoryModel<User, Prisma.UserCreateInput, Prisma.UserUpdateInput>;
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByRole(role: 'buyer' | 'professional' | 'admin') {
    return prisma.user.findMany({ where: { role } });
  }

  async createWithValidation(data: CreateUserData) {
    // Validate email uniqueness
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate role
    if (!['buyer', 'professional', 'admin'].includes(data.role)) {
      throw new Error('Invalid user role');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const createData: Prisma.UserCreateInput = {
      email: data.email,
      passwordHash,
      role: data.role,
    };

    return this.create(createData);
  }

  async updateWithValidation(id: string, data: UpdateUserData) {
    if (data.email) {
      const existingUser = await this.findByEmail(data.email);
      if (existingUser && existingUser.id !== id) {
        throw new Error('Email already in use by another user');
      }
    }

    if (data.role && !['buyer', 'professional', 'admin'].includes(data.role)) {
      throw new Error('Invalid user role');
    }

    const updateData: Prisma.UserUpdateInput = {
      email: data.email,
      role: data.role,
    };

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    return this.update(id, updateData);
  }
}
