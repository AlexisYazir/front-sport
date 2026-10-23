import { catalogMedia, marcaImageUrl, publicImageUrl, sportImageUrl } from './public-catalog-media';

describe('Imágenes públicas para uso sin conexión', () => {
  it('incluye todas las variantes y prioriza las imágenes visibles del inicio sin duplicarlas', () => {
    const first = 'https://m.media-amazon.com/first.jpg';
    const second = 'https://http2.mlstatic.com/second.webp';
    const extra = 'https://http2.mlstatic.com/extra.webp';
    const products = Array.from({ length: 9 }, (_, index) => ({ variantes: [
      { imagenes: [first, second] }, { imagenes: [extra, first] },
    ] }));
    const media = catalogMedia(products, [{ nombre: 'Marca', imagen: 'https://images.seeklogo.com/a.png' }],
      [{ nombre: 'Fútbol' }], [{ activo: true, url_imagen: 'https://res.cloudinary.com/banner.png' }]);
    expect(media.all).toContain(first);
    expect(media.all).toContain(second);
    expect(media.all).toContain(extra);
    expect(media.home).toContain(first);
    expect(media.home).not.toContain(second);
    expect(media.all.length).toBe(new Set(media.all).size);
    expect(media.all.slice(0, media.home.length)).toEqual(media.home);
  });

  it('incluye productos posteriores a los ocho destacados y descarta banners inactivos', () => {
    const products = Array.from({ length: 9 }, (_, index) => ({ variantes: [{ imagenes: [`https://http2.mlstatic.com/${index}.jpg`] }] }));
    const media = catalogMedia(products, [], [], [{ activo: false, url_imagen: 'https://res.cloudinary.com/old.png' }]);
    expect(media.all).toContain('https://http2.mlstatic.com/8.jpg');
    expect(media.home).not.toContain('https://http2.mlstatic.com/8.jpg');
    expect(media.all).not.toContain('https://res.cloudinary.com/old.png');
  });

  it('resuelve rutas de marcas contra el backend, conserva parámetros y codifica nombres', () => {
    expect(marcaImageUrl({ nombre: 'A', imagen: '/uploads/logo.png' })).toContain('/uploads/logo.png');
    expect(marcaImageUrl({ nombre: 'A & B' })).toContain('name=A%20%26%20B');
    expect(publicImageUrl('https://example.com/a.jpg?size=500')).toBe('https://example.com/a.jpg?size=500');
    expect(sportImageUrl('FÚTBOL')).toContain('futbol_mbm6ls');
  });

  it('rechaza direcciones con credenciales, protocolos ejecutables y valores nulos', () => {
    expect(publicImageUrl('javascript:alert(1)')).toBeNull();
    expect(publicImageUrl('https://user:secret@example.com/a.jpg')).toBeNull();
    expect(publicImageUrl(null)).toBeNull();
    expect(publicImageUrl('null')).toBeNull();
  });
});
