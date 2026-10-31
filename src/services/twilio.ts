import Twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.warn('Twilio credentials not configured');
}

const twilioClient = accountSid && authToken ? Twilio(accountSid, authToken) : null;

export interface SendSmsParams {
  to: string;
  from: string;
  body: string;
}

export async function sendSms({ to, from, body }: SendSmsParams): Promise<string | null> {
  if (!twilioClient) {
    console.error('Twilio client not initialized');
    return null;
  }

  try {
    const message = await twilioClient.messages.create({
      to,
      from,
      body,
    });
    return message.sid;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
}

export async function searchAvailableNumbers(areaCode?: string): Promise<Array<{
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}>> {
  if (!twilioClient) {
    throw new Error('Twilio client not initialized');
  }

  try {
    const numbers = await twilioClient.availablePhoneNumbers('US')
      .local.list({
        areaCode: areaCode ? parseInt(areaCode, 10) : undefined,
        smsEnabled: true,
        limit: 10,
      });

    return numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
    }));
  } catch (error) {
    console.error('Failed to search available numbers:', error);
    throw error;
  }
}

export async function purchasePhoneNumber(phoneNumber: string, webhookUrl: string): Promise<{
  sid: string;
  phoneNumber: string;
  friendlyName: string;
}> {
  if (!twilioClient) {
    throw new Error('Twilio client not initialized');
  }

  try {
    const purchased = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber,
      smsUrl: webhookUrl,
      smsMethod: 'POST',
    });

    return {
      sid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
      friendlyName: purchased.friendlyName,
    };
  } catch (error) {
    console.error('Failed to purchase phone number:', error);
    throw error;
  }
}

export async function releasePhoneNumber(sid: string): Promise<void> {
  if (!twilioClient) {
    throw new Error('Twilio client not initialized');
  }

  try {
    await twilioClient.incomingPhoneNumbers(sid).remove();
  } catch (error) {
    console.error('Failed to release phone number:', error);
    throw error;
  }
}

export async function updatePhoneNumberWebhook(sid: string, webhookUrl: string): Promise<void> {
  if (!twilioClient) {
    throw new Error('Twilio client not initialized');
  }

  try {
    await twilioClient.incomingPhoneNumbers(sid).update({
      smsUrl: webhookUrl,
      smsMethod: 'POST',
    });
  } catch (error) {
    console.error('Failed to update phone number webhook:', error);
    throw error;
  }
}

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) return false;
  return Twilio.validateRequest(authToken, signature, url, params);
}
