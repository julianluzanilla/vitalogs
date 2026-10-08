import { useState } from 'react';
import { AMOUNTS, OBS_PRESETS, TYPES, ZONES, type EntryType } from '../../shared/model';
import { deleteEntry, newId, restoreEntry, saveEntry } from '../data/store';
import { useMeds, useProfile } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { bmi, bmiLabel, bodyOf, fmt1, navyFat, navyMissing } from '../lib/body';
import { dec, entryFromForm, validateForm, type FormState } from '../lib/form';
import { intLabel } from '../lib/format';
import { ConfirmDialog } from './Dialog';
import { Icon, IconChip } from './Icon';
import { Sheet } from './Sheet';
import { MedPurposeList } from './MedPurposeList';
import { Chip, TypeTiles } from './TypeTiles';

export function EntrySheet({ initial, onClose }: { initial: FormState; onClose: () => void }) {
  const [f, setF] = useState<FormState>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meds = useMeds();
  const body = bodyOf(useProfile());
  const toast = useToast();

  const set = (p: Partial<FormState>) => setF((s) => ({ ...s, ...p, err: '' }));
  const t = f.type;
  const fields = f.step === 'fields' && !!t;
  const heading = fields ? (f.editing ? 'Editar ' : '') + TYPES[t!].title : 'Nuevo registro';
  const obsParts = f.obs
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const pickType = (type: EntryType) => set({ type, step: 'fields' });

  return (
    <Sheet onClose={onClose} label={heading}>
      {({ close, dragProps }) => {
        const save = async () => {
          const err = validateForm(f);
          if (err) return setF((s) => ({ ...s, err }));
          await saveEntry(entryFromForm(f, f.editing || newId(), Date.now()));
          toast(f.editing ? 'Registro actualizado' : 'Registro guardado');
          close();
        };

        return (
          <>
            <div className="panel-head draggable" {...dragProps}>
              {fields && <IconChip name={TYPES[t!].icon} />}
              <div className="panel-title">
                <span>{heading}</span>
                {fields && !f.editing && (
                  <button className="link-btn" onClick={() => set({ step: 'type' })}>
                    Cambiar tipo
                  </button>
                )}
              </div>
              <button className="icon-btn close" aria-label="Cerrar" onClick={close}>
                <Icon name="x" />
              </button>
            </div>

            <div className="panel-body">
              {!fields && <TypeTiles onPick={pickType} />}

              {fields && (
                <div className="two">
                  <label className="field">
                    <span className="label">Fecha</span>
                    <input className="input strong" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
                  </label>
                  <label className="field">
                    <span className="label">Hora</span>
                    <input className="input strong" type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} />
                  </label>
                </div>
              )}

              {fields && t === 'dolor' && (
                <div className="field">
                  <span className="label">Zona</span>
                  <div className="chips">
                    {ZONES.map((z) => (
                      <Chip key={z} size="lg" on={f.zone === z} onClick={() => set({ zone: z })}>
                        {z}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {fields && t === 'dolor' && (
                <label className="field">
                  <span className="label">{f.zone === 'Otro' ? 'Observaciones · especifica la zona' : 'Observaciones · ¿quieres ser más específico?'}</span>
                  <textarea
                    className="textarea"
                    rows={2}
                    maxLength={1000}
                    value={f.obs}
                    placeholder={f.zone === 'Otro' ? 'p. ej. rodilla derecha, dolor punzante…' : 'p. ej. espalda baja, lado derecho, dolor punzante, al moverme…'}
                    onChange={(e) => set({ obs: e.target.value })}
                  />
                </label>
              )}

              {fields && (t === 'dolor' || t === 'mareo') && (
                <>
                  <div className="field">
                    <span className="label">Duración</span>
                    <div className="dur-row">
                      <label className={`dur${f.constant ? ' off' : ''}`}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="0"
                          value={f.constant ? '' : f.duration}
                          disabled={f.constant}
                          onChange={(e) => set({ duration: e.target.value })}
                          aria-label="Duración en minutos"
                        />
                        <span className="unit">min</span>
                      </label>
                      {t === 'dolor' && (
                        <button type="button" className={`chip const-btn${f.constant ? ' on' : ''}`} aria-pressed={f.constant} onClick={() => set({ constant: !f.constant })}>
                          Constante
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="field">
                    <div className="int-head">
                      <span className="label">Intensidad</span>
                      <span className="v">
                        {f.intensity}/10 · {intLabel(f.intensity)}
                      </span>
                    </div>
                    <div className="int-grid">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <Chip key={n} on={f.intensity === n} onClick={() => set({ intensity: n })}>
                          {n}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {fields && t === 'lpm' && (
                <label className="big-card">
                  <span className="label">Resultado</span>
                  <input className="big-input" type="number" inputMode="numeric" placeholder="72" value={f.value} onChange={(e) => set({ value: e.target.value })} />
                  <span className="label" style={{ fontSize: 14 }}>
                    latidos por minuto
                  </span>
                </label>
              )}

              {fields && t === 'presion' && (
                <div className="field" style={{ gap: 10 }}>
                  <div className="bp-card">
                    <label>
                      <span>Sistólica</span>
                      <input className="big-input" type="number" inputMode="numeric" placeholder="120" value={f.sys} onChange={(e) => set({ sys: e.target.value })} />
                    </label>
                    <span className="bp-slash">/</span>
                    <label>
                      <span>Diastólica</span>
                      <input className="big-input" type="number" inputMode="numeric" placeholder="80" value={f.dia} onChange={(e) => set({ dia: e.target.value })} />
                    </label>
                  </div>
                  <label className="inline-field">
                    <Icon name="lpm" />
                    <span className="lbl">Pulso (opcional)</span>
                    <input type="number" inputMode="numeric" placeholder="—" value={f.pulse} onChange={(e) => set({ pulse: e.target.value })} />
                    <span className="unit">lpm</span>
                  </label>
                </div>
              )}

              {fields && t === 'medicamento' && (
                <>
                  <div className="field">
                    <span className="label">Medicamento</span>
                    <div className="chips">
                      {meds.map((m) => (
                        <Chip key={m.id} size="lg" on={f.med === m.name} onClick={() => set({ med: m.name, dose: m.dose, purpose: m.purpose || '' })}>
                          {m.name}
                        </Chip>
                      ))}
                      {/* Al editar un registro cuyo medicamento ya no está en la lista, se muestra igual. */}
                      {f.med && !meds.some((m) => m.name === f.med) && (
                        <Chip size="lg" on onClick={() => {}}>
                          {f.med}
                        </Chip>
                      )}
                    </div>
                    {!meds.length && <div className="hint">Agrega tus medicamentos en Perfil.</div>}
                  </div>
                  <label className="field">
                    <span className="label">Dosis</span>
                    <input className="input" value={f.dose} placeholder="p. ej. 500 mg" maxLength={120} onChange={(e) => set({ dose: e.target.value })} />
                  </label>
                  <label className="field">
                    <span className="label">¿Para qué es? · opcional</span>
                    <input
                      className="input"
                      value={f.purpose}
                      list="med-purposes"
                      placeholder="p. ej. control de hipertensión"
                      maxLength={120}
                      onChange={(e) => set({ purpose: e.target.value })}
                    />
                    <MedPurposeList />
                  </label>
                  <label className="field">
                    <span className="label">Síntoma presentado · opcional</span>
                    <input className="input" value={f.symptom} placeholder="p. ej. dolor de cabeza" maxLength={300} onChange={(e) => set({ symptom: e.target.value })} />
                  </label>
                </>
              )}

              {fields && t === 'bano' && (
                <>
                  <div className="kind-grid">
                    <Chip on={f.kind === 'pipi'} onClick={() => set({ kind: 'pipi' })}>
                      Pipí
                    </Chip>
                    <Chip on={f.kind === 'popo'} onClick={() => set({ kind: 'popo' })}>
                      Popó
                    </Chip>
                  </div>
                  <div className="field">
                    <span className="label">Cantidad</span>
                    <div className="segmented" role="radiogroup">
                      {AMOUNTS.map((a) => (
                        <button key={a} type="button" role="radio" aria-checked={f.amount === a} className={f.amount === a ? 'on' : ''} onClick={() => set({ amount: a })}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {fields && t === 'peso' && <PesoFields f={f} set={set} body={body} />}

              {fields && (t === 'lpm' || t === 'presion' || t === 'bano' || t === 'peso') && (
                <div className="field" style={{ gap: 10 }}>
                  <span className="label">Observaciones · opcional</span>
                  {t !== 'bano' && (
                    <div className="chips" style={{ gap: 6 }}>
                      {OBS_PRESETS.map((o) => {
                        const has = obsParts.includes(o);
                        return (
                          <Chip key={o} size="sm" on={has} onClick={() => set({ obs: (has ? obsParts.filter((x) => x !== o) : [...obsParts, o]).join(', ') })}>
                            {o}
                          </Chip>
                        );
                      })}
                    </div>
                  )}
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={1000}
                    value={f.obs}
                    placeholder={t === 'bano' ? 'Color, dolor, condiciones (p. ej. mucho frío)…' : 'Otras notas…'}
                    onChange={(e) => set({ obs: e.target.value })}
                  />
                </div>
              )}

              {f.err && <div className="error-text">{f.err}</div>}
            </div>

            {fields && (
              <div className="panel-foot">
                {f.editing && (
                  <button className="btn btn-danger trash btn-lg" title="Eliminar" aria-label="Eliminar registro" onClick={() => setConfirmDelete(true)}>
                    <Icon name="trash" />
                  </button>
                )}
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={save}>
                  {f.editing ? 'Guardar cambios' : 'Guardar registro'}
                </button>
              </div>
            )}

            {confirmDelete && (
              <ConfirmDialog
                title="¿Eliminar este registro?"
                confirmLabel="Eliminar"
                danger
                onClose={() => setConfirmDelete(false)}
                onConfirm={async () => {
                  const id = f.editing!;
                  await deleteEntry(id);
                  toast('Registro eliminado', { label: 'Deshacer', run: () => void restoreEntry(id) });
                  close();
                }}
              >
                Se eliminará de todos tus dispositivos.
              </ConfirmDialog>
            )}
          </>
        );
      }}
    </Sheet>
  );
}

/** Peso, medidas opcionales y vista previa de IMC / % de grasa. */
function PesoFields({ f, set, body }: { f: FormState; set: (p: Partial<FormState>) => void; body: ReturnType<typeof bodyOf> }) {
  const m = { waist: dec(f.waist), neck: dec(f.neck), hip: dec(f.hip) };
  const w = dec(f.weight);
  const i = w ? bmi(w, body.height) : null;
  const fat = navyFat(m, body);
  const missing = navyMissing(m, body);
  const measure = (k: 'waist' | 'neck' | 'hip' | 'fat', label: string, unit: string) => (
    <label className="inline-field">
      <span className="lbl">{label}</span>
      <input type="number" inputMode="decimal" step="0.1" placeholder="—" value={f[k]} onChange={(e) => set({ [k]: e.target.value })} />
      <span className="unit">{unit}</span>
    </label>
  );

  return (
    <>
      <label className="big-card">
        <span className="label">Peso</span>
        <input className="big-input" type="number" inputMode="decimal" step="0.1" placeholder="70.5" value={f.weight} onChange={(e) => set({ weight: e.target.value })} />
        <span className="label" style={{ fontSize: 14 }}>
          kilogramos
        </span>
      </label>
      {(i || fat) && (
        <div className="body-calc">
          {i && (
            <span>
              <small>IMC</small>
              <b>{fmt1(i)}</b>
              {bmiLabel(i)}
            </span>
          )}
          {fat && (
            <span>
              <small>Grasa (US Navy)</small>
              <b>{fmt1(fat)} %</b>
              estimada
            </span>
          )}
        </div>
      )}
      <div className="field" style={{ gap: 10 }}>
        <span className="label">Medidas · opcional</span>
        {measure('waist', body.sex === 'F' ? 'Cintura (parte más estrecha)' : 'Cintura (a la altura del ombligo)', 'cm')}
        {measure('neck', 'Cuello (debajo de la laringe)', 'cm')}
        {body.sex !== 'M' && measure('hip', 'Cadera (parte más ancha)', 'cm')}
        {measure('fat', '% grasa de báscula', '%')}
        {missing && <div className="hint">{missing}</div>}
      </div>
    </>
  );
}
