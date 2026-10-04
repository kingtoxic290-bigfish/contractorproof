import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Construction,
  FileCheck2,
  Flag,
  Hash,
  Menu,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import "./landing-page.css";

/**
 * Public landing page.
 *
 * This page explains one thing: how a client finds a contractor by CRB
 * registration number, reviews the Contractor Passport, assigns a project, and
 * then keeps a verifiable record of what happened during execution.
 *
 * It states only what the product actually does. There are no ratings, scores,
 * rankings or recommendations anywhere on this page, and nothing here claims
 * that a cryptographic proof establishes that construction work was truthful.
 * Verification results are the four factual states the system records.
 *
 * Every outbound link points at a route this application already serves:
 * `/login`, `/verify`, and `/contractors` (the existing CRB discovery screen).
 * No landing-page behaviour calls an endpoint that the application does not
 * already use.
 */

const CLIENT_STEPS = [
  {
    number: "01",
    title: "Find",
    text: "Enter the contractor's CRB Registration Number.",
  },
  {
    number: "02",
    title: "Review",
    text: "Open the Contractor Passport and review the recorded contractor and project history.",
  },
  {
    number: "03",
    title: "Assign",
    text: "The Client selects the contractor and creates the project.",
  },
  {
    number: "04",
    title: "Verify",
    text: "Milestones, evidence and verification events are recorded throughout project execution.",
  },
];

/**
 * What a project goes through, in the order the application records it.
 *
 * The last stage is the point of the whole record: earlier entries stay visible
 * after a correction or a dispute is resolved.
 */
const EXECUTION_STAGES = [
  { label: "Project created", note: "The client creates the project and assigns the contractor." },
  { label: "Milestone", note: "The agreed stages of work are recorded against the project." },
  { label: "Evidence", note: "The assigned contractor documents the work with evidence." },
  { label: "Inspection / review", note: "An authorised reviewer compares the evidence." },
  { label: "Approval", note: "The client records the review decision." },
  { label: "Correction / dispute", note: "A disagreement is raised rather than overwritten." },
  { label: "Resolution", note: "The outcome is recorded against the original entry." },
  { label: "Completion", note: "Execution is closed once the recorded stages are complete." },
  { label: "Historical record", note: "The project Passport keeps the full sequence." },
];

/**
 * The proof pipeline. Documents stay in controlled storage; only proofs of
 * those documents are anchored.
 */
const PROOF_STAGES = [
  "Evidence",
  "SHA-256 hash",
  "Authorised verification",
  "Blockchain proof",
  "Verification",
];

const VERIFICATION_STATES = [
  {
    name: "MATCH",
    detail: "Evidence matches the recorded cryptographic proof.",
    tone: "positive",
  },
  {
    name: "MISMATCH",
    detail: "Evidence does not match the recorded proof.",
    tone: "negative",
  },
  {
    name: "PENDING",
    detail: "Verification has not yet been completed.",
    tone: "neutral",
  },
  {
    name: "UNAVAILABLE",
    detail: "The proof cannot currently be checked.",
    tone: "neutral",
  },
];

const CLIENT_ACTIONS = [
  { title: "Discover", text: "Find a contractor using the CRB Registration Number." },
  { title: "Review", text: "View the Contractor Passport before assignment." },
  { title: "Assign", text: "Create and assign projects to contractors." },
  { title: "Verify", text: "Track milestones, evidence and verification throughout execution." },
];

const CONTRACTOR_ACTIONS = [
  "Assigned projects",
  "Milestone evidence",
  "Verification history",
  "Project passport",
];

const PASSPORT_SAMPLE_PROJECTS = [
  "Road Rehabilitation Project",
  "Building Construction Project",
  "Water Infrastructure Project",
];

const NAV_LINKS = [
  { href: "#passport", label: "Contractor Passport" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#verification", label: "Verification" },
];

/**
 * Photographs supplied for the page, mapped to the section each one supports.
 *
 * Filenames carry the spaces and parentheses they were pasted with, so the
 * paths are percent-encoded to match what the browser requests. The hero is not
 * listed here: it is a background layer set through `--lp-hero-image` in the
 * stylesheet.
 *
 * These are illustrations of work the surrounding copy already describes. They
 * deliberately carry no caption, because a caption would assert something about
 * the photograph that the page cannot verify.
 */
const SECTION_IMAGES = {
  discovery: {
    src: "/images/Pasted%20image.png",
    alt: "Contractor discovery and site review",
  },
  execution: {
    src: "/images/Pasted%20image%20(4).png",
    alt: "Project execution and site works",
  },
  evidence: {
    src: "/images/Pasted%20image%20(3).png",
    alt: "Site evidence recorded during inspection",
  },
} as const;

/**
 * A section that fades in once it enters the viewport.
 *
 * Renders visible by default. The hidden starting state is only applied once
 * the browser reports that it supports IntersectionObserver and that the visitor
 * has not asked for reduced motion, so content is never trapped behind an
 * effect that may not run.
 */
function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [waiting, setWaiting] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      return;
    }
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    setWaiting(true);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setWaiting(false);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.04 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${waiting ? "lp-reveal-pending" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="lp-eyebrow">{children}</p>;
}

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="lp-heading">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="lp-title">{title}</h2>
      {children ? <p className="lp-lede">{children}</p> : null}
    </div>
  );
}

