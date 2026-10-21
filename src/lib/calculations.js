// Deterministic calculations for LoadClarity.
// All arithmetic, durations, dates, percentages and verdicts live here — never in AI.

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pick = (...vals) => {
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return undefined;
};

// ---- Economics / cost breakdown ----
export function computeEconomics(load = {}, settings = {}, carrier = {}) {
  const rate = num(load.rate);
  const loadedMiles = num(load.loaded_miles);
  const deadheadMiles = num(load.deadhead_miles);
  const fuelPrice = num(pick(load.fuel_price, settings.fuel_price));
  const mpg = num(pick(load.mpg, carrier.mpg, settings.mpg));
  const driverPayMode = pick(load.driver_pay_mode, carrier.driver_pay_mode, settings.driver_pay_mode, "per_mile");
  const driverPayPerMile = num(pick(load.driver_pay_per_mile, carrier.driver_pay_per_mile, settings.driver_pay_per_mile));
  const driverPayPercent = num(pick(load.driver_pay_percent, carrier.driver_pay_percent, settings.driver_pay_percent));
  const maintenancePerMile = num(pick(load.maintenance_per_mile, carrier.maintenance_per_mile, settings.maintenance_per_mile));
  const fixedAllocation = num(pick(load.fixed_allocation, carrier.fixed_allocation, settings.fixed_allocation));
  const tollsOther = num(pick(load.tolls_other, settings.tolls_other));
  const lumperAmount = num(load.lumper_amount);

  const totalMiles = loadedMiles + deadheadMiles;
  const gallons = mpg > 0 ? totalMiles / mpg : 0;
  const fuelCost = gallons * fuelPrice;
  const driverCost = driverPayMode === "percent" ? (rate * driverPayPercent) / 100 : totalMiles * driverPayPerMile;
  const maintenanceCost = totalMiles * maintenancePerMile;
  const tripCost = fuelCost + driverCost + maintenanceCost + fixedAllocation + tollsOther;
  const margin = rate - tripCost;
  const marginPct = rate > 0 ? (margin / rate) * 100 : 0;
  const revPerTotalMile = totalMiles > 0 ? rate / totalMiles : 0;
  const revPerLoadedMile = loadedMiles > 0 ? rate / loadedMiles : 0;
  const deadheadPct = totalMiles > 0 ? (deadheadMiles / totalMiles) * 100 : 0;

  return {
    rate, loadedMiles, deadheadMiles, totalMiles, mpg, fuelPrice, gallons, fuelCost,
    driverPayMode, driverPayPerMile, driverPayPercent, driverCost,
    maintenancePerMile, maintenanceCost, fixedAllocation, tollsOther, lumperAmount, tripCost,
    margin, marginPct, revPerTotalMile, revPerLoadedMile, deadheadPct,
    hasRate: rate > 0, hasMiles: loadedMiles > 0, hasMpg: mpg > 0,
  };
}

// ---- Dispatcher share ----
export function computeDispatcherShare(load = {}, calc, carrier = {}) {
  const feeMode = pick(load.fee_mode, carrier.fee_mode, "percent");
  const feeBase = pick(load.fee_base, carrier.fee_base, "gross");
  let fee;
  if (feeMode === "flat") {
    fee = num(pick(load.fee_flat, carrier.fee_flat));
  } else {
    const pct = num(pick(load.fee_percent, carrier.fee_percent));
    const base = feeBase === "net" ? Math.max(0, calc.rate - calc.fuelCost - calc.lumperAmount) : calc.rate;
    fee = (base * pct) / 100;
  }
  fee = Math.round(fee * 100) / 100;
  const carrierKeeps = Math.round((calc.margin - fee) * 100) / 100;
  return { feeMode, feeBase, fee, carrierKeeps };
}

// ---- Suggested decision ----
export function computeDecision(load, calc, settings = {}, issues = []) {
  const minMarginPct = num(settings.min_margin_pct);
  const minPerMile = num(settings.min_per_mile);
  const totalMiles = calc.totalMiles;

  if (!calc.hasRate || !calc.hasMiles || !calc.hasMpg) {
    return {
      verdict: "not_enough_data",
      label: "Not enough data",
      tone: "info",
      why: ["Rate, loaded miles, or MPG is missing."],
      options: ["Complete the fields to get a decision."],
      counter: null,
    };
  }

  const counterBase = [];
  if (minMarginPct > 0) counterBase.push(calc.tripCost / (1 - minMarginPct / 100));
  if (minPerMile > 0 && totalMiles > 0) counterBase.push(minPerMile * totalMiles);
  const counter = counterBase.length ? Math.ceil(Math.max(...counterBase) / 25) * 25 : null;

  const urgent = issues.filter((i) => i.severity === "Critical" || i.severity === "High");
  const why = [
    `Estimated margin ${calc.marginPct.toFixed(1)}% vs minimum ${minMarginPct}%`,
    `Revenue per total mile $${calc.revPerTotalMile.toFixed(2)} vs minimum $${minPerMile}`,
    urgent.length ? `${urgent.length} urgent issue(s) open` : "No urgent issues",
  ];

  if (calc.margin < 0) {
    return {
      verdict: "pass_at_this_rate",
      label: "Pass at this rate",
      tone: "danger",
      why: [`Estimated margin is negative ($${calc.margin.toFixed(2)}).`],
      options: ["Pass", counter ? `Counter at $${counter}` : "Counter", "Re-check costs"],
      counter,
    };
  }

  const belowMargin = minMarginPct > 0 && calc.marginPct < minMarginPct;
  const belowPerMile = minPerMile > 0 && calc.revPerTotalMile < minPerMile;
  if (belowMargin || belowPerMile) {
    const reasons = [];
    if (belowMargin) reasons.push(`Margin ${calc.marginPct.toFixed(1)}% is below your ${minMarginPct}% minimum.`);
    if (belowPerMile) reasons.push(`Revenue per mile $${calc.revPerTotalMile.toFixed(2)} is below your $${minPerMile} minimum.`);
    return {
      verdict: "negotiate",
      label: "Negotiate",
      tone: "warning",
      why: reasons,
      options: [counter ? `Counter at $${counter}` : "Counter", "Take it below minimum", "Pass"],
      counter,
    };
  }

  if (urgent.length > 0) {
    return {
      verdict: "take_after_confirming",
      label: "Take after confirming",
      tone: "warning",
      why: [...why, ...urgent.map((i) => i.title)],
      options: ["Confirm in writing, then take", counter ? `Counter at $${counter} if answers add cost` : "Counter if answers add cost", "Pass if unconfirmed"],
      counter,
      urgent,
    };
  }

  return {
    verdict: "take",
    label: "Take",
    tone: "success",
    why,
    options: ["Take the load", "Still verify paperwork and appointments"],
    counter,
  };
}

