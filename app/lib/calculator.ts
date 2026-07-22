import workbookDataRaw from "../workbook-data.json" with { type: "json" };

type Cell = string | number | boolean | null;
type SheetData = { address: string; values: Cell[][]; formulas: Cell[][] };
type WorkbookData = { sheets: Record<string, SheetData> };

const workbookData = workbookDataRaw as unknown as WorkbookData;
const DAY_MS = 86_400_000;
const JULIAN_YEAR_MS = 365.25 * DAY_MS;

export type StarInput = {
  id: string;
  label: string;
  clt: number;
  surname: string;
  birthIso: string;
};

export type SpectralAnchor = {
  label: string;
  teff: number;
  index: number;
  letter: string;
  subtype: number;
};

type SpectralPosition = {
  hot: SpectralAnchor;
  cool: SpectralAnchor;
  fraction: number;
  hotWeight: number;
  coolWeight: number;
  continuousLabel: string;
  roundedLabel: string;
};

type Keyframe = {
  age: number;
  value: number;
  stage: string;
  point: string;
};

type TrackState = {
  multiplier: number;
  stage: string;
  path: string;
  checkpoint: string;
  heldAtEndpoint: boolean;
};

export type StarResult = {
  input: StarInput;
  evaluatedAt: string;
  ageYears: number;
  teffB: number;
  teffBDisplay: string;
  radB: number;
  massB: number;
  massBDisplay: string;
  radSeed: number;
  teffSeed: number;
  massSeed: number;
  seededTeff: number;
  seededRadius: number;
  zamsMass: number;
  spectralB: string;
  hotAnchor: string;
  coolAnchor: string;
  hotWeight: number;
  coolWeight: number;
  path: string;
  stage: string;
  checkpoint: string;
  teffMultiplier: number;
  radiusMultiplier: number;
  massMultiplier: number;
  currentTeff: number;
  currentRadius: number;
  currentMass: number;
  luminosity: number;
  density: number;
  spectralC: string;
  endpointHeld: boolean;
  evolutionClamp: string | null;
  evidenceStatus: "User-entered / unverified";
};

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const sigmoid = (z: number) => {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
};

const hill = (x: number, midpoint: number, power: number) => {
  if (x <= 0) return 0;
  const exponent = power * Math.log(midpoint / x);
  if (exponent > 709) return 0;
  if (exponent < -709) return 1;
  return 1 / (1 + Math.exp(exponent));
};

export const calculateTeffB = (clt: number) => {
  const x = Math.max(0, clt);
  return (
    225 * hill(x, 0.0203, 22.75) +
    1886 * hill(x, 0.598, 1.268) +
    3204 * hill(x, 787, 1.325) +
    1611 * hill(x, 3655, 0.836) +
    22316 * hill(x, 4399, 10.2) +
    35976 * hill(x, 10152, 4.003) +
    15282 * hill(x, 16964, 0.7105)
  );
};

export const calculateRadB = (teffB: number) => {
  const t = Math.max(0, teffB);
  const ns = (midpoint: number, scale: number) => {
    const base = sigmoid(-midpoint / scale);
    return (sigmoid((t - midpoint) / scale) - base) / (1 - base);
  };
  const value =
    0.005 +
    0.0923717253 * (1 - Math.exp(-t / 500)) -
    0.0989397479 *
      (Math.exp(-(((t - 2300) / 700) ** 2)) - Math.exp(-((2300 / 700) ** 2))) +
    0.419101249 * ns(3800, 400) +
    0.298967356 * ns(5600, 400) +
    0.426499679 * ns(7000, 500) +
    2.34287874 * ns(15000, 2500) +
    8.59934589 * ns(30000, 8000) +
    8.31537605 * ns(55000, 10000);
  return round(Math.max(0.005, value), 6);
};

