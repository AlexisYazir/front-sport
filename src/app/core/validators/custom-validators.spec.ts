import { FormControl } from '@angular/forms';
import {
  detectXSS,
  emailFormatValidator,
  nameValidator,
  passwordComplexityValidator,
  validateEmail,
  validateName,
  validatePasswordComplexity,
  xssPatternDetector,
} from './custom-validators';

describe('Validadores: restricciones de caracteres después de la limpieza', () => {
  it('rechaza controles ASCII en texto, nombres y correos, incluidos salto de línea y DEL', () => {
    const codes = [...Array.from({ length: 32 }, (_, index) => index), 127];
    for (const code of codes) {
      const character = String.fromCharCode(code);
      const text = `Texto${character}normal`;
      const name = `Mar${character}cial`;
      const email = `cliente${character}qa@example.com`;
      expect(detectXSS(text)).withContext(`texto, código ${code}`).toBeTrue();
      expect(xssPatternDetector()(new FormControl(text))).not.toBeNull();
      expect(validateName(name)).withContext(`nombre, código ${code}`).toBeFalse();
      expect(nameValidator()(new FormControl(name))).not.toBeNull();
      expect(validateEmail(email)).withContext(`correo, código ${code}`).toBeFalse();
      expect(emailFormatValidator()(new FormControl(email))).not.toBeNull();
    }
    for (let code = 128; code <= 159; code++) {
      expect(validateName(`Mar${String.fromCharCode(code)}cial`)).toBeFalse();
    }
  });

  it('conserva nombres con acentos y puntuación admitida en correos', () => {
    expect(validateName("Ángel O'Neil")).toBeTrue();
    expect(nameValidator()(new FormControl('Ana-María Pérez'))).toBeNull();
    expect(validateEmail('cliente/qa+1@sub.example.com')).toBeTrue();
    expect(emailFormatValidator()(new FormControl('cliente/qa+1@sub.example.com'))).toBeNull();
    expect(validateEmail('cliente..qa@example.com')).toBeFalse();
    expect(validateEmail('cliente@example..com')).toBeFalse();
  });

  it('conserva los caracteres especiales de contraseña y exige al menos uno', () => {
    const base = 'Qh9vKr2xLm5z';
    const specialCharacters = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?`~";
    for (const character of specialCharacters) {
      const password = base + character;
      expect(validatePasswordComplexity(password)).withContext(`carácter ${character}`).toBeTrue();
      expect(passwordComplexityValidator()(new FormControl(password))).toBeNull();
    }
    expect(validatePasswordComplexity(base)).toBeFalse();
    expect(passwordComplexityValidator()(new FormControl(base))?.['passwordComplexity']).toContain('special-char');
    expect(validatePasswordComplexity(base + ' ')).toBeFalse();
  });
});
