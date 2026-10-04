import { MED_PURPOSES } from '../../shared/model';

/** Sugerencias para el campo "¿Para qué es?" (se enlaza con list="med-purposes"). */
export function MedPurposeList() {
  return (
    <datalist id="med-purposes">
      {MED_PURPOSES.map((p) => (
        <option key={p} value={p} />
      ))}
    </datalist>
  );
}
