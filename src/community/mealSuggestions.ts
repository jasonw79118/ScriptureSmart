import type { DietaryNeed, Dish } from './models';
export const commonFoods = [
  'Milk',
  'Egg',
  'Fish',
  'Crustacean shellfish',
  'Tree nuts',
  'Peanuts',
  'Wheat',
  'Soy',
  'Sesame',
  'Gluten',
];
export interface Pairing {
  name: string;
  category: 'side' | 'dessert';
  details: string;
  allergens: string[];
}
const fruit: Pairing = {
  name: 'Fresh fruit platter',
  category: 'dessert',
  details:
    'Seasonal fruit, served separately from toppings. Confirm individual fruit restrictions.',
  allergens: [],
};
export function suggestPairings(main: string): Pairing[] {
  if (!main.trim()) return [];
  if (/taco|enchilada|fajita|mexican|burrito/i.test(main))
    return [
      {
        name: 'Cilantro-lime rice',
        category: 'side',
        details: 'Confirm broth and seasoning ingredients.',
        allergens: [],
      },
      {
        name: 'Black beans and corn salad',
        category: 'side',
        details: 'Serve dressing separately; verify every ingredient.',
        allergens: [],
      },
      {
        name: 'Cinnamon cookies',
        category: 'dessert',
        details:
          'Typical recipes include flour, butter, and eggs; verify the recipe.',
        allergens: ['Wheat', 'Gluten', 'Milk', 'Egg'],
      },
      fruit,
    ];
  if (/pasta|lasagna|spaghetti|pizza/i.test(main))
    return [
      {
        name: 'Mixed green salad',
        category: 'side',
        details: 'Offer dressing, cheese, and croutons separately.',
        allergens: [],
      },
      {
        name: 'Garlic bread',
        category: 'side',
        details: 'Typical bread and butter ingredients need checking.',
        allergens: ['Wheat', 'Gluten', 'Milk'],
      },
      {
        name: 'Roasted vegetables',
        category: 'side',
        details: 'Confirm oil, seasonings, and preparation surfaces.',
        allergens: [],
      },
      fruit,
    ];
  if (/bbq|barbecue|brisket|burger|pulled|ribs/i.test(main))
    return [
      {
        name: 'Vinegar slaw',
        category: 'side',
        details: 'Use a vinegar dressing; check prepared condiments.',
        allergens: [],
      },
      {
        name: 'Roasted potatoes',
        category: 'side',
        details: 'Check seasonings and keep toppings separate.',
        allergens: [],
      },
      {
        name: 'Brownies',
        category: 'dessert',
        details:
          'Typical recipes contain eggs, milk, and wheat; chocolate may contain soy.',
        allergens: ['Wheat', 'Gluten', 'Milk', 'Egg', 'Soy'],
      },
      fruit,
    ];
  return [
    {
      name: 'Seasonal roasted vegetables',
      category: 'side',
      details: 'Adapt vegetables to the menu and declared restrictions.',
      allergens: [],
    },
    {
      name: 'Rice pilaf',
      category: 'side',
      details:
        'Verify broth; common recipes use butter and may include wheat pasta.',
      allergens: ['Milk', 'Wheat', 'Gluten'],
    },
    {
      name: 'Green salad with dressing on the side',
      category: 'side',
      details: 'Keep cheese, nuts, and croutons separate; check dressing.',
      allergens: [],
    },
    fruit,
  ];
}
const normalize = (s: string) => s.toLowerCase().trim();
const aliases: Record<string, string[]> = {
  milk: ['milk', 'dairy', 'lactose', 'butter', 'cheese', 'cream', 'yogurt'],
  egg: ['egg', 'eggs', 'mayonnaise'],
  wheat: ['wheat', 'flour', 'bread', 'pasta'],
  gluten: ['gluten', 'wheat', 'barley', 'rye', 'flour', 'bread', 'pasta'],
  soy: ['soy', 'soybean', 'soybeans', 'tofu'],
  peanuts: ['peanut', 'peanuts'],
  'tree nuts': [
    'tree nut',
    'tree nuts',
    'almond',
    'walnut',
    'pecan',
    'cashew',
    'pistachio',
  ],
  'crustacean shellfish': ['shellfish', 'shrimp', 'crab', 'lobster', 'prawn'],
  fish: ['fish', 'salmon', 'tuna', 'cod'],
  sesame: ['sesame', 'tahini'],
};
export function conflicts(
  dish: Pick<Dish, 'name' | 'allergens' | 'ingredients'>,
  needs: DietaryNeed[],
): string[] {
  const tags = (dish.allergens ?? []).map(normalize);
  const content = normalize(`${dish.name} ${dish.ingredients ?? ''}`);
  return [
    ...new Set(
      needs
        .filter((n) => n.consent)
        .flatMap((n) => n.foods)
        .filter((food) => {
          const f = normalize(food);
          const canonical = Object.keys(aliases).find(
            (k) => k === f || aliases[k].includes(f),
          );
          const words = canonical ? aliases[canonical] : [f];
          return (
            tags.some(
              (t) =>
                t === f ||
                t === canonical ||
                words.includes(t) ||
                (canonical === 'gluten' && t === 'wheat'),
            ) ||
            words.some((w) =>
              new RegExp(
                `\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
                'i',
              ).test(content),
            )
          );
        }),
    ),
  ];
}
