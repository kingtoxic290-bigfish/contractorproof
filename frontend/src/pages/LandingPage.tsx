import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  FileStack,
  Fingerprint,
  FolderKanban,
  Hash,
  Menu,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import "./landing-page.css";

const workflowSteps = [
  { number: "01", title: "Discover", text: "Find a contractor using their CRB Registration Number.", icon: Search },
  { number: "02", title: "Review", text: "Examine the contractor's recorded Passport information.", icon: ShieldCheck },
  { number: "03", title: "Assign", text: "The client selects a contractor and creates the project.", icon: UserCheck },
  { number: "04", title: "Document", text: "Record milestones and evidence as work progresses.", icon: FolderKanban },
  { number: "05", title: "Prove", text: "Hash evidence and anchor authorized events as proof.", icon: Hash },
  { number: "06", title: "Verify", text: "Compare evidence with its previously recorded proof.", icon: CheckCircle2 },
];

const lifecycle = [
  "Project created",
  "Milestone created",
  "Evidence submitted",
  "Inspection and review",
  "Approval or correction",
  "Dispute and resolution",
  "Completion",
  "Historical record",
];

const problems = [
  { title: "Fragmented records", text: "Contractor information, project documents and milestone evidence are often scattered across different systems.", icon: FileStack },
  { title: "Difficult verification", text: "A registration record alone cannot explain what happened during project execution.", icon: Search },
  { title: "Evidence can be disputed", text: "When evidence changes, it can be difficult to establish which version was originally recorded.", icon: FileClock },
  { title: "Lost project history", text: "Completed work should become a useful historical record, not disappear into disconnected files.", icon: FolderKanban },
];

const statuses = [
  { name: "MATCH", title: "Evidence matches", detail: "The submitted evidence matches the recorded cryptographic proof.", className: "match", icon: CheckCircle2 },
  { name: "MISMATCH", title: "Evidence differs", detail: "The submitted evidence does not match the recorded proof.", className: "mismatch", icon: Fingerprint },
  { name: "PENDING", title: "Not yet complete", detail: "Verification has not yet been completed.", className: "pending", icon: FileClock },
  { name: "UNAVAILABLE", title: "Cannot be checked", detail: "The proof cannot currently be checked.", className: "unavailable", icon: ShieldCheck },
];

const clientActions = [
  { title: "Discover", text: "Search and review contractors before assigning work.", icon: Search },
  { title: "Assign", text: "Create projects and assign contractors from recorded profiles.", icon: UserCheck },
  { title: "Manage", text: "Track milestones, evidence, inspections and project progress.", icon: ClipboardCheck },
  { title: "Verify", text: "Establish whether submitted evidence matches recorded proof.", icon: BadgeCheck },
];

const contractorActions = [
  { title: "Assigned projects", text: "See work assigned to your contractor account.", icon: FolderKanban },
  { title: "Milestone evidence", text: "Record progress and submit evidence against project milestones.", icon: FileCheck2 },
  { title: "Verification history", text: "Review recorded outcomes and the history of submissions.", icon: ShieldCheck },
  { title: "Project Passport", text: "Build a structured record of completed, verified work.", icon: FileStack },
];

function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`landing-mark${compact ? " compact" : ""}`} aria-hidden="true">
      <ShieldCheck />
    </span>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return <p className="landing-eyebrow">{children}</p>;
}

