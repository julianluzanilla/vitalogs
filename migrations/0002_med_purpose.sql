-- Para qué es cada medicamento guardado (p. ej. "Control de hipertensión")
ALTER TABLE meds ADD COLUMN purpose TEXT NOT NULL DEFAULT '';
