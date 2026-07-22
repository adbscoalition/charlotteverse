"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  calculateStar,
  formatCompact,
  sourceMetadata,
  spectralColor,
  type StarInput,
  type StarResult,
} from "./lib/calculator";

const STORAGE_KEY = "charlotte-star-leaderboard-v1";

const initialInput: StarInput = {
  id: "draft",
  label: "Charlotte Example",
  clt: 1000,
  surname: "Smith",
  birthIso: "2001-07-02T12:00",
};

type SortKey = "luminosity" | "clt" | "currentMass" | "currentRadius" | "currentTeff";

const isStoredInput = (value: unknown): value is StarInput => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StarInput>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.clt === "number" &&
    typeof candidate.surname === "string" &&
    typeof candidate.birthIso === "string"
  );
};

const formatFixed = (value: number, places = 6) =>
  Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: places,
        maximumFractionDigits: places,
      })
    : "—";

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));

function Metric({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className={`metric ${accent ? "metric-accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {unit ? <small>{unit}</small> : null}
    </div>
  );
}

function ResultPanel({ result, refreshKey }: { result: StarResult; refreshKey: number }) {
  const color = spectralColor(result.currentTeff);
  return (
    <section className="result-card" aria-live="polite">
      <div className="result-hero">
        <div className="star-orbit" style={{ "--star-color": color } as CSSProperties} aria-hidden="true">
          <div className="star-body" />
          <div className="orbit-ring orbit-one" />
          <div className="orbit-ring orbit-two" />
        </div>
        <div className="result-identity">
          <p className="eyebrow">Live stellar result</p>
          <h2>{result.input.label || "Unnamed Charlotte"}</h2>
          <div className="spectral-lockup">
            <strong>{result.spectralC}</strong>
            <span>SpectralC</span>
          </div>
          <p>{result.stage}</p>
          <div className="live-line">
            <span className="live-dot" />
            Updated {formatDateTime(result.evaluatedAt)}
          </div>
          <div className="refresh-track" key={refreshKey} aria-hidden="true">
            <span />
          </div>
        </div>
      </div>

      <div className="primary-metrics">
        <Metric label="Current Teff" value={formatCompact(result.currentTeff, 3)} unit="K" accent />
        <Metric label="Current radius" value={formatCompact(result.currentRadius, 5)} unit="R☉" />
        <Metric label="Current mass" value={formatCompact(result.currentMass, 5)} unit="M☉" />
        <Metric label="Luminosity" value={formatCompact(result.luminosity, 4)} unit="L☉" />
      </div>

      <div className="multiplier-strip">
        <div>
          <span>Teff multiplier</span>
          <strong>{formatFixed(result.teffMultiplier, 9)}×</strong>
        </div>
        <div>
          <span>Radius multiplier</span>
          <strong>{formatFixed(result.radiusMultiplier, 9)}×</strong>
        </div>
        <div>
          <span>Mass multiplier</span>
          <strong>{formatFixed(result.massMultiplier, 9)}×</strong>
        </div>
      </div>

      <div className="result-context">
        <div>
          <span>Evolutionary path</span>
          <strong>{result.path}</strong>
        </div>
        <div>
          <span>Active checkpoint</span>
          <strong>{result.checkpoint}</strong>
        </div>
        <div>
          <span>Mean density</span>
          <strong>{formatCompact(result.density, 6)} g/cm³</strong>
        </div>
        <div>
          <span>Julian age</span>
          <strong>{formatFixed(result.ageYears, 9)} yr</strong>
        </div>
      </div>

      {result.evolutionClamp ? <p className="notice warning">{result.evolutionClamp}</p> : null}
      {result.endpointHeld ? (
        <p className="notice">Living star held at the workbook&apos;s final living endpoint.</p>
      ) : null}
    </section>
  );
}

function CalculationTrace({ result }: { result: StarResult }) {
  return (
    <details className="trace-card">
      <summary>
        <span>
          <strong>Calculation trace</strong>
          <small>Base values, seeds, interpolation weights, and audit metadata</small>
        </span>
        <span className="summary-action">Open</span>
      </summary>
      <div className="trace-grid">
        <section>
          <h3>Base outputs</h3>
          <dl>
            <div><dt>TeffB</dt><dd>{result.teffBDisplay} K</dd></div>
            <div><dt>RadB</dt><dd>{formatFixed(result.radB, 6)} R☉</dd></div>
            <div><dt>MassB</dt><dd>{result.massBDisplay} M☉</dd></div>
          </dl>
        </section>
        <section>
          <h3>Surname seeds</h3>
          <dl>
            <div><dt>TeffSeed</dt><dd>{formatFixed(result.teffSeed, 6)}×</dd></div>
            <div><dt>RadSeed</dt><dd>{formatFixed(result.radSeed, 6)}×</dd></div>
            <div><dt>MassSeed</dt><dd>{formatFixed(result.massSeed, 6)}×</dd></div>
          </dl>
        </section>
        <section>
          <h3>Seeded ZAMS values</h3>
          <dl>
            <div><dt>Seeded Teff</dt><dd>{formatFixed(result.seededTeff, 3)} K</dd></div>
            <div><dt>Seeded radius</dt><dd>{formatFixed(result.seededRadius, 6)} R☉</dd></div>
            <div><dt>ZAMS mass</dt><dd>{formatFixed(result.zamsMass, 6)} M☉</dd></div>
          </dl>
        </section>
        <section>
          <h3>SpectralB blend</h3>
          <dl>
            <div><dt>SpectralB</dt><dd>{result.spectralB}</dd></div>
            <div><dt>{result.hotAnchor} weight</dt><dd>{formatFixed(result.hotWeight, 9)}</dd></div>
            <div><dt>{result.coolAnchor} weight</dt><dd>{formatFixed(result.coolWeight, 9)}</dd></div>
          </dl>
        </section>
      </div>
      <div className="audit-line">
        <span>{sourceMetadata.cltVersion}</span>
        <span>{sourceMetadata.formulaVersion}</span>
        <span>Mass: ZAMS and current bound mass labeled separately</span>
        <span>{result.evidenceStatus}</span>
      </div>
    </details>
  );
}

export default function Home() {
  const [input, setInput] = useState<StarInput>(initialInput);
  const [entries, setEntries] = useState<StarInput[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("luminosity");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const update = () => setNowMs(Date.now());
    update();
    const timer = window.setInterval(update, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setEntries(parsed.filter(isStoredInput));
        }
      } catch {
        setMessage("Stored leaderboard data could not be read; a fresh local leaderboard is active.");
      } finally {
        setStorageReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // The in-memory leaderboard remains usable when browser storage is unavailable.
    }
  }, [entries, storageReady]);

  const currentCalculation = useMemo(() => {
    if (!nowMs) return { result: null, error: "" };
    try {
      return { result: calculateStar(input, new Date(nowMs)), error: "" };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Calculation failed." };
    }
  }, [input, nowMs]);

  const leaderboard = useMemo(() => {
    if (!nowMs) return [];
    return entries
      .map((entry) => {
        try {
          return calculateStar(entry, new Date(nowMs));
        } catch {
          return null;
        }
      })
      .filter((result): result is StarResult => result !== null)
      .sort((a, b) => {
        if (sortKey === "clt") return b.input.clt - a.input.clt;
        return b[sortKey] - a[sortKey];
      });
  }, [entries, nowMs, sortKey]);

  const updateField = <K extends keyof StarInput>(field: K, value: StarInput[K]) =>
    setInput((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentCalculation.result) return;
    const label = input.label.trim();
    if (!label) {
      setMessage("Enter a leaderboard label.");
      return;
    }
    const editing = input.id !== "draft" && entries.some((entry) => entry.id === input.id);
    const id = editing ? input.id : globalThis.crypto?.randomUUID?.() ?? `star-${Date.now()}`;
    const next = { ...input, id, label };
    setEntries((current) =>
      editing ? current.map((entry) => (entry.id === id ? next : entry)) : [...current, next],
    );
    setInput({ ...next, id: "draft" });
    setMessage(editing ? `${label} was updated.` : `${label} was added to the leaderboard.`);
  };

  const editEntry = (entry: StarInput) => {
    setInput(entry);
    setMessage(`Editing ${entry.label}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeEntry = (id: string) => {
    const target = entries.find((entry) => entry.id === id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (input.id === id) setInput({ ...input, id: "draft" });
    if (target) setMessage(`${target.label} was removed from this browser's leaderboard.`);
  };

  const editing = input.id !== "draft" && entries.some((entry) => entry.id === input.id);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Charlotte Star Calculator home">
          <span className="brand-mark">C</span>
          <span>
            <strong>Charlotte Stellar Registry</strong>
            <small>CLT star calculator</small>
          </span>
        </a>
        <div className="header-status">
          <span><i className="live-dot" /> Live · 5-second cycle</span>
          <span>{sourceMetadata.cltVersion}</span>
        </div>
      </header>

      <div className="page-shell" id="top">
        <section className="intro">
          <div>
            <p className="eyebrow">Formula-driven stellar evolution</p>
            <h1>Turn CLT into a living star.</h1>
          </div>
          <p>
            Calculate TeffB, RadB, Teff-driven MassB, surname seeds, continuous spectral weights, workbook evolution,
            and current stellar specifications. Every saved Charlotte recalculates from full precision every five seconds.
          </p>
        </section>

        <section className="calculator-layout" aria-label="Star calculator">
          <form className="input-card" onSubmit={handleSubmit}>
            <div className="card-heading">
              <span>01</span>
              <div>
                <p className="eyebrow">Inputs</p>
                <h2>Register a Charlotte</h2>
              </div>
            </div>

            <label>
              <span>Leaderboard label</span>
              <input
                value={input.label}
                onChange={(event) => updateField("label", event.target.value)}
                placeholder="Charlotte Smith"
                autoComplete="name"
                required
              />
            </label>

            <div className="field-row">
              <label>
                <span>CLT</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={input.clt}
                  onChange={(event) => updateField("clt", Number(event.target.value))}
                  inputMode="decimal"
                  required
                />
                <small>Nonnegative base CLT input</small>
              </label>
              <label>
                <span>Legal surname</span>
                <input
                  value={input.surname}
                  onChange={(event) => updateField("surname", event.target.value)}
                  placeholder="Smith"
                  autoComplete="family-name"
                  required
                />
                <small>Drives all surname seeds</small>
              </label>
            </div>

            <label>
              <span>Birth date and time</span>
              <input
                type="datetime-local"
                value={input.birthIso}
                onChange={(event) => updateField("birthIso", event.target.value)}
                required
              />
              <small>Age uses Julian years; the live evaluation time refreshes automatically</small>
            </label>

            {currentCalculation.error ? <p className="form-error">{currentCalculation.error}</p> : null}
            {message ? <p className="form-message" role="status">{message}</p> : null}

            <button className="primary-button" type="submit" disabled={!currentCalculation.result}>
              {editing ? "Update leaderboard entry" : "Add result to leaderboard"}
              <span aria-hidden="true">↗</span>
            </button>
            {editing ? (
              <button className="text-button" type="button" onClick={() => setInput({ ...input, id: "draft" })}>
                Cancel editing
              </button>
            ) : null}

            <p className="local-note">
              Leaderboard entries are stored in this browser. Connect your own database later if you want a shared public registry.
            </p>
          </form>

          <div className="result-column">
            {currentCalculation.result ? (
              <>
                <ResultPanel result={currentCalculation.result} refreshKey={nowMs} />
                <CalculationTrace result={currentCalculation.result} />
              </>
            ) : (
              <section className="result-card result-loading">Starting live calculation…</section>
            )}
          </div>
        </section>

        <section className="leaderboard-section" aria-labelledby="leaderboard-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Live registry</p>
              <h2 id="leaderboard-title">Stellar leaderboard</h2>
              <p>Every row uses its own spectral weights, age segment, and current workbook multipliers.</p>
            </div>
            <label className="sort-control">
              <span>Rank by</span>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                <option value="luminosity">Current luminosity</option>
                <option value="clt">CLT</option>
                <option value="currentMass">Current mass</option>
                <option value="currentRadius">Current radius</option>
                <option value="currentTeff">Current Teff</option>
              </select>
            </label>
          </div>

          <div className="leaderboard-card">
            {leaderboard.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Charlotte</th>
                      <th>CLT</th>
                      <th>SpectralC</th>
                      <th>Stage</th>
                      <th>Teff mult.</th>
                      <th>Radius mult.</th>
                      <th>Mass mult.</th>
                      <th>Current specs</th>
                      <th><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((result, index) => (
                      <tr key={result.input.id} className={index < 3 ? `podium podium-${index + 1}` : ""}>
                        <td><span className="rank-badge">{String(index + 1).padStart(2, "0")}</span></td>
                        <td>
                          <strong>{result.input.label}</strong>
                          <small>{result.input.surname} · {result.spectralB}</small>
                        </td>
                        <td className="mono">{formatCompact(result.input.clt, 3)}</td>
                        <td><span className="spectral-pill">{result.spectralC}</span></td>
                        <td>
                          <span className="stage-cell">{result.stage}</span>
                          <small>{result.path}</small>
                        </td>
                        <td className="mono">{formatFixed(result.teffMultiplier, 9)}×</td>
                        <td className="mono">{formatFixed(result.radiusMultiplier, 9)}×</td>
                        <td className="mono">{formatFixed(result.massMultiplier, 9)}×</td>
                        <td>
                          <strong>{formatCompact(result.currentTeff, 2)} K</strong>
                          <small>{formatCompact(result.currentRadius, 4)} R☉ · {formatCompact(result.currentMass, 4)} M☉</small>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button type="button" onClick={() => editEntry(result.input)} aria-label={`Edit ${result.input.label}`}>Edit</button>
                            <button type="button" onClick={() => removeEntry(result.input.id)} aria-label={`Remove ${result.input.label}`}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-star" aria-hidden="true" />
                <h3>No registered results yet</h3>
                <p>Run the calculator above, then add the result. All saved rows will begin their five-second live cycle together.</p>
              </div>
            )}
          </div>
        </section>

        <section className="method-section">
          <div>
            <p className="eyebrow">Model contract</p>
            <h2>Full precision in. Rounded display out.</h2>
          </div>
          <div className="method-grid">
            <article>
              <span>01</span>
              <h3>Base + seed</h3>
              <p>CLT produces TeffB, RadB, and a Teff-driven MassB. The legal surname independently produces TeffSeed, RadSeed, and MassSeed.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Spectral-first blend</h3>
              <p>Seeded Teff locates the two surrounding O1–L0 anchors. Exact continuous weights blend the workbook tracks.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Live evolution</h3>
              <p>Age selects the active segment. Radius, Teff, and bound-mass multipliers interpolate continuously and refresh every five seconds.</p>
            </article>
          </div>
        </section>

        <footer>
          <div>
            <strong>Charlotte Star Calculator</strong>
            <p>A fictional Charlotteverse tool. It does not describe real scientific, legal, medical, or personal status.</p>
          </div>
          <div className="footer-meta">
            <span>{sourceMetadata.formulaVersion}</span>
            <span>{sourceMetadata.workbookVersion}</span>
            <span>{sourceMetadata.codexVersion}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
