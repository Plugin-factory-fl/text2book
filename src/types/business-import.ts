export interface ExtractedHour {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface ExtractedService {
  name: string;
  price: number | null;
  duration: number | null;
  description: string | null;
}

export interface ExtractedFaq {
  question: string;
  answer: string;
}

export interface ExtractedBusinessInfo {
  businessName: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  hours: ExtractedHour[] | null;
  services: ExtractedService[] | null;
  policies: {
    cancellation: string | null;
    deposit: string | null;
    late: string | null;
  } | null;
  faqs: ExtractedFaq[] | null;
}
