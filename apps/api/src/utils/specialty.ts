const specialtySynonyms: Record<string, string[]> = {
  cardiology: ["cardiologist", "heart doctor", "heart specialist", "card geologist", "car geologist"],
  dentistry: ["dentist", "dental"],
  dermatology: ["dermatologist", "skin doctor"],
  pediatrics: ["pediatrician", "child doctor"],
  "general practice": ["general practitioner", "primary care", "family doctor", "gp"],
  neurology: ["neurologist"],
  orthopedics: ["orthopedist", "orthopedic surgeon"],
  ophthalmology: ["ophthalmologist", "eye doctor"],
  otolaryngology: ["ent", "ear nose throat", "ear nose and throat", "ent specialist"],
  "internal medicine": ["internist"],
};

/**
 * Normalizes a specialty string to its canonical form.
 * For example, "cardiologist" -> "cardiology", "dentist" -> "dentistry"
 */
export function normalizeSpecialty(value: string): string {
  const normalized = value.trim().toLowerCase();
  for (const [canonical, synonyms] of Object.entries(specialtySynonyms)) {
    if (canonical === normalized || synonyms.includes(normalized)) {
      return canonical;
    }
  }
  return normalized;
}

