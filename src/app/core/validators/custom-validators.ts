import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validadores personalizados con seguridad ESTRICTA
 */

// ============================================================================
// CONFIGURACIÓN GLOBAL DE VALIDADORES
// ============================================================================
export const VALIDATOR_CONFIG = {
  password: {
    minLength: 12,  // Modificable: longitud mínima de contraseña
    maxLength: 128, // Modificable: longitud máxima de contraseña
  },
  email: {
    minLength: 5,
    maxLength: 254,
  },
  name: {
    minLength: 2,
    maxLength: 50,
  },
  input: {
    maxLength: 10000,
  }
};

// ============================================================================
// EMAIL VALIDATION
// ============================================================================
export function emailFormatValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const email = String(control.value).trim();
    
    // RFC 5322 estricto + límites
    if (email.length < VALIDATOR_CONFIG.email.minLength || email.length > VALIDATOR_CONFIG.email.maxLength) {
      return { invalidEmailFormat: { value: email } };
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email) || email.includes('..') || /[\x00-\x1F\x7F]/.test(email)) {
      return { invalidEmailFormat: { value: email } };
    }

    return null;
  };
}

// ============================================================================
// PASSWORD VALIDATION - ESTRICTO
// ============================================================================
export interface PasswordStrength {
  score: number;
  feedback: string[];
  isValid: boolean;
}

export function passwordComplexityValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const password = String(control.value);
    const errors: string[] = [];

    // EXACTAMENTE minLength+ caracteres (CONFIGURABLE)
    if (password.length < VALIDATOR_CONFIG.password.minLength) errors.push('min-length');
    if (password.length > VALIDATOR_CONFIG.password.maxLength) errors.push('max-length');

    // OBLIGATORIO: Cada tipo de carácter
    if (!/[A-Z]/.test(password)) errors.push('uppercase');
    if (!/[a-z]/.test(password)) errors.push('lowercase');
    if (!/[0-9]/.test(password)) errors.push('digit');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) errors.push('special-char');

    // NO PERMITIR: Espacios en blanco
    if (/\s/.test(password)) errors.push('no-spaces');

    // NO PERMITIR: Caracteres consecutivos repetidos (aaa, 111, !!!)
    if (/(.)\1{2,}/.test(password)) errors.push('consecutive-chars');

    // NO PERMITIR: Secuencias de 3+ caracteres consecutivos (abc, 123, 789)
    // Alfabéticas
    if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
      errors.push('sequential-chars');
    }
    // Numéricas (cualquier secuencia de 3+ dígitos consecutivos)
    if (/(?:012|123|234|345|456|567|678|789|890|0123|1234|2345|3456|4567|5678|6789|7890|01234|12345|23456|34567|45678|56789|67890|012345|123456|234567|345678|456789|567890|0123456|1234567|2345678|3456789|4567890|01234567|12345678|23456789|34567890|012345678|123456789|234567890|0123456789)/.test(password)) {
      errors.push('sequential-chars');
    }

    // NO PERMITIR: Patrones repetitivos (abcabc)
    if (/^(.{1,4})\1+$/.test(password)) errors.push('repetitive-pattern');

    // NO PERMITIR: Palabras comunes
    if (/password|admin|user|login|welcome|qwerty|letmein|123456|abc123/i.test(password)) {
      errors.push('common-password');
    }

    return errors.length > 0 ? { passwordComplexity: errors } : null;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, feedback: ['Ingresa una contraseña'], isValid: false };
  }

  const errors: string[] = [];
  let score = 0;

  if (password.length >= VALIDATOR_CONFIG.password.minLength) score += 2;
  else errors.push(`Mínimo ${VALIDATOR_CONFIG.password.minLength} caracteres`);

  if (/[A-Z]/.test(password)) score += 1;
  else errors.push('Agrega mayúsculas');

  if (/[a-z]/.test(password)) score += 1;
  else errors.push('Agrega minúsculas');

  if (/[0-9]/.test(password)) score += 1;
  else errors.push('Agrega números');

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) score += 1;
  else errors.push('Agrega caracteres especiales');

  // Penalizar repeticiones y secuencias
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 2);
    errors.push('Sin caracteres consecutivos');
  }

  if (/(?:abc|bcd|123|234|345|456|567|678|789|012|0123|1234|2345|3456|4567|5678|6789|7890|12345|23456|34567|45678|56789|67890|123456|234567|345678|456789|567890|1234567|2345678|3456789|4567890|12345678|23456789|34567890|123456789|234567890|0123456789)/i.test(password)) {
    score = Math.max(0, score - 1);
    errors.push('Sin secuencias');
  }

  const isValid = score >= 6 && 
                  password.length >= VALIDATOR_CONFIG.password.minLength && 
                  !/(.)\1{2,}/.test(password) &&
                  !/(?:abc|123|234)/i.test(password);

  return {
    score: Math.min(score, 4),
    feedback: errors.slice(0, 2),
    isValid
  };
}