function PassportMockup() {
  return (
    <div className="passport-stage" aria-label="Illustrative Contractor Passport interface">
      <div className="passport-note"><span className="note-dot" /> Illustrative interface · sample data</div>
      <article className="passport-card">
        <header className="passport-card-head">
          <div className="passport-card-brand"><Mark compact /><span>CONTRACTOR<br />PASSPORT</span></div>
          <span className="passport-record-id">CP · SAMPLE</span>
        </header>
        <div className="passport-identity">
          <div className="company-monogram" aria-hidden="true">AB</div>
          <div className="passport-name"><p>CONTRACTOR</p><h3>ABC Builders Ltd</h3><span>CRB Registration · CRB/XXXX/XXXX</span></div>
          <div className="record-status"><Check aria-hidden="true" /> VERIFIED RECORD</div>
        </div>
        <div className="passport-metrics">
          <div><strong>12</strong><span>Projects</span></div>
          <div><strong>48</strong><span>Completed milestones</span></div>
          <div><strong>126</strong><span>Evidence records</span></div>
        </div>
        <div className="passport-project">
          <div className="project-row"><span className="project-kicker">RECENT PROJECT · SAMPLE</span><span className="project-verified"><CheckCircle2 /> VERIFIED HISTORY</span></div>
          <h4>North district clinic extension</h4>
          <div className="project-details"><span>4 milestones</span><span>Evidence history retained</span></div>
        </div>
        <div className="passport-card-foot"><span><ShieldCheck /> Factual project history</span><span>No ratings or rankings</span></div>
      </article>
      <div className="proof-path" aria-label="Project evidence proof chain">
        <span>PROJECT</span><ArrowRight /><span>MILESTONE</span><ArrowRight /><span>EVIDENCE</span><ArrowRight /><span>SHA-256</span><ArrowRight /><span>BLOCKCHAIN PROOF</span><ArrowRight /><b><Check /> MATCH</b>
      </div>
    </div>
  );
}