export const calculateMassB = (teffB: number) => {
  const t = Math.max(0, teffB);
  const ns = (midpoint: number, scale: number) => {
    const base = sigmoid(-midpoint / scale);
    return (sigmoid((t - midpoint) / scale) - base) / (1 - base);
  };
  return round(
    0.0000028 +
      0.047361031 * ns(1000, 700) +
      0.344657415 * ns(3000, 250) +
      0.283577181 * ns(4200, 450) +
      0.708791982 * ns(6000, 600) +
      0.481235531 * ns(8000, 650) +
      1.84039258 * ns(10500, 700) +
      6.74581025 * ns(18000, 2500) +
      10.506204 * ns(28000, 3200) +
      8.10137484 * ns(36000, 1600) +
      35.7680788 * ns(45000, 2200) +
      21.6994721 * ns(52000, 1800) +
      153.452768 * ns(58500, 1000) +
      13.45306 * ns(61000, 1300) +
      123.630861 * ns(70000, 1800),
    6,
  );
};

const cleanSurname = (surname: string) =>
  surname
    .toLowerCase()
    .replaceAll("æ", "a")
    .replaceAll("œ", "o")
    .replaceAll("ø", "o")
    .replaceAll("ß", "ss")
    .replace(/[^a-z]/g, "");

export const calculateSurnameSeeds = (surname: string) => {
  const clean = cleanSurname(surname);
  if (!clean) throw new Error("Surname must contain at least one supported letter (a-z).");
  const values = [...clean].map((letter) => letter.charCodeAt(0) - 96);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const radSeed = round(0.87 + average * 0.01, 6);
  const digits = values.map(String).join("");
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 11;
  const teffSeed = round(0.98 + remainder * 0.004, 6);
  return { radSeed, teffSeed, massSeed: radSeed, clean };
};

const spectralAnchors = (() => {
  const values = workbookData.sheets["Seeded Teff Rule"].values;
  const headerRow = values.findIndex((row) => row.includes("Redefined baseline Teff (K)"));
  if (headerRow < 0) throw new Error("Spectral rubric header was not found.");
  const classCol = values[headerRow].findIndex((cell) => cell === "Class");
  const teffCol = values[headerRow].findIndex((cell) => cell === "Redefined baseline Teff (K)");
  const indexCol = values[headerRow].findIndex((cell) => cell === "Hot→cool index");
  const letterCol = values[headerRow].findIndex((cell) => cell === "Letter");
  const subtypeCol = values[headerRow].findIndex((cell) => cell === "Subtype");
  return values
    .slice(headerRow + 1)
    .filter((row) => typeof row[classCol] === "string" && typeof row[teffCol] === "number")
    .map((row) => ({
      label: String(row[classCol]),
      teff: Number(row[teffCol]),
      index: Number(row[indexCol]),
      letter: String(row[letterCol]),
      subtype: Number(row[subtypeCol]),
    } satisfies SpectralAnchor));
})();

const formatContinuousClass = (hot: SpectralAnchor, cool: SpectralAnchor, fraction: number) => {
  if (hot.index === cool.index) return `${hot.letter}${hot.subtype.toFixed(3)}`;
  if (fraction >= 1 - 1e-12) return `${cool.letter}${cool.subtype.toFixed(3)}`;
  return `${hot.letter}${(hot.subtype + fraction).toFixed(3)}`;
};

const formatRoundedClass = (hot: SpectralAnchor, cool: SpectralAnchor, fraction: number) => {
  if (hot.index === cool.index) return hot.label;
  if (fraction < 0.4) return hot.label;
  if (fraction <= 0.6) return `${hot.letter}${(hot.subtype + 0.5).toFixed(1)}`;
  return cool.label;
};

