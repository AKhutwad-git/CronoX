import { logger } from '../../lib/logger';

export type NotificationType =
  | 'purchase_completed'
  | 'purchase_confirmed'
  | 'session_scheduled'
  | 'session_reminder'
  | 'session_started'
  | 'session_completed'
  | 'booking_cancelled';

export interface NotificationPayload {
  type: NotificationType;
  recipientEmail: string;
  data: Record<string, unknown>;
}

/**
 * Console-based notification service.
 * Replace with email/push provider (SendGrid, Firebase, etc.) in production.
 */
export class NotificationService {
  async send(payload: NotificationPayload): Promise<void> {
    const { type, recipientEmail, data } = payload;

    const messages: Record<NotificationType, string> = {
      purchase_completed: `🔔 New purchase! Buyer "${data.buyerEmail}" purchased your session "${data.tokenTitle}" (${data.durationMinutes} min). Booking ID: ${data.bookingId}. Please schedule the session.`,
      purchase_confirmed: `✅ Purchase confirmed! You've booked "${data.tokenTitle}" with ${data.professionalEmail}. Booking ID: ${data.bookingId}. The professional will schedule your session soon.`,
      session_scheduled: `📅 Session scheduled! "${data.tokenTitle}" is set for ${data.scheduledAt}. Meeting link: ${data.meetingLink || 'TBD'}`,
      session_reminder: `⏰ Reminder: Your session "${data.tokenTitle}" starts in ${data.minutesBefore} minutes.`,
      session_started: `🟢 Session "${data.sessionId}" has started.`,
      session_completed: `✔️ Session "${data.sessionId}" completed. Payment has been settled.`,
      booking_cancelled: `❌ Booking "${data.bookingId}" has been cancelled by ${data.cancelledBy}.`,
    };

    const message = messages[type] || `Notification [${type}]: ${JSON.stringify(data)}`;

    logger.info(`[notification] TO: ${recipientEmail} | ${message}`);

    // In production, integrate with an email/push service here:
    // await sendgrid.send({ to: recipientEmail, subject: ..., text: message });
  }

  async sendBatch(payloads: NotificationPayload[]): Promise<void> {
    await Promise.allSettled(payloads.map((p) => this.send(p)));
  }
}