// ============================================================================
// NAME VALIDATION
// ============================================================================
export function nameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const name = String(control.value).trim();
    
    if (name.length < VALIDATOR_CONFIG.name.minLength || name.length > VALIDATOR_CONFIG.name.maxLength) {
      return { invalidName: ['length'] };
    }

    // Solo letras Unicode, espacios únicos, guiones
    if (!/^[\p{L}\p{M}]+(?:[\s\-'][\p{L}\p{M}]+)*$/u.test(name)) {
      return { invalidName: ['format'] };
    }

    // Sin caracteres de control
    if (/[\x00-\x1F\x7F-\x9F]/.test(name)) {
      return { invalidName: ['control-chars'] };
    }

    return null;
  };
}

// ============================================================================
// XSS DETECTION - ESTRICTO
// ============================================================================
export function xssPatternDetector(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const input = String(control.value);

    if (input.length > VALIDATOR_CONFIG.input.maxLength) {
      return { xssDetected: { value: 'input-too-large' } };
    }

    const xssPatterns = [
      /<script/gi, /<iframe/gi, /<embed/gi, /<object/gi,
      /javascript:/gi, /on\w+\s*=/gi, /eval\(/gi, /expression\(/gi,
      /<img[^>]*on/gi, /<svg[^>]*on/gi, /vbscript:/gi,
      /data:text\/html/gi, /<(base|link|meta|style)/gi,
      /<!--/, /<\?/, /<%/, /\${/, /&#x?[0-9a-f]+;/gi,
      /\\[ux][0-9a-f]{2,4}/gi
    ];

    if (xssPatterns.some(p => p.test(input)) || /[\x00-\x1F\x7F]/.test(input)) {
      return { xssDetected: { value: input.substring(0, 50) } };
    }

    return null;
  };
}

// ============================================================================
// SQL INJECTION DETECTION - ESTRICTO
// ============================================================================
export function sqlInjectionDetector(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const input = String(control.value);
    
    if (input.length > VALIDATOR_CONFIG.input.maxLength) {
      return { sqlInjectionDetected: { value: 'input-too-large' } };
    }

    // Permitir solo emails
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim())) {
      return null;
    }

    const sqlPatterns = [
      /\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|TRUNCATE)\b/gi,
      /(['"][\s\n]*(OR|AND)[\s\n]*['"]?\s*=)/gi,
      /(--|\/\*|\*\/|;.*DROP|;.*DELETE)/gi,
      /\b(OR|AND)\b\s*['"0-9]+\s*=\s*['"0-9]+/gi,
      /\b(1\s*=\s*1|0\s*=\s*0)\b/gi,
      /\b(xp_|sp_|INFORMATION_SCHEMA|SLEEP|BENCHMARK|LOAD_FILE)\b/gi,
      /\b0x[0-9a-f]+\b/gi,
      /('--|";|';|"--|\|\||@@)/
    ];

    if (sqlPatterns.some(p => p.test(input))) {
      return { sqlInjectionDetected: { value: input.substring(0, 50) } };
    }

    return null;
  };
}

// ============================================================================
// SECURE INPUT - Combina validaciones
// ============================================================================
export function secureInputValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const xssCheck = xssPatternDetector()(control);
    const sqlCheck = sqlInjectionDetector()(control);

    if (xssCheck || sqlCheck) {
      return {
        insecureInput: {
          xss: !!xssCheck,
          sql: !!sqlCheck
        }
      };
    }

    return null;
  };
}