function PipelineMockup() {
  return (
    <div className="pipeline-card" aria-label="Illustrative evidence verification record">
      <div className="pipeline-card-top"><div><span className="pipeline-overline">EVIDENCE RECORD</span><h3>Foundation inspection report.pdf</h3></div><span className="file-icon"><FileCheck2 /></span></div>
      <div className="pipeline-line">
        <div className="pipeline-node"><span className="pipeline-node-icon"><FileCheck2 /></span><div><small>01 · FILE</small><strong>Evidence stored</strong></div></div>
        <div className="pipeline-node"><span className="pipeline-node-icon"><Hash /></span><div><small>02 · FINGERPRINT</small><strong>SHA-256 generated</strong></div></div>
        <div className="pipeline-node"><span className="pipeline-node-icon"><ShieldCheck /></span><div><small>03 · PROOF</small><strong>Authorized verification</strong></div></div>
      </div>
      <div className="pipeline-result"><div><small>SHA-256 · TRUNCATED EXAMPLE</small><code>8f3a...91c2</code></div><div className="pipeline-confirmed"><CheckCircle2 /><span><small>RESULT</small><strong>MATCH · CONFIRMED</strong></span></div></div>
      <p className="pipeline-caption">Illustrative sample only. A real result depends on a recorded proof and successful verification.</p>
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="landing-page" id="top">
      <a className="landing-skip" href="#main-content">Skip to content</a>
      <header className="landing-header">
        <a className="landing-brand" href="#top" aria-label="ContractorProof home" onClick={closeMenu}>
          <Mark /><span>ContractorProof<small>PROJECT EVIDENCE &amp; VERIFICATION</small></span>
        </a>
        <button className="landing-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav id="landing-navigation" className={`landing-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
          <a href="#passport" onClick={closeMenu}>Contractor Passport</a>
          <a href="#workflow" onClick={closeMenu}>How it works</a>
          <a href="#verification" onClick={closeMenu}>Verification</a>
          <a href="#clients" onClick={closeMenu}>For clients</a>
          <a href="#contractors" onClick={closeMenu}>For contractors</a>
          <Link className="nav-sign-in" to="/login" onClick={closeMenu}>Sign in <ArrowRight /></Link>
        </nav>
      </header>

      <div id="main-content">
        <section className="landing-hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-copy">
            <SectionEyebrow>CONSTRUCTION PROJECT EVIDENCE</SectionEyebrow>
            <h1>Build with confidence.<br /><span>Verify every project.</span><br />Preserve every proof.</h1>
            <p>ContractorProof creates a verifiable digital history of contractor projects — connecting contractor records, project milestones, evidence, verification and blockchain-backed proof.</p>
            <div className="hero-actions">
              <a className="landing-button button-primary" href="#passport">Explore Contractor Passport <ArrowRight /></a>
              <a className="landing-button button-light" href="#workflow">See how it works <ArrowDown /></a>
            </div>
            <div className="hero-note"><span className="note-rule" />A shared record of project work, built from evidence.</div>
          </div>
          <PassportMockup />
          <div className="hero-bottomline"><span>01 / PROJECT RECORDS</span><span>AN EVIDENCE-LED WORKFLOW</span><span>SCROLL TO EXPLORE ↓</span></div>
        </section>

        <section className="landing-section problem-section" id="why">
          <div className="section-heading split-heading"><div><SectionEyebrow>THE RECORD GAP</SectionEyebrow><h2>Project records should not disappear when a project ends.</h2></div><p>Construction work creates a trail of decisions, inspections and evidence. ContractorProof helps keep that trail connected and reviewable.</p></div>
          <div className="problem-grid">{problems.map(({ title, text, icon: Icon }, index) => <article className="problem-item" key={title}><span className="problem-index">0{index + 1}</span><Icon /><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className="landing-section passport-section" id="passport">
          <div className="passport-section-copy"><SectionEyebrow>THE CONTRACTOR PASSPORT</SectionEyebrow><h2>One contractor.<br /><em>One evolving project history.</em></h2><p>ContractorProof brings contractor identity references, projects, milestones, evidence and verification history together into a Contractor Passport.</p><ul className="check-list"><li><Check /> CRB registration reference and recorded status</li><li><Check /> Project and milestone history</li><li><Check /> Evidence versions and verification outcomes</li><li><Check /> Verified history, separate from active work</li></ul><a className="text-link" href="#workflow">Explore how a Passport is built <ArrowRight /></a></div>
          <div className="passport-section-visual"><PassportMockup /></div>
        </section>

        <section className="landing-section workflow-section" id="workflow">
          <div className="section-heading"><SectionEyebrow>THE PROJECT PATH</SectionEyebrow><h2>From contractor discovery to verified project history.</h2><p>A client creates and assigns the project. The contractor participates in the assigned work and submits evidence as milestones progress.</p></div>
          <ol className="workflow-grid">{workflowSteps.map(({ number, title, text, icon: Icon }) => <li className="workflow-step" key={number}><div className="workflow-top"><span>{number}</span><Icon /></div><h3>{title}</h3><p>{text}</p></li>)}</ol>
          <div className="workflow-ribbon"><span>CLIENT DISCOVERY</span><i /><span>PROJECT EXECUTION</span><i /><span>VERIFIED HISTORY</span></div>
        </section>

        <section className="evidence-section" id="evidence">
          <div className="evidence-copy"><SectionEyebrow>DOCUMENTS OFF-CHAIN · PROOF ON-CHAIN</SectionEyebrow><h2>Blockchain proves the record.<br /><em>It does not replace the record.</em></h2><p>ContractorProof keeps project documents and application data in controlled storage. The blockchain is an integrity layer for cryptographic proof of authorized events.</p><p className="evidence-principle">Your documents stay where they belong.<br /><strong>The blockchain stores the proof, not the documents.</strong></p><a className="landing-button button-outline-light" href="#architecture">Understand the record model <ArrowRight /></a></div>
          <PipelineMockup />
        </section>

        <section className="landing-section verification-section" id="verification">
          <div className="section-heading"><SectionEyebrow>FACTUAL VERIFICATION</SectionEyebrow><h2>Verification should answer a factual question.</h2><p>Does the evidence presented now match the evidence previously recorded? The result describes the evidence and proof state, not the contractor.</p></div>
          <div className="status-grid">{statuses.map(({ name, title, detail, className, icon: Icon }) => <article className={`status-card ${className}`} key={name}><div className="status-card-head"><Icon /><span>{name}</span></div><h3>{title}</h3><p>{detail}</p></article>)}</div>
          <div className="verification-link"><span>No score or judgement. Only a recorded result.</span><Link to="/verify" className="text-link">Open public verification <ArrowRight /></Link></div>
        </section>

        <section className="landing-section history-section" id="history">
          <div className="section-heading"><SectionEyebrow>APPEND-ONLY PROJECT HISTORY</SectionEyebrow><h2>Project history evolves without disappearing.</h2><p>Corrections, variations and disputes become part of the history rather than silently overwriting what happened before.</p></div>
          <ol className="history-timeline">{lifecycle.map((event, index) => <li key={event} className={index === lifecycle.length - 1 ? "is-final" : ""}><span className="timeline-node">{index === lifecycle.length - 1 ? <Check /> : String(index + 1).padStart(2, "0")}</span><span>{event}</span></li>)}</ol>
        </section>

        <section className="audience-section" id="clients">
          <div className="audience-panel client-panel"><SectionEyebrow>FOR CLIENTS &amp; PROJECT OWNERS</SectionEyebrow><h2>Built for the people responsible for projects.</h2><p className="audience-intro">Clients discover contractors, own project creation and assignment, and review the evidence submitted against project milestones.</p><div className="audience-grid">{clientActions.map(({ title, text, icon: Icon }) => <article className="audience-item" key={title}><Icon /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div><Link className="text-link" to="/login">Enter the client workspace <ArrowRight /></Link></div>
          <div className="audience-panel contractor-panel" id="contractors"><SectionEyebrow>FOR CONTRACTORS</SectionEyebrow><h2>Give completed work a verifiable history.</h2><p className="audience-intro">Contractors participate in assigned projects, submit evidence and build a structured history of completed work. Project creation remains with the client.</p><div className="audience-grid">{contractorActions.map(({ title, text, icon: Icon }) => <article className="audience-item" key={title}><Icon /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div><Link className="text-link" to="/login">Enter the contractor workspace <ArrowRight /></Link></div>
        </section>

        <section className="public-proof-section" id="public-proof"><div className="public-proof-heading"><SectionEyebrow>PUBLIC VERIFICATION</SectionEyebrow><h2>Verify a proof without opening the entire project.</h2><p>Public verification can confirm whether a specific proof reference corresponds to recorded evidence without exposing confidential project documents.</p><Link className="landing-button button-primary" to="/verify">Verify evidence <ArrowRight /></Link></div><div className="public-proof-ui"><div className="public-proof-ui-top"><span>CONTRACTORPROOF · PUBLIC CHECK</span><span className="sample-label">SAMPLE</span></div><div className="reference-line"><span>Verification reference</span><code>CP-VER-2026-000184</code></div><div className="public-proof-data"><div><span>Status</span><strong className="public-match"><CheckCircle2 /> MATCH</strong></div><div><span>Proof</span><strong>Confirmed</strong></div><div><span>Block</span><strong>#184293</strong></div></div><p>Illustrative interface only. Live responses depend on the supplied evidence reference and actual proof state.</p></div></section>

        <section className="landing-section architecture-section" id="architecture"><div className="architecture-copy"><SectionEyebrow>THE TRUST MODEL</SectionEyebrow><h2>Blockchain is one layer of the system — not the whole system.</h2><p>Application records, controlled document storage and cryptographic proof each have a distinct role in the workflow.</p></div><div className="architecture-stack"><div><span>01</span><strong>USER INTERFACE</strong><small>Discovery · execution · review</small></div><ArrowDown /><div><span>02</span><strong>CONTRACTORPROOF API</strong><small>Access rules · workflow · history</small></div><div className="stack-bottom"><div><span>03</span><strong>POSTGRESQL</strong><small>System of record</small></div><div><span>04</span><strong>CONTROLLED STORAGE</strong><small>Evidence files stay off-chain</small></div><div><span>05</span><strong>BLOCKCHAIN REGISTRY</strong><small>Authorized event proof</small></div></div></div></section>

        <section className="final-cta"><SectionEyebrow>CONTRACTORPROOF</SectionEyebrow><h2>Turn project records into verifiable history.</h2><p>Connect contractor discovery, project execution, evidence, verification and blockchain-backed proof in one auditable workflow.</p><div className="hero-actions"><Link className="landing-button button-primary" to="/login">Explore ContractorProof <ArrowRight /></Link><Link className="landing-button button-light" to="/login">Sign in</Link></div></section>
      </div>

      <footer className="landing-footer"><a className="landing-brand" href="#top"><Mark compact /><span>ContractorProof<small>PROJECT EVIDENCE &amp; VERIFICATION</small></span></a><span>Evidence remains the record. Proof preserves its integrity.</span><div><Link to="/login">Sign in</Link><Link to="/verify">Public verification</Link></div></footer>
    </main>
  );
}