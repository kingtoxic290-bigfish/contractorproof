import { useState } from "react";
import { BadgeCheck, Building2, Copy, FileCheck2, Flag, Link2, Scale, ShieldCheck } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { StateLabel } from "../../shared/StateLabel";
import type { JsonValue, PassportProof, ProjectPassport } from "../types";

function CopyHash({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-1 flex min-w-0 items-start gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-xs leading-5 text-stone-800">{value}</code>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
          title={copied ? "Copied" : `Copy ${label}`}
        >
          {copied ? <span aria-hidden="true" className="text-xs font-bold">OK</span> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
        </button>
      </dd>
      <span className="sr-only" role="status" aria-live="polite">{copied ? `${label} copied` : ""}</span>
    </div>
  );
}

function ProofRecord({ proof, title = "Blockchain proof" }: { proof: PassportProof | null; title?: string }) {
  const confirmed = Boolean(proof?.txHash && proof.blockNumber !== null && proof.blockNumber > 0);
  const state = proof === null ? "NO PROOF" : confirmed ? "CONFIRMED" : "PENDING";
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Link2 className="h-4 w-4" aria-hidden="true" /> {title}
        </h5>
        <span className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800">
          {state}
        </span>
      </div>
      {proof ? (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Event</dt>
            <dd className="mt-1 break-words text-sm text-stone-800">{proof.eventType}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Block</dt>
            <dd className="mt-1 text-sm text-stone-800">{confirmed ? proof.blockNumber : "Not confirmed"}</dd>
          </div>
          <div className="sm:col-span-2">
            <CopyHash label="Transaction hash" value={proof.txHash ?? "Not provided"} />
          </div>
          {proof.evidenceHash !== undefined ? (
            <div className="sm:col-span-2">
              <CopyHash label="Anchored evidence hash" value={proof.evidenceHash ?? "Not provided"} />
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Recorded at</dt>
            <dd className="mt-1 break-words text-sm text-stone-800">{proof.createdAt}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-stone-600">No blockchain proof is included for this record in the Passport projection.</p>
      )}
      <p className="mt-3 text-xs leading-5 text-stone-600">Proof metadata records an integrity event; it does not establish the truth or quality of the underlying claim.</p>
    </div>
  );
}

function JsonSnapshot({ title, value }: { title: string; value: JsonValue }) {
  return (
    <details className="rounded-lg border border-stone-200 bg-white px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
        {title}
      </summary>
      <pre className="mt-2 whitespace-pre-wrap break-all rounded-md bg-stone-50 p-3 font-mono text-xs leading-5 text-stone-700">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function VersionRecord({ version, current }: { version: ProjectPassport["milestones"][number]["evidence"][number]["versions"][number]; current: boolean }) {
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-semibold text-stone-900">
          Evidence Version {version.versionNumber}{current ? " · current" : " · historical"}
        </h5>
        {version.verificationStatus ? <StateLabel value={version.verificationStatus} /> : <span className="text-xs text-stone-600">No verification result</span>}
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Version ID</dt>
          <dd className="mt-1 break-all font-mono text-xs text-stone-800">{version.id}</dd>
        </div>
        <CopyHash label="SHA-256" value={version.sha256} />
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Created</dt>
          <dd className="mt-1 break-words text-sm text-stone-800">{version.createdAt}</dd>
        </div>
      </dl>
      {version.verifications.length ? (
        <div className="mt-4 border-t border-stone-200 pt-3">
          <h6 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Verification history</h6>
          <ul className="mt-2 space-y-2">
            {version.verifications.map((verification) => (
              <li key={verification.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-stone-50 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <StateLabel value={verification.status} />
                  <span className="text-xs text-stone-600">{verification.source}</span>
                </div>
                <time className="break-words text-xs text-stone-600">{verification.createdAt}</time>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4">
        <ProofRecord proof={version.blockchainProof} title="Version proof" />
      </div>
    </li>
  );
}

function CorrectionRecord({ correction }: { correction: ProjectPassport["milestones"][number]["corrections"][number] }) {
  return (
    <li className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-semibold text-stone-900">Correction record</h5>
        <StateLabel value={correction.status} />
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Reason</dt>
          <dd className="mt-1 break-words text-sm text-stone-800">{correction.reason}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Recorded</dt>
          <dd className="mt-1 break-words text-sm text-stone-800">{correction.createdAt}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Original event</dt>
          <dd className="mt-1 break-all font-mono text-xs text-stone-800">{correction.originalRecord.eventType} · {correction.originalRecord.eventId}</dd>
        </div>
        {correction.originalRecord.evidenceVersion ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Original evidence version</dt>
            <dd className="mt-1 text-sm text-stone-800">Version {correction.originalRecord.evidenceVersion.versionNumber}</dd>
            <code className="mt-1 block break-all font-mono text-xs text-stone-700">{correction.originalRecord.evidenceVersion.sha256}</code>
          </div>
        ) : null}
      </dl>
      {correction.correctedEvidence ? (
        <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3">
          <h6 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Corrected evidence versions</h6>
          <ul className="mt-2 space-y-2">
            {correction.correctedEvidence.versions.map((version) => (
              <li key={version.id} className="text-sm text-stone-800">
                Version {version.versionNumber} · {version.createdAt}
                <code className="mt-1 block break-all font-mono text-xs text-stone-700">{version.sha256}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {correction.resolutions.length ? (
        <ul className="mt-3 space-y-2">
          {correction.resolutions.map((resolution) => (
            <li key={resolution.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <p className="text-sm font-medium text-stone-900">Resolution: {resolution.status}</p>
              <p className="mt-1 break-words text-sm text-stone-700">{resolution.resolution}</p>
              <p className="mt-1 text-xs text-stone-600">{resolution.resolvedByRole} · {resolution.createdAt}</p>
              {resolution.correctedEvidenceVersion ? <code className="mt-2 block break-all font-mono text-xs">{resolution.correctedEvidenceVersion.sha256}</code> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ProofRecord proof={correction.originalRecord.blockchainProof} title="Original event proof" />
        <ProofRecord proof={correction.correctionProof} title="Correction proof" />
      </div>
    </li>
  );
}

export function ProjectHistoryCard({ passport }: { passport: ProjectPassport }) {
  const { project, milestones, variations } = passport;
  const allAttestations = milestones.flatMap((milestone) => milestone.evidence.flatMap((evidence) => evidence.attestations));

  return (
    <Card title={project.name} description="Project and linked historical records in the official Passport projection." icon={Building2}>
      <dl className="grid gap-4 border-b border-stone-200 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-xs uppercase tracking-wide text-stone-500">Project ID</dt><dd className="mt-1 break-all font-mono text-xs text-stone-800">{project.id}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-stone-500">Contract status</dt><dd className="mt-1 text-sm text-stone-900">{project.contractStatus ?? "Not provided"}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-stone-500">Procuring entity</dt><dd className="mt-1 break-words text-sm text-stone-900">{project.procuringEntity ?? "Not provided"}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-stone-500">NeST tender / contract</dt><dd className="mt-1 break-words text-sm text-stone-900">{[project.nestTenderReference, project.nestContractReference].filter((value): value is string => value !== null).join(" / ") || "Not provided"}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-stone-500">OCID</dt><dd className="mt-1 break-all font-mono text-xs text-stone-900">{project.ocid ?? "Not provided"}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-stone-500">Contract dates</dt><dd className="mt-1 break-words text-sm text-stone-900">{project.contractStartDate ?? "Not provided"} — {project.contractEndDate ?? "Not provided"}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-stone-500">Project record created</dt><dd className="mt-1 text-sm text-stone-900">{project.createdAt}</dd></div>
      </dl>

      <section className="mt-5" aria-labelledby="passport-milestones">
        <h3 id="passport-milestones" className="flex items-center gap-2 font-serif text-lg text-stone-900"><Flag className="h-4 w-4" aria-hidden="true" /> Milestones</h3>
        {milestones.length === 0 ? <p className="mt-3 text-sm text-stone-600">No milestones were returned in this Passport projection.</p> : (
          <ol className="mt-3 space-y-4">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-medium text-stone-900">{milestone.name}</h4>
                    <p className="mt-1 break-words text-sm text-stone-600">{milestone.description ?? "No description provided"}</p>
                  </div>
                  <StateLabel value={milestone.status} />
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs uppercase tracking-wide text-stone-500">Milestone ID</dt><dd className="mt-1 break-all font-mono text-xs text-stone-800">{milestone.id}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-stone-500">Recorded</dt><dd className="mt-1 text-stone-800">{milestone.createdAt}</dd></div>
                  {milestone.policy ? <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-stone-500">Policy</dt><dd className="mt-1 text-stone-800">{milestone.policy.name} · {milestone.policy.requiredApprovals} required approvals · {milestone.policy.allowedRoles.join(", ")}</dd></div> : null}
                </dl>

                <div className="mt-4 border-t border-stone-200 pt-4">
                  <h5 className="flex items-center gap-2 text-sm font-semibold text-stone-900"><FileCheck2 className="h-4 w-4" aria-hidden="true" /> Evidence records ({milestone.evidence.length})</h5>
                  {milestone.evidence.length === 0 ? <p className="mt-2 text-sm text-stone-600">No evidence records were returned for this milestone.</p> : (
                    <ul className="mt-3 space-y-4">
                      {milestone.evidence.map((evidence) => (
                        <li key={evidence.id} className="rounded-xl border border-stone-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <h6 className="break-all font-mono text-sm font-semibold text-stone-900">Evidence {evidence.id}</h6>
                              <p className="mt-1 text-xs text-stone-600">Evidence status · <StateLabel value={evidence.status} /></p>
                              <p className="mt-1 break-words text-xs text-stone-600">Recorded {evidence.createdAt}</p>
                            </div>
                            <span className="text-xs text-stone-600">{evidence.versions.length} version{evidence.versions.length === 1 ? "" : "s"}</span>
                          </div>
                          {evidence.versions.length ? (
                            <ol className="mt-4 space-y-3">
                              {evidence.versions.map((version) => (
                                <VersionRecord key={version.id} version={version} current={version.id === evidence.currentVersionId} />
                              ))}
                            </ol>
                          ) : <p className="mt-3 text-sm text-stone-600">No evidence versions were returned.</p>}

                          <div className="mt-4 border-t border-stone-200 pt-4">
                            <h6 className="flex items-center gap-2 text-sm font-semibold text-stone-900"><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Attestations ({evidence.attestations.length})</h6>
                            {evidence.attestations.length ? (
                              <ul className="mt-3 space-y-3">
                                {evidence.attestations.map((attestation) => (
                                  <li key={attestation.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                                    <dl className="grid gap-3 sm:grid-cols-2">
                                      <div><dt className="text-xs uppercase tracking-wide text-stone-500">Decision</dt><dd className="mt-1 text-sm font-semibold text-stone-900">{attestation.decision}</dd></div>
                                      <div><dt className="text-xs uppercase tracking-wide text-stone-500">Verifier role</dt><dd className="mt-1 text-sm text-stone-900">{attestation.verifierRole}</dd></div>
                                      <div><dt className="text-xs uppercase tracking-wide text-stone-500">Recorded</dt><dd className="mt-1 text-sm text-stone-900">{attestation.createdAt}</dd></div>
                                      <div><dt className="text-xs uppercase tracking-wide text-stone-500">Attestation ID</dt><dd className="mt-1 break-all font-mono text-xs text-stone-900">{attestation.id}</dd></div>
                                      {attestation.policyId ? <div><dt className="text-xs uppercase tracking-wide text-stone-500">Policy ID</dt><dd className="mt-1 break-all font-mono text-xs text-stone-900">{attestation.policyId}</dd></div> : null}
                                    </dl>
                                    <div className="mt-3"><ProofRecord proof={attestation.blockchainProof} title="Attestation proof" /></div>
                                  </li>
                                ))}
                              </ul>
                            ) : <p className="mt-2 text-sm text-stone-600">No attestations were returned for this evidence.</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 border-t border-stone-200 pt-4">
                  <h5 className="flex items-center gap-2 text-sm font-semibold text-stone-900"><Scale className="h-4 w-4" aria-hidden="true" /> Corrections ({milestone.corrections.length})</h5>
                  {milestone.corrections.length ? <ul className="mt-3 space-y-3">{milestone.corrections.map((correction) => <CorrectionRecord key={correction.id} correction={correction} />)}</ul> : <p className="mt-2 text-sm text-stone-600">No correction records were returned for this milestone.</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-6 border-t border-stone-200 pt-5" aria-labelledby="passport-variations">
        <h3 id="passport-variations" className="flex items-center gap-2 font-serif text-lg text-stone-900"><Building2 className="h-4 w-4" aria-hidden="true" /> Variations ({variations.length})</h3>
        {variations.length ? (
          <ol className="mt-3 space-y-3">
            {variations.map((variation) => (
              <li key={variation.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-medium text-stone-900">Variation {variation.variationReference}</h4>
                  <StateLabel value={variation.status} />
                </div>
                <p className="mt-2 break-words text-sm text-stone-700">{variation.reason}</p>
                <p className="mt-1 text-xs text-stone-600">Recorded {variation.createdAt}</p>
                {variation.review ? <p className="mt-1 text-xs text-stone-600">Reviewed by {variation.review.reviewedByRole ?? "role not provided"} · {variation.review.reviewedAt}</p> : null}
                <div className="mt-3 grid gap-2">
                  <JsonSnapshot title="Original state" value={variation.originalState} />
                  <JsonSnapshot title="Proposed state" value={variation.proposedState} />
                  <JsonSnapshot title="Milestone snapshot" value={variation.milestone} />
                  <JsonSnapshot title="Evidence references" value={variation.evidence} />
                </div>
                {variation.resolutions.length ? <ul className="mt-3 space-y-2">{variation.resolutions.map((resolution) => <li key={resolution.id} className="rounded-lg border border-stone-200 bg-white p-3"><p className="text-sm font-medium text-stone-900">{resolution.status}: {resolution.decision}</p>{resolution.note ? <p className="mt-1 break-words text-sm text-stone-700">{resolution.note}</p> : null}<p className="mt-1 text-xs text-stone-600">{resolution.resolvedByRole} · {resolution.createdAt}</p></li>)}</ul> : null}
                <div className="mt-3 grid gap-3 lg:grid-cols-2"><ProofRecord proof={variation.previousProof} title="Previous event proof" /><ProofRecord proof={variation.variationProof} title="Variation proof" /></div>
              </li>
            ))}
          </ol>
        ) : <p className="mt-2 text-sm text-stone-600">No variation records were returned for this project.</p>}
      </section>

      <div className="mt-5 border-t border-stone-200 pt-4">
        <h3 className="flex items-center gap-2 font-serif text-lg text-stone-900"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Project proof events ({passport.blockchainProofs.length})</h3>
        {passport.blockchainProofs.length ? <ul className="mt-3 grid gap-3 lg:grid-cols-2">{passport.blockchainProofs.map((proof) => <li key={proof.id}><ProofRecord proof={proof} /></li>)}</ul> : <p className="mt-2 text-sm text-stone-600">No blockchain proof events were returned for this project.</p>}
      </div>
      {allAttestations.length ? <p className="sr-only">{allAttestations.length} attestation records are included in evidence history.</p> : null}
    </Card>
  );
}