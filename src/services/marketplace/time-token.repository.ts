import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, TimeToken, TokenState } from '@prisma/client';

export interface CreateTimeTokenData {
  professionalId: string;
  duration: number;
  price: number;
  state?: TokenState;
  title?: string;
  description?: string;
  topics?: string[];
  expertiseTags?: string[];
}

export interface UpdateTimeTokenData {
  buyerId?: string;
  state?: TokenState;
  duration?: number;
  price?: number;
}

export class TimeTokenRepository extends BaseRepository<
  TimeToken,
  Prisma.TimeTokenUncheckedCreateInput,
  Prisma.TimeTokenUncheckedUpdateInput
> {
  protected get model() {
    return prisma.timeToken as unknown as RepositoryModel<
      TimeToken,
      Prisma.TimeTokenUncheckedCreateInput,
      Prisma.TimeTokenUncheckedUpdateInput
    >;
  }

  async findByProfessionalId(professionalId: string) {
    return prisma.timeToken.findMany({
      where: { professionalId },
      include: { professional: { include: { user: true } } }
    });
  }

  async findByBuyerId(buyerId: string) {
    return prisma.timeToken.findMany({
      where: { ownerId: buyerId },
      include: { professional: { include: { user: true } } }
    });
  }

  async findByState(state: TokenState) {
    try {
      console.log('[time-token.repository] findByState start', { state });
      const tokens = await prisma.timeToken.findMany({
        where: { state },
        include: {
          professional: {
            include: {
              user: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      console.log('[time-token.repository] findByState success', { count: tokens.length });
      return tokens;
    } catch (error) {
      console.error('[time-token.repository] findByState error', error);
      throw error;
    }
  }

  async findListedWithFilters(params: {
    search?: string;
    skills?: string[];
    topics?: string[];
    minPrice?: number;
    maxPrice?: number;
    page: number;
    pageSize: number;
  }) {
    const { search, skills, topics, minPrice, maxPrice, page, pageSize } = params;
    const now = new Date();
    const filters: Prisma.TimeTokenWhereInput[] = [
      { state: 'listed' },
      {
        professional: {
          user: {
            focusScores: {
              some: {
                validUntil: { gt: now }
              }
            }
          }
        }
      }
    ];

    if (typeof minPrice === 'number' || typeof maxPrice === 'number') {
      filters.push({
        price: {
          ...(typeof minPrice === 'number' ? { gte: minPrice } : {}),
          ...(typeof maxPrice === 'number' ? { lte: maxPrice } : {})
        }
      });
    }

    if (skills && skills.length > 0) {
      filters.push({
        professional: {
          skills: { hasSome: skills }
        }
      });
    }

    if (topics && topics.length > 0) {
      filters.push({
        topics: { hasSome: topics }
      });
    }

    if (search && search.trim().length > 0) {
      const terms = search.split(/\s+/).map((term) => term.trim()).filter(Boolean);
      const orFilters: Prisma.TimeTokenWhereInput[] = [];

      terms.forEach((term) => {
        orFilters.push(
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { topics: { has: term } },
          { expertiseTags: { has: term } },
          { professional: { skills: { has: term } } },
          { professional: { user: { email: { contains: term, mode: 'insensitive' } } } }
        );
      });

      if (orFilters.length > 0) {
        filters.push({ OR: orFilters });
      }
    }

    const where: Prisma.TimeTokenWhereInput = filters.length > 1 ? { AND: filters } : filters[0];
    const skip = (page - 1) * pageSize;

    const [totalCount, items] = await prisma.$transaction([
      prisma.timeToken.count({ where }),
      prisma.timeToken.findMany({
        where,
        include: {
          professional: {
            include: { user: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    return { totalCount, items };
  }

  async findListedCardsWithFilters(params: {
    search?: string;
    skills?: string[];
    topics?: string[];
    minPrice?: number;
    maxPrice?: number;
    page: number;
    pageSize: number;
  }) {
    const { search, skills, topics, minPrice, maxPrice, page, pageSize } = params;
    const now = new Date();
    const filters: Prisma.TimeTokenWhereInput[] = [
      { state: 'listed' },
      {
        professional: {
          user: {
            focusScores: {
              some: {
                validUntil: { gt: now }
              }
            }
          }
        }
      }
    ];

    if (typeof minPrice === 'number' || typeof maxPrice === 'number') {
      filters.push({
        price: {
          ...(typeof minPrice === 'number' ? { gte: minPrice } : {}),
          ...(typeof maxPrice === 'number' ? { lte: maxPrice } : {})
        }
      });
    }

    if (skills && skills.length > 0) {
      filters.push({
        professional: {
          skills: { hasSome: skills }
        }
      });
    }

    if (topics && topics.length > 0) {
      filters.push({
        topics: { hasSome: topics }
      });
    }

    if (search && search.trim().length > 0) {
      const terms = search.split(/\s+/).map((term) => term.trim()).filter(Boolean);
      const orFilters: Prisma.TimeTokenWhereInput[] = [];

      terms.forEach((term) => {
        orFilters.push(
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { topics: { has: term } },
          { expertiseTags: { has: term } },
          { professional: { skills: { has: term } } },
          { professional: { user: { email: { contains: term, mode: 'insensitive' } } } }
        );
      });

      if (orFilters.length > 0) {
        filters.push({ OR: orFilters });
      }
    }

    const where: Prisma.TimeTokenWhereInput = filters.length > 1 ? { AND: filters } : filters[0];
    const skip = (page - 1) * pageSize;

    const [totalCount, items] = await prisma.$transaction([
      prisma.timeToken.count({ where }),
      prisma.timeToken.findMany({
        where,
        select: {
          id: true,
          state: true,
          professionalId: true,
          durationMinutes: true,
          price: true,
          currency: true,
          title: true,
          topics: true,
          expertiseTags: true,
          professional: {
            select: {
              verificationStatus: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                  focusScores: {
                    where: {
                      validUntil: { gt: now }
                    },
                    orderBy: { computedAt: 'desc' },
                    take: 1,
                    select: {
                      score: true,
                      confidence: true,
                      validUntil: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    return { totalCount, items };
  }

  async findByIdWithProfessional(id: string) {
    return prisma.timeToken.findUnique({
      where: { id },
      include: {
        professional: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async createWithValidation(data: CreateTimeTokenData) {
    const professional = await prisma.professional.findUnique({
      where: { id: data.professionalId }
    });

    if (!professional) {
      throw new Error('Professional not found');
    }

    if (data.duration <= 0) {
      throw new Error('Duration must be positive');
    }

    if (data.price <= 0) {
      throw new Error('Price must be positive');
    }

    return this.create({
      professionalId: data.professionalId,
      durationMinutes: data.duration,
      price: data.price,
      state: data.state || 'drafted',
      title: data.title || undefined,
      description: data.description || undefined,
      topics: data.topics ?? undefined,
      expertiseTags: data.expertiseTags ?? undefined
    });
  }

  private canTransition(from: TokenState, to: TokenState): boolean {
    const validTransitions: Record<TokenState, TokenState[]> = {
      drafted: ['listed', 'cancelled'],
      listed: ['purchased', 'cancelled'],
      purchased: ['consumed', 'cancelled'],
      consumed: [],
      cancelled: []
    };
    return validTransitions[from]?.includes(to) || false;
  }

  async updateState(tokenId: string, newState: TokenState, buyerId?: string) {
    const token = await this.findById(tokenId);
    if (!token) {
      throw new Error('Token not found');
    }

    if (!this.canTransition(token.state, newState)) {
      throw new Error(`Invalid state transition from ${token.state} to ${newState}`);
    }

    const updateData: Record<string, unknown> = { state: newState };
    if (buyerId && newState === 'purchased') {
      updateData.ownerId = buyerId;
    }

    return this.update(tokenId, updateData);
  }

  async updateStatus(tokenId: string, newState: TokenState, buyerId?: string) {
    // Backward compatibility shim
    return this.updateState(tokenId, newState, buyerId);
  }

  async listToken(tokenId: string) {
    return this.updateState(tokenId, 'listed');
  }
}
