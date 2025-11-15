import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create sample doctors
  const doctors = [
    {
      name: "Dr. Sarah Johnson",
      specialty: "cardiology",
      address: "123 Medical Center Dr, New York, NY 10001",
      latitude: 40.7128,
      longitude: -74.006,
      phone: "+1-555-0101",
      email: "sarah.johnson@example.com",
    },
    {
      name: "Dr. Michael Chen",
      specialty: "dentistry",
      address: "456 Dental Plaza, New York, NY 10002",
      latitude: 40.718,
      longitude: -73.99,
      phone: "+1-555-0102",
      email: "michael.chen@example.com",
    },
    {
      name: "Dr. Emily Rodriguez",
      specialty: "dermatology",
      address: "789 Skin Care Ave, New York, NY 10003",
      latitude: 40.72,
      longitude: -74.01,
      phone: "+1-555-0103",
      email: "emily.rodriguez@example.com",
    },
    {
      name: "Dr. James Wilson",
      specialty: "pediatrics",
      address: "321 Children's Hospital Blvd, New York, NY 10004",
      latitude: 40.715,
      longitude: -74.005,
      phone: "+1-555-0104",
      email: "james.wilson@example.com",
    },
    {
      name: "Dr. Lisa Anderson",
      specialty: "general practice",
      address: "654 Family Health Center, New York, NY 10005",
      latitude: 40.71,
      longitude: -74.008,
      phone: "+1-555-0105",
      email: "lisa.anderson@example.com",
    },
  ];

  for (const doctor of doctors) {
    await prisma.doctor.upsert({
      where: { email: doctor.email },
      update: {},
      create: doctor,
    });
  }

  console.log(`Created ${doctors.length} doctors`);
  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