// ---- Detention ----
export function computeDetention(event = {}, settings = {}, now = new Date()) {
  const checkIn = event.check_in_time ? new Date(event.check_in_time) : null;
  const departure = event.departure_time ? new Date(event.departure_time) : null;
  const endRef = departure || (checkIn ? now : null);
  if (!checkIn || !endRef) {
    return { waitMinutes: 0, potentialMinutes: 0, potentialHours: 0, potentialAmount: 0, active: !!checkIn };
  }
  const waitMinutes = Math.max(0, (endRef - checkIn) / 60000);
  const freeMinutes = num(pick(event.free_minutes, settings.free_detention_minutes, 120));
  const potentialMinutes = Math.max(0, waitMinutes - freeMinutes);
  const potentialHours = potentialMinutes / 60;
  const rate = num(event.detention_rate);
  const potentialAmount = Math.round(potentialHours * rate * 100) / 100;
  return { waitMinutes, freeMinutes, potentialMinutes, potentialHours, potentialAmount, active: !departure };
}

// ---- Delivery timing (rough planning estimate) ----
export function computeDeliveryTiming(load = {}, settings = {}) {
  const loadedMiles = num(load.loaded_miles);
  const avgSpeed = num(pick(settings.avg_speed, 50));
  const missing = [];
  if (!load.pickup_date) missing.push("pickup date");
  if (!load.delivery_date) missing.push("delivery date");
  if (!loadedMiles) missing.push("loaded miles");
  if (!avgSpeed) missing.push("average speed");
  if (missing.length) return { verdict: "missing", missing, label: "Missing info", tone: "info" };

  const drivingHours = avgSpeed > 0 ? loadedMiles / avgSpeed : 0;
  const shortBreaks = 0.5 * Math.floor(drivingHours / 8);
  const longResets = 10 * Math.max(0, Math.floor((drivingHours - 0.01) / 11));
  const timeNeeded = 1.5 + drivingHours + shortBreaks + longResets;

  // Parse pickup (latest) and delivery (earliest) as local datetimes — compared as entered.
  const pTime = parseAppointment(load.pickup_date, load.pickup_appointment, true);
  const dTime = parseAppointment(load.delivery_date, load.delivery_appointment, false);
  if (!pTime || !dTime) {
    const m = [];
    if (!pTime) m.push("pickup appointment time");
    if (!dTime) m.push("delivery appointment time");
    return { verdict: "missing", missing: m, label: "Missing appointment time", tone: "info", timeNeeded };
  }
  const availableHours = (dTime - pTime) / 3600000;
  const slack = availableHours - timeNeeded;
  let verdict, label, tone;
  if (slack < 0) { verdict = "not_enough_time"; label = "Not enough time at these assumptions"; tone = "danger"; }
  else if (slack < 2) { verdict = "tight"; label = "Tight (under 2 hours slack)"; tone = "warning"; }
  else { verdict = "workable"; label = "Looks workable"; tone = "success"; }
  return { verdict, label, tone, drivingHours, shortBreaks, longResets, timeNeeded, availableHours, slack };
}

function parseAppointment(dateStr, apptStr, latest) {
  if (!dateStr) return null;
  let timePart = apptStr;
  if (!timePart) return null;
  // try to extract a time like "14:00" or "2:00 PM" or a window "08:00-10:00"
  const times = (timePart.match(/\d{1,2}:\d{2}\s*(?:AM|PM)?/gi) || []);
  if (!times.length) return null;
  const parsed = times.map((t) => parseTime(t));
  const valid = parsed.filter(Boolean);
  if (!valid.length) return null;
  const chosen = latest ? valid[valid.length - 1] : valid[0];
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(chosen.h, chosen.m, 0, 0);
  return d;
}

function parseTime(t) {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return { h, m: min };
}