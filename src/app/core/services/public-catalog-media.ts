import { environment } from '../../../environments/environment';

/** Las mismas direcciones se usan al dibujar el inicio y al preparar su copia. */
export const SPORT_IMAGES: Readonly<Record<string, string>> = {
  futbol: 'https://res.cloudinary.com/dcktzxrmw/image/upload/v1784798726/futbol_mbm6ls.jpg',
  football: 'https://res.cloudinary.com/dcktzxrmw/image/upload/v1784798726/futbol_mbm6ls.jpg',
  basketbol: 'https://res.cloudinary.com/dcktzxrmw/image/upload/v1784798722/basketbol_uankb2.png',
  basketball: 'https://res.cloudinary.com/dcktzxrmw/image/upload/v1784798722/basketbol_uankb2.png',
  basquetbol: 'https://res.cloudinary.com/dcktzxrmw/image/upload/v1784798722/basketbol_uankb2.png',
  gym: 'https://res.cloudinary.com/dcktzxrmw/image/upload/v1784798725/gym_uo2qv6.jpg',
  gimnasio: 'https://res.cloudinary.com/dcktzxrmw/image/upload/v1784798725/gym_uo2qv6.jpg',
  ciclismo: 'https://res.cloudinary.com/dcktzxrmw/image/upload/v1784798722/ciclismo_s3huyx.jpg',
  running: 'https://res.cloudinary.com/dcktzxrmw/image/upload/v1784798722/running_za35oe.jpg',
};

export function publicImageUrl(value: unknown, base = document.baseURI): string | null {
  if (typeof value !== 'string' || !value.trim() || value === 'null') return null;
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function marcaImageUrl(marca: { nombre: string; imagen?: string }): string {
  const api = environment.apiUrl.replace(/\/$/, '');
  return publicImageUrl(marca.imagen, `${api}/`) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(marca.nombre)}&background=0367A6&color=fff&size=128`;
}

export function sportImageUrl(nombre: string): string {
  const slug = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return SPORT_IMAGES[slug] || SPORT_IMAGES['running'];
}

export interface CatalogMedia { home: string[]; all: string[]; }

export function catalogMedia(products: any[], marcas: any[], sports: any[], banners: any[]): CatalogMedia {
  const home = new Set<string>();
  const all = new Set<string>();
  const add = (value: unknown, featured = false) => {
    const url = publicImageUrl(value);
    if (url) { all.add(url); if (featured) home.add(url); }
  };
  for (const [index, product] of products.entries()) {
    const variants = Array.isArray(product.variantes) ? product.variantes : [];
    add(variants[0]?.imagenes?.[0] || 'assets/images/no_imagen.webp', index < 8);
    for (const variant of variants) {
      for (const image of Array.isArray(variant.imagenes) ? variant.imagenes : []) add(image);
    }
    add(product.imagen_marca);
  }
  for (const marca of marcas) add(marcaImageUrl(marca), true);
  for (const sport of sports) add(sportImageUrl(sport.nombre), true);
  for (const banner of banners) if (banner.activo && banner.url_imagen) add(banner.url_imagen, true);
  return { home: [...home], all: [...home, ...[...all].filter(url => !home.has(url))] };
}
