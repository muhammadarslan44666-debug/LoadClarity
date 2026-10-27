export const currency = (n) =>
  n === null || n === undefined || n === "" || Number.isNaN(Number(n))
    ? "—"
    : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const miles = (n) =>
  n === null || n === undefined || n === "" ? "—" : `${Number(n).toLocaleString()} mi`;

export const pct = (n) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : `${Number(n).toFixed(1)}%`;

export const num = (n) =>
  n === null || n === undefined || n === "" ? "—" : Number(n).toLocaleString();

export const dateStr = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dateTimeStr = (d) => (d ? new Date(d).toLocaleString() : "—");

export const titleCase = (s) =>
  (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const STATUS_LABELS = {
  draft: "Draft", pending_review: "Pending Review", ready: "Ready", booked: "Booked",
  driver_assigned: "Driver Assigned", at_pickup: "At Pickup", loading: "Loading",
  in_transit: "In Transit", at_delivery: "At Delivery", delivered: "Delivered",
  pod_pending: "POD Pending", billing_review: "Billing Review", billing_ready: "Billing Ready",
  completed: "Completed", cancelled: "Cancelled",
};

export const STATUS_TONE = {
  draft: "info", pending_review: "warning", ready: "info", booked: "info",
  driver_assigned: "info", at_pickup: "info", loading: "info", in_transit: "info",
  at_delivery: "info", delivered: "success", pod_pending: "warning",
  billing_review: "warning", billing_ready: "success", completed: "success", cancelled: "danger",
};

export const EQUIPMENT_LABELS = {
  dry_van: "Dry Van", reefer: "Reefer", flatbed: "Flatbed", box_truck: "Box Truck", other: "Other",
};