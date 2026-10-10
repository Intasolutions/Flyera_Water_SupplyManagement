import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create Inventory Types
  const inventory20L = await prisma.inventoryType.create({
    data: {
      name: '20L Bottle',
      price: 50,
      pointsValue: 1,
      stocks: {
        create: {
          fullCount: 500,
          emptyCount: 100,
          damagedCount: 5
        }
      }
    }
  })

  const inventory5L = await prisma.inventoryType.create({
    data: {
      name: '5L Bottle',
      price: 20,
      pointsValue: 0,
      stocks: {
        create: {
          fullCount: 200,
          emptyCount: 20,
          damagedCount: 0
        }
      }
    }
  })

  // Create Staff
  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      role: 'ADMIN',
      phone: '9999999999'
    }
  })

  const driver1 = await prisma.user.create({
    data: {
      name: 'Rahul D.',
      role: 'DRIVER',
      phone: '8888888888'
    }
  })

  // Create Vehicle
  const vehicle1 = await prisma.vehicle.create({
    data: {
      plateNumber: 'MH 12 AB 1234',
      model: 'Tata Ace'
    }
  })

  // Create Clients
  const client1 = await prisma.client.create({
    data: {
      name: 'Sharma Residence',
      phone: '7777777777',
      address: '101, Blue Sky Apts, Pune',
      loyaltyPoints: 10
    }
  })

  const client2 = await prisma.client.create({
    data: {
      name: 'Tech Solutions Inc',
      phone: '6666666666',
      address: 'Hinjewadi Phase 1, Pune',
      loyaltyPoints: 45
    }
  })

  console.log('Seed data created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
