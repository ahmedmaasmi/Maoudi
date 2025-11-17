# Test Prompts for Appointment Booking System

These test prompts can be used to test the appointment booking system. They include various scenarios with different levels of information provided.

## Complete Information Prompts (Auto-Booking Should Work)

### 1. Cardiologist - Complete Info
```
Hello, I'm Ahmed and my heart is hurting me. My name is Ahmed and my email is ahmedmaasmi.contact@gmail.com and I want an appointment tomorrow morning around 9am.
```

### 2. Cardiologist - Alternative Format
```
Hi, my name is Sarah and I need to see a cardiologist urgently. My email is sarah.johnson@test.com and I'm available tomorrow at 2pm.
```

### 3. Dermatologist - Complete Info
```
Hello, I'm John and I have a skin rash. My email is john.doe@example.com and I need an appointment tomorrow at 10am.
```

### 4. Dentist - Complete Info
```
I need a dentist appointment. My name is Maria, email is maria.garcia@test.com, and I want to see someone tomorrow afternoon around 3pm.
```

## Progressive Information Prompts (Multi-turn Conversation)

### 5. Step-by-Step Booking
**Turn 1:**
```
I need to see a cardiologist for chest pain.
```

**Turn 2:**
```
My name is Ahmed and my email is ahmed@test.com
```

**Turn 3:**
```
Tomorrow morning at 9am would be perfect.
```

### 6. Progressive Booking with Location
**Turn 1:**
```
I'm looking for a cardiologist near Algiers.
```

**Turn 2:**
```
My name is Fatima, email is fatima@test.com
```

**Turn 3:**
```
Can I get an appointment tomorrow at 11am?
```

## Specialty-Specific Prompts

### 7. Cardiology - Heart Pain
```
Hello, I'm Ahmed. My heart is hurting and I need to see a cardiologist urgently. My email is ahmed.maasmi@test.com and I want an appointment tomorrow morning at 9am.
```

### 8. Dermatology - Skin Issues
```
Hi, I'm Sarah and I have a persistent skin rash. My email is sarah.smith@test.com. Can I see a dermatologist tomorrow at 2pm?
```

### 9. Pediatrics - Child Care
```
I need a pediatrician for my child. My name is Leila, email is leila@test.com, and I want an appointment tomorrow at 10am.
```

### 10. General Practice - Check-up
```
I need a general check-up. My name is Karim, email is karim@test.com, and I'm available tomorrow afternoon around 3pm.
```

## Location-Based Prompts

### 11. Algiers Location (Specified)
```
I need a cardiologist in Algiers. My name is Ahmed, email is ahmed@test.com, and I want an appointment tomorrow at 9am.
```

### 12. Oran Location (Specified)
```
Looking for a cardiologist near Oran. My name is Fatima, email is fatima@test.com, tomorrow at 2pm please.
```

### 13. New York Location (Specified)
```
I need a cardiologist in New York. My name is John, email is john@test.com, and I want an appointment tomorrow morning.
```

## Location Preference Prompts

### 14. Ask for Location Preference
**Turn 1:**
```
I need a cardiologist. My name is Ahmed, email is ahmed@test.com, tomorrow at 9am.
```

**Turn 2 (System asks):**
```
Would you like me to find doctors near your current location, or would you prefer to specify a location?
```

**Turn 3 - Option A (Use Current Location):**
```
Use my location
```
or
```
Near me
```
or
```
Current location
```

**Turn 3 - Option B (Specify Location):**
```
Algiers
```
or
```
I want doctors in Oran
```
or
```
Near New York
```

### 15. Direct Current Location Request
```
I need a cardiologist near my current location. My name is Ahmed, email is ahmed@test.com, tomorrow at 9am.
```

### 16. Direct Location Specification
```
I need a cardiologist in Algiers. My name is Ahmed, email is ahmed@test.com, tomorrow at 9am.
```

## Time Variations

### 14. Morning Appointment
```
I need a cardiologist appointment tomorrow morning. My name is Ahmed, email is ahmed@test.com.
```

### 15. Afternoon Appointment
```
Can I book a cardiologist for tomorrow afternoon? My name is Sarah, email is sarah@test.com.
```

### 16. Specific Time
```
I need to see a cardiologist tomorrow at 9am. My name is Ahmed, email is ahmed@test.com.
```

### 17. Urgent Appointment
```
URGENT: I need a cardiologist immediately. My heart is hurting. My name is Ahmed, email is ahmed@test.com, tomorrow at 9am.
```

## Edge Cases and Variations

### 18. Name Extraction Test
```
Hello im ahmed and my heart is hurting me, my name is ahmed and my email is ahmedmaasmi.contact@gmail.com and i want a appointment tomorrow morning around 9 am
```

### 19. Minimal Information
```
I need a cardiologist appointment. Email: ahmed@test.com
```

### 20. Name in Email
```
I need a cardiologist. My email is ahmed.maasmi@test.com and I want tomorrow at 9am.
```

