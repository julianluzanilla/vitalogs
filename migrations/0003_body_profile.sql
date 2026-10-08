-- Datos corporales del perfil (para IMC y % de grasa US Navy)
ALTER TABLE profiles ADD COLUMN height_cm REAL;
ALTER TABLE profiles ADD COLUMN sex TEXT CHECK (sex IN ('M', 'F'));
