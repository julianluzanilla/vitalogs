import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useDisplayName } from '../components/AppShell';
import { ExportSheet } from '../components/ExportSheet';
import { Icon, IconChip } from '../components/Icon';
import { LogoutDialog } from '../components/LogoutDialog';
import { Sheet } from '../components/Sheet';
import { MedPurposeList } from '../components/MedPurposeList';
import { HEIGHT_RANGE, type Sex } from '../../shared/model';
import { addMed, buildBackup, removeMed, restoreBackup, setProfile, setReportName, updateMed } from '../data/store';
import { useEntries, useMeds, useProfile } from '../hooks/useData';
import { useMe, useSession } from '../hooks/useSession';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import type { ExportFile } from '../lib/export/share';
import { countLabel, ds } from '../lib/format';
import { PasswordForm } from './Login';

export function Perfil() {
  const me = useMe();
  const name = useDisplayName();
  const entries = useEntries();
  const { dark, toggle } = useTheme();
  const { changePassword } = useSession();
  const toast = useToast();
  const [draft, setDraft] = useState(name);
  const [backup, setBackup] = useState<ExportFile | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const editing = useRef(false);

  // Sincroniza el campo con cambios llegados de otro dispositivo, salvo mientras se escribe.
  useEffect(() => {
    if (!editing.current) setDraft(name);
  }, [name]);

  const commitName = () => {
    editing.current = false;
    const v = draft.trim();
    if (v && v !== name) void setReportName(v);
    else setDraft(name);
  };

  const makeBackup = async () => {
    const data = await buildBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    setBackup({ blob, name: `vitalogs-respaldo-${ds(new Date())}.json` });
  };

  const onRestore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const n = await restoreBackup(JSON.parse(await file.text()));
      toast(`Respaldo restaurado · ${countLabel(n)}`);
    } catch {
      toast('Archivo no válido');
    }
  };

  return (
    <>
      <h1 className="page-title">Perfil</h1>
      <div className="profile-grid">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card profile-card">
            <div className="avatar">{(name || '?').charAt(0).toUpperCase()}</div>
            <label>
              <span>Nombre en reportes</span>
              <input
                className="input"
                value={draft}
                maxLength={120}
                onFocus={() => (editing.current = true)}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
              />
            </label>
          </section>

          <BodyCard />

          <section className="card settings">
            <button className="setting" onClick={toggle} role="switch" aria-checked={dark}>
              <Icon name="moon" />
              <span className="grow">Modo oscuro</span>
              <span className={`switch${dark ? ' on' : ''}`}>
                <span />
              </span>
            </button>
            <button className="setting" onClick={makeBackup}>
              <Icon name="download" />
              <span className="grow">Descargar respaldo</span>
              <span className="meta">{countLabel(entries.length)}</span>
            </button>
            <button className="setting" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" />
              <span className="grow">Restaurar respaldo</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void onRestore(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button className="setting" onClick={() => setPwOpen(true)}>
              <Icon name="lock" />
              <span className="grow">Cambiar contraseña</span>
              <span className="meta">@{me.username}</span>
            </button>
            <button className="setting danger" onClick={() => setLogoutOpen(true)}>
              <Icon name="logout" />
              Cerrar sesión
            </button>
          </section>
        </div>

        <MedsCard />
      </div>

      {backup && <ExportSheet file={backup} title="Respaldo listo" onClose={() => setBackup(null)} />}
      {logoutOpen && <LogoutDialog onClose={() => setLogoutOpen(false)} />}
      {pwOpen && (
        <Sheet onClose={() => setPwOpen(false)} small label="Cambiar contraseña">
          {({ close, dragProps }) => (
            <>
              <div className="panel-head draggable" {...dragProps}>
                <div className="panel-title">
                  <span>Cambiar contraseña</span>
                </div>
                <button className="icon-btn close" aria-label="Cerrar" onClick={close}>
                  <Icon name="x" />
                </button>
              </div>
              <div className="dialog-body" style={{ paddingBottom: 'calc(22px + var(--sab))' }}>
                <PasswordForm
                  minLength={8}
                  submitLabel="Guardar contraseña"
                  onSubmit={async (cur, next) => {
                    await changePassword(cur, next);
                    toast('Contraseña actualizada');
                    close();
                  }}
                />
              </div>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}

/** Estatura y sexo: se usan para calcular IMC y % de grasa (US Navy) en los registros de peso. */
function BodyCard() {
  const profile = useProfile();
  const toast = useToast();
  const height = profile?.height ?? null;
  const sex = profile?.sex ?? null;
  const [draft, setDraft] = useState(height ? String(height) : '');
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(height ? String(height) : '');
  }, [height]);

  const commit = () => {
    editing.current = false;
    const v = draft.trim() === '' ? null : Math.round(Number(draft.replace(',', '.')));
    if (v !== null && !(v >= HEIGHT_RANGE[0] && v <= HEIGHT_RANGE[1])) {
      toast(`Estatura entre ${HEIGHT_RANGE[0]} y ${HEIGHT_RANGE[1]} cm`);
      setDraft(height ? String(height) : '');
      return;
    }
    if (v !== height) void setProfile({ height: v });
  };
  const pickSex = (s: Sex) => void setProfile({ sex: s === sex ? null : s });

  return (
    <section className="card body-card">
      <div className="report-sec-head">
        <IconChip name="peso" size="sm" />
        <h2 className="section-title">Datos corporales</h2>
      </div>
      <div className="body-fields">
        <label className="inline-field">
          <span className="lbl">Estatura</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="—"
            value={draft}
            onFocus={() => (editing.current = true)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            aria-label="Estatura en centímetros"
          />
          <span className="unit">cm</span>
        </label>
        <div className="segmented" role="radiogroup" aria-label="Sexo">
          {(
            [
              ['M', 'Hombre'],
              ['F', 'Mujer'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={sex === k} className={sex === k ? 'on' : ''} onClick={() => pickSex(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="hint">Se usan para calcular tu IMC y tu % de grasa (fórmula de la US Navy) en los registros de peso.</div>
    </section>
  );
}

/** "Mis medicamentos": lista para elegir rápido al registrar. Tocar uno lo carga para editarlo. */
function MedsCard() {
  const meds = useMeds();
  const toast = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [purpose, setPurpose] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setEditId(null);
    setName('');
    setDose('');
    setPurpose('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editId) {
      void updateMed(editId, name, dose, purpose);
      toast('Medicamento actualizado');
    } else void addMed(name, dose, purpose);
    reset();
  };

  return (
    <section className="card meds">
      <div className="report-sec-head">
        <IconChip name="medicamento" size="sm" />
        <h2 className="section-title">Mis medicamentos</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {!meds.length && <div className="hint">Agrega los medicamentos que tomas para elegirlos rápido al registrar.</div>}
        {meds.map((m) => (
          <div className={`med-row${editId === m.id ? ' editing' : ''}`} key={m.id}>
            <button
              type="button"
              className="med-info"
              title="Editar"
              onClick={() => {
                setEditId(m.id);
                setName(m.name);
                setDose(m.dose);
                setPurpose(m.purpose || '');
                nameInput.current?.focus();
              }}
            >
              <span className="n">{m.name}</span>
              {m.purpose && <span className="p">{m.purpose}</span>}
            </button>
            <span className="d">{m.dose}</span>
            <button className="icon-btn ghost" title="Eliminar" aria-label={`Eliminar ${m.name}`} onClick={() => (void removeMed(m.id), editId === m.id && reset())}>
              <Icon name="trash" size={17} />
            </button>
          </div>
        ))}
      </div>
      <form className="med-form" onSubmit={submit}>
        <input ref={nameInput} className="input alt" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" maxLength={120} aria-label="Nombre del medicamento" />
        <input className="input alt" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dosis" maxLength={120} aria-label="Dosis" />
        <input
          className="input alt purpose"
          value={purpose}
          list="med-purposes"
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="¿Para qué es? (p. ej. hipertensión, TDAH, dormir)"
          maxLength={120}
          aria-label="Para qué es el medicamento"
        />
        <MedPurposeList />
        <button type="submit" className="btn btn-primary submit" disabled={!name.trim()}>
          {!editId && <Icon name="plus" size={18} />}
          {editId ? 'Guardar cambios' : 'Agregar medicamento'}
        </button>
        {editId && (
          <button type="button" className="link-btn cancel" onClick={reset}>
            Cancelar edición
          </button>
        )}
      </form>
    </section>
  );
}
