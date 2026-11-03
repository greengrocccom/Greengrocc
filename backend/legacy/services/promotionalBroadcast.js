import { resolveNotificationAudience } from "./notificationAudience.js";
import User from "../models/user.js";
import ScheduledNotification from "../models/ScheduledNotification.js";
import { broadcastToUsers } from "./notificationService.js";

export const AUDIENCE_LABELS = { retail: "Normal users", bulk: "Bulk users", all: "All customers" };

export function normalizeAudience(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "bulk" || raw === "retail" ? raw : "all";
}

export function audienceFilter(audience) {
  if (audience === "bulk") return { role: "user", accountType: "bulk" };
  if (audience === "retail") return { role: "user", accountType: { $ne: "bulk" } };
  return { role: "user" };
}

export async function broadcastPromotionalNotification({ title, body = "", data, audience = "all", imageUrl = "", segment = "all", days = 30 }) {
  const hasNavigation =
    data.linkTarget && data.linkTarget !== "none" && data.linkTarget !== "general";
  const type = hasNavigation || data.offerId ? "offer" : "promotional";

  const users = await User.find(await resolveNotificationAudience(audienceFilter(audience), { segment, days })).select("_id fcmToken fcmTokens").lean();
  return broadcastToUsers(users, {
    title,
    body,
    type,
    imageUrl,
    data: { ...data, audience, segment, days },
  });
}

// ---- scheduled sends --------------------------------------------------------

// Re-check periodically so jobs created by another server instance still fire.
const MAX_WAIT_MS = 5 * 60 * 1000;
const STALE_SENDING_MS = 10 * 60 * 1000;
let timer = null;
let running = false;

async function runDueJobs() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const job = await ScheduledNotification.findOneAndUpdate(
        { status: "scheduled", sendAt: { $lte: new Date() } },
        { $set: { status: "sending" } },
        { sort: { sendAt: 1 }, new: true }
      );
      if (!job) break;

      try {
        job.summary = await broadcastPromotionalNotification({
          title: job.title,
          body: job.body,
          data: job.data || {},
          audience: job.audience,
          segment: job.data?.segment || "all",
          days: job.data?.days ?? 30,
          imageUrl: job.imageUrl,
        });
        job.status = "sent";
        job.sentAt = new Date();
      } catch (error) {
        job.status = "failed";
        job.error = error.message || "Broadcast failed";
      }
      await job.save();
      console.log(`[notifications] scheduled "${job.title}" → ${job.audience}: ${job.status}`);
    }
  } catch (error) {
    console.warn("[notifications] scheduler run failed:", error.message);
  } finally {
    running = false;
    void armScheduler();
  }
}

/** Point the timer at the next scheduled job. Call after creating or cancelling one. */
export async function armScheduler() {
  clearTimeout(timer);
  let delay = MAX_WAIT_MS;
  try {
    const next = await ScheduledNotification.findOne({ status: "scheduled" })
      .sort({ sendAt: 1 })
      .select("sendAt")
      .lean();
    if (next) delay = Math.min(Math.max(0, new Date(next.sendAt).getTime() - Date.now()), MAX_WAIT_MS);
  } catch (error) {
    console.warn("[notifications] scheduler arm failed:", error.message);
  }
  timer = setTimeout(runDueJobs, delay);
  timer.unref?.();
}

export async function startNotificationScheduler() {
  // A job left "sending" by a crash may be half-delivered; don't resend it blindly.
  await ScheduledNotification.updateMany(
    { status: "sending", updatedAt: { $lt: new Date(Date.now() - STALE_SENDING_MS) } },
    { $set: { status: "failed", error: "Server restarted while sending" } }
  ).catch(() => {});
  await armScheduler();
}
