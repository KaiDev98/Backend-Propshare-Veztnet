const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function fix() {
  const rentals = await prisma.rental.findMany({
    where: { propertyId: null },
    include: { room: true },
  });

  for (const r of rentals) {
    if (r.room?.propertyId) {
      await prisma.rental.update({
        where: { id: r.id },
        data: { propertyId: r.room.propertyId },
      });

      console.log("Fixed rental:", r.id);
    }
  }

  console.log("Done!");
  await prisma.$disconnect();
}

fix();