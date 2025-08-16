import { useMemo, useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import cloudflareLogo from './assets/Cloudflare_Logo.svg'
import './App.css'

////////
// import React, { useMemo, useState } from "react";

/**
 * South Indian Relationship Finder (based on Ravikiran Rao's matrix for Kannada terms)
 * Source for rules: https://www.ravikiran.com/blog/examined/202009/the-south-indian-relationship-chart/
 *
 * How it works
 * - We represent everyone by a coordinate in a 2×N matrix. Columns: A (left) and B (right). Rows: generations, with "You" at A2.
 * - Moves:
 *   - father: (col, row-1)
 *   - mother: (spouse of father) => (otherCol(col), row-1)
 *   - spouse: (otherCol(col), row)
 *   - child (son/daughter): goes under the FATHER’s column (current male → same column; current female → spouse’s column)
 *   - sibling: same block as current person (age qualifier is attached to the sibling step)
 * - Age-relative naming rules (selected highlights):
 *   - Your siblings (A2): aNNa/tamma (brothers), akka/tangi (sisters) depending on elder/younger relative to YOU
 *   - Father's brothers (A1): doDDappa/chikkappa vs father’s sister: atthe (age doesn’t matter)
//  *   - Mother's sisters (B1): doDDamma/chikkamma vs mother’s brother: mAva (age doesn’t matter)
 *   - Spouse’s siblings (B2): bhAva or maiduna (male), attige or nAdini (female), age relative to your SPOUSE
 *   - Parents: appa (father), amma (mother)
 *   - Children: maga (son), magaLu (daughter); in‑laws: aLiya (son‑in‑law), sose (daughter‑in‑law)
 *   - Grandparents: ajja/ajji. Grandchildren: mommagga/mommagalu
 * - The model assumes “ordinary” marriages between A and B within the same row.
 */

// Types
const COLS = ["A", "B"] as const;
const otherCol = (c: Col): Col => (c === "A" ? "B" : "A");

type Col = typeof COLS[number];

type Gender = "male" | "female" | "unknown";

type AgeRel = "elder" | "younger" | "unknown";

type StepType =
  | { kind: "father" }
  | { kind: "mother" }
  // | { kind: "spouse" }
  | { kind: "husband" }
  | { kind: "wife" }
  | { kind: "son" }
  | { kind: "daughter" }
  | { kind: "sibling"; gender: Gender; age: AgeRel };

// A person on the matrix
interface Person {
  col: Col;
  row: number; // lower numbers are older generations (row 1 above row 2)
  gender: Gender; // known when step implies it (e.g. father → male)
  // For determining terms that depend on relative age vs a reference
  refForAge?: "you" | "father" | "mother" | "husband" | "wife" | "self";
  noSiblingInGeneration: boolean; // true if string of spouse steps without sibling steps
}

// Starting point: You at A2. User selects their gender.
function startPerson(userGender: Gender): Person {
  return { col: "A", row: 2, gender: userGender, refForAge: "you", noSiblingInGeneration: false };
}

function move(person: Person, step: StepType): Person {
  const p = { ...person };
  switch (step.kind) {
    case "father":
      return { col: p.col, row: p.row - 1, gender: "male", refForAge: "father", noSiblingInGeneration: true };
    case "mother":
      return { col: otherCol(p.col), row: p.row - 1, gender: "female", refForAge: "mother", noSiblingInGeneration: true };
    case "husband":
      return { col: p.gender === "male" ? p.col : otherCol(p.col), row: p.row, gender: "male", refForAge: "husband", noSiblingInGeneration: p.noSiblingInGeneration };
    // return { col: otherCol(p.col), row: p.row, gender: "male", refForAge: "husband" };
    case "wife":
      return { col: p.gender === "female" ? p.col : otherCol(p.col), row: p.row, gender: "female", refForAge: "wife", noSiblingInGeneration: p.noSiblingInGeneration };
    // return { col: otherCol(p.col), row: p.row, gender: "female", refForAge: "wife" };
    case "son": {
      // Children are placed one row below the FATHER's column (Rule #1/"conversely" in the chart)
      // i.e., if the current person is male, child stays in same column; if female, child is in spouse's column
      const childCol: Col = p.gender === "male" ? p.col : otherCol(p.col);
      return { col: childCol, row: p.row + 1, gender: "male", refForAge: "self", noSiblingInGeneration: true };
    }
    case "daughter": {
      const childCol: Col = p.gender === "male" ? p.col : otherCol(p.col);
      return { col: childCol, row: p.row + 1, gender: "female", refForAge: "self", noSiblingInGeneration: true };
    }
    case "sibling":
      // Sibling stays in the same block; gender & age supplied by the step; for age comparisons the reference is the person whose sibling it is
      return { col: p.col, row: p.row, gender: step.gender, refForAge: p.refForAge, noSiblingInGeneration: false };
  }
}

// Simulate a full path so we can inspect intermediate positions (useful for correctness & debugging)
function simulate(userGender: Gender, steps: StepType[]): Person[] {
  const arr: Person[] = [startPerson(userGender)];
  let p = arr[0];
  for (const s of steps) {
    p = move(p, s);
    arr.push(p);
  }
  return arr;
}

// Figure out the Kannada kinship term for the located person relative to YOU
function labelFor(person: Person, path: StepType[], userGender: Gender, trace?: Person[]): string {
  const { col, row, gender, noSiblingInGeneration } = person;
  const last = path[path.length - 1];
  console.log(path)

  if (path.length === 0) return "You";

  // Special direct terms
  if (row === 2 && col === "A") {
    if (last?.kind === "sibling") {
      // Your siblings
      if (last.gender === "male") return last.age === "elder" ? "aNNa (elder brother)" : last.age === "younger" ? "tamma (younger brother)" : "aNNa/tamma (brother)";
      if (last.gender === "female") return last.age === "elder" ? "akka (elder sister)" : last.age === "younger" ? "tangi (younger sister)" : "akka/tangi (sister)";
      return "Sibling (need gender/age)";
    }
    // If someone else (e.g., cousins from father’s brothers or mother’s sisters) lands in A2, they are treated as siblings
    if (gender === "male") return "aNNa/tamma (brother/cousin treated as sibling)";
    if (gender === "female") return "akka/tangi (sister/cousin treated as sibling)";
    return "Sibling/cousin in same block";
  }

  // Parents and their siblings (row 1)
  if (row === 1) {
    // Determine effective column; if we arrived via a child step, infer using the parent's father-column.
    let effectiveCol: Col = col;
    const cameViaChild = !!(last && (last.kind === "son" || last.kind === "daughter"));
    if (cameViaChild && trace && trace.length >= 2) {
      const parent = trace[trace.length - 2];
      effectiveCol = parent.gender === "male" ? parent.col : otherCol(parent.col);
    }

    if (gender === "male") {
      if (noSiblingInGeneration) return "Appa (father)";
      // if ((path.at(-2)?.kind === "father" || path.at(-2)?.kind === "mother") && path.at(-1)?.kind === "husband") return "Appa (father)";
      return (effectiveCol === "A") ? "doDDappa/chikkappa (father’s brother)" : "MAva (maternal uncle)";
    }
    else if (gender === "female") {
      if (noSiblingInGeneration) return "Amma (mother)";
      // if ((path.at(-2)?.kind === "mother" || path.at(-2)?.kind === "father") && path.at(-1)?.kind === "wife") return "Amma (mother)";
      return (effectiveCol === "A") ? "Atthe (father’s sister / paternal aunt)" : "doDDamma/chikkamma (mother’s sister)";
    }
  }

  // Spouse’s block (row 2, col B)
  if (row === 2 && col === "B") {
    if (path.length === 1 && path.at(-1)?.kind === "husband") {
      return "GanDa (husband)";
    }
    if (path.length === 1 && path.at(-1)?.kind === "wife") {
      return "HenDathi (wife)";
    }

    // Spouse’s siblings OR your cross-cousins – need age and gender
    if (last?.kind === "sibling") {
      if (last.gender === "male") return last.age === "elder" ? "BhAva (elder brother-in-law)" : last.age === "younger" ? "Maiduna (younger brother-in-law)" : "BhAva/Maiduna (brother-in-law)";
      if (last.gender === "female") return last.age === "elder" ? "Attige (elder sister-in-law)" : last.age === "younger" ? "NAdini (younger sister-in-law)" : "Attige/NAdini (sister-in-law)";
      return "Sibling-in-law (need gender/age)";
    }

    // Anyone else who lands in B2 (e.g., father’s sister’s child or mother’s brother’s child) is treated as in-law
    if (gender === "male") return "BhAva/Maiduna (cousin-in-law)";
    if (gender === "female") return "Attige/NAdini (cousin-in-law)";
  }

  // Children & their spouses (row 3)
  if (row === 3) {
    if (gender === "male") {
      if (path.at(-1)?.kind === "son") return "Maga (son)";
      if (path.at(-1)?.kind === "husband") return "ALiya (son-in-law)"; // spouse of daughter
      return "Mommagga (grandson)";
    }
    if (gender === "female") {
      if (path.at(-1)?.kind === "daughter") return "MagaLu (daughter)";
      if (path.at(-1)?.kind === "wife") return "Sose (daughter-in-law)"; // spouse of son
      return "Mommagalu (granddaughter)";
    }
  }

  if (row === 4) {
    if (gender === "male") return "Mommagga (grandson)";
    if (gender === "female") return "Mommagalu (granddaughter)";
  }

  // Grandparents (row 0)
  if (row === 0) {
    return gender === "male" ? "Ajja (grandfather)" : gender === "female" ? "Ajji (grandmother)" : "Ajja/Ajji (grandparent)";
  }

  if (row === -1) {
    return gender === "male" ? "Muttajja (great-grandfather)" : gender === "female" ? "Muttajji (great-grandmother)" : "Muttajja/Muttajji (great-grandparent)";
  }

  // Fallback
  return "Relationship not yet covered by this demo";
}

// UI helpers
const StepBadge: React.FC<{ step: StepType; i: number }> = ({ step, i }) => {
  const text =
    step.kind === "sibling"
      ? `${i + 1}. sibling (${step.gender ?? "?"}${step.age !== "unknown" ? ", " + step.age : ""})`
      : `${i + 1}. ${step.kind}`;
  return (
    <span className="inline-flex items-center rounded-2xl px-3 py-1 text-sm bg-gray-100 border border-gray-200">
      {text}
    </span>
  );
};

const ControlCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl shadow-sm border p-4 space-y-3">
    <div className="font-semibold">{title}</div>
    {children}
  </div>
);

