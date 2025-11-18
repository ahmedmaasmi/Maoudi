"use client";

import { useState, useEffect } from "react";
import { apiClient, Doctor } from "@/lib/api";
import { Search, MapPin, Phone, Mail, Stethoscope } from "lucide-react";

export default function DoctorsList() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getAllDoctors();
      setDoctors(data);
    } catch (err) {
      setError("Failed to load doctors");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter((doctor) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      doctor.name.toLowerCase().includes(term) ||
      doctor.specialty.toLowerCase().includes(term) ||
      doctor.address.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search doctors by name, specialty, or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Doctors List */}
      {filteredDoctors.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Stethoscope className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No doctors found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDoctors.map((doctor) => (
            <div
              key={doctor.id}
              className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">{doctor.name}</h3>
                  <p className="text-gray-400 capitalize">{doctor.specialty}</p>
                </div>
                {doctor.distance !== undefined && (
                  <span className="text-sm text-gray-500">
                    {doctor.distance.toFixed(1)} km
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300">
                  <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm">{doctor.address}</span>
                </div>
                {doctor.phone && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-sm">{doctor.phone}</span>
                  </div>
                )}
                {doctor.email && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-sm">{doctor.email}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {searchTerm && filteredDoctors.length > 0 && (
        <p className="text-sm text-gray-500 text-center">
          Showing {filteredDoctors.length} of {doctors.length} doctors
        </p>
      )}
    </div>
  );
}

