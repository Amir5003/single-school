import LegalLayout, { Clause, List } from './LegalLayout';
import { REFUND_VERSION, CONTACTS, TERMS_VALUES as V } from '../../constants/legalConfig';

/**
 * Refund & Cancellation Policy.
 *
 * Kept as its own page rather than folded into the Terms: Indian payment
 * gateways look for a distinct, publicly reachable refund policy during
 * merchant onboarding.
 */
export default function Refunds() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" version={REFUND_VERSION}>
      <Clause n="1" title="Free trial">
        <p>
          Every school gets {V.trialDays} days free, with no card required. Nothing is charged unless
          you choose a paid plan.
        </p>
      </Clause>

      <Clause n="2" title="Cancelling">
        <p>
          Cancel any time from Billing in your admin dashboard. Your plan stays active until the end
          of the term you have already paid for, and does not renew after that. You keep full access
          until then, and can request an export of your data for {V.exportWindowDays} days afterwards.
        </p>
      </Clause>

      <Clause n="3" title="Refunds">
        <List
          items={[
            <><strong>Within {V.refundWindowDays} days of a first paid subscription</strong> — full refund on request, no questions asked.</>,
            <><strong>After that</strong> — fees for the current term are non-refundable, because access continues for the whole term.</>,
            <><strong>Billing errors</strong> — duplicate or incorrect charges are refunded in full whenever they are found.</>,
            <><strong>Extended outage</strong> — if the Service is unavailable for more than {V.outageRefundHours} consecutive hours through our fault, we refund that term pro rata on request.</>,
            <><strong>If we discontinue the Service</strong> — we refund the unused portion of any prepaid fees.</>,
          ]}
        />
      </Clause>

      <Clause n="4" title="How refunds are paid">
        <p>
          Approved refunds are issued to the original payment method through Razorpay within{' '}
          {V.refundProcessingDays} working days of approval. Your bank may take a further 5 to 10
          working days to credit it.
        </p>
      </Clause>

      <Clause n="5" title="Requesting a refund">
        <p>
          Email {CONTACTS.billing} from the registered administrator address with your school name
          and the payment reference. We respond within {V.supportResponseDays} working days.
        </p>
      </Clause>
    </LegalLayout>
  );
}