function App() {
  const [userGender, setUserGender] = useState<Gender>("male");
  const [steps, setSteps] = useState<StepType[]>([]);

  const trace = useMemo(() => simulate(userGender, steps), [steps, userGender]);
  const dest = trace[trace.length - 1];

  const label = useMemo(() => labelFor(dest, steps, userGender, trace), [dest, steps, userGender, trace]);

  const add = (s: StepType) => setSteps(prev => [...prev, s]);
  const pop = () => setSteps(prev => prev.slice(0, -1));
  const reset = () => setSteps([]);

  return (
    <div className="min-h-screen w-full p-6 md:p-10 dark:text-white">
      <div className="max-w-5xl mx-auto grid gap-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Kinship Term Calculator for Kannada</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-200">Find the correct Kannada kinship term by composing relations (based on <a href="https://www.ravikiran.com/blog/examined/202009/the-south-indian-relationship-chart/">Ravikiran Rao’s 2×N matrix</a>).</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">You are</label>
            <select
              className="rounded-xl border px-3 py-2"
              value={userGender}
              onChange={e => setUserGender(e.target.value as Gender)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unknown">Prefer not to say</option>
            </select>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-2">
          <div className="flex col-span-2">
            <ControlCard title="Add a…">
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => add({ kind: "father" })}>Father</button>
                <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => add({ kind: "mother" })}>Mother</button>
                {/* <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => add({ kind: "spouse" })}>Spouse</button> */}
                <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => add({ kind: "husband" })}>Husband</button>
                <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => add({ kind: "wife" })}>Wife</button>
                <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => add({ kind: "son" })}>Son</button>
                <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => add({ kind: "daughter" })}>Daughter</button>
              </div>
              <SiblingButtons onAdd={add} />
              <p className="text-xs text-gray-500 dark:text-gray-300">Age is interpreted relative to the person whose sibling you’re taking (e.g., spouse’s elder sister = elder relative to your spouse).</p>
            </ControlCard>
          </div>

          <div className="flex">
            <ControlCard title="Result">
              <div className="flex-grow flex items-center text-lg md:text-xl font-semibold px-3">
                {label}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={pop} disabled={!steps.length}>Undo</button>
                <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={reset} disabled={!steps.length}>Reset</button>
              </div>

            </ControlCard>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border p-5 space-y-3 flex-shrink-0">
            <div className="col-span-2">
              {steps.length === 0 ? (
                <span className="text-sm text-gray-500 dark:text-gray-300">Starting at yourself, add steps to compose a relation.</span>
              ) : (
                steps.map((s, i) => <StepBadge step={s} key={i} i={i} />)
              )}

              <div className="text-sm text-gray-600 dark:text-gray-200 py-3">Matrix location: <span className="font-mono">{dest.col}{dest.row}</span> &middot; Gender: {dest.gender}</div>
              <div className="text-xs text-gray-500 dark:text-gray-300">Trace: {trace.map((p, i) => (<span key={i} className="font-mono">{p.col}{p.row}{i < trace.length - 1 ? ' → ' : ''}</span>))}</div>
            </div>
          </div>
          <div className="rounded-2xl border p-5 space-y-3">
            <div className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-300">Quick examples</div>
            <Examples onRun={(steps) => setSteps(steps)} />
          </div>
        </div>
        <footer className="text-xs text-gray-500 dark:text-gray-300">
          Built for exploration; not all edge cases are handled (e.g., cross-generational marriages). Terms and rules follow <a href="https://www.ravikiran.com/blog/examined/202009/the-south-indian-relationship-chart/">Ravikiran Rao’s chart</a>.
        </footer>
      </div>
    </div>
  );
}

