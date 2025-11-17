// @ts-nocheck
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  console.log("Tip: rerun with `pnpm --filter apps/api prisma db seed` if needed.");

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
    // Algeria dataset
    {
      name: "Dr. Amel Bensalah",
      specialty: "cardiology",
      address: "Rue Didouche Mourad, Sidi M'Hamed, Algiers",
      latitude: 36.7659,
      longitude: 3.0602,
      phone: "+213-21-123-456",
      email: "amel.bensalah@dzcare.dz",
    },
    {
      name: "Dr. Mourad Kaci",
      specialty: "dentistry",
      address: "Avenue de l'ANP, Bir El Djir, Oran",
      latitude: 35.7206,
      longitude: -0.5703,
      phone: "+213-41-789-321",
      email: "mourad.kaci@oran-smile.dz",
    },
    {
      name: "Dr. Yasmine Laouar",
      specialty: "dermatology",
      address: "Boulevard de la Liberté, Constantine",
      latitude: 36.3574,
      longitude: 6.6099,
      phone: "+213-31-456-789",
      email: "yasmine.laouar@derma-constantine.dz",
    },
    {
      name: "Dr. Adel Kerkar",
      specialty: "pediatrics",
      address: "Cité Sidi Salem, Annaba",
      latitude: 36.8995,
      longitude: 7.7647,
      phone: "+213-38-210-555",
      email: "adel.kerkar@annaba-kids.dz",
    },
    {
      name: "Dr. Lila Benhabyles",
      specialty: "orthopedics",
      address: "Boulevard Colonel Lotfi, Tlemcen",
      latitude: 34.8828,
      longitude: -1.3167,
      phone: "+213-43-250-777",
      email: "lila.benhabyles@tlemcen-ortho.dz",
    },
    {
      name: "Dr. Karim Gherbi",
      specialty: "general practice",
      address: "Rue des Frères Aissiou, Blida",
      latitude: 36.4689,
      longitude: 2.8286,
      phone: "+213-25-330-888",
      email: "karim.gherbi@blida-familycare.dz",
    },
    {
      name: "Dr. Nabila Cheriet",
      specialty: "neurology",
      address: "Avenue de l'Indépendance, Sétif",
      latitude: 36.1911,
      longitude: 5.4108,
      phone: "+213-36-550-222",
      email: "nabila.cheriet@setif-neuro.dz",
    },
    {
      name: "Dr. Farid Bouzid",
      specialty: "ophthalmology",
      address: "Rue de la Wilaya, Béjaïa",
      latitude: 36.7515,
      longitude: 5.0645,
      phone: "+213-34-990-444",
      email: "farid.bouzid@bejaia-vision.dz",
    },
    {
      name: "Dr. Souad Messaoudi",
      specialty: "internal medicine",
      address: "Quartier Sidi Abbaz, Ghardaïa",
      latitude: 32.4891,
      longitude: 3.6736,
      phone: "+213-29-720-333",
      email: "souad.messaoudi@ghardaia-clinic.dz",
    },
    {
      name: "Dr. Hakim Ouali",
      specialty: "otolaryngology",
      address: "Rue Lamali Ahmed, Tizi Ouzou",
      latitude: 36.7071,
      longitude: 4.0483,
      phone: "+213-26-450-666",
      email: "hakim.ouali@tizi-ent.dz",
    },
    {
      name: "Dr. Rania Benyahia",
      specialty: "cardiology",
      address: "Rue Emir Abdelkader, Souk Ahras",
      latitude: 36.2866,
      longitude: 7.9515,
      phone: "+213-37-770-210",
      email: "rania.benyahia@soukahras-heart.dz",
    },
    {
      name: "Dr. Salim Boutaibi",
      specialty: "general practice",
      address: "Boulevard du 1er Novembre 1954, Souk Ahras",
      latitude: 36.2842,
      longitude: 7.9528,
      phone: "+213-37-770-220",
      email: "salim.boutaibi@soukahras-family.dz",
    },
    {
      name: "Dr. Hania Guemari",
      specialty: "internal medicine",
      address: "Rue de la République, Guelma",
      latitude: 36.4603,
      longitude: 7.4266,
      phone: "+213-37-220-440",
      email: "hania.guemari@guelma-care.dz",
    },
    {
      name: "Dr. Mehdi Boukra",
      specialty: "cardiology",
      address: "Avenue de l'ALN, Tebessa",
      latitude: 35.4071,
      longitude: 8.1222,
      phone: "+213-37-510-330",
      email: "mehdi.boukra@tebessa-heart.dz",
    },
    {
      name: "Dr. Ikram Sahraoui",
      specialty: "pediatrics",
      address: "Route Nationale 16, Souk Ahras",
      latitude: 36.2779,
      longitude: 7.9387,
      phone: "+213-37-770-260",
      email: "ikram.sahraoui@soukahras-kids.dz",
    },
    // Additional Cardiologists
    {
      name: "Dr. Ahmed Maasmi",
      specialty: "cardiology",
      address: "Avenue Mustapha Ben Boulaid, Algiers",
      latitude: 36.7525,
      longitude: 3.042,
      phone: "+213-21-234-567",
      email: "ahmed.maasmi@cardio-algiers.dz",
    },
    {
      name: "Dr. Fatima Zohra Boudiaf",
      specialty: "cardiology",
      address: "Boulevard de la République, Oran",
      latitude: 35.6971,
      longitude: -0.6337,
      phone: "+213-41-345-678",
      email: "fatima.boudiaf@cardio-oran.dz",
    },
    {
      name: "Dr. Samir Khelifi",
      specialty: "cardiology",
      address: "Rue Ali Kafi, Constantine",
      latitude: 36.365,
      longitude: 6.6147,
      phone: "+213-31-456-789",
      email: "samir.khelifi@cardio-constantine.dz",
    },
    {
      name: "Dr. Leila Benali",
      specialty: "cardiology",
      address: "Avenue de l'Indépendance, Annaba",
      latitude: 36.9,
      longitude: 7.7667,
      phone: "+213-38-567-890",
      email: "leila.benali@cardio-annaba.dz",
    },
    {
      name: "Dr. Youssef Hamdi",
      specialty: "cardiology",
      address: "Rue de la Santé, Blida",
      latitude: 36.4701,
      longitude: 2.8277,
      phone: "+213-25-678-901",
      email: "youssef.hamdi@cardio-blida.dz",
    },
    {
      name: "Dr. Nadia Merzoug",
      specialty: "cardiology",
      address: "Boulevard Colonel Amirouche, Tizi Ouzou",
      latitude: 36.7119,
      longitude: 4.0458,
      phone: "+213-26-789-012",
      email: "nadia.merzoug@cardio-tizi.dz",
    },
    {
      name: "Dr. Omar Belkacem",
      specialty: "cardiology",
      address: "Avenue de la Révolution, Sétif",
      latitude: 36.1914,
      longitude: 5.4137,
      phone: "+213-36-890-123",
      email: "omar.belkacem@cardio-setif.dz",
    },
    {
      name: "Dr. Khadija Saadi",
      specialty: "cardiology",
      address: "Rue de la Liberté, Béjaïa",
      latitude: 36.7509,
      longitude: 5.0567,
      phone: "+213-34-901-234",
      email: "khadija.saadi@cardio-bejaia.dz",
    },
    {
      name: "Dr. Mohamed Tarek",
      specialty: "cardiology",
      address: "Boulevard de la Victoire, Batna",
      latitude: 35.5559,
      longitude: 6.1746,
      phone: "+213-33-012-345",
      email: "mohamed.tarek@cardio-batna.dz",
    },
    {
      name: "Dr. Amina Chergui",
      specialty: "cardiology",
      address: "Avenue du 1er Novembre, Djelfa",
      latitude: 34.6704,
      longitude: 3.2507,
      phone: "+213-27-123-456",
      email: "amina.chergui@cardio-djelfa.dz",
    },
    {
      name: "Dr. Robert Martinez",
      specialty: "cardiology",
      address: "789 Heart Center Blvd, New York, NY 10006",
      latitude: 40.7589,
      longitude: -73.9851,
      phone: "+1-555-0106",
      email: "robert.martinez@heartcare.com",
    },
    {
      name: "Dr. Jennifer Lee",
      specialty: "cardiology",
      address: "321 Cardiovascular Center, New York, NY 10007",
      latitude: 40.7505,
      longitude: -73.9934,
      phone: "+1-555-0107",
      email: "jennifer.lee@cardio-ny.com",
    },
    {
      name: "Dr. David Thompson",
      specialty: "cardiology",
      address: "555 Cardiac Care Ave, New York, NY 10008",
      latitude: 40.7614,
      longitude: -73.9776,
      phone: "+1-555-0108",
      email: "david.thompson@heartcenter.com",
    },
  ];

  for (const doctor of doctors) {
    if (doctor.email) {
      const existing = await prisma.doctor.findFirst({
        where: { email: doctor.email },
      });

      if (existing) {
        await prisma.doctor.update({
          where: { id: existing.id },
          data: doctor,
        });
        continue;
      }
    }

    await prisma.doctor.create({ data: doctor });
  }

  const persistedDoctors = await prisma.doctor.findMany();
  const doctorsByEmail = new Map(persistedDoctors.map((doctor) => [doctor.email, doctor]));

  const patients = [
    { name: "Nadia Boulifa", email: "nadia.boulifa@example.com", phone: "+213-550-100-200" },
    { name: "Karim Djemai", email: "karim.djemai@example.com", phone: "+213-550-300-111" },
    { name: "Lamia Cherif", email: "lamia.cherif@example.com", phone: "+213-550-444-222" },
    { name: "Yacine Ferhat", email: "yacine.ferhat@example.com", phone: "+213-550-555-333" },
  ];

  const patientMap = new Map<string, { id: string; email: string; name: string; phone?: string | null }>();

  for (const patient of patients) {
    const record = await prisma.patient.upsert({
      where: { email: patient.email },
      update: {
        name: patient.name,
        phone: patient.phone,
      },
      create: {
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
      },
    });
    patientMap.set(record.email, record);
  }

  const sampleAppointments = [
    {
      doctorEmail: "amel.bensalah@dzcare.dz",
      patientEmail: "nadia.boulifa@example.com",
      hoursFromNow: -48,
      durationMinutes: 30,
      reason: "Follow-up on chest pain",
      notes: "Patient mentioned occasional dizziness.",
      symptoms: ["chest pain", "dizziness"],
      status: "completed",
    },
    {
      doctorEmail: "yasmine.laouar@derma-constantine.dz",
      patientEmail: "lamia.cherif@example.com",
      hoursFromNow: -5,
      durationMinutes: 30,
      reason: "Persistent rash",
      notes: "Suspected allergic reaction to detergent.",
      symptoms: ["rash", "itching"],
      status: "confirmed",
    },
    {
      doctorEmail: "karim.gherbi@blida-familycare.dz",
      patientEmail: "karim.djemai@example.com",
      hoursFromNow: 12,
      durationMinutes: 30,
      reason: "General check-up",
      notes: "Patient requested fasting lab work.",
      symptoms: ["fatigue"],
      status: "confirmed",
    },
    {
      doctorEmail: "farid.bouzid@bejaia-vision.dz",
      patientEmail: "yacine.ferhat@example.com",
      hoursFromNow: 30,
      durationMinutes: 45,
      reason: "Blurred vision",
      notes: "Needs refraction assessment.",
      symptoms: ["blurred vision"],
      status: "confirmed",
    },
  ];

  for (const sample of sampleAppointments) {
    const doctor = sample.doctorEmail ? doctorsByEmail.get(sample.doctorEmail) : undefined;
    const patient = patientMap.get(sample.patientEmail);
    if (!doctor || !patient) continue;

    const startUtc = new Date(Date.now() + sample.hoursFromNow * 60 * 60 * 1000);
    const endUtc = new Date(startUtc.getTime() + sample.durationMinutes * 60 * 1000);

    const appointment = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        startUtc,
        endUtc,
        userName: patient.name,
        userEmail: patient.email,
        userPhone: patient.phone || null,
        reason: sample.reason,
        notes: sample.notes,
        symptoms: JSON.stringify(sample.symptoms),
        status: sample.status,
      },
    });

    await Promise.all(
      sample.symptoms.map((symptom) =>
        prisma.patientSymptom.upsert({
          where: {
            patientId_symptom: {
              patientId: patient.id,
              symptom: symptom.trim().toLowerCase(),
            },
          },
          update: {
            notedAt: new Date(),
          },
          create: {
            patientId: patient.id,
            symptom: symptom.trim().toLowerCase(),
          },
        })
      )
    );
  }

  console.log(`Created ${doctors.length} doctors`);
  console.log(`Created ${patients.length} patients with historical appointments`);
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

