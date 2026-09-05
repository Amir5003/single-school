import LegalLayout, { Clause, List } from './LegalLayout';
import {
  PRIVACY_VERSION,
  ENTITY,
  CONTACTS,
  GRIEVANCE_OFFICER,
  HOSTING,
  TERMS_VALUES as V,
} from '../../constants/legalConfig';

/**
 * Privacy Notice — written for the student and the parent, not the lawyer.
 *
 * §2 must match the schema exactly. If you add a field that holds personal
 * data, add it here in the same commit.
 *
 * §3 states there is no tracking or advertising in this product. That claim is
 * verifiable in the diff and it is load-bearing: adding an analytics SDK,
 * error reporter or marketing pixel invalidates published text that families
 * have relied on. Do not add one without updating this page first.
 */
export default function Privacy() {
  return (
    <LegalLayout title="Privacy Notice" version={PRIVACY_VERSION}>
      <Clause n="1" title="Who we are, and who holds your data">
        <p>
          {ENTITY.productName} is software that schools use to manage attendance, timetables, marks,
          homework and fees. It is operated by {ENTITY.name}.
        </p>
        <p>
          If you are a student, parent or teacher,{' '}
          <strong>your school decided to use this software and decided what to record about you.</strong>{' '}
          We store and protect that information on your school’s behalf. We do not decide what is
          collected about you, and we do not use it for our own purposes.
        </p>
        <p>
          That means: questions about <em>why</em> your school holds something, or requests to
          correct or remove it, go to your school first. Questions about how we store and secure it
          come to us at {CONTACTS.privacy}.
        </p>
      </Clause>

      <Clause n="2" title="What is held about you">
        <p>Depending on your role, your school may enter or generate:</p>
        <List
          items={[
            <><strong>Identity and contact</strong> — name, email address, phone number.</>,
            <><strong>Student record</strong> — enrollment ID, date of birth, home address, class and section.</>,
            <><strong>Attendance</strong> — daily present/absent marks.</>,
            <><strong>Academic</strong> — exam and assessment scores, results, report cards, coursework and homework submissions, including any files uploaded.</>,
            <><strong>Fees</strong> — amounts due, payments recorded, and overdue status.</>,
            <><strong>Family links</strong> — the connection between a parent account and a student’s record.</>,
            <><strong>Account and security</strong> — your password, stored only as a bcrypt hash we cannot reverse; sign-in session tokens; and whether you must change your password.</>,
            <><strong>Technical logs</strong> — request logs and error records generated when you use the Service, kept for security and troubleshooting.</>,
          ]}
        />
        <p>
          School administrators and our billing records also hold the school’s own contact and
          subscription details.
        </p>
      </Clause>

      <Clause n="3" title="If you are a student, or a parent of one">
        <p>Most people using this software are children. We take that seriously and it changes what we do.</p>
        <List
          items={[
            <>We run <strong>no advertising, no analytics, and no third-party tracking</strong> anywhere in this product. There is no ad network, no marketing pixel, and no behavioural profiling.</>,
            'The only cookies we set are the ones that keep you signed in. There are no optional cookies to accept or refuse.',
            'We never sell personal data, and we never use it to train machine learning models.',
            'Your account was created by your school, not by you. Your school is responsible for telling you and your parent or guardian that it exists, and for getting parental consent where the law requires it.',
          ]}
        />
        <p>
          If you or your parent did not know an account had been created, contact your school. If
          your school does not resolve it, write to us at {CONTACTS.privacy} and we will take it up
          with them.
        </p>
      </Clause>

      <Clause n="4" title="Why the information is used">
        <List
          items={[
            'To run the school’s day-to-day administration — registers, timetables, assessments, fee accounts.',
            'To give you an account and keep it secure, including emailing you a temporary password when your account is created and a reset link if you ask for one.',
            'To show you and, where linked, your parent, your own records.',
            'To keep the Service secure, diagnose faults, and prevent misuse.',
            'To bill the school and meet our tax and accounting obligations.',
          ]}
        />
        <p>
          Your school relies on its own lawful grounds — its enrolment agreement with you, its legal
          duties to keep attendance and assessment records, and its legitimate interest in running
          the school. We process on the school’s instructions under a written contract.
        </p>
      </Clause>

      <Clause n="5" title="Who else sees it">
        <p>
          Within your school: administrators see their school’s records; teachers see the classes
          they teach; students see their own records; parents see the records of children linked to
          them. One school can never see another school’s data.
        </p>
        <p>Outside your school, we use these service providers, and no others:</p>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">What for</th>
                <th className="px-4 py-2.5 font-medium">What it can see</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['MongoDB Atlas', 'Database hosting', 'All stored records'],
                ['Render', 'Backend application hosting', 'Data in transit and in memory'],
                ['Vercel', 'Frontend hosting', 'Requests and technical logs'],
                ['Cloudinary', 'School logos and homework file uploads', 'Uploaded files only'],
                [HOSTING.smtpProvider, 'Account and password-reset emails', 'Name and email address'],
                ['Razorpay', 'Subscription payments by the school', 'School billing details only — no student data'],
              ].map(([provider, purpose, sees]) => (
                <tr key={provider}>
                  <td className="px-4 py-3 font-medium text-gray-900">{provider}</td>
                  <td className="px-4 py-3 text-gray-600">{purpose}</td>
                  <td className="px-4 py-3 text-gray-600">{sees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Each is bound to use the data only to provide its service to us. We also disclose data
          where the law requires it, or to establish or defend a legal claim.
        </p>
      </Clause>

      <Clause n="6" title="Where it is stored">
        <p>
          Data is stored in {HOSTING.dataRegion}. Some providers above operate globally and may
          process data outside {HOSTING.country}. Where that happens we rely on the provider’s
          contractual safeguards for international transfers.
        </p>
      </Clause>

      <Clause n="7" title="How long it is kept">
        <List
          items={[
            'While you are at the school, for as long as the school keeps your record.',
            'When a record is deleted in the Service it is removed from view immediately and retained in our systems after that, so accidental deletions can be reversed and so records the school must keep are not lost.',
            'If the school stops using the Service, its data is deleted on the school’s written request, and otherwise kept only while we have a lawful reason to keep it.',
            'Billing records are kept for as long as tax law requires.',
          ]}
        />
        <p>
          You can ask us to erase data about you at any time under section 9, whichever of the above
          applies.
        </p>
      </Clause>

      <Clause n="8" title="How it is protected">
        <List
          items={[
            'All traffic is encrypted in transit over HTTPS.',
            'Passwords are stored only as bcrypt hashes with a work factor of 12 — we cannot read your password, and neither can your school.',
            'Sign-in tokens are held in httpOnly cookies, so page scripts cannot read them, and access tokens are short-lived.',
            'Every request is scoped to a single school, enforced on the server, so data cannot leak between schools.',
            'Access by our staff is limited to those who need it to run or support the Service.',
          ]}
        />
        <p>
          No system is perfectly secure. If a breach affects your data we will tell your school
          within {V.breachNotificationHours} hours of becoming aware, so it can tell you, and we will
          notify regulators where the law requires.
        </p>
      </Clause>

      <Clause n="9" title="Your rights">
        <p>
          Subject to the law that applies to you, you can ask to see the data held about you, have it
          corrected, have it erased, object to how it is used, or receive a copy in a portable form.
          You can also nominate someone to exercise these rights for you.
        </p>
        <p>
          <strong>Start with your school</strong> — it decides what is held about you and can act on
          most requests immediately using tools in the Service. If your school does not respond,
          write to {CONTACTS.privacy} and we will help, and where necessary act on the school’s
          behalf.
        </p>
        <p>
          You may also complain to the data protection authority in your country. In India that is
          the Data Protection Board of India.
        </p>
      </Clause>

      <Clause n="10" title="Cookies">
        <p>
          We set two cookies, both strictly necessary: a short-lived access token and a longer-lived
          refresh token, which together keep you signed in. Both are httpOnly. We set no analytics,
          advertising or tracking cookies, so there is no cookie banner and nothing to opt out of.
          Blocking these cookies will prevent you from signing in.
        </p>
      </Clause>

      <Clause n="11" title="Changes and contact">
        <p>
          We will post any update here and change the date at the top. For significant changes we
          will notify schools, who will notify you.
        </p>
        <p className="whitespace-pre-line">
          {ENTITY.name}{'\n'}
          {ENTITY.address}{'\n'}
          Privacy: {CONTACTS.privacy}{'\n'}
          Grievance Officer: {GRIEVANCE_OFFICER.name}, {GRIEVANCE_OFFICER.email}
        </p>
      </Clause>
    </LegalLayout>
  );
}