### 21. Phone Number Included
```
I need a cardiologist. My name is Ahmed, email is ahmed@test.com, phone is +213-550-123-456, and I want tomorrow at 9am.
```

### 22. Symptoms Mentioned
```
I have chest pain and need a cardiologist. My name is Ahmed, email is ahmed@test.com, tomorrow at 9am.
```

### 23. Multiple Symptoms
```
I'm experiencing heart pain and dizziness. I need a cardiologist. My name is Ahmed, email is ahmed@test.com, tomorrow morning.
```

## Different Specialty Tests

### 24. Neurology
```
I need a neurologist for headaches. My name is Nabila, email is nabila@test.com, tomorrow at 10am.
```

### 25. Ophthalmology
```
I have blurred vision and need an ophthalmologist. My name is Farid, email is farid@test.com, tomorrow at 2pm.
```

### 26. Internal Medicine
```
I need an internal medicine doctor. My name is Souad, email is souad@test.com, tomorrow at 11am.
```

## Complex Scenarios

### 27. Multiple Requirements
```
I need a cardiologist in Algiers for chest pain. My name is Ahmed, email is ahmed@test.com, phone is +213-550-123-456, and I want tomorrow morning at 9am.
```

### 28. Follow-up Appointment
```
I need a follow-up appointment with my cardiologist. My name is Ahmed, email is ahmed@test.com, tomorrow at 2pm.
```

### 29. Weekend Appointment (if supported)
```
Can I get a cardiologist appointment this Saturday? My name is Ahmed, email is ahmed@test.com.
```

## Test Data Reference

### Available Cardiologists:
- Dr. Sarah Johnson - New York (sarah.johnson@example.com)
- Dr. Amel Bensalah - Algiers (amel.bensalah@dzcare.dz)
- Dr. Rania Benyahia - Souk Ahras (rania.benyahia@soukahras-heart.dz)
- Dr. Mehdi Boukra - Tebessa (mehdi.boukra@tebessa-heart.dz)
- Dr. Ahmed Maasmi - Algiers (ahmed.maasmi@cardio-algiers.dz)
- Dr. Fatima Zohra Boudiaf - Oran (fatima.boudiaf@cardio-oran.dz)
- Dr. Samir Khelifi - Constantine (samir.khelifi@cardio-constantine.dz)
- Dr. Leila Benali - Annaba (leila.benali@cardio-annaba.dz)
- Dr. Youssef Hamdi - Blida (youssef.hamdi@cardio-blida.dz)
- Dr. Nadia Merzoug - Tizi Ouzou (nadia.merzoug@cardio-tizi.dz)
- Dr. Omar Belkacem - Sétif (omar.belkacem@cardio-setif.dz)
- Dr. Khadija Saadi - Béjaïa (khadija.saadi@cardio-bejaia.dz)
- Dr. Mohamed Tarek - Batna (mohamed.tarek@cardio-batna.dz)
- Dr. Amina Chergui - Djelfa (amina.chergui@cardio-djelfa.dz)
- Dr. Robert Martinez - New York (robert.martinez@heartcare.com)
- Dr. Jennifer Lee - New York (jennifer.lee@cardio-ny.com)
- Dr. David Thompson - New York (david.thompson@heartcenter.com)

### Other Specialties Available:
- Dentistry: Dr. Michael Chen, Dr. Mourad Kaci
- Dermatology: Dr. Emily Rodriguez, Dr. Yasmine Laouar
- Pediatrics: Dr. James Wilson, Dr. Adel Kerkar, Dr. Ikram Sahraoui
- General Practice: Dr. Lisa Anderson, Dr. Karim Gherbi, Dr. Salim Boutaibi
- Neurology: Dr. Nabila Cheriet
- Ophthalmology: Dr. Farid Bouzid
- Internal Medicine: Dr. Souad Messaoudi, Dr. Hania Guemari
- Orthopedics: Dr. Lila Benhabyles
- Otolaryngology: Dr. Hakim Ouali

## Testing Checklist

When testing, verify:
- [ ] Name is extracted correctly
- [ ] Email is extracted correctly
- [ ] Specialty is identified correctly
- [ ] Time/date is parsed correctly
- [ ] Doctor is found from database
- [ ] Availability is checked
- [ ] Appointment is booked successfully
- [ ] Response is user-friendly
- [ ] Logs show the complete flow

## Expected Behavior

1. **Complete Info Prompts**: Should auto-book immediately
2. **Progressive Prompts**: Should collect info across multiple turns
3. **Location-Based**: Should find nearest doctor
4. **Time Variations**: Should parse and use the requested time
5. **Edge Cases**: Should handle gracefully and ask for missing info

## Notes

- All times are in UTC (system converts local time)
- Working hours: 9 AM - 5 PM (default)
- Appointment duration: 30 minutes (default)
- System uses local calendar (no Google Calendar needed)
- All doctors are available for booking (no calendar credentials required)

