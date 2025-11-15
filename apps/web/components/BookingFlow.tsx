"use client";

import { useState } from "react";
import { apiClient, type Doctor, type AvailabilitySlot } from "@/lib/api";

interface BookingState {
  step: "search" | "select-doctor" | "select-slot" | "confirm" | "complete";
  doctors: Doctor[];
  selectedDoctor: Doctor | null;
  slots: AvailabilitySlot[];
  selectedSlot: AvailabilitySlot | null;
  userDetails: {
    name: string;
    email: string;
    phone: string;
  };
  bookingResult: {
    appointmentId: string;
    calendarLink: string;
  } | null;
}

export default function BookingFlow() {
  const [state, setState] = useState<BookingState>({
    step: "search",
    doctors: [],
    selectedDoctor: null,
    slots: [],
    selectedSlot: null,
    userDetails: { name: "", email: "", phone: "" },
    bookingResult: null,
  });

  const [searchParams, setSearchParams] = useState({
    specialty: "",
    location: "",
    lat: 40.7128,
    lng: -74.0060,
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchParams.specialty.trim()) return;

    setIsLoading(true);
    try {
      let lat = searchParams.lat;
      let lng = searchParams.lng;

      if (searchParams.location) {
        const geocode = await apiClient.geocode(searchParams.location);
        lat = geocode.lat;
        lng = geocode.lng;
      } else {
        // Try to get user's location
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch (error) {
          console.warn("Geolocation failed, using default");
        }
      }

      const doctors = await apiClient.searchDoctors(searchParams.specialty, lat, lng, 10);
      setState((prev) => ({
        ...prev,
        doctors,
        step: doctors.length > 0 ? "select-doctor" : "search",
      }));
    } catch (error) {
      console.error("Search error:", error);
      alert("Failed to search doctors. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDoctor = async (doctor: Doctor) => {
    setState((prev) => ({ ...prev, selectedDoctor: doctor, step: "select-slot" }));
    setIsLoading(true);

    try {
      // Get availability for next 7 days
      const startRange = new Date();
      startRange.setHours(9, 0, 0, 0); // 9 AM
      const endRange = new Date();
      endRange.setDate(endRange.getDate() + 7);
      endRange.setHours(17, 0, 0, 0); // 5 PM

      const slots = await apiClient.checkAvailability(
        doctor.id,
        startRange.toISOString(),
        endRange.toISOString(),
        30
      );

      setState((prev) => ({ ...prev, slots }));
    } catch (error) {
      console.error("Availability error:", error);
      alert("Failed to load availability. Please try again.");
      setState((prev) => ({ ...prev, step: "select-doctor" }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSlot = (slot: AvailabilitySlot) => {
    setState((prev) => ({ ...prev, selectedSlot: slot, step: "confirm" }));
  };

  const handleConfirmBooking = async () => {
    if (!state.selectedDoctor || !state.selectedSlot || !state.userDetails.name || !state.userDetails.email) {
      alert("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiClient.bookAppointment({
        doctorId: state.selectedDoctor.id,
        startUtc: state.selectedSlot.start,
        endUtc: state.selectedSlot.end,
        user: state.userDetails,
      });

      setState((prev) => ({
        ...prev,
        bookingResult: result,
        step: "complete",
      }));
    } catch (error) {
      console.error("Booking error:", error);
      alert("Failed to book appointment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (state.step === "complete" && state.bookingResult) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-green-800 mb-4">Appointment Booked!</h2>
          <p className="text-gray-700 mb-4">
            Your appointment has been successfully booked.
          </p>
          <a
            href={state.bookingResult.calendarLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            View in Google Calendar
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {state.step === "search" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Find a Doctor</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Specialty</label>
              <input
                type="text"
                value={searchParams.specialty}
                onChange={(e) =>
                  setSearchParams((prev) => ({ ...prev, specialty: e.target.value }))
                }
                placeholder="e.g., cardiology, dentistry"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Location (optional)</label>
              <input
                type="text"
                value={searchParams.location}
                onChange={(e) =>
                  setSearchParams((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="e.g., downtown, New York"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isLoading || !searchParams.specialty.trim()}
              className="w-full px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
      )}

      {state.step === "select-doctor" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Select a Doctor</h2>
          {state.doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => handleSelectDoctor(doctor)}
            >
              <h3 className="font-semibold text-lg">{doctor.name}</h3>
              <p className="text-gray-600">{doctor.specialty}</p>
              <p className="text-sm text-gray-500">{doctor.address}</p>
              {doctor.distance !== undefined && (
                <p className="text-sm text-blue-600">{doctor.distance.toFixed(1)} km away</p>
              )}
            </div>
          ))}
        </div>
      )}

      {state.step === "select-slot" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">
            Select a Time Slot - {state.selectedDoctor?.name}
          </h2>
          {isLoading ? (
            <p>Loading availability...</p>
          ) : state.slots.length === 0 ? (
            <p className="text-gray-500">No available slots found. Please try a different date range.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {state.slots.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSlot(slot)}
                  className={`px-4 py-2 border rounded-lg ${
                    state.selectedSlot?.start === slot.start
                      ? "bg-blue-500 text-white border-blue-500"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {new Date(slot.start).toLocaleString()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {state.step === "confirm" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Confirm Booking</h2>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <p className="font-semibold">{state.selectedDoctor?.name}</p>
            <p className="text-sm text-gray-600">{state.selectedDoctor?.specialty}</p>
            <p className="text-sm text-gray-600 mt-2">
              {state.selectedSlot &&
                new Date(state.selectedSlot.start).toLocaleString()}
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <input
                type="text"
                value={state.userDetails.name}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    userDetails: { ...prev.userDetails, name: e.target.value },
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email *</label>
              <input
                type="email"
                value={state.userDetails.email}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    userDetails: { ...prev.userDetails, email: e.target.value },
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone (optional)</label>
              <input
                type="tel"
                value={state.userDetails.phone}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    userDetails: { ...prev.userDetails, phone: e.target.value },
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleConfirmBooking}
              disabled={isLoading || !state.userDetails.name || !state.userDetails.email}
              className="w-full px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {isLoading ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

