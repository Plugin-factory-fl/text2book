/**
 * Assistant Tools Tests
 * 
 * Tests for the owner assistant's CRUD tool handlers.
 * These verify that tools work correctly and maintain data isolation.
 */

import {
  ASSISTANT_TOOL_DEFINITIONS,
  executeAssistantTool,
  AssistantToolContext,
} from '../src/services/assistant-tools';
import { validateClientSafeContext } from '../src/services/agent-context';

describe('Assistant Tool Definitions', () => {
  it('should have all required tool definitions', () => {
    const toolNames = ASSISTANT_TOOL_DEFINITIONS.map((t) => t.function.name);

    expect(toolNames).toContain('list_services');
    expect(toolNames).toContain('create_service');
    expect(toolNames).toContain('update_service');
    expect(toolNames).toContain('delete_service');
    expect(toolNames).toContain('get_availability');
    expect(toolNames).toContain('update_availability');
    expect(toolNames).toContain('get_business_info');
    expect(toolNames).toContain('update_business_info');
    expect(toolNames).toContain('create_faq');
    expect(toolNames).toContain('update_faq');
    expect(toolNames).toContain('delete_faq');
    expect(toolNames).toContain('get_deposit_settings');
    expect(toolNames).toContain('update_deposit_settings');
    expect(toolNames).toContain('list_trusted_clients');
    expect(toolNames).toContain('add_trusted_client');
    expect(toolNames).toContain('remove_trusted_client');
    expect(toolNames).toContain('list_bookings');
    expect(toolNames).toContain('create_booking');
    expect(toolNames).toContain('cancel_booking');
    expect(toolNames).toContain('reschedule_booking');
    expect(toolNames).toContain('get_reminder_settings');
    expect(toolNames).toContain('update_reminder_settings');
    expect(toolNames).toContain('get_client_info');
    expect(toolNames).toContain('update_client_name');
  });

  it('should have valid function schema for each tool', () => {
    for (const tool of ASSISTANT_TOOL_DEFINITIONS) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeDefined();
      expect(tool.function.description).toBeDefined();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
    }
  });

  it('should have required properties marked correctly', () => {
    const createServiceTool = ASSISTANT_TOOL_DEFINITIONS.find(
      (t) => t.function.name === 'create_service'
    );
    expect(createServiceTool?.function.parameters.required).toContain('name');
    expect(createServiceTool?.function.parameters.required).toContain('duration');
    expect(createServiceTool?.function.parameters.required).toContain('price');

    const createBookingTool = ASSISTANT_TOOL_DEFINITIONS.find(
      (t) => t.function.name === 'create_booking'
    );
    expect(createBookingTool?.function.parameters.required).toContain('serviceId');
    expect(createBookingTool?.function.parameters.required).toContain('clientName');
    expect(createBookingTool?.function.parameters.required).toContain('clientPhone');
    expect(createBookingTool?.function.parameters.required).toContain('startTime');
  });
});

describe('Tool Executor', () => {
  const mockContext: AssistantToolContext = {
    businessId: 'test-business-id',
    userId: 'test-user-id',
  };

  it('should return error for unknown tool', async () => {
    const result = await executeAssistantTool(mockContext, 'unknown_tool', {});
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown tool');
  });
});

describe('Data Isolation', () => {
  it('should not include owner tools in client-safe context validation', () => {
    const ownerContext = {
      business: { name: 'Test', timezone: 'UTC', reminderHoursBefore: 24 },
      services: [],
      availability: [],
      faqs: [],
      depositPolicy: { enabled: false, defaultAmount: 0, holdMinutes: 30, policyText: '' },
      thisClient: { phone: '+1', name: null, isTrusted: false, upcomingBookings: [], pastBookingCount: 0 },
      metrics: { totalClients: 10 },
      allClients: [{ phone: '+15551234567' }],
    };

    const result = validateClientSafeContext(ownerContext);
    expect(result.isValid).toBe(false);
    expect(result.violations).toContain('Context contains metrics (owner-only)');
    expect(result.violations).toContain('Context contains allClients (owner-only)');
  });

  it('should pass validation for client-safe context', () => {
    const clientContext = {
      business: { name: 'Test', timezone: 'UTC', reminderHoursBefore: 24 },
      services: [{ id: '1', name: 'Haircut', description: null, duration: 30, price: 50, isActive: true, depositRequired: false, depositAmount: null }],
      availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }],
      faqs: [{ question: 'Where?', answer: 'Here' }],
      depositPolicy: { enabled: false, defaultAmount: 0, holdMinutes: 30, policyText: '' },
      thisClient: { phone: '+15551234567', name: 'John', isTrusted: false, upcomingBookings: [], pastBookingCount: 2 },
    };

    const result = validateClientSafeContext(clientContext);
    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

describe('Destructive Action Confirmations', () => {
  it('should define delete tools with confirmation parameter', () => {
    const deleteTools = ASSISTANT_TOOL_DEFINITIONS.filter((t) =>
      t.function.name.includes('delete') || t.function.name.includes('cancel') || t.function.name.includes('remove')
    );

    for (const tool of deleteTools) {
      const hasConfirmedParam = tool.function.parameters.properties?.confirmed !== undefined;
      expect(hasConfirmedParam).toBe(true);
    }
  });

  it('should define client-facing tools with confirmation parameter', () => {
    const clientFacingTools = ['create_booking', 'reschedule_booking', 'cancel_booking'];

    for (const toolName of clientFacingTools) {
      const tool = ASSISTANT_TOOL_DEFINITIONS.find((t) => t.function.name === toolName);
      expect(tool).toBeDefined();
      expect(tool?.function.parameters.properties?.confirmed).toBeDefined();
    }
  });
});

describe('Tool Categories', () => {
  it('should have service management tools', () => {
    const serviceTools = ASSISTANT_TOOL_DEFINITIONS.filter((t) =>
      t.function.name.includes('service')
    );
    expect(serviceTools.length).toBeGreaterThanOrEqual(4);
  });

  it('should have availability/hours tools', () => {
    const availabilityTools = ASSISTANT_TOOL_DEFINITIONS.filter((t) =>
      t.function.name.includes('availability')
    );
    expect(availabilityTools.length).toBeGreaterThanOrEqual(2);
  });

  it('should have business info and FAQ tools', () => {
    const infoTools = ASSISTANT_TOOL_DEFINITIONS.filter((t) =>
      t.function.name.includes('business_info') || t.function.name.includes('faq')
    );
    expect(infoTools.length).toBeGreaterThanOrEqual(5);
  });

  it('should have deposit and trusted client tools', () => {
    const depositTools = ASSISTANT_TOOL_DEFINITIONS.filter((t) =>
      t.function.name.includes('deposit') || t.function.name.includes('trusted')
    );
    expect(depositTools.length).toBeGreaterThanOrEqual(5);
  });

  it('should have booking management tools', () => {
    const bookingTools = ASSISTANT_TOOL_DEFINITIONS.filter((t) =>
      t.function.name.includes('booking')
    );
    expect(bookingTools.length).toBeGreaterThanOrEqual(4);
  });

  it('should have client management tools', () => {
    const clientTools = ASSISTANT_TOOL_DEFINITIONS.filter((t) =>
      t.function.name.includes('client')
    );
    expect(clientTools.length).toBeGreaterThanOrEqual(4);
  });
});
