import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initialisation de la base de données...\n');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@hellomcdo.com' },
    update: {},
    create: {
      email: 'admin@hellomcdo.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'System',
      role: 'ADMIN',
    },
  });

  console.log('✅ Utilisateur admin créé:');
  console.log(`   Email: admin@hellomcdo.com`);
  console.log(`   Mot de passe: admin123`);
  console.log(`   Rôle: ${admin.role}\n`);

  // Create demo user
  const userPassword = await bcrypt.hash('user123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'user@hellomcdo.com' },
    update: {},
    create: {
      email: 'user@hellomcdo.com',
      password: userPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
    },
  });

  console.log('✅ Utilisateur de test créé:');
  console.log(`   Email: user@hellomcdo.com`);
  console.log(`   Mot de passe: user123`);
  console.log(`   Rôle: ${user.role}\n`);

  // Create demo restaurants
  const restaurants = [
    { code: '1318', name: 'Paris Champs-Élysées', city: 'Paris', address: '140 Avenue des Champs-Élysées' },
    { code: '1015', name: 'Paris Bastille', city: 'Paris', address: 'Place de la Bastille' },
    { code: '1042', name: 'Paris Gare du Nord', city: 'Paris', address: 'Gare du Nord' },
  ];

  console.log('✅ Création des restaurants de démonstration...');
  
  for (const restaurantData of restaurants) {
    const restaurant = await prisma.restaurant.upsert({
      where: { code: restaurantData.code },
      update: {},
      create: restaurantData,
    });
    
    // Grant access to demo user
    await prisma.restaurantAccess.upsert({
      where: {
        userId_restaurantId: {
          userId: user.id,
          restaurantId: restaurant.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        restaurantId: restaurant.id,
      },
    });

    console.log(`   - ${restaurant.code}: ${restaurant.name}`);
  }

  console.log('\n✅ Initialisation terminée !');
  console.log('\n📝 Pour vous connecter:');
  console.log('   Admin: admin@hellomcdo.com / admin123');
  console.log('   User:  user@hellomcdo.com / user123');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
