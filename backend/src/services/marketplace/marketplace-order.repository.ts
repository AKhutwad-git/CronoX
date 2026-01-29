import prisma from '../../lib/prisma';
import { BaseRepository, RepositoryModel } from '../../lib/base-repository';
import { Prisma, MarketplaceOrder } from '@prisma/client';

export interface CreateMarketplaceOrderData {
  timeTokenId: string;
  buyerId: string;
  pricePaid: number;
  currency: string;
}

export class MarketplaceOrderRepository extends BaseRepository<
  MarketplaceOrder,
  Prisma.MarketplaceOrderCreateInput,
  Prisma.MarketplaceOrderUpdateInput
> {
  protected get model() {
    return prisma.marketplaceOrder as unknown as RepositoryModel<
      MarketplaceOrder,
      Prisma.MarketplaceOrderCreateInput,
      Prisma.MarketplaceOrderUpdateInput
    >;
  }

  async delete(id: string): Promise<MarketplaceOrder> {
    throw new Error('Orders cannot be deleted.');
  }

  async findAllPaginated(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [totalCount, items] = await prisma.$transaction([
      prisma.marketplaceOrder.count(),
      prisma.marketplaceOrder.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    return { totalCount, items };
  }

  async findByBuyerId(buyerId: string) {
    return prisma.marketplaceOrder.findMany({
      where: { buyerId },
      include: {
        token: {
          include: {
            professional: { include: { user: true } }
          }
        },
        buyer: true
      }
    });
  }

  async findByBuyerIdPaginated(buyerId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.MarketplaceOrderWhereInput = { buyerId };
    const [totalCount, items] = await prisma.$transaction([
      prisma.marketplaceOrder.count({ where }),
      prisma.marketplaceOrder.findMany({
        where,
        include: {
          token: {
            include: {
              professional: { include: { user: true } }
            }
          },
          buyer: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    return { totalCount, items };
  }

  async findByProfessional(professionalUserId: string) {
    return prisma.marketplaceOrder.findMany({
      where: {
        token: {
          professional: {
            userId: professionalUserId
          }
        }
      },
      include: {
        token: true,
        buyer: true
      }
    });
  }

  async findByProfessionalPaginated(professionalUserId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.MarketplaceOrderWhereInput = {
      token: {
        professional: {
          userId: professionalUserId
        }
      }
    };
    const [totalCount, items] = await prisma.$transaction([
      prisma.marketplaceOrder.count({ where }),
      prisma.marketplaceOrder.findMany({
        where,
        include: {
          token: true,
          buyer: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    return { totalCount, items };
  }

  async findByTimeTokenId(timeTokenId: string) {
    return prisma.marketplaceOrder.findMany({
      where: { tokenId: timeTokenId },
      include: {
        buyer: true
      }
    });
  }

  async createWithValidation(data: CreateMarketplaceOrderData) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock/Get Token
      const timeToken = await tx.timeToken.findUnique({
        where: { id: data.timeTokenId },
        include: { professional: true }
      });

      if (!timeToken) {
        throw new Error('Time token not found');
      }

      if (timeToken.state !== 'listed') {
        throw new Error(`Time token is not available for purchase (Current state: ${timeToken.state})`);
      }

      // 2. Validate Buyer
      const buyer = await tx.user.findUnique({
        where: { id: data.buyerId }
      });

      if (!buyer || buyer.role !== 'buyer') {
        throw new Error('Valid buyer required');
      }

      // 3. Create Order
      const order = await tx.marketplaceOrder.create({
        data: {
          tokenId: data.timeTokenId,
          buyerId: data.buyerId,
          pricePaid: data.pricePaid,
          currency: data.currency
        }
      });

      // 4. Update Token Sate
      await tx.timeToken.update({
        where: { id: data.timeTokenId },
        data: {
          state: 'purchased',
          ownerId: data.buyerId
        }
      });

      // 5. Audit Log (Atomic)
      await tx.auditLog.create({
        data: {
          entityType: 'TimeToken',
          entityId: data.timeTokenId,
          eventType: 'TokenPurchased',
          metadata: {
            orderId: order.id,
            buyerId: data.buyerId,
            price: data.pricePaid
          } as Prisma.InputJsonValue
        }
      });

      return order;
    });
  }

  async getOrderWithDetails(orderId: string) {
    return prisma.marketplaceOrder.findUnique({
      where: { id: orderId },
      include: {
        token: {
          include: {
            professional: { include: { user: true } }
          }
        },
        buyer: true
      }
    });
  }
}
