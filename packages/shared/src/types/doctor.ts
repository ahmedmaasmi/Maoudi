export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  email?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

