import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRateConfirmation } from '../src/lib/load/rateConfirmationParser.js';

const plainTextRateCon = `RATE CONFIRMATION & CARRIER AGREEMENT
INTEGRITY LOGISTICS BROKERAGE
Broker Ref: TQL-123456
MC Number: 765432
Broker Phone: 312-555-0199
Dispatch Email: dispatch@integritylogistics.com
Gross Rate: $2,400
Loaded Miles: 850
Deadhead Miles: 22
Commodity: General Freight
Weight: 38,000 lbs
Equipment: Dry Van
Pickup 1:
ACME DISTRIBUTION CENTER
123 Warehouse Road
Chicago, IL 60601
Pickup Date: 10/21/2026
Pickup Appointment: 08:00-10:00
Delivery 1:
DALLAS RECEIVING LLC
900 Freight Avenue
Dallas, TX 75201
Delivery Date: 10/22/2026
Delivery Appointment: 14:00
Lumper Amount: $150
Detention terms: $50/hour after 2 hours
Layover terms: $250/night`;

test('extracts mandatory fields from multi-line plain-text rate confirmation without cross-swapping', () => {
  const parsed = parseRateConfirmation(plainTextRateCon);
  assert.equal(parsed.broker_name, 'INTEGRITY LOGISTICS BROKERAGE');
  assert.equal(parsed.broker_reference, 'TQL-123456');
  assert.equal(parsed.rate, 2400);
  assert.equal(parsed.pickup_company, 'ACME DISTRIBUTION CENTER');
  assert.equal(parsed.pickup_city, 'Chicago');
  assert.equal(parsed.pickup_state, 'IL');
  assert.equal(parsed.pickup_zip, '60601');
  assert.equal(parsed.pickup_date, '2026-10-21');
  assert.equal(parsed.delivery_company, 'DALLAS RECEIVING LLC');
  assert.equal(parsed.delivery_city, 'Dallas');
  assert.equal(parsed.delivery_state, 'TX');
  assert.equal(parsed.delivery_zip, '75201');
  assert.equal(parsed.delivery_date, '2026-10-22');
  assert.equal(parsed.loaded_miles, 850);
  assert.equal(parsed.deadhead_miles, 22);
  assert.equal(parsed.weight_lb, 38000);
  assert.equal(parsed.lumper_amount, 150);
});

test('does not mistake the document title for the broker name', () => {
  const parsed = parseRateConfirmation('RATE CONFIRMATION & CARRIER AGREEMENT\nBroker Name: BROKERAGE\nRate: $2400');
  assert.equal(parsed.broker_name, 'BROKERAGE');
});

test('splits combined US addresses into clean street, multi-word city, state and ZIP fields', () => {
  const parsed = parseRateConfirmation(`
Broker Name: Example Logistics
Pickup:
Company: Origin Warehouse
Address: 1200 S Blue Island Ave, Chicago, IL 60608
Pickup Date: 10/19/2026
Delivery:
Company: Destination Warehouse
Address: 350 5th Ave, New York, NY 10118
Delivery Date: 10/20/2026
`);
  assert.equal(parsed.pickup_address, '1200 S Blue Island Ave');
  assert.equal(parsed.pickup_city, 'Chicago');
  assert.equal(parsed.pickup_state, 'IL');
  assert.equal(parsed.pickup_zip, '60608');
  assert.equal(parsed.delivery_address, '350 5th Ave');
  assert.equal(parsed.delivery_city, 'New York');
  assert.equal(parsed.delivery_state, 'NY');
  assert.equal(parsed.delivery_zip, '10118');
});

test('cleans labels and parses full address captured in the city field', () => {
  const parsed = parseRateConfirmation(`
Broker Name: Example Logistics
Pickup:
Company: Origin
City: 742 Evergreen Terrace, Los Angeles, CA 90001
Delivery:
Company: Destination
City: San Francisco, CA 94105
`);
  assert.equal(parsed.pickup_address, '742 Evergreen Terrace');
  assert.equal(parsed.pickup_city, 'Los Angeles');
  assert.equal(parsed.pickup_state, 'CA');
  assert.equal(parsed.pickup_zip, '90001');
  assert.equal(parsed.delivery_city, 'San Francisco');
  assert.equal(parsed.delivery_state, 'CA');
  assert.equal(parsed.delivery_zip, '94105');
});


test('maps broker contacts, dates, appointments, financials and clean location fields from a custom layout', () => {
  const parsed = parseRateConfirmation(`
CUSTOM BROKER RATE CONFIRMATION
Broker Name: Apex Freight Services
Broker Phone: (312) 555-0198
Broker Email: ops@apexfreight.com
MC Number: 123456
Load Reference: APEX-90872
Total Rate: $2,400.00
Loaded Miles: 925
Weight (lbs): 42,500 lbs
Commodity: Frozen Food
Equipment Type: Reefer
Pickup Location:
Company: MidWest Cold Storage
Address: 1200 S Blue Island Ave, Chicago, IL 60608
Pickup Date: 10/21/2026
Appointment / Window: 08:00 AM - 10:00 AM
Delivery Location:
Company: Lone Star Logistics Hub
Address: 4500 IH-35, Dallas, TX 75201
Delivery Date: 10/23/2026
Delivery Appointment / Window: 02:00 PM - 04:00 PM
`);
  assert.equal(parsed.broker_name, 'Apex Freight Services');
  assert.equal(parsed.broker_phone, '(312) 555-0198');
  assert.equal(parsed.broker_email, 'ops@apexfreight.com');
  assert.equal(parsed.broker_mc, '123456');
  assert.equal(parsed.broker_reference, 'APEX-90872');
  assert.equal(parsed.rate, 2400);
  assert.equal(parsed.loaded_miles, 925);
  assert.equal(parsed.weight_lb, 42500);
  assert.equal(parsed.commodity, 'Frozen Food');
  assert.equal(parsed.equipment_type, 'reefer');
  assert.equal(parsed.pickup_company, 'MidWest Cold Storage');
  assert.equal(parsed.pickup_address, '1200 S Blue Island Ave');
  assert.equal(parsed.pickup_city, 'Chicago');
  assert.equal(parsed.pickup_state, 'IL');
  assert.equal(parsed.pickup_zip, '60608');
  assert.equal(parsed.pickup_date, '2026-10-21');
  assert.equal(parsed.pickup_appointment, '08:00 AM - 10:00 AM');
  assert.equal(parsed.delivery_company, 'Lone Star Logistics Hub');
  assert.equal(parsed.delivery_address, '4500 IH-35');
  assert.equal(parsed.delivery_city, 'Dallas');
  assert.equal(parsed.delivery_state, 'TX');
  assert.equal(parsed.delivery_zip, '75201');
  assert.equal(parsed.delivery_date, '2026-10-23');
  assert.equal(parsed.delivery_appointment, '02:00 PM - 04:00 PM');
});
