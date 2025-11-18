// Script to export all data from the database for seeding
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function exportData() {
  console.log("Exporting database data...");

  try {
    // Export all data
    const doctors = await prisma.doctor.findMany({
      include: {
        credentials: true,
        appointments: {
          include: {
            patient: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const patients = await prisma.patient.findMany({
      include: {
        symptoms: true,
        appointments: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const chats = await prisma.chat.findMany({
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Format the data for seed file
    const exportData = {
      doctors: doctors.map((doctor) => ({
        name: doctor.name,
        specialty: doctor.specialty,
        address: doctor.address,
        latitude: doctor.latitude,
        longitude: doctor.longitude,
        phone: doctor.phone,
        email: doctor.email,
      })),
      patients: patients.map((patient) => ({
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        symptoms: patient.symptoms.map((s) => s.symptom),
      })),
      appointments: doctors.flatMap((doctor) =>
        doctor.appointments.map((apt) => {
          const patient = apt.patient;
          return {
            doctorEmail: doctor.email,
            patientEmail: patient?.email || apt.userEmail,
            userName: apt.userName,
            userEmail: apt.userEmail,
            userPhone: apt.userPhone,
            startUtc: apt.startUtc.toISOString(),
            endUtc: apt.endUtc.toISOString(),
            reason: apt.reason,
            notes: apt.notes,
            symptoms: apt.symptoms ? JSON.parse(apt.symptoms) : [],
            status: apt.status,
          };
        })
      ),
      chats: chats.map((chat) => ({
        title: chat.title,
        userId: chat.userId,
        metadata: chat.metadata,
        messages: chat.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata,
          createdAt: msg.createdAt.toISOString(),
        })),
      })),
    };

    console.log("\n=== EXPORTED DATA ===");
    console.log(`Doctors: ${exportData.doctors.length}`);
    console.log(`Patients: ${exportData.patients.length}`);
    console.log(`Appointments: ${exportData.appointments.length}`);
    console.log(`Chats: ${exportData.chats.length}`);

    // Output as JSON for easy copying
    console.log("\n=== JSON OUTPUT (copy this) ===");
    console.log(JSON.stringify(exportData, null, 2));

    return exportData;
  } catch (error) {
    console.error("Error exporting data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportData()
  .then(() => {
    console.log("\nExport completed!");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