const locateSpectralPosition = (teff: number): SpectralPosition => {
  const hottest = spectralAnchors[0];
  const coolest = spectralAnchors[spectralAnchors.length - 1];
  if (teff >= hottest.teff) {
    return {
      hot: hottest,
      cool: hottest,
      fraction: 0,
      hotWeight: 1,
      coolWeight: 0,
      continuousLabel: formatContinuousClass(hottest, hottest, 0),
      roundedLabel: hottest.label,
    };
  }
  if (teff <= coolest.teff) {
    return {
      hot: coolest,
      cool: coolest,
      fraction: 0,
      hotWeight: 1,
      coolWeight: 0,
      continuousLabel: formatContinuousClass(coolest, coolest, 0),
      roundedLabel: coolest.label,
    };
  }
  for (let index = 0; index < spectralAnchors.length - 1; index += 1) {
    const hot = spectralAnchors[index];
    const cool = spectralAnchors[index + 1];
    if (teff <= hot.teff && teff >= cool.teff) {
      const fraction = clamp((hot.teff - teff) / (hot.teff - cool.teff), 0, 1);
      return {
        hot,
        cool,
        fraction,
        hotWeight: 1 - fraction,
        coolWeight: fraction,
        continuousLabel: formatContinuousClass(hot, cool, fraction),
        roundedLabel: formatRoundedClass(hot, cool, fraction),
      };
    }
  }
  throw new Error("Unable to locate a spectral interval.");
};

const pathsByClass = (() => {
  const values = workbookData.sheets.Paths.values;
  const headerRow = values.findIndex((row) => row[0] === "Class" && row[1] === "Path");
  return new Map(
    values
      .slice(headerRow + 1)
      .filter((row) => typeof row[0] === "string" && typeof row[1] === "string")
      .map((row) => [String(row[0]).replace(/V$/, ""), String(row[1])]),
  );
})();

const preMsAges = (() => {
  const values = workbookData.sheets["Pre-MS Timing"].values;
  const headerRow = values.findIndex((row) => row[0] === "Interval" && row[4] === "Age (years)");
  return values
    .slice(headerRow + 1)
    .filter((row) => typeof row[0] === "string" && typeof row[4] === "number")
    .map((row) => ({ point: String(row[0]), age: Number(row[4]), stage: String(row[1]) }));
})();

type TimingRecord = { stage: string; points: Array<{ point: string; age: number }> };
const timingsByPath = (() => {
  const values = workbookData.sheets.Timing.values;
  const headerRow = values.findIndex((row) => row[0] === "Path" && row[1] === "Stage");
  const map = new Map<string, TimingRecord[]>();
  for (const row of values.slice(headerRow + 1)) {
    if (typeof row[0] !== "string" || typeof row[1] !== "string") continue;
    const points: Array<{ point: string; age: number }> = [];
    for (const [pointCol, ageCol] of [
      [3, 6],
      [4, 7],
      [5, 8],
      [15, 16],
    ] as const) {
      if (row[pointCol] != null && typeof row[ageCol] === "number") {
        points.push({ point: String(row[pointCol]), age: Number(row[ageCol]) });
      }
    }
    const path = String(row[0]);
    const records = map.get(path) ?? [];
    records.push({ stage: String(row[1]), points });
    map.set(path, records);
  }
  return map;
})();

type MultiplierMatrix = Map<string, Map<string, number>>;

const normalizeStage = (stage: string) => {
  if (stage === "MS/CoreH") return "MS";
  return stage;
};

const parseMultiplierMatrix = (sheetName: string): MultiplierMatrix => {
  const values = workbookData.sheets[sheetName].values;
  const stageHeader = values[2];
  const pointHeader = values[3];
  const columns: Array<{ col: number; stage: string; point: string }> = [];
  let currentStage = "";
  for (let col = 2; col < stageHeader.length; col += 1) {
    if (typeof stageHeader[col] === "string" && stageHeader[col]) currentStage = String(stageHeader[col]);
    if (currentStage && pointHeader[col] != null) {
      columns.push({ col, stage: currentStage, point: String(pointHeader[col]) });
    }
  }
  const matrix: MultiplierMatrix = new Map();
  for (const row of values.slice(4)) {
    if (typeof row[0] !== "string" || !/^[OBAFGKM]\dV$/.test(String(row[0]))) continue;
    const classLabel = String(row[0]).replace(/V$/, "");
    const valuesByKey = new Map<string, number>();
    for (const column of columns) {
      if (typeof row[column.col] === "number") {
        valuesByKey.set(`${column.stage}|${column.point}`, Number(row[column.col]));
      }
    }
    matrix.set(classLabel, valuesByKey);
  }
  return matrix;
};