// ============================================================================
// PASSWORD MATCH VALIDATOR
// ============================================================================
export function passwordMatchValidator(passwordField: string, confirmField: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get(passwordField);
    const confirm = control.get(confirmField);

    if (!password || !confirm || !password.value || !confirm.value) {
      return null;
    }

    return password.value === confirm.value ? null : { passwordMismatch: true };
  };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

export function validateEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (trimmed.length < VALIDATOR_CONFIG.email.minLength || trimmed.length > VALIDATOR_CONFIG.email.maxLength) return false;
  
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(trimmed) && !trimmed.includes('..') && !/[\x00-\x1F\x7F]/.test(trimmed);
}

export function validatePasswordComplexity(password: string): boolean {
  if (!password || password.length < VALIDATOR_CONFIG.password.minLength || password.length > VALIDATOR_CONFIG.password.maxLength) return false;
  
  // TODOS los tipos OBLIGATORIOS
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return false;

  // SIN espacios
  if (/\s/.test(password)) return false;

  // SIN consecutivos ni secuencias
  if (/(.)\1{2,}/.test(password)) return false;
  
  // SIN secuencias alfabéticas
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) return false;
  
  // SIN secuencias numéricas de 3+
  if (/(?:012|123|234|345|456|567|678|789|890|0123|1234|2345|3456|4567|5678|6789|7890|01234|12345|23456|34567|45678|56789|67890|012345|123456|234567|345678|456789|567890|0123456|1234567|2345678|3456789|4567890|01234567|12345678|23456789|34567890|012345678|123456789|234567890|0123456789)/.test(password)) return false;
  
  if (/^(.{1,4})\1+$/.test(password)) return false;
  if (/password|admin|qwerty|123456/i.test(password)) return false;

  return true;
}

export function validateName(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  
  if (trimmed.length < VALIDATOR_CONFIG.name.minLength || trimmed.length > VALIDATOR_CONFIG.name.maxLength) return false;
  if (!/^[\p{L}\p{M}]+(?:[\s\-'][\p{L}\p{M}]+)*$/u.test(trimmed)) return false;
  if (/[\x00-\x1F\x7F-\x9F]/.test(trimmed)) return false;

  return true;
}

export function detectXSS(input: string): boolean {
  if (!input || input.length > VALIDATOR_CONFIG.input.maxLength) return true;

  const xssPatterns = [
    /<script/gi, /<iframe/gi, /<embed/gi, /javascript:/gi,
    /on\w+\s*=/gi, /eval\(/gi, /<img[^>]*on/gi, /<svg[^>]*on/gi,
    /vbscript:/gi, /data:text\/html/gi, /<(base|link|meta|style)/gi,
    /<!--/, /<\?/, /<%/, /\${/, /&#x?[0-9a-f]+;/gi
  ];

  return xssPatterns.some(p => p.test(input)) || /[\x00-\x1F\x7F]/.test(input);
}

export function detectSQLInjection(input: string): boolean {
  if (!input || input.length > VALIDATOR_CONFIG.input.maxLength) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim())) return false;

  const sqlPatterns = [
    /\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|TRUNCATE)\b/gi,
    /(['"][\s\n]*(OR|AND)[\s\n]*['"]?\s*=)/gi,
    /(--|\/\*|\*\/|;.*DROP)/gi,
    /\b(OR|AND)\b\s*['"0-9]+\s*=\s*['"0-9]+/gi,
    /\b(1\s*=\s*1|xp_|sp_|INFORMATION_SCHEMA)\b/gi,
    /('--|";|';\|\||@@|0x[0-9a-f]+)/i
  ];

  return sqlPatterns.some(p => p.test(input));
}

export function isSecureInput(input: string): boolean {
  if (!input) return true;
  if (input.length > VALIDATOR_CONFIG.input.maxLength) return false;
  return !detectXSS(input) && !detectSQLInjection(input);
}
// Validar teléfono (10 dígitos)
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\d{10}$/;
  return phoneRegex.test(phone);
}