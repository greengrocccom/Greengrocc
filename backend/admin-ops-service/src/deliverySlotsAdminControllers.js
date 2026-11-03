import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import DeliveryBoy from "../../delivery-service/src/models/DeliveryBoy.js";
import { getIO } from "../../socket.js";
import { notifyRiders } from "../../delivery-service/src/services/RiderNotificationService.js";
import { istDateString } from "../../delivery-service/src/utils/onlineHoursHelper.js";

export {
  listShifts as adminListShifts,
  createShift as adminCreateShift,
  updateSlotDateWise as adminUpdateSlot,
  deleteSlotDateWise as adminDeleteSlot,
  getSlotDetailsWithRiders as adminSlotDetails,
  listAssignableRiders as adminAssignableRiders,
  assignSlotRiders as adminAssignSlotRiders,
  unassignSlotRider as adminUnassignSlotRider,
} from "../../delivery-service/src/controllers/shiftManagementController.js";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const fail = (res, status, message) => res.status(status).json({ success: false, message });

/** Lets the Delivery Manager shift handlers act on the dark store chosen by the admin. */
export async function withManagerOverride(req, res, next) {
  try {
    const manager = await DeliveryManager.findById(req.params.managerId);
    if (!manager) return fail(res, 404, "Delivery manager not found");
    req.managerOverride = manager;
    next();
  } catch (error) {
    next(error);
  }
}

function salaryView(rider) {
  const credits = [...(rider.salaryCredits || [])].sort((a, b) =>
    String(b.month).localeCompare(String(a.month))
  );
  const incentives = [...(rider.incentiveCredits || [])].sort(
    (a, b) => new Date(b.creditedAt) - new Date(a.creditedAt)
  );
  const incentiveByMonth = {};
  for (const c of incentives) {
    incentiveByMonth[c.month] = (incentiveByMonth[c.month] || 0) + Number(c.amount || 0);
  }
  const months = [...new Set([...credits.map((c) => c.month), ...Object.keys(incentiveByMonth)])]
    .sort()
    .reverse();
  return {
    riderId: String(rider._id),
    name: rider.name || "Delivery Partner",
    phone: rider.phone || "",
    employmentType: rider.employmentType || "PART_TIME",
    monthlySalary: rider.monthlySalary ?? null,
    walletBalance: Number(rider.walletBalance) || 0,
    months: months.map((month) => {
      const credit = credits.find((c) => c.month === month) || null;
      return {
        month,
        salaryCredited: credit ? Number(credit.amount) || 0 : 0,
        salaryCreditedAt: credit?.creditedAt || null,
        creditedByRole: credit?.creditedByRole || null,
        note: credit?.note || "",
        incentives: Math.round((incentiveByMonth[month] || 0) * 100) / 100,
      };
    }),
    recentIncentives: incentives.slice(0, 50).map((c) => ({
      month: c.month,
      dateString: c.dateString,
      mode: c.mode,
      rate: c.rate,
      units: c.units,
      amount: c.amount,
      label: c.label,
      creditedAt: c.creditedAt,
    })),
  };
}

/** GET /delivery/boys/:id/salary — month-wise salary + incentives */
export async function getRiderSalaryAdmin(req, res, next) {
  try {
    const rider = await DeliveryBoy.findById(req.params.id).select(
      "name phone employmentType monthlySalary walletBalance salaryCredits incentiveCredits"
    );
    if (!rider) return fail(res, 404, "Delivery partner not found");
    return res.json({ success: true, data: salaryView(rider) });
  } catch (error) {
    next(error);
  }
}

/** PUT /delivery/boys/:id/salary  { monthlySalary: number | null } */
export async function setRiderMonthlySalaryAdmin(req, res, next) {
  try {
    const raw = req.body?.monthlySalary;
    let value = null;
    if (raw !== null && raw !== undefined && raw !== "") {
      value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        return fail(res, 400, "monthlySalary must be a non-negative number, or empty to clear it");
      }
      value = Math.round(value);
    }
    const rider = await DeliveryBoy.findByIdAndUpdate(
      req.params.id,
      { $set: { monthlySalary: value, salaryAmount: value, salaryPeriod: "month" } },
      { returnDocument: 'after' }
    ).select("name phone employmentType monthlySalary walletBalance salaryCredits incentiveCredits");
    if (!rider) return fail(res, 404, "Delivery partner not found");
    return res.json({
      success: true,
      message: value == null ? "Monthly salary cleared" : `Monthly salary set to ₹${value}`,
      data: salaryView(rider),
    });
  } catch (error) {
    next(error);
  }
}

/** POST /delivery/boys/:id/salary-credits  { month: "YYYY-MM", amount?, note? } — one credit per month */
export async function creditRiderSalaryAdmin(req, res, next) {
  try {
    const month = String(req.body?.month || istDateString().slice(0, 7)).trim();
    if (!MONTH_RE.test(month)) return fail(res, 400, "month must be in YYYY-MM format");

    const rider = await DeliveryBoy.findById(req.params.id).select("monthlySalary");
    if (!rider) return fail(res, 404, "Delivery partner not found");

    const amountRaw = req.body?.amount;
    const amount =
      amountRaw === undefined || amountRaw === null || amountRaw === ""
        ? Number(rider.monthlySalary) || 0
        : Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail(res, 400, "Salary amount must be greater than 0. Set the monthly salary first.");
    }
    const rounded = Math.round(amount);
    const note = String(req.body?.note || "").trim().slice(0, 200);

    const updated = await DeliveryBoy.findOneAndUpdate(
      { _id: req.params.id, "salaryCredits.month": { $ne: month } },
      {
        $inc: { walletBalance: rounded, totalLifetimeEarnings: rounded },
        $push: {
          salaryCredits: {
            month,
            amount: rounded,
            creditedAt: new Date(),
            creditedBy: null,
            creditedByRole: "admin",
            note,
          },
        },
      },
      { returnDocument: 'after' }
    ).select("name phone employmentType monthlySalary walletBalance salaryCredits incentiveCredits");
    if (!updated) {
      return res.status(409).json({
        success: false,
        code: "SALARY_ALREADY_CREDITED",
        message: `Salary for ${month} has already been credited to this delivery partner`,
      });
    }

    const payload = {
      riderId: String(updated._id),
      amount: rounded,
      reason: `salary_${month}`,
      walletBalance: Number(updated.walletBalance) || 0,
      message: `₹${rounded} salary for ${month} credited`,
      timestamp: new Date().toISOString(),
    };
    try {
      const io = getIO();
      for (const room of [`rider_${updated._id}`, `rider:${updated._id}`]) {
        io.to(room).emit("wallet_updated", payload);
        io.to(room).emit("rider_wallet_credited", payload);
      }
    } catch (_) {}

    await notifyRiders({
      riderIds: [updated._id],
      type: "SALARY_CREDITED",
      title: `₹${rounded} salary credited`,
      message: `Your salary for ${month} has been added to your wallet.`,
      amount: rounded,
      priority: "high",
      dedupeKey: `salary:${updated._id}:${month}`,
      data: { screen: "wallet", month, amount: String(rounded), event: "salary_credited" },
    }).catch(() => {});

    return res.json({
      success: true,
      message: `₹${rounded} salary for ${month} credited to wallet`,
      data: salaryView(updated),
    });
  } catch (error) {
    next(error);
  }
}