const radiusMatrix = parseMultiplierMatrix("Radius Multipliers");
const teffMatrix = parseMultiplierMatrix("Teff Multipliers");
const massMatrix = parseMultiplierMatrix("Mass Multipliers");

const multiplierForPoint = (
  matrix: MultiplierMatrix,
  classLabel: string,
  stageRaw: string,
  pointRaw: string,
  pointIndex: number,
) => {
  const values = matrix.get(classLabel);
  if (!values) return null;
  const stage = normalizeStage(stageRaw);
  let point = pointRaw;
  if (stage === "MS") point = ["ZAMS", "50", "TAMS"][pointIndex] ?? pointRaw;
  const direct = values.get(`${stage}|${point}`);
  if (direct != null) return direct;
  if (stage === "PostAGB" && point === "90") {
    const p50 = values.get("PostAGB|50");
    const p100 = values.get("PostAGB|100");
    if (p50 != null && p100 != null) return p50 + 0.8 * (p100 - p50);
  }
  return null;
};

const buildKeyframes = (matrix: MultiplierMatrix, classLabel: string): Keyframe[] => {
  const path = pathsByClass.get(classLabel);
  if (!path) throw new Error(`No evolution path for ${classLabel}.`);
  const keyframes: Keyframe[] = [];
  for (const item of preMsAges) {
    const stage = item.point.startsWith("PS")
      ? "Protostar"
      : item.point.startsWith("PM")
        ? "Proto–Main Sequence"
        : "MS";
    const value = multiplierForPoint(matrix, classLabel, stage, item.point, 0);
    if (value != null) keyframes.push({ age: item.age, value, stage, point: item.point });
  }
  for (const record of timingsByPath.get(path) ?? []) {
    record.points.forEach((item, pointIndex) => {
      const value = multiplierForPoint(matrix, classLabel, record.stage, item.point, pointIndex);
      if (value != null) {
        keyframes.push({
          age: item.age,
          value,
          stage: normalizeStage(record.stage),
          point: `${normalizeStage(record.stage)} ${item.point}`,
        });
      }
    });
  }
  keyframes.sort((a, b) => a.age - b.age);
  const deduped: Keyframe[] = [];
  for (const keyframe of keyframes) {
    const previous = deduped.at(-1);
    if (previous && Math.abs(previous.age - keyframe.age) < 1e-12) deduped[deduped.length - 1] = keyframe;
    else deduped.push(keyframe);
  }
  return deduped;
};

const keyframeCache = new Map<string, Keyframe[]>();
const getKeyframes = (matrixName: string, matrix: MultiplierMatrix, classLabel: string) => {
  const key = `${matrixName}|${classLabel}`;
  const cached = keyframeCache.get(key);
  if (cached) return cached;
  const keyframes = buildKeyframes(matrix, classLabel);
  keyframeCache.set(key, keyframes);
  return keyframes;
};

const displayStage = (stage: string) =>
  ({
    MS: "Main Sequence",
    HG: "Hertzsprung Gap",
    "RGB/RSG": "RGB / RSG",
    "HeIgn/HF": "Helium Ignition / HF",
    "CoreHe/HeMS": "Core-He / He-MS",
    AGB: "AGB",
    TPAGB: "TP-AGB",
    SAGB: "Super-AGB",
    "NakedHe/WR": "Naked-He / WR",
    PostAGB: "Post-AGB",
    BlueDwarf: "Blue Dwarf",
    PreSN: "Pre-Supernova",
    Protostar: "Protostar",
    "Proto–Main Sequence": "Proto–Main Sequence",
  })[stage] ?? stage;