const SiblingButtons: React.FC<{ onAdd: (s: StepType) => void }> = ({ onAdd }) => {
  // const label = gender === "male" ? "Brother" : "Sister";
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-start-1">
        <div className="font-medium">Brother</div>
        {/* <div className="flex flex-wrap gap-2"> */}
        <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => onAdd({ kind: "sibling", gender: "male", age: "elder" })}>Elder brother</button>
        <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => onAdd({ kind: "sibling", gender: "male", age: "younger" })}>Younger brother</button>
        <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => onAdd({ kind: "sibling", gender: "male", age: "unknown" })}>(Unknown) brother</button>
      </div>
      <div className="col-start-2">
        <div className="font-medium">Sister</div>
        <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => onAdd({ kind: "sibling", gender: "female", age: "elder" })}>Elder sister</button>
        <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => onAdd({ kind: "sibling", gender: "female", age: "younger" })}>Younger sister</button>
        <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => onAdd({ kind: "sibling", gender: "female", age: "unknown" })}>(Unknown) sister</button>
        {/* </div> */}
      </div>
    </div>
  );
};

const Examples: React.FC<{ onRun: (s: StepType[]) => void }> = ({ onRun }) => {
  const ex: Array<{ name: string; steps: StepType[] }> = [
    { name: "Mother’s mother’s sister’s daughter", steps: [{ kind: "mother" }, { kind: "mother" }, { kind: "sibling", gender: "female", age: "unknown" }, { kind: "daughter" }] },
    { name: "Mother’s mother’s brother’s daughter", steps: [{ kind: "mother" }, { kind: "mother" }, { kind: "sibling", gender: "male", age: "unknown" }, { kind: "daughter" }] },
    { name: "Mother’s brother", steps: [{ kind: "mother" }, { kind: "sibling", gender: "male", age: "unknown" }] },
    { name: "Father’s sister", steps: [{ kind: "father" }, { kind: "sibling", gender: "female", age: "unknown" }] },
    { name: "Husband's elder sister", steps: [{ kind: "husband" }, { kind: "sibling", gender: "female", age: "elder" }] },
    { name: "Wife's younger brother", steps: [{ kind: "wife" }, { kind: "sibling", gender: "male", age: "younger" }] },
    { name: "Maternal cousin (uncle’s child)", steps: [{ kind: "mother" }, { kind: "sibling", gender: "male", age: "unknown" }, { kind: "son" }] },
    { name: "Paternal cousin (aunt’s daughter)", steps: [{ kind: "father" }, { kind: "sibling", gender: "female", age: "unknown" }, { kind: "daughter" }] },
  ];
  return (
    <div className="space-y-2">
      {ex.map((e, i) => (
        <button key={i} className="w-full text-left rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => onRun(e.steps)}>
          {e.name}
        </button>
      ))}
    </div>
  );
};

export default App