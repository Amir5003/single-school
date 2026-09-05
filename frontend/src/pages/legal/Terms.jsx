import LegalLayout, { Clause, Sub, List } from './LegalLayout';
import {
  TERMS_VERSION,
  ENTITY,
  CONTACTS,
  GRIEVANCE_OFFICER,
  JURISDICTION,
  TERMS_VALUES as V,
} from '../../constants/legalConfig';

/**
 * Terms of Service — the commercial contract between the platform and a school.
 *
 * Clause 6 is the load-bearing one: it places the lawful-basis, notice and
 * parental-consent obligations on the school, which is the only party with the
 * relationship and standing to discharge them.
 *
 * ⚠️ Clauses 7.6 and 13 describe RETENTION and EXPORT as the system actually
 * behaves today (records are hidden on delete and retained; export is on
 * written request). Do not "upgrade" this wording to a self-serve export or an
 * automatic purge until specs/011 T-027/T-028 have actually shipped — a
 * published policy is a representation about the product.
 */
export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" version={TERMS_VERSION}>
      <p>
        These Terms of Service (“<strong>Terms</strong>”) govern your school’s use of{' '}
        {ENTITY.productName} (the “<strong>Service</strong>”), operated by {ENTITY.name},{' '}
        {ENTITY.type}, registered at {ENTITY.address} (“<strong>we</strong>”, “<strong>us</strong>”,
        “<strong>our</strong>”).
      </p>
      <p>
        By creating a school workspace, ticking the acceptance box, or using the Service, the
        educational institution you represent (the “<strong>School</strong>”, “<strong>you</strong>”)
        agrees to these Terms. If you do not agree, do not create a workspace.
      </p>

      <Clause n="1" title="Definitions">
        <List
          items={[
            <><strong>School</strong> — the educational institution that registers a workspace.</>,
            <><strong>Administrator</strong> — a person the School authorises to hold a school-admin account.</>,
            <><strong>End User</strong> — any student, parent, guardian or teacher given access by the School.</>,
            <><strong>School Data</strong> — all data the School or its End Users enter into or generate within the Service, including personal data about End Users.</>,
            <><strong>Personal Data</strong> — information relating to an identified or identifiable individual, as defined by Applicable Data Protection Law.</>,
            <><strong>Applicable Data Protection Law</strong> — the Digital Personal Data Protection Act, 2023 and rules made under it, and any other data protection law applicable to the School or to us.</>,
          ]}
        />
      </Clause>

      <Clause n="2" title="Acceptance and authority">
        <Sub n="2.1">The individual accepting these Terms represents that they are authorised to bind the School to a contract. If they are not, they accept these Terms personally.</Sub>
        <Sub n="2.2">The School is responsible for every action taken under its workspace, including actions by Administrators, teachers, students and parents, whether authorised or not.</Sub>
        <Sub n="2.3">We record the date, time, account and version of Terms accepted. That record is evidence of acceptance.</Sub>
      </Clause>

      <Clause n="3" title="Registration and approval">
        <Sub n="3.1">School registrations are reviewed before activation. We may decline or delay any registration at our discretion, including where we cannot verify that the applicant is a genuine educational institution.</Sub>
        <Sub n="3.2">Each School receives a unique URL identifier (a “slug”). Slugs are allocated on a first-come basis and may be reclaimed if they infringe a third party’s rights or impersonate another institution.</Sub>
        <Sub n="3.3">The School must give accurate registration details and keep them current.</Sub>
      </Clause>

      <Clause n="4" title="Trial, plans and student limits">
        <Sub n="4.1">New Schools receive a free trial of {V.trialDays} days, limited to {V.trialStudentLimit} active student records.</Sub>
        <Sub n="4.2">On reaching the trial student limit, creation of further student records is blocked until the School subscribes to a paid plan. Existing data stays accessible.</Sub>
        <Sub n="4.3">When a trial or paid term ends without renewal, the workspace enters a grace period of {V.graceDays} days during which access continues. After that, access is suspended in line with clause 12.</Sub>
        <Sub n="4.4">Paid plans, their prices, student limits and included features are published in the Service. We may change prices on {V.priceChangeNoticeDays} days’ notice; changes take effect at the School’s next renewal, never mid-term.</Sub>
      </Clause>

      <Clause n="5" title="Accounts, credentials and security">
        <Sub n="5.1">The School creates accounts for its End Users. Where the School supplies an email address, the Service emails a temporary password to that address and requires the password to be changed at first sign-in.</Sub>
        <Sub n="5.2">The School must ensure any email address it enters belongs to that End User, or to their parent or guardian where the End User is a child. The School is responsible for the consequences of entering an incorrect address, including delivery of credentials to the wrong person.</Sub>
        <Sub n="5.3">Administrator credentials must not be shared. The School must revoke access promptly when a person leaves its employment or enrolment.</Sub>
        <Sub n="5.4">The School must notify us without undue delay at {CONTACTS.security} on becoming aware of unauthorised access to its workspace.</Sub>
      </Clause>

      <Clause n="6" title="The School’s data protection obligations">
        <p>
          For all Personal Data in the Service, the School is the Data Fiduciary (controller) and we
          are a Data Processor acting on its documented instructions. The School warrants, for as
          long as it uses the Service, that:
        </p>
        <Sub n="6.1">it has a lawful basis under Applicable Data Protection Law for every category of Personal Data it enters, and for having us process it;</Sub>
        <Sub n="6.2">it has given every End User — or, for a child, that child’s parent or lawful guardian — a clear privacy notice covering the fact that their data is held in the Service, what is held, why, and how to exercise their rights;</Sub>
        <Sub n="6.3">it has the standing to give those notices, having the direct relationship with the End User and their family;</Sub>
        <Sub n="6.4">where an End User is a child under the age at which Applicable Data Protection Law requires it, the School has obtained and can evidence verifiable parental consent, or is entitled to rely on a statutory exemption available to educational institutions;</Sub>
        <Sub n="6.5">it will not enter Personal Data beyond what the Service is designed to hold, and specifically will not enter health records, biometric identifiers, caste or religious data, government identity numbers, or financial account details, except in fields the Service explicitly provides for them;</Sub>
        <Sub n="6.6">it will keep records accurate and up to date, and will delete or deactivate records for students and staff who have left;</Sub>
        <Sub n="6.7">it will respond to requests from End Users to access, correct or erase their data, and will use the Service’s own tools to act on them.</Sub>
        <p>
          The School indemnifies us against claims, fines and reasonable legal costs arising from a
          breach of this clause 6. We may suspend a workspace where we have reasonable grounds to
          believe this clause is being breached in a way that puts End Users at risk.
        </p>
      </Clause>

      <Clause n="7" title="Our data protection obligations">
        <Sub n="7.1">We process School Data only to provide, secure and support the Service, and on the School’s instructions. We do not sell School Data, use it for advertising, or use it to train machine learning models.</Sub>
        <Sub n="7.2">We maintain technical and organisational security measures appropriate to the risk, including encryption of data in transit, passwords stored only as bcrypt hashes, session tokens held in httpOnly cookies, and tenant isolation so that one School cannot access another’s data.</Sub>
        <Sub n="7.3">We use the sub-processors listed in the Privacy Notice, each bound by equivalent obligations. We give {V.subProcessorNoticeDays} days’ notice before adding a sub-processor, and the School may terminate without penalty if it reasonably objects.</Sub>
        <Sub n="7.4">We notify the School without undue delay, and in any event within {V.breachNotificationHours} hours of becoming aware, of any personal data breach affecting its data, with the information the School needs to meet its own reporting duties.</Sub>
        <Sub n="7.5">We assist the School, at its reasonable request, in responding to End User rights requests and in any consultation with a regulator.</Sub>
        <Sub n="7.6">On written request to {CONTACTS.support}, during the subscription term or within {V.exportWindowDays} days of its end, we will provide the School with an export of its School Data in a structured, machine-readable format.</Sub>
        <Sub n="7.7">We restrict staff access to School Data to personnel who need it to operate or support the Service, under confidentiality obligations.</Sub>
      </Clause>

      <Clause n="8" title="Acceptable use">
        <p>The School and its End Users must not:</p>
        <List
          items={[
            'use the Service for anything other than administering the School’s own educational operations;',
            'upload malware, or content that is unlawful, defamatory, or harmful to a child;',
            'attempt to access another School’s workspace, probe or bypass access controls, or test the Service’s security without our prior written permission;',
            'scrape, bulk-export or resell the Service or its data other than exporting the School’s own data;',
            'resell, sublicense or white-label the Service without a separate written agreement.',
          ]}
        />
        <p>We may suspend access immediately, without notice, for a breach of this clause that puts End Users or the Service at risk.</p>
      </Clause>

      <Clause n="9" title="Fees, billing and taxes">
        <Sub n="9.1">Paid plans are billed in advance, monthly or annually, through our payment provider Razorpay. We do not receive or store full card details.</Sub>
        <Sub n="9.2">Subscriptions renew automatically for successive terms unless cancelled before the current term ends.</Sub>
        <Sub n="9.3">Prices exclude GST and other applicable taxes, which are added where required.</Sub>
        <Sub n="9.4">If a payment fails, the workspace enters the grace period in clause 4.3. If it is still unpaid at the end of that period, access is suspended.</Sub>
        <Sub n="9.5">Plan changes take effect as described in the Service at the time of the change. A downgrade taking the School below its plan’s student limit must be resolved by the School before the change applies.</Sub>
      </Clause>

      <Clause n="10" title="Refunds and cancellation">
        <p>
          Set out in the <a className="text-indigo-600 underline" href="/refunds">Refund &amp; Cancellation Policy</a>,
          which forms part of these Terms.
        </p>
      </Clause>

      <Clause n="11" title="Availability and support">
        <Sub n="11.1">We aim to keep the Service available but do not commit to a guaranteed uptime level unless a separate written service level agreement is in place.</Sub>
        <Sub n="11.2">The Service depends on third-party infrastructure, and outages or latency in those providers may affect availability. Hosting on some tiers may introduce a delay on the first request after a period of inactivity.</Sub>
        <Sub n="11.3">We may perform maintenance, giving advance notice for planned work that we expect to cause significant disruption.</Sub>
        <Sub n="11.4">Support is provided by email at {CONTACTS.support}.</Sub>
      </Clause>

      <Clause n="12" title="Suspension and termination">
        <Sub n="12.1">The School may cancel at any time from the billing area. Cancellation takes effect at the end of the current paid term.</Sub>
        <Sub n="12.2">We may suspend or terminate for non-payment after the grace period, for a material breach not remedied within {V.curePeriodDays} days of notice, or immediately for a breach of clause 8 that puts End Users at risk.</Sub>
        <Sub n="12.3">We may discontinue the Service entirely on {V.terminationNoticeDays} days’ notice, refunding the unused portion of any prepaid fees.</Sub>
        <Sub n="12.4">On termination the School may request an export of its data under clause 7.6 for {V.exportWindowDays} days.</Sub>
      </Clause>

      <Clause n="13" title="Data retention and deletion">
        <Sub n="13.1">While a workspace is active, School Data is retained until the School deletes it.</Sub>
        <Sub n="13.2">Deleting a student, teacher or record within the Service removes it from normal views and marks it inactive. It is retained in our systems after that so that accidental deletions can be reversed and so that historical records the School is required to keep are not lost.</Sub>
        <Sub n="13.3">After termination and the export window in clause 12.4, we delete School Data on the School’s written request to {CONTACTS.privacy}, and otherwise retain it only for as long as we have a lawful reason to.</Sub>
        <Sub n="13.4">We retain billing and transaction records for the period required by tax law.</Sub>
      </Clause>

      <Clause n="14" title="Intellectual property">
        <Sub n="14.1">We own the Service, its software, design and documentation. These Terms grant the School a non-exclusive, non-transferable right to use it during the subscription term.</Sub>
        <Sub n="14.2">The School owns its School Data. It grants us only the licence needed to host, process, back up and display that data in order to provide the Service.</Sub>
        <Sub n="14.3">The School’s name and logo remain its own. We use them within the Service to render its branded portal, and elsewhere only with permission.</Sub>
        <Sub n="14.4">If the School sends us feedback or suggestions, we may use them without obligation or payment.</Sub>
      </Clause>

      <Clause n="15" title="Disclaimers">
        <p>
          Except as expressly stated, the Service is provided “as is” and we disclaim all implied
          warranties to the extent the law permits, including fitness for a particular purpose. We do
          not warrant that the Service will be uninterrupted or error-free, and the School remains
          responsible for the accuracy of the records it maintains, including attendance registers,
          marks, results and fee accounts. Nothing here excludes liability that cannot lawfully be
          excluded.
        </p>
      </Clause>

      <Clause n="16" title="Limitation of liability">
        <Sub n="16.1">Neither party is liable for indirect or consequential loss, or for loss of profit, revenue, goodwill or anticipated savings.</Sub>
        <Sub n="16.2">Our total aggregate liability arising out of these Terms is limited to the fees paid by the School in the {V.liabilityCapMonths} months before the event giving rise to the claim.</Sub>
        <Sub n="16.3">Clause 16.2 does not limit either party’s liability for death or personal injury caused by negligence, for fraud, or for any liability that cannot be limited by law. It does not limit the School’s indemnity under clause 6 or its obligation to pay fees due.</Sub>
      </Clause>

      <Clause n="17" title="Changes to these Terms">
        <p>
          We may update these Terms. For material changes we give at least {V.priceChangeNoticeDays}{' '}
          days’ notice by email to Administrators and by notice in the Service. Continued use after
          the effective date is acceptance; a School that objects may terminate before that date and
          receive a pro-rata refund of prepaid fees. Superseded versions remain available at{' '}
          <code className="text-[13px]">/terms/v/&lt;version&gt;</code>.
        </p>
      </Clause>

      <Clause n="18" title="Governing law and disputes">
        <Sub n="18.1">These Terms are governed by the laws of {JURISDICTION.law}.</Sub>
        <Sub n="18.2">The courts of {JURISDICTION.courts} have exclusive jurisdiction.</Sub>
        <Sub n="18.3">Both parties will attempt to resolve a dispute in good faith for 30 days before starting proceedings.</Sub>
      </Clause>

      <Clause n="19" title="General">
        <p>
          These Terms, with the Privacy Notice and Refund &amp; Cancellation Policy, are the entire
          agreement between the parties. If a clause is unenforceable the rest survives. Failure to
          enforce a right is not a waiver of it. The School may not assign these Terms without our
          consent; we may assign them to a successor in a merger or sale of the business, on notice.
          Nothing creates a partnership, agency or employment relationship.
        </p>
      </Clause>

      <Clause n="20" title="Contact">
        <p className="whitespace-pre-line">
          {ENTITY.name}{'\n'}
          {ENTITY.address}{'\n'}
          General: {CONTACTS.support}{'\n'}
          Privacy and data protection: {CONTACTS.privacy}{'\n'}
          Grievance Officer: {GRIEVANCE_OFFICER.name}, {GRIEVANCE_OFFICER.email}
        </p>
      </Clause>
    </LegalLayout>
  );
}
