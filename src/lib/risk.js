// Risk / exception engine. Derives issues from real load data — never invents.
import { computeDeliveryTiming } from "./calculations";

const has = (v) => v !== null && v !== undefined && String(v).trim() !== "";

export function computeIssues(load = {}, calc = {}, settings = {}, timing = null) {
  const issues = [];
  const t = timing || computeDeliveryTiming(load, settings);

  if (!has(load.rate)) {
    issues.push({ key: "rate_missing", severity: "Critical", category: "rate", title: "Rate missing or unclear", evidence: "No rate found on this load.", action: "Confirm the rate with the broker before booking.", broker_question: "What is the agreed line-haul rate for this load?" });
  }
  if (has(load.delivery_date) && has(load.pickup_date) && load.delivery_date < load.pickup_date) {
    issues.push({ key: "delivery_before_pickup", severity: "Critical", category: "delivery", title: "Delivery date before pickup date", evidence: `Pickup ${load.pickup_date} / Delivery ${load.delivery_date}.`, action: "Correct the dates.", broker_question: null });
  }
  if (t.verdict === "not_enough_time") {
    issues.push({ key: "appointment_unreachable", severity: "Critical", category: "appointment", title: "Delivery appointment may be unreachable", evidence: `Slack is ${t.slack?.toFixed(1)} hours at ${settings.avg_speed || 50} mph.`, action: "Confirm timing with the driver before booking.", broker_question: "Can the delivery appointment be moved to allow enough transit time?" });
  }
  if (!has(load.weight_lb)) {
    issues.push({ key: "weight_missing", severity: "High", category: "weight", title: "Weight missing", evidence: "No weight listed on the load.", action: "Get the weight from the broker.", broker_question: "What is the commodity weight for this load?" });
  }
  if (!has(load.detention_terms)) {
    issues.push({ key: "detention_terms_missing", severity: "High", category: "detention", title: "Detention terms not found", evidence: "No detention terms found on the RateCon.", action: "Ask the broker for detention terms in writing before pickup.", broker_question: "What are the detention terms (free time and rate per hour) for this load?" });
  }
  if (["delivered", "pod_pending", "billing_review", "billing_ready", "completed"].includes(load.status) && load.pod_present !== true) {
    issues.push({ key: "pod_missing", severity: "High", category: "pod", title: "POD missing", evidence: `Load is ${load.status.replace(/_/g, " ")} but no POD is attached.`, action: "Upload the signed POD in Documents.", broker_question: "" });
  }
  if (["in_transit", "at_delivery", "delivered", "pod_pending", "billing_review", "billing_ready", "completed"].includes(load.status) && load.bol_present !== true) {
    issues.push({ key: "bol_missing", severity: "Review", category: "bol", title: "BOL missing", evidence: `Load is ${load.status.replace(/_/g, " ")} but no BOL is attached.`, action: "Upload the BOL in Documents.", broker_question: "" });
  }
  if (!has(load.pickup_appointment)) {
    issues.push({ key: "pickup_appointment_missing", severity: "Review", category: "appointment", title: "Pickup appointment missing", evidence: "No pickup appointment time found.", action: "Confirm the pickup appointment.", broker_question: "What is the pickup appointment time?" });
  }
  if (!has(load.delivery_appointment)) {
    issues.push({ key: "delivery_appointment_missing", severity: "Review", category: "appointment", title: "Delivery appointment missing or unclear", evidence: "No delivery appointment time found.", action: "Confirm the delivery appointment.", broker_question: "What is the delivery appointment time?" });
  }
  if (!has(load.broker_reference)) {
    issues.push({ key: "broker_reference_missing", severity: "Review", category: "broker", title: "Broker reference number missing", evidence: "No broker reference number found.", action: "Get the reference number for billing.", broker_question: "What reference number should go on the BOL and invoice?" });
  }
  if (!has(load.commodity)) {
    issues.push({ key: "commodity_missing", severity: "Review", category: "other", title: "Commodity missing", evidence: "No commodity listed.", action: "Confirm what is being hauled.", broker_question: "What commodity is on this load?" });
  }
  if (!has(load.equipment_type)) {
    issues.push({ key: "equipment_missing", severity: "Review", category: "equipment", title: "Equipment not specified", evidence: "No equipment type listed.", action: "Confirm equipment.", broker_question: null });
  }
  if (t.verdict === "tight") {
    issues.push({ key: "delivery_timing_tight", severity: "Review", category: "delivery", title: "Delivery timing tight", evidence: `Slack is ${t.slack?.toFixed(1)} hours (under 2).`, action: "Check with the driver that the schedule is realistic.", broker_question: null });
  }
  if (!has(load.broker_phone) && !has(load.broker_email)) {
    issues.push({ key: "broker_contact_missing", severity: "Review", category: "broker", title: "Broker contact missing", evidence: "No broker phone or email on file.", action: "Get a contact number for the broker.", broker_question: null });
  }
  if (!has(load.driver_id)) {
    issues.push({ key: "no_driver", severity: "Info", category: "driver", title: "No driver assigned", evidence: "No driver assigned to this load yet.", action: "Assign a driver when ready.", broker_question: null });
  }
  return issues;
}

export function severityTone(sev) {
  return { Critical: "danger", High: "warning", Review: "warning", Info: "info" }[sev] || "info";
}