const evaluateTrack = (
  matrixName: string,
  matrix: MultiplierMatrix,
  classLabel: string,
  age: number,
): TrackState => {
  const path = pathsByClass.get(classLabel) ?? "Unassigned";
  const keyframes = getKeyframes(matrixName, matrix, classLabel);
  if (!keyframes.length) throw new Error(`No ${matrixName} keyframes for ${classLabel}.`);
  if (age <= keyframes[0].age) {
    const first = keyframes[0];
    return {
      multiplier: first.value,
      stage: displayStage(first.stage),
      path,
      checkpoint: first.point,
      heldAtEndpoint: false,
    };
  }
  const last = keyframes.at(-1)!;
  if (age >= last.age) {
    return {
      multiplier: last.value,
      stage: displayStage(last.stage),
      path,
      checkpoint: `${last.point} (held)`,
      heldAtEndpoint: age > last.age,
    };
  }
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    if (age >= start.age && age <= end.age) {
      const fraction = clamp((age - start.age) / (end.age - start.age), 0, 1);
      const sameStage = start.stage === end.stage;
      return {
        multiplier: start.value + fraction * (end.value - start.value),
        stage: sameStage
          ? displayStage(start.stage)
          : `${displayStage(start.stage)} → ${displayStage(end.stage)}`,
        path,
        checkpoint: `${start.point} → ${end.point}`,
        heldAtEndpoint: false,
      };
    }
  }
  throw new Error(`Age ${age} did not resolve on ${classLabel}.`);
};

const mergeTrackStates = (
  hot: TrackState,
  cool: TrackState,
  hotWeight: number,
  coolWeight: number,
) => ({
  multiplier: hotWeight * hot.multiplier + coolWeight * cool.multiplier,
  stage: hot.stage === cool.stage ? hot.stage : `${hot.stage} ↔ ${cool.stage}`,
  path: hot.path === cool.path ? hot.path : `${hot.path} / ${cool.path}`,
  checkpoint: hot.checkpoint === cool.checkpoint ? hot.checkpoint : `${hot.checkpoint} / ${cool.checkpoint}`,
  heldAtEndpoint: hot.heldAtEndpoint || cool.heldAtEndpoint,
});

const evolutionClassPair = (spectral: SpectralPosition) => {
  const maxEvolutionIndex = spectralAnchors.findIndex((anchor) => anchor.label === "M9");
  const hotIndex = Math.min(spectral.hot.index, maxEvolutionIndex);
  const coolIndex = Math.min(spectral.cool.index, maxEvolutionIndex);
  const hot = spectralAnchors[hotIndex];
  const cool = spectralAnchors[coolIndex];
  const clamped = spectral.hot.index > maxEvolutionIndex || spectral.cool.index > maxEvolutionIndex;
  return { hot, cool, clamped };
};

const displayMassB = (massB: number) => {
  if (massB < 1) return massB.toFixed(6);
  if (massB < 100) return massB.toFixed(4);
  return massB.toFixed(2);
};

const classifierForStage = (stage: string, path: string) => {
  const s = stage.toLowerCase();
  const p = path.toLowerCase();
  if (s.includes("protostar") && !s.includes("proto–main")) return { value: "ps", prefix: true };
  if (s.includes("proto–main")) return { value: "pms", prefix: true };
  if (s.includes("blue dwarf")) return { value: "bd", prefix: true };
  if (s.includes("naked-he") || s.includes("wr")) return { value: "WR", prefix: false };
  if (s.includes("pre-supernova")) return { value: "Ia+", prefix: false };
  if (s.includes("post-agb")) return { value: "post-AGB", prefix: false };
  if (s.includes("rgb") || s.includes("rsg")) {
    return { value: p.includes("massive") ? "Iab" : "III", prefix: false };
  }
  if (s.includes("core-he")) {
    if (p.includes("massive") || p.includes("extreme")) return { value: "Ib", prefix: false };
    if (p.includes("intermediate")) return { value: "II", prefix: false };
    return { value: "III", prefix: false };
  }
  if (s.includes("sagb")) return { value: "II", prefix: false };
  if (s.includes("agb") || s.includes("helium ignition")) return { value: "III", prefix: false };
  if (s.includes("hertzsprung")) return { value: "IV", prefix: false };
  return { value: "V", prefix: false };
};

