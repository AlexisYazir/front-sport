import { HttpContextToken } from '@angular/common/http';

// No viaja por la red: evita repetir una escritura cuyo resultado debe revisarse.
export const SKIP_AUTH_RETRY = new HttpContextToken<boolean>(() => false);
