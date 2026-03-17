export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bloodType: string;
  allergies: string[] | string; // Allow for both array and string for backend/frontend flexibility
  medicalConditions: string[] | string;
  termsAccepted: boolean;
}

export interface Incident {
  id: string;
  userId: string;
  paramedicId: string;
  timestamp: string;
  location?: string;
  notes: string;
}