export const calculateStar = (input: StarInput, evaluatedAt: Date): StarResult => {
  if (!Number.isFinite(input.clt) || input.clt < 0) throw new Error("CLT must be a nonnegative number.");
  const birth = new Date(input.birthIso);
  if (Number.isNaN(birth.getTime())) throw new Error("Enter a valid birth date and time.");
  if (birth.getTime() > evaluatedAt.getTime()) throw new Error("Birth time cannot be after evaluation time.");
  const { radSeed, teffSeed, massSeed } = calculateSurnameSeeds(input.surname);
  const teffB = calculateTeffB(input.clt);
  const radB = calculateRadB(teffB);
  const massB = calculateMassB(teffB);
  const seededTeff = teffB * teffSeed;
  const seededRadius = round(radB * radSeed, 6);
  const zamsMass = round(massB * massSeed, 6);
  const spectral = locateSpectralPosition(seededTeff);
  const ageYears = Math.max(0, (evaluatedAt.getTime() - birth.getTime()) / JULIAN_YEAR_MS);
  const evolution = evolutionClassPair(spectral);

  const evaluatePair = (name: string, matrix: MultiplierMatrix) => {
    const hot = evaluateTrack(name, matrix, evolution.hot.label, ageYears);
    const cool = evaluateTrack(name, matrix, evolution.cool.label, ageYears);
    if (evolution.hot.label === evolution.cool.label) return hot;
    return mergeTrackStates(hot, cool, spectral.hotWeight, spectral.coolWeight);
  };

  const radiusState = evaluatePair("radius", radiusMatrix);
  const teffState = evaluatePair("teff", teffMatrix);
  const massState = evaluatePair("mass", massMatrix);
  const currentTeff = seededTeff * teffState.multiplier;
  const currentRadius = seededRadius * radiusState.multiplier;
  const currentMass = zamsMass * massState.multiplier;
  const luminosity = currentRadius ** 2 * (currentTeff / 5772) ** 4;
  const density = 1.409822456 * currentMass / currentRadius ** 3;
  const currentSpectral = locateSpectralPosition(currentTeff);
  const classifier = classifierForStage(radiusState.stage, radiusState.path);
  const spectralC = classifier.prefix
    ? `${classifier.value} ${currentSpectral.roundedLabel}`
    : `${currentSpectral.roundedLabel} ${classifier.value}`;

  return {
    input,
    evaluatedAt: evaluatedAt.toISOString(),
    ageYears,
    teffB,
    teffBDisplay: teffB.toFixed(3),
    radB,
    massB,
    massBDisplay: displayMassB(massB),
    radSeed,
    teffSeed,
    massSeed,
    seededTeff,
    seededRadius,
    zamsMass,
    spectralB: spectral.continuousLabel,
    hotAnchor: spectral.hot.label,
    coolAnchor: spectral.cool.label,
    hotWeight: spectral.hotWeight,
    coolWeight: spectral.coolWeight,
    path: radiusState.path,
    stage: radiusState.stage,
    checkpoint: radiusState.checkpoint,
    teffMultiplier: teffState.multiplier,
    radiusMultiplier: radiusState.multiplier,
    massMultiplier: massState.multiplier,
    currentTeff,
    currentRadius,
    currentMass,
    luminosity,
    density,
    spectralC,
    endpointHeld: radiusState.heldAtEndpoint || teffState.heldAtEndpoint || massState.heldAtEndpoint,
    evolutionClamp: evolution.clamped
      ? "Classification reaches L0, but evolution is clamped to the M9 track because the workbook defines no L0 multipliers."
      : null,
    evidenceStatus: "User-entered / unverified",
  };
};

export const spectralColor = (teff: number) => {
  if (teff >= 30000) return "#a8c7ff";
  if (teff >= 10000) return "#d7e4ff";
  if (teff >= 7500) return "#f5f2ff";
  if (teff >= 6000) return "#fff4da";
  if (teff >= 5000) return "#ffd9a4";
  if (teff >= 3500) return "#ffad7a";
  return "#ff755f";
};

export const formatCompact = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits,
  }).format(value);

export const sourceMetadata = {
  cltVersion: "CLT-6",
  formulaVersion: "User TEFFB / RadB / Teff-driven MassB set — 2026-07-22",
  workbookVersion: "stellar_evolution_with_redefined_teff_spectral_rubric.xlsx",
  codexVersion: "CHARLOTTEVERSELAW_Rule92_Applied.docx — 2026-07-22",
};
