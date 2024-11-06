import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const projectsData: Prisma.ProjectCreateInput[] = [
  {
    name: 'Project les communs',
    description:
      "Projet de développement d'une application de gestion de communs",
    ownerUserId: 'Matt',
  },
  {
    name: 'Project MEC',
    description: "Mouvement pour l'économie circulaire",
    ownerUserId: 'Jean',
  },
];

async function main() {
  console.log(`Start seeding ...`);
  for (const u of projectsData) {
    const user = await prisma.project.create({
      data: u,
    });
    console.log(`Created project with id: ${user.id}`);
  }
  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
