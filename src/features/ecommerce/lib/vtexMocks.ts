import type { VtexSearchedProduct, VtexCategoryNode, VtexBrand } from '../types/vtex';

export const vtexCategoriesMock: VtexCategoryNode[] = [
  {
    id: 1,
    name: 'Hortifruti',
    children: [],
  },
  {
    id: 2,
    name: 'Mercearia',
    children: [
      { id: 68, name: 'Bomboniere' },
      { id: 15, name: 'Doces e Sobremesas' },
      { id: 21, name: 'Grãos e Cereais' },
      { id: 16, name: 'Molhos e Condimentos' },
    ],
  },
  { id: 3, name: 'Açougue', children: [{ id: 45, name: 'Frango' }] },
  {
    id: 4,
    name: 'Bebidas',
    children: [
      { id: 18, name: 'Refrigerantes' },
      { id: 19, name: 'Cervejas' },
      { id: 22, name: 'Vinhos' },
    ],
  },
  { id: 20, name: 'Congelados', children: [{ id: 44, name: 'Hambúrguer' }] },
  { id: 5, name: 'Limpeza', children: [{ id: 31, name: 'Cozinha' }, { id: 32, name: 'Lavanderia' }, { id: 33, name: 'Casa Em Geral' }] },
  { id: 6, name: 'Higiene e Beleza', children: [{ id: 41, name: 'Cabelos' }] },
  { id: 7, name: 'Frios e Laticínios', children: [{ id: 51, name: 'Queijos' }] },
  { id: 8, name: 'Padaria', children: [{ id: 61, name: 'Pães' }] },
  { id: 9, name: 'Pet Shop', children: [{ id: 71, name: 'Cães' }] },
];

export const vtexBrandsMock: VtexBrand[] = [
  { id: 1, name: 'Pilar', isActive: true },
  { id: 2, name: 'Café Real', isActive: true },
  { id: 3, name: 'Nestle', isActive: true },
  { id: 4, name: 'Bauducco', isActive: true },
  { id: 5, name: 'Coca-Cola', isActive: true },
  { id: 6, name: 'Tio João', isActive: true },
  { id: 7, name: 'Kicaldo', isActive: true },
  { id: 8, name: "Hellmann's", isActive: true },
  { id: 9, name: 'Heineken', isActive: true },
  { id: 10, name: 'Ypê', isActive: true },
  { id: 11, name: 'OMO', isActive: true },
  { id: 12, name: 'Seda', isActive: true },
  { id: 13, name: 'Padaria', isActive: true },
  { id: 14, name: 'Local', isActive: true },
  { id: 15, name: 'PetLove', isActive: true },
];

export const vtexProductsMock: VtexSearchedProduct[] = [
  {
    productId: '7348',
    productName: 'Biscoito Cream Cracker Pilar Premium 350g',
  linkText: 'biscoito-cream-cracker-pilar-premium-350g-281855',
    brand: 'Pilar',
    categories: ['Mercearia', 'Bomboniere', 'Biscoito Salgado'],
    categoriesIds: ['2', '68', '674'],
    items: [
      {
        itemId: '7348-SKU',
        name: 'Biscoito Cream Cracker Pilar Premium 350g',
        referenceId: [{ Key: 'RefId', Value: '281855' }],
        images: [{ imageUrl: '//picsum.photos/192/192?random=1', imageText: 'biscoito' }],
        sellers: [{ sellerId: '1', commertialOffer: { Price: 4.19, ListPrice: 4.65, AvailableQuantity: 10 } }],
      },
    ],
  },
  {
    productId: 'mango-kg',
    productName: 'Manga Palmer',
  linkText: 'manga-palmer-kg',
    brand: 'Hortifruti',
    categories: ['Hortifruti'],
    categoriesIds: ['1'],
    items: [
      {
        itemId: 'mango-kg',
        name: 'Manga Palmer',
        images: [{ imageUrl: '//picsum.photos/192/192?random=2', imageText: 'manga' }],
        sellers: [{ sellerId: '1', commertialOffer: { Price: 5.29, ListPrice: 6.49, AvailableQuantity: 73 } }],
      },
    ],
  },
  {
    productId: 'coca-cola-8',
    productName: 'Refrigerante Coca-Cola 2L',
  linkText: 'coca-cola-2l',
    brand: 'Coca-Cola',
    categories: ['Bebidas', 'Refrigerantes', 'Cola'],
    categoriesIds: ['4', '18', '95'],
    items: [
      {
        itemId: 'coca-cola-8',
        name: 'Refrigerante Coca-Cola 2L',
        images: [{ imageUrl: '//picsum.photos/192/192?random=8', imageText: 'coca' }],
        sellers: [{ sellerId: '1', commertialOffer: { Price: 5.89, ListPrice: 6.49, AvailableQuantity: 24 } }],
      },
    ],
  },
];