function SampleTag() {
  return (
    <p className="lp-sample-tag">
      <span aria-hidden="true">Sample record</span>
      <span className="sr-only">Illustrative interface using sample data</span>
    </p>
  );
}

/**
 * A photograph supporting a section. Lazy-loaded because every instance sits
 * below the hero, and constrained so it can never widen the page.
 */
function SectionImage({
  image,
  size = "wide",
}: {
  image: { src: string; alt: string };
  size?: "wide" | "compact";
}) {
  return (
    <figure className={`lp-figure lp-figure-${size}`}>
      <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
    </figure>
  );
}

/**
 * Shape of a Contractor Passport entry, shown so a visitor knows what they will
 * be reading. Every value is illustrative.
 */
function PassportPreview() {
  const totals = [
    { label: "Projects", value: "12" },
    { label: "Completed milestones", value: "48" },
    { label: "Verified evidence", value: "126" },
  ];

  return (
    <figure className="lp-card lp-passport">
      <SampleTag />
      <div className="lp-passport-head">
        <p className="lp-passport-name">ABC Builders Ltd</p>
        <dl className="lp-passport-identity">
          <div>
            <dt>CRB Registration</dt>
            <dd className="font-mono">CRB/1234/2024</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Verified record</dd>
          </div>
        </dl>
      </div>

      <dl className="lp-passport-totals">
        {totals.map((total) => (
          <div key={total.label}>
            <dt>{total.label}</dt>
            <dd>{total.value}</dd>
          </div>
        ))}
      </dl>

      <div className="lp-passport-history">
        <p className="lp-subhead">Recent project history</p>
        <ul>
          {PASSPORT_SAMPLE_PROJECTS.map((project) => (
            <li key={project}>
              <Construction aria-hidden="true" />
              {project}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="lp-root">
      <a className="lp-skip" href="#main-content">
        Skip to main content
      </a>

      <header className="lp-header">
        <div className="lp-shell lp-header-inner">
          <a className="lp-brand" href="#top" onClick={closeMenu}>
            <span className="lp-brand-mark" aria-hidden="true">
              <ShieldCheck />
            </span>
            <span>ContractorProof</span>
          </a>

          <button
            type="button"
            className="lp-menu-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="landing-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>

          <nav
            id="landing-navigation"
            className={`lp-nav${menuOpen ? " is-open" : ""}`}
            aria-label="Main navigation"
          >
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu}>
                {link.label}
              </a>
            ))}
            <Link className="lp-nav-signin" to="/login" onClick={closeMenu}>
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        {/* Hero. The photograph layer sits behind a dark overlay so the text
            keeps its contrast whether or not an image has been supplied. */}
        <section className="lp-hero" id="top">
          <div className="lp-hero-media" aria-hidden="true" />
          <div className="lp-shell lp-hero-inner">
            <p className="lp-hero-eyebrow">
              <Construction aria-hidden="true" />
              Contractor records and project verification
            </p>
            <h1 className="lp-hero-title">
              Know the Contractor.
              <br />
              Verify the Project.
              <br />
              Keep the Proof.
            </h1>
            <p className="lp-hero-lede">
              ContractorProof helps clients discover contractors using their CRB registration
              number, review their Contractor Passport, assign projects, and preserve verifiable
              project history.
            </p>
            <div className="lp-hero-actions">
              <a className="lp-btn lp-btn-primary" href="#find">
                Find a Contractor
              </a>
              <Link className="lp-btn lp-btn-ghost-light" to="/login">
                Sign In
              </Link>
            </div>
            <p className="lp-hero-note">
              ContractorProof records history. It does not rate, score or rank contractors.
            </p>
          </div>
        </section>

        {/* The client's first action. */}
        <section className="lp-section" id="find">
          <div className="lp-shell">
            <SectionHeading eyebrow="Start here" title="Find a Contractor">
              Start with the contractor&apos;s CRB Registration Number.
            </SectionHeading>

            <div className="lp-find">
              <form
                className="lp-find-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  // Hands off to the existing contractor discovery screen. This
                  // page performs no search of its own and shows no result of
                  // its own; it only routes to functionality that already
                  // exists. The number travels as a query parameter because that
                  // route sits behind the sign-in gate, and a visitor should not
                  // have to type it twice.
                  const entered = new FormData(event.currentTarget).get("crbRegistrationNumber");
                  const crb = typeof entered === "string" ? entered.trim() : "";
                  navigate(crb ? `/contractors?crb=${encodeURIComponent(crb)}` : "/contractors");
                }}
              >
                <label className="lp-field" htmlFor="crb-registration">
                  <span>CRB Registration Number</span>
                  <span className="lp-input-row">
                    <span className="lp-input-prefix" aria-hidden="true">
                      <Hash />
                    </span>
                    <input
                      id="crb-registration"
                      name="crbRegistrationNumber"
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      placeholder="CRB/________________________"
                      required
                    />
                    <button type="submit" className="lp-btn lp-btn-primary lp-btn-submit">
                      <Search aria-hidden="true" />
                      Search Contractor
                    </button>
                  </span>
                </label>
              </form>

              <ol className="lp-find-path">
                {["CRB Number", "Contractor Passport", "Review", "Assign Project"].map(
                  (stage, index) => (
                    <li key={stage}>
                      <span className="lp-find-index">{index + 1}</span>
                      {stage}
                    </li>
                  ),
                )}
              </ol>

              <p className="lp-find-note">
                Contractor discovery runs inside ContractorProof. Sign in as a client or
                administrator to search contractor records and open a Contractor Passport.
              </p>
            </div>

            <SectionImage image={SECTION_IMAGES.discovery} />
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="passport">
          <div className="lp-shell">
            <SectionHeading eyebrow="Before you assign" title="Contractor Passport">
              A single, evolving record of a contractor&apos;s verified project history.
            </SectionHeading>

            <div className="lp-split">
              <div className="lp-split-copy">
                <p>
                  The Passport is what a client reads before deciding. It holds the
                  contractor&apos;s registration record, the projects they were assigned, and the
                  milestones, evidence and verification events recorded against each one.
                </p>
                <ul className="lp-checks">
                  <li>
                    <Check aria-hidden="true" />
                    Recorded CRB registration and check history
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    Project and milestone status counts
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    Evidence, corrections and dispute records
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    Blockchain proof counts
                  </li>
                </ul>
                <p className="lp-split-note">
                  ContractorProof records history. It does not decide which contractor is
                  &ldquo;best&rdquo;.
                </p>
                <Link className="lp-btn lp-btn-outline" to="/contractors">
                  View Contractor Passport
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
              <PassportPreview />
            </div>
          </div>
        </section>

        <section className="lp-section" id="how-it-works">
          <div className="lp-shell">
            <SectionHeading eyebrow="The client workflow" title="From Contractor Discovery to Project History">
              Four steps, in the order a client actually performs them.
            </SectionHeading>

            <ol className="lp-steps">
              {CLIENT_STEPS.map((step) => (
                <li key={step.number} className="lp-step">
                  <span className="lp-step-number">{step.number}</span>
                  <h3 className="lp-step-title">{step.title}</h3>
                  <p className="lp-step-text">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="execution">
          <div className="lp-shell">
            <SectionHeading eyebrow="During execution" title="Follow the Project From Start to Finish">
              Project history evolves without silently replacing what happened before.
              Corrections, variations and disputes remain part of the record.
            </SectionHeading>

            <SectionImage image={SECTION_IMAGES.execution} />

            <ol className="lp-rail">
              {EXECUTION_STAGES.map((stage) => (
                <li key={stage.label} className="lp-rail-item">
                  <span className="lp-rail-dot" aria-hidden="true" />
                  <span className="lp-rail-label">{stage.label}</span>
                  <span className="lp-rail-note">{stage.note}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-section" id="proof">
          <div className="lp-shell">
            <div className="lp-split lp-split-proof">
              <div className="lp-split-copy">
                <SectionHeading eyebrow="Integrity layer" title="Blockchain Provides the Proof Layer">
                  Project documents remain in controlled storage. ContractorProof creates
                  cryptographic proofs of recorded evidence and uses blockchain to preserve the
                  integrity of those proofs.
                </SectionHeading>
                <p className="lp-principle">
                  Blockchain proves that the recorded evidence matches the anchored cryptographic
                  proof. It does not independently prove that the construction work was truthful.
                </p>
              </div>

              <figure className="lp-card lp-pipeline">
                <SampleTag />
                <p className="lp-subhead">Proof pipeline</p>
                <ol className="lp-flow">
                  {PROOF_STAGES.map((stage) => (
                    <li key={stage}>{stage}</li>
                  ))}
                </ol>

                <div className="lp-sample-evidence">
                  <p className="lp-sample-file">
                    <FileCheck2 aria-hidden="true" />
                    Foundation Inspection Report.pdf
                  </p>
                  <dl>
                    <div>
                      <dt>SHA-256</dt>
                      <dd className="font-mono">8f3a&hellip;91c2</dd>
                    </div>
                    <div>
                      <dt>Verification</dt>
                      <dd className="lp-state lp-state-positive">Match</dd>
                    </div>
                    <div>
                      <dt>Blockchain</dt>
                      <dd>Confirmed</dd>
                    </div>
                  </dl>
                </div>
              </figure>
            </div>

            <SectionImage image={SECTION_IMAGES.evidence} size="compact" />
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="verification">
          <div className="lp-shell">
            <SectionHeading eyebrow="What a result means" title="Verification Should Answer a Factual Question">
              Does the evidence presented now match the evidence previously recorded?
            </SectionHeading>

            <ul className="lp-states">
              {VERIFICATION_STATES.map((state) => (
                <li key={state.name} className={`lp-state-row lp-tone-${state.tone}`}>
                  <span className="lp-state-name">{state.name}</span>
                  <span className="lp-state-detail">{state.detail}</span>
                </li>
              ))}
            </ul>

            <p className="lp-find-note">
              These results describe a comparison of recorded evidence. They are not a judgement
              about a contractor.
            </p>
          </div>
        </section>

        <section className="lp-section" id="clients">
          <div className="lp-shell">
            <SectionHeading eyebrow="Who does what" title="Built for Clients Managing Real Projects">
              The client owns project creation and assignment.
            </SectionHeading>

            <dl className="lp-actions">
              {CLIENT_ACTIONS.map((action) => (
                <div key={action.title} className="lp-action">
                  <dt>{action.title}</dt>
                  <dd>{action.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="contractors">
          <div className="lp-shell">
            <div className="lp-split">
              <div className="lp-split-copy">
                <SectionHeading eyebrow="For contractors" title="Give Completed Work a Verifiable History">
                  Contractors receive assigned projects, document project execution and build a
                  verifiable history of completed work.
                </SectionHeading>
                <ul className="lp-checks">
                  <li>
                    <Flag aria-hidden="true" />
                    Work arrives as an assigned project, not an invitation to create one
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    Evidence is recorded against the milestone it belongs to
                  </li>
                </ul>
              </div>

              <ul className="lp-list-panel">
                {CONTRACTOR_ACTIONS.map((item) => (
                  <li key={item}>
                    <Check aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-section" id="public-proof">
          <div className="lp-shell">
            <div className="lp-split">
              <figure className="lp-card lp-proof-card">
                <SampleTag />
                <dl>
                  <div>
                    <dt>Verification reference</dt>
                    <dd className="font-mono">CP-VER-2026-000184</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd className="lp-state lp-state-positive">Match</dd>
                  </div>
                  <div>
                    <dt>Proof</dt>
                    <dd>Confirmed</dd>
                  </div>
                  <div>
                    <dt>Block</dt>
                    <dd className="font-mono">#184293</dd>
                  </div>
                </dl>
              </figure>

              <div className="lp-split-copy">
                <SectionHeading eyebrow="Public check" title="Verify a Proof">
                  Verify a recorded proof without opening confidential project documents.
                </SectionHeading>
                <p>
                  Anyone holding a recorded proof can check it against the anchored cryptographic
                  proof. The document itself is never published to do this.
                </p>
                <Link className="lp-btn lp-btn-outline" to="/verify">
                  Verify a Proof
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-cta">
          <div className="lp-shell lp-cta-inner">
            <Reveal>
              <h2 className="lp-cta-title">
                Know the Contractor.
                <br />
                Verify the Project.
                <br />
                Keep the Proof.
              </h2>
              <p className="lp-cta-lede">
                ContractorProof connects contractor discovery, project execution, evidence,
                verification and blockchain-backed proof in one auditable workflow.
              </p>
              <div className="lp-hero-actions">
                <a className="lp-btn lp-btn-primary" href="#find">
                  Find a Contractor
                </a>
                <Link className="lp-btn lp-btn-ghost-light" to="/login">
                  Sign In
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-shell lp-footer-inner">
          <p className="lp-footer-brand">
            <ShieldCheck aria-hidden="true" />
            ContractorProof
          </p>
          <nav className="lp-footer-nav" aria-label="Footer navigation">
            <a href="#passport" onClick={closeMenu}>
              Contractor Passport
            </a>
            <a href="#how-it-works" onClick={closeMenu}>
              How It Works
            </a>
            <Link to="/verify">Verification</Link>
            <Link to="/login">Sign In</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
