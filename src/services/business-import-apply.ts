import prisma from '@/lib/prisma';
import type { ExtractedBusinessInfo } from './business-import';

export interface AcceptedImport {
  businessName?: boolean;
  description?: boolean;
  address?: boolean;
  city?: boolean;
  state?: boolean;
  zipCode?: boolean;
  phone?: boolean;
  cancellationPolicy?: boolean;
  depositPolicy?: boolean;
  latePolicy?: boolean;
  hours?: boolean;
  services?: boolean;
  faqs?: boolean;
  edited?: Partial<{
    businessName: string;
    description: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
    cancellationPolicy: string;
    depositPolicy: string;
    latePolicy: string;
  }>;
}

function pick(
  extracted: string | null | undefined,
  edited: string | undefined,
  accepted: boolean | undefined
): string | undefined {
  if (!accepted) return undefined;
  const value = edited ?? extracted ?? undefined;
  return value && value.trim() ? value.trim() : undefined;
}

export async function applyExtractedBusinessInfo(
  businessId: string,
  extracted: ExtractedBusinessInfo,
  accepted: AcceptedImport
): Promise<{ updatedFields: string[]; createdFaqs: number; createdServices: number; updatedHours: number }> {
  const updatedFields: string[] = [];
  const edited = accepted.edited || {};

  const businessUpdate: Record<string, string> = {};
  const name = pick(extracted.businessName, edited.businessName, accepted.businessName);
  const description = pick(extracted.description, edited.description, accepted.description);
  const address = pick(extracted.address, edited.address, accepted.address);
  const city = pick(extracted.city, edited.city, accepted.city);
  const state = pick(extracted.state, edited.state, accepted.state);
  const zipCode = pick(extracted.zipCode, edited.zipCode, accepted.zipCode);
  const phone = pick(extracted.phone, edited.phone, accepted.phone);
  const cancellation = pick(
    extracted.policies?.cancellation,
    edited.cancellationPolicy,
    accepted.cancellationPolicy
  );
  const deposit = pick(extracted.policies?.deposit, edited.depositPolicy, accepted.depositPolicy);

  if (name) {
    businessUpdate.name = name;
    updatedFields.push('businessName');
  }
  if (description) {
    businessUpdate.description = description;
    updatedFields.push('description');
  }
  if (address) {
    businessUpdate.address = address;
    updatedFields.push('address');
  }
  if (city) {
    businessUpdate.city = city;
    updatedFields.push('city');
  }
  if (state) {
    businessUpdate.state = state;
    updatedFields.push('state');
  }
  if (zipCode) {
    businessUpdate.zipCode = zipCode;
    updatedFields.push('zipCode');
  }
  if (phone) {
    businessUpdate.phone = phone;
    updatedFields.push('phone');
  }
  if (cancellation) {
    businessUpdate.cancellationPolicy = cancellation;
    updatedFields.push('cancellationPolicy');
  }
  if (deposit) {
    businessUpdate.depositPolicyText = deposit;
    updatedFields.push('depositPolicy');
  }

  if (Object.keys(businessUpdate).length > 0) {
    await prisma.business.update({
      where: { id: businessId },
      data: businessUpdate,
    });
  }

  let updatedHours = 0;
  if (accepted.hours && extracted.hours?.length) {
    for (const rule of extracted.hours) {
      const existing = await prisma.availabilityRule.findFirst({
        where: { businessId, dayOfWeek: rule.dayOfWeek },
      });
      if (existing) {
        await prisma.availabilityRule.update({
          where: { id: existing.id },
          data: {
            startTime: rule.startTime,
            endTime: rule.endTime,
            isActive: rule.isActive,
          },
        });
      } else {
        await prisma.availabilityRule.create({
          data: {
            businessId,
            dayOfWeek: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
            isActive: rule.isActive,
          },
        });
      }
      updatedHours += 1;
    }
    updatedFields.push('hours');
  }

  let createdServices = 0;
  if (accepted.services && extracted.services?.length) {
    for (const service of extracted.services) {
      const existing = await prisma.service.findFirst({
        where: { businessId, name: { equals: service.name, mode: 'insensitive' } },
      });
      if (existing) {
        await prisma.service.update({
          where: { id: existing.id },
          data: {
            price: service.price ?? existing.price,
            duration: service.duration ?? existing.duration,
            description: service.description ?? existing.description,
          },
        });
      } else {
        await prisma.service.create({
          data: {
            businessId,
            name: service.name,
            price: service.price,
            duration: service.duration ?? 60,
            description: service.description,
          },
        });
      }
      createdServices += 1;
    }
    updatedFields.push('services');
  }

  let createdFaqs = 0;
  if (accepted.faqs && extracted.faqs?.length) {
    for (const faq of extracted.faqs) {
      const existing = await prisma.fAQ.findFirst({
        where: {
          businessId,
          question: { equals: faq.question, mode: 'insensitive' },
        },
      });
      if (existing) {
        await prisma.fAQ.update({
          where: { id: existing.id },
          data: { answer: faq.answer },
        });
      } else {
        await prisma.fAQ.create({
          data: {
            businessId,
            question: faq.question,
            answer: faq.answer,
          },
        });
      }
      createdFaqs += 1;
    }
    updatedFields.push('faqs');
  }

  return { updatedFields, createdFaqs, createdServices, updatedHours };
}
