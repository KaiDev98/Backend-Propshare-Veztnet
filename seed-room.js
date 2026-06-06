const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Ambil semua properti yang ada
  const properties = await prisma.property.findMany({
    select: { id: true, title: true },
  });

  console.log('Properties found:', properties.length);
  console.log(properties);

  // Buat kamar untuk setiap properti
  for (const prop of properties) {
    const existing = await prisma.room.findFirst({
      where: { propertyId: prop.id },
    });

    if (existing) {
      console.log(`⏭️  Properti "${prop.title}" sudah punya kamar, skip.`);
      continue;
    }

    // Buat 3 kamar per properti
    const rooms = await prisma.room.createMany({
      data: [
        { propertyId: prop.id, roomNumber: '101', pricePerMonth: 1000000 },
        { propertyId: prop.id, roomNumber: '102', pricePerMonth: 1000000 },
        { propertyId: prop.id, roomNumber: '103', pricePerMonth: 1200000 },
      ],
    });

    console.log(`✅ Properti "${prop.title}" — ${rooms.count} kamar dibuat`);
  }

  console.log('\n✅ Selesai!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());