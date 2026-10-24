type BowlGuide = {
  description: string;
  portions: Record<string, string>;
  flavourings?: string[];
  prepMinutes: number;
  cookMinutes: number;
  equipment: string[];
  steps: string[];
  notes?: string;
};

// These are original, untested home-cooking guides for the starter combinations.
// Household amounts are suggestions, never measured facts about a logged meal.
export const fillingBowlGuides: Record<string, BowlGuide> = {
  'Yoghurt, strawberries & chia': {
    description:
      'A cold breakfast bowl of thick Greek yoghurt, juicy strawberries and softened chia seeds. Stir the chia into the yoghurt rather than eating the seeds dry.',
    portions: {
      '0% Greek yoghurt': 'Start with 4–6 generous spoonfuls, then adjust to your appetite.',
      Strawberries: 'A handful, washed, green tops removed and berries sliced.',
      'Chia seeds': 'Up to the programme’s 2 tbsp choice; stir into the yoghurt to soften.',
    },
    prepMinutes: 5,
    cookMinutes: 0,
    equipment: ['Bowl', 'Spoon', 'Knife and chopping board'],
    steps: [
      'Wash the strawberries, remove their green tops and slice any large berries into bite-sized pieces.',
      'Spoon the yoghurt into your bowl and stir in the chia seeds. If the mixture is very thick, loosen it with a small splash of water.',
      'Leave for about 10 minutes so the chia has time to soften, then stir again. Add another splash of water if needed.',
      'Top with the strawberries and eat when you are ready. Adjust the yoghurt and fruit amounts to make a comfortable breakfast.',
    ],
    notes: 'Allow about 10 minutes of resting time in addition to the active preparation estimate.',
  },
  'Chicken cucumber bowl': {
    description:
      'A crisp chicken salad with cucumber, lettuce and a lemon-dill yoghurt dressing. This cold version uses cooked, ready-to-eat chicken; the mayonnaise is the included fat choice.',
    portions: {
      'Chicken breast':
        'A cooked, ready-to-eat breast or a comfortable handful of cooked pieces, kept chilled. Not raw chicken.',
      '0% Greek yoghurt': '2–3 spoonfuls for the dressing, adding a little water if too thick.',
      Cucumber: 'About half a small cucumber, washed and diced.',
      Lettuce: 'A couple of handfuls, washed, dried and torn.',
      'Light mayonnaise':
        'The programme’s 1 tbsp half-fat mayonnaise choice, mixed into the dressing.',
      Lemon: 'A squeeze of juice, starting with a small wedge; add more to taste.',
      Dill: 'A small pinch of chopped fresh dill or dried dill, to taste.',
    },
    flavourings: ['Lemon', 'Dill'],
    prepMinutes: 10,
    cookMinutes: 0,
    equipment: ['Bowl', 'Small bowl for dressing', 'Spoon', 'Knife and chopping board'],
    steps: [
      'Check that the chicken is fully cooked and labelled ready to eat. Keep it chilled while preparing the vegetables; this recipe does not cook raw chicken.',
      'Wash the cucumber and lettuce. Dice the cucumber, dry the lettuce and tear it into your bowl.',
      'Stir together the yoghurt, the mayonnaise, a squeeze of lemon and the dill in a small bowl. Add a teaspoon of water at a time until it is easy to spoon.',
      'Tear or slice the cooked chicken into bite-sized pieces. Add it to the salad and spoon over the dressing.',
      'Toss gently, taste and add more lemon or dill if wanted. Serve straight away; there is no extra oil to add.',
    ],
    notes:
      'The timing assumes ready-to-eat chicken. If starting with raw chicken, cook it separately following its pack instructions, checking 75°C for 30 seconds or 70°C for 2 minutes at the centre, then cool it safely before using it in this cold salad. Allow extra cooking and cooling time.',
  },
  'Prawn broccoli konjac bowl': {
    description:
      'Garlic and soy prawns tossed with tender broccoli and well-drained konjac noodles. The sesame oil is shared across the pan cooking; a little water helps steam the broccoli.',
    portions: {
      Prawns:
        'A comfortable handful of raw, peeled prawns; thaw frozen prawns and cook according to their pack.',
      Broccoli: 'A generous handful of small florets; thinly slice the peeled stalk if using it.',
      'Konjac noodles':
        'One comfortable bowl portion, rinsed, drained and prepared as its pack directs.',
      'Sesame oil': 'Up to the programme’s 1 tbsp choice in total, for cooking and flavour.',
      'Soy sauce': 'Start with a small splash, around 1 tsp, and add to taste.',
      Garlic: 'One small clove, peeled and finely chopped, or less if preferred.',
    },
    flavourings: ['Soy sauce', 'Garlic'],
    prepMinutes: 8,
    cookMinutes: 12,
    equipment: [
      'Non-stick frying pan with lid',
      'Colander',
      'Spatula',
      'Knife and chopping board',
      'Food thermometer',
    ],
    steps: [
      'Read the prawn and noodle packs first. Thaw frozen prawns as directed. Wash and cut the broccoli into small florets and finely chop the garlic.',
      'Rinse and drain the konjac noodles, then complete any boiling or other preparation required by their pack. Drain well so they do not water down the sauce.',
      'Warm the sesame oil in a non-stick pan over medium heat. Add the broccoli and a splash of water, cover and steam for 4–5 minutes until nearly tender.',
      'Uncover, let excess water evaporate and stir in the garlic for about 30 seconds. Add the raw prawns and cook, turning, for roughly 3–5 minutes or as their pack directs, until opaque, firm and piping hot throughout. Check the thickest prawns reach 75°C for 30 seconds or 70°C for 2 minutes.',
      'Add the prepared noodles and soy sauce. Toss for about 2 minutes, until everything is piping hot; add a small splash of water if the pan starts to stick.',
      'Taste the noodles, adjust the soy sauce if wanted and serve in your bowl. The sesame oil already used is the meal’s fat choice.',
    ],
  },
  'Egg, mushroom & spinach bowl': {
    description:
      'Soft scrambled whole eggs and egg whites with mushrooms and wilted spinach. A non-stick pan and small splashes of water cook the vegetables without an additional oil choice.',
    portions: {
      'Egg whites':
        'A small pour of pasteurised egg whites, roughly 2–3 whites, adjusted to appetite.',
      Mushrooms: 'A large handful, wiped clean and thinly sliced.',
      Spinach: 'A large handful, washed and drained.',
      'Whole eggs': 'The programme’s 2 whole eggs choice, beaten together with the whites.',
      'Herbs and spices': 'A pinch of black pepper or dried mixed herbs, to taste.',
    },
    flavourings: ['Herbs and spices'],
    prepMinutes: 5,
    cookMinutes: 10,
    equipment: [
      'Non-stick frying pan with lid',
      'Bowl',
      'Fork',
      'Spatula',
      'Knife and chopping board',
    ],
    steps: [
      'Slice the mushrooms and wash the spinach. Beat the whole eggs and egg whites in a bowl with a pinch of pepper or herbs.',
      'Put the mushrooms and 2 tbsp water into a non-stick pan over medium heat. Cover for 3–4 minutes, then uncover and stir until softened, adding a little more water if they stick.',
      'Add the spinach and stir for about 1 minute until wilted. Allow any pool of water to evaporate so the eggs will not be watery.',
      'Turn the heat low and pour in the egg mixture. Slowly fold and stir for about 3–5 minutes until the eggs are set and piping hot, with no runny egg remaining.',
      'Slide into your bowl and eat straight away. The whole eggs provide the listed fat choice, so no cooking oil is needed.',
    ],
  },
  'Tuna kimchi bowl': {
    description:
      'A crunchy, cold tuna salad with cucumber, carrot and tangy kimchi, brought together with a yoghurt-mayonnaise dressing. Use ready-to-eat tinned tuna rather than raw tuna.',
    portions: {
      Tuna: 'A small tin of ready-to-eat tuna in spring water or brine, well drained, or an amount that suits you.',
      '0% Greek yoghurt': '2–3 spoonfuls to bind the tuna and mayonnaise.',
      Cucumber: 'About half a small cucumber, diced.',
      Carrots: 'One small carrot, washed, trimmed and grated.',
      Kimchi: 'A spoonful or two, chopped if the pieces are large; check the label for allergens.',
      Lettuce: 'A couple of handfuls, washed, dried and torn.',
      'Light mayonnaise': 'The programme’s 1 tbsp half-fat mayonnaise choice, mixed into the tuna.',
    },
    prepMinutes: 10,
    cookMinutes: 0,
    equipment: [
      'Bowl',
      'Small mixing bowl',
      'Fork',
      'Grater',
      'Knife and chopping board',
      'Tin opener if needed',
    ],
    steps: [
      'Drain the tuna well and flake it with a fork. Stir it together with the yoghurt and mayonnaise in a small bowl.',
      'Wash the vegetables. Tear and dry the lettuce, dice the cucumber and grate the carrot.',
      'Put the lettuce, cucumber and carrot in your eating bowl. Add the kimchi, chopping it first if needed.',
      'Spoon the creamy tuna over the vegetables and mix gently. Taste before adding more kimchi, because its flavour and saltiness vary by product.',
    ],
  },
  'Chicken courgette bowl': {
    description:
      'Lemon-garlic chicken with golden courgette and quick cauliflower rice. Cook the chicken first, then use the same pan for the vegetables and bring everything together at the end.',
    portions: {
      'Chicken breast': 'One small raw breast or a comfortable portion, cut into even 2 cm pieces.',
      Courgette: 'One small courgette, washed and sliced into thin half-moons.',
      Cauliflower:
        'A couple of handfuls of florets, coarsely grated or finely chopped into rice-sized pieces.',
      'Olive oil':
        'Up to the programme’s 1 tbsp in total: half for the chicken, half for the vegetables.',
      Garlic: 'One small clove, peeled and finely chopped.',
      Lemon: 'A wedge or two to squeeze over the finished bowl.',
      'Herbs and spices': 'A pinch of paprika, dried oregano or black pepper, to taste.',
    },
    flavourings: ['Garlic', 'Lemon', 'Herbs and spices'],
    prepMinutes: 10,
    cookMinutes: 18,
    equipment: [
      'Non-stick frying pan',
      'Spatula',
      'Grater or food processor',
      'Knife and chopping boards',
      'Clean plate',
      'Food thermometer',
    ],
    steps: [
      'Wash and cut the courgette, grate the cauliflower and chop the garlic before handling the chicken. On a separate board, cut the raw chicken into even 2 cm pieces; wash hands and equipment after handling it. Do not wash raw chicken.',
      'Heat half of the olive oil in a non-stick pan over medium-high heat. Add the chicken in a single layer with the paprika, oregano or pepper.',
      'Cook the chicken for roughly 8–10 minutes, turning regularly, until piping hot throughout. Check a thick piece reaches 75°C for 30 seconds or 70°C for 2 minutes. Transfer the cooked chicken to a clean plate.',
      'Add the remaining olive oil to the pan. Cook the courgette for 3–4 minutes, stirring, then add the garlic for 30 seconds.',
      'Add the cauliflower rice and a splash of water. Stir for 3–4 minutes until tender but still slightly firm; let excess moisture evaporate. Return the cooked chicken and its juices, stirring until everything is hot.',
      'Spoon into your bowl and finish with a squeeze of lemon. Taste and adjust the listed herbs or spices; no extra oil is required.',
    ],
  },
  'Cottage cheese & cantaloupe': {
    description:
      'A cool, simple breakfast of cottage cheese, sweet cantaloupe and crunchy almonds. Keep the melon in bite-sized pieces so you get a little of each ingredient in a spoonful.',
    portions: {
      '0% cottage cheese': 'Start with 4–6 generous spoonfuls and adjust to appetite.',
      Cantaloupe: 'A comfortable wedge, rind and seeds removed, then cubed.',
      Almonds: 'Up to the programme’s 20-almond choice, roughly chopped if preferred.',
    },
    prepMinutes: 5,
    cookMinutes: 0,
    equipment: ['Bowl', 'Spoon', 'Knife and chopping board'],
    steps: [
      'Wash the outside of the melon before cutting it. Cut off a wedge, scoop out the seeds and remove the rind.',
      'Cut the melon flesh into bite-sized cubes. Roughly chop the almonds if you prefer smaller crunchy pieces.',
      'Spoon the cottage cheese into your bowl. Add the melon and scatter the almonds over the top, or fold them through.',
    ],
  },
  'Chicken cabbage bowl': {
    description:
      'A crunchy chicken slaw with cucumber, sliced olives and a sharp lemon-mustard dressing. The olives are the fat choice; the dressing uses no additional oil.',
    portions: {
      'Chicken breast':
        'A cooked, ready-to-eat breast or handful of cooked pieces, kept chilled. Not raw chicken.',
      Cabbage:
        'A couple of handfuls, washed and very finely shredded; remove the tough central core.',
      Cucumber: 'About half a small cucumber, washed and cut into thin half-moons.',
      Olives: 'Up to the programme’s 20-olive choice; use pitted olives and slice them.',
      Lemon: 'A wedge or two for juice, starting with a small squeeze.',
      Mustard: 'Around 1 tsp, or less to taste; check the label for allergens.',
    },
    flavourings: ['Lemon', 'Mustard'],
    prepMinutes: 10,
    cookMinutes: 0,
    equipment: ['Bowl', 'Small bowl for dressing', 'Fork', 'Knife and chopping board'],
    steps: [
      'Use fully cooked chicken labelled ready to eat and keep it chilled while you prepare the salad. This cold recipe does not cook raw chicken.',
      'Remove the cabbage core and shred the leaves very finely. Wash, drain and place in your bowl with the sliced cucumber.',
      'Mix the mustard with a squeeze of lemon and 1–2 tsp water. Toss this through the cabbage and cucumber, then leave for 2–3 minutes to soften the cabbage slightly.',
      'Tear the cooked chicken into pieces and add it with the sliced pitted olives. Toss again, taste and adjust the lemon or mustard before serving.',
    ],
    notes:
      'The timing assumes ready-to-eat chicken. If starting with raw chicken, cook separately following its pack instructions, checking 75°C for 30 seconds or 70°C for 2 minutes at the centre, and cool safely before assembling the salad. Allow extra time. No oil is needed in the dressing.',
  },
  'Tilapia pumpkin bowl': {
    description:
      'A lemon-herb tilapia traybake with soft roasted pumpkin and broccoli. The pumpkin starts roasting first so the fish can be added later without drying out.',
    portions: {
      Tilapia:
        'One boneless raw fillet or a comfortable portion; thaw frozen fish as the pack directs.',
      Pumpkin: 'A couple of handfuls, peeled, deseeded and cut into even 2 cm cubes.',
      Broccoli: 'A generous handful of small florets.',
      'Olive oil':
        'Up to the programme’s 1 tbsp total: roughly 2 tsp for vegetables and 1 tsp for fish.',
      Lemon: 'A wedge or two, for a little juice before cooking and at the table.',
      Garlic: 'One small clove, finely chopped or crushed.',
      'Herbs and spices': 'A pinch of dried mixed herbs or paprika, to taste.',
    },
    flavourings: ['Lemon', 'Garlic', 'Herbs and spices'],
    prepMinutes: 10,
    cookMinutes: 40,
    equipment: [
      'Oven',
      'Baking tray or roasting dish',
      'Spatula',
      'Knife and chopping board',
      'Food thermometer',
    ],
    steps: [
      'Heat the oven to 200°C / 180°C fan. Read the fish pack for any different cooking instructions and thaw frozen fish as directed. Peel and deseed the pumpkin, then cut it into even 2 cm cubes.',
      'Toss the pumpkin on the tray with about half the vegetable share of the olive oil and the herbs or paprika. Spread out and roast for about 20 minutes, turning once.',
      'Cut the broccoli into small florets and coat lightly with the rest of the vegetable oil. Mix the fish share of oil with the garlic and a small squeeze of lemon.',
      'Add the broccoli to the tray. Make space for the fish, lay it flat and spread the lemon-garlic mixture over it. Wash hands and utensils after handling raw fish.',
      'Roast for about 12–18 minutes more, or follow the fish pack timing if different. The pumpkin should be fork-tender and the broccoli tender. The fish must be piping hot, opaque and flake easily; check its thickest part reaches 75°C for 30 seconds or 70°C for 2 minutes. Return any underdone component to the oven.',
      'Serve the fish and vegetables in your bowl with another squeeze of lemon if wanted. All cooking oil is included in the listed tablespoon.',
    ],
  },
  'Strawberry jelly yoghurt bowl': {
    description:
      'A cold layered breakfast with strawberry pieces, set sugar-free jelly and chia yoghurt. Use ready-set jelly or prepare it ahead of time so the bowl takes only a few minutes to assemble.',
    portions: {
      '0% Greek yoghurt': 'Start with 4–6 generous spoonfuls and adjust to appetite.',
      Strawberries: 'A handful, washed, green tops removed and sliced.',
      'Sugar-free jelly':
        'A few spoonfuls of ready-set jelly; if using powder, prepare and chill it according to the pack first.',
      'Chia seeds': 'Up to the programme’s 2 tbsp choice, stirred into the yoghurt to soften.',
    },
    prepMinutes: 5,
    cookMinutes: 0,
    equipment: ['Bowl', 'Spoon', 'Knife and chopping board'],
    steps: [
      'Use cold, fully set jelly. If yours is a powder or concentrate, make it according to its pack and allow the full setting time before starting this bowl.',
      'Stir the chia into the yoghurt with a small splash of water if needed. Leave for about 10 minutes, then stir again so the seeds soften evenly.',
      'Wash and slice the strawberries. Cut or spoon the set jelly into bite-sized pieces.',
      'Layer the chia yoghurt, strawberries and jelly in your bowl. Keep the layers separate or fold them together gently before eating.',
    ],
    notes:
      'The preparation estimate excludes about 10 minutes for chia to soften and any jelly preparation or setting time; check the jelly pack well ahead of the meal.',
  },
  'Prawn avocado salad bowl': {
    description:
      'A cold prawn salad with cucumber, lettuce and creamy lemon-dill avocado dressing. This version uses cooked, ready-to-eat prawns; all of the avocado belongs to the single listed fat choice.',
    portions: {
      Prawns:
        'A comfortable handful of cooked, ready-to-eat peeled prawns, kept chilled. Thaw frozen ready-to-eat prawns as their pack directs; not raw prawns.',
      Lettuce: 'A couple of handfuls, washed, dried and torn.',
      Cucumber: 'About half a small cucumber, washed and diced.',
      Avocado:
        'The programme’s ½ avocado choice; mash half of this portion for dressing and dice the rest.',
      Lemon: 'A wedge or two to squeeze into the avocado.',
      Dill: 'A small pinch of chopped fresh or dried dill, to taste.',
    },
    flavourings: ['Lemon', 'Dill'],
    prepMinutes: 10,
    cookMinutes: 0,
    equipment: ['Bowl', 'Small bowl for dressing', 'Fork', 'Knife and chopping board'],
    steps: [
      'Check the prawns are fully cooked and labelled ready to eat. Thaw frozen ready-to-eat prawns only as the pack directs and keep them chilled while preparing the salad.',
      'Wash and dry the lettuce, tear it into the bowl and add the diced cucumber.',
      'Remove the stone and skin from your half avocado. Mash half of that portion in a small bowl with a squeeze of lemon and the dill. Stir in a teaspoon of water at a time until it makes a spoonable dressing.',
      'Dice the rest of the avocado. Add it and the cooked prawns to the lettuce and cucumber.',
      'Spoon over the avocado dressing, toss gently and serve. Add more lemon to taste; no additional mayonnaise or oil is required.',
    ],
    notes:
      'The timing assumes cooked ready-to-eat prawns. For raw prawns, thaw and cook separately following their pack, until opaque, firm and piping hot throughout (75°C for 30 seconds or 70°C for 2 minutes at the centre), then cool safely before assembling this cold salad. Allow extra time.',
  },
  'Chicken konjac vegetable bowl': {
    description:
      'A garlic-soy chicken noodle bowl with broccoli, carrot and cauliflower. Prepare and drain the konjac noodles before stir-frying, and cook the chicken separately from the quick-steamed vegetables.',
    portions: {
      'Chicken breast': 'One small raw breast or a comfortable portion, cut into even thin strips.',
      'Konjac noodles':
        'One comfortable bowl portion, rinsed, drained and prepared as its pack directs.',
      Broccoli: 'A handful of small florets; thinly slice any peeled stalk.',
      Carrots: 'One small carrot, washed and cut into thin matchsticks.',
      Cauliflower: 'A handful of small florets, sliced thinner if very chunky.',
      'Sesame oil': 'Up to the programme’s 1 tbsp total; divide between chicken and vegetables.',
      'Soy sauce': 'Start with a small splash, around 1 tsp, then adjust to taste.',
      Garlic: 'One small clove, peeled and finely chopped.',
    },
    flavourings: ['Soy sauce', 'Garlic'],
    prepMinutes: 15,
    cookMinutes: 20,
    equipment: [
      'Non-stick frying pan or wok with lid',
      'Colander',
      'Spatula',
      'Knife and chopping boards',
      'Clean plate',
      'Food thermometer',
    ],
    steps: [
      'Read the noodle pack. Rinse, prepare and drain the noodles as directed. Wash and cut all vegetables into small pieces and chop the garlic before handling raw chicken.',
      'Cut the chicken into even thin strips on a separate board. Wash hands and equipment after handling it; do not wash raw chicken.',
      'Warm half the sesame oil in the pan over medium-high heat. Stir-fry the chicken for roughly 6–10 minutes, turning until piping hot throughout and its thickest pieces reach 75°C for 30 seconds or 70°C for 2 minutes. Move the cooked chicken to a clean plate.',
      'Add the remaining oil and the garlic to the pan and stir for about 30 seconds. Add the broccoli, carrot and cauliflower with a splash of water, cover and steam for 5–7 minutes, stirring occasionally, until tender.',
      'Uncover and let excess water evaporate. Add the prepared noodles, cooked chicken and soy sauce. Toss for about 2 minutes until everything is piping hot, adding a splash of water if it sticks.',
      'Taste and adjust the soy sauce if needed, then serve. The sesame oil already in the pan is the complete fat choice.',
    ],
  },
  'Egg, mushroom & pumpkin bowl': {
    description:
      'A warm breakfast scramble with tender pumpkin cubes and mushrooms. Steam the pumpkin in a covered non-stick pan before adding the eggs; no extra frying oil is needed.',
    portions: {
      'Egg whites':
        'A small pour of pasteurised egg whites, roughly 2–3 whites, adjusted to appetite.',
      Mushrooms: 'A large handful, wiped clean and thinly sliced.',
      Pumpkin:
        'A handful or two, peeled, deseeded and cut into small 1 cm cubes so they soften quickly.',
      'Whole eggs': 'The programme’s 2 whole eggs choice, beaten together with the whites.',
      'Herbs and spices': 'A pinch of paprika or black pepper, to taste.',
    },
    flavourings: ['Herbs and spices'],
    prepMinutes: 10,
    cookMinutes: 20,
    equipment: [
      'Non-stick frying pan with lid',
      'Bowl',
      'Fork',
      'Spatula',
      'Knife and chopping board',
    ],
    steps: [
      'Peel and deseed the pumpkin and cut into even 1 cm cubes. Slice the mushrooms. Beat the whole eggs and egg whites together with paprika or pepper.',
      'Put the pumpkin and a shallow splash of water in a non-stick pan over medium heat. Cover and steam for about 10–12 minutes, checking and adding more water as needed, until a fork goes through the cubes easily.',
      'Add the mushrooms and another small splash of water if the pan is dry. Cook uncovered for 3–4 minutes, stirring, until softened and excess water has evaporated.',
      'Lower the heat. Add the beaten eggs and gently fold with a spatula for 3–5 minutes until set and piping hot, with no runny egg remaining.',
      'Serve in your bowl. The whole eggs are the fat choice; use water to prevent sticking rather than adding an unlisted oil.',
    ],
  },
  'Creamy chicken cauliflower bowl': {
    description:
      'Gently poached chicken, cauliflower and carrots in a light cream-cheese sauce. Mash a little cooked cauliflower into the sauce for extra body; no oil or cream is added.',
    portions: {
      'Chicken breast': 'One small raw breast or a comfortable portion, cut into even thin strips.',
      Cauliflower:
        'A couple of handfuls of small florets; reserve a few cooked florets to mash into the sauce.',
      Carrots: 'One small carrot, washed and thinly sliced.',
      'Light cream cheese':
        'The programme’s 2 tbsp choice, loosened with hot vegetable cooking water.',
      Garlic: 'One small clove, peeled and finely chopped.',
      'Herbs and spices': 'A pinch of dried mixed herbs or black pepper, to taste.',
    },
    flavourings: ['Garlic', 'Herbs and spices'],
    prepMinutes: 10,
    cookMinutes: 25,
    equipment: [
      'Wide saucepan or deep non-stick pan with lid',
      'Slotted spoon',
      'Small bowl',
      'Fork',
      'Knife and chopping boards',
      'Clean plate',
      'Food thermometer',
    ],
    steps: [
      'Wash and cut the cauliflower and carrot into small pieces and chop the garlic. On a separate board cut the raw chicken into even thin strips; wash hands and equipment afterwards. Do not wash raw chicken.',
      'Put the chicken in the pan with enough water to just cover. Bring to a gentle simmer and cook for roughly 8–12 minutes, until piping hot throughout and the thickest pieces reach 75°C for 30 seconds or 70°C for 2 minutes. Lift onto a clean plate and cover.',
      'Add the cauliflower, carrot, garlic and herbs to the simmering cooking liquid, topping up with water if needed. Cover and simmer for 8–10 minutes until the vegetables are tender.',
      'Lift a few cauliflower florets into a small bowl and mash with a fork. Mix in the light cream cheese and a few spoonfuls of hot cooking liquid to make a smooth, spoonable sauce.',
      'Drain the remaining vegetables, reserving a little liquid. Return vegetables, cooked chicken and sauce to the pan. Warm gently for 2–3 minutes until everything is piping hot; loosen with reserved liquid if too thick.',
      'Taste, adjust the listed herbs or pepper and spoon into your bowl. The cream cheese is the included fat choice, so there is no extra oil or butter to add.',
    ],
  },
  'Cottage cheese & watermelon': {
    description:
      'Cold watermelon and cottage cheese with chopped almonds: a juicy, crunchy breakfast that needs no cooking. Drain excess melon juice before assembling if you prefer a thicker bowl.',
    portions: {
      '0% cottage cheese': 'Start with 4–6 generous spoonfuls, then adjust to appetite.',
      Watermelon:
        'A comfortable wedge, rind removed and flesh cut into small cubes; remove hard seeds.',
      Almonds: 'Up to the programme’s 20-almond choice; chop roughly if preferred.',
    },
    prepMinutes: 5,
    cookMinutes: 0,
    equipment: ['Bowl', 'Spoon', 'Knife and chopping board'],
    steps: [
      'Wash the outside of the watermelon before cutting. Cut off a wedge, remove the rind and any hard seeds, then dice the flesh into bite-sized cubes.',
      'Spoon the cottage cheese into your bowl. If the melon has released a lot of juice, drain it before adding the cubes.',
      'Roughly chop the almonds if wanted, scatter over the top and eat while the melon and cottage cheese are cold.',
    ],
  },
  'Chicken avocado salad bowl': {
    description:
      'A filling cold chicken salad with crisp lettuce, cucumber and avocado, finished with lemon and mustard. This recipe uses cooked, ready-to-eat chicken and the avocado replaces an oily dressing.',
    portions: {
      'Chicken breast':
        'A cooked, ready-to-eat breast or handful of cooked pieces, kept chilled. Not raw chicken.',
      Lettuce: 'A couple of handfuls, washed, dried and torn.',
      Cucumber: 'About half a small cucumber, washed and cut into bite-sized chunks.',
      Avocado: 'The programme’s ½ avocado choice, stone and skin removed and flesh sliced.',
      Lemon: 'A wedge or two for juice, starting with a small squeeze.',
      Mustard: 'Around 1 tsp, or less to taste; check the label for allergens.',
      'Herbs and spices': 'A pinch of black pepper or dried mixed herbs, to taste.',
    },
    flavourings: ['Lemon', 'Mustard', 'Herbs and spices'],
    prepMinutes: 10,
    cookMinutes: 0,
    equipment: ['Bowl', 'Small bowl for dressing', 'Fork', 'Knife and chopping board'],
    steps: [
      'Use fully cooked chicken labelled ready to eat. Keep it chilled while washing and preparing the vegetables; this cold recipe does not cook raw chicken.',
      'Wash and dry the lettuce, tear it into your bowl and add the cucumber chunks. Slice the cooked chicken into bite-sized pieces.',
      'Mix the mustard with a squeeze of lemon, the herbs or pepper and 1–2 tsp water to make a light dressing.',
      'Remove the avocado stone and skin, slice your half avocado and add it with the chicken. Spoon over the dressing and toss gently so a little avocado coats the leaves.',
      'Taste and add more lemon if wanted, then serve. The half avocado is the whole fat choice; no extra oil is needed.',
    ],
    notes:
      'The timing assumes ready-to-eat chicken. If starting with raw chicken, cook separately following its pack instructions, checking 75°C for 30 seconds or 70°C for 2 minutes at the centre, then cool safely before using it in this salad. Allow extra cooking and cooling time.',
  },
  'Prawn courgette cabbage bowl': {
    description:
      'Quick garlic-soy prawns with thinly sliced courgette and cabbage. Steam the vegetables briefly, then cook the prawns in the same pan and toss everything together with sesame flavour.',
    portions: {
      Prawns:
        'A comfortable handful of raw, peeled prawns; thaw frozen prawns and cook as their pack directs.',
      Courgette: 'One small courgette, washed and cut into thin half-moons.',
      Cabbage: 'A couple of handfuls, washed and finely shredded, with the tough core removed.',
      'Sesame oil':
        'Up to the programme’s 1 tbsp in total; half for vegetables and half for prawns.',
      Garlic: 'One small clove, peeled and finely chopped.',
      'Soy sauce': 'Start with a small splash, around 1 tsp, then adjust to taste.',
      Lemon: 'An optional small squeeze of juice to finish.',
    },
    flavourings: ['Garlic', 'Soy sauce', 'Lemon'],
    prepMinutes: 10,
    cookMinutes: 12,
    equipment: [
      'Non-stick frying pan or wok with lid',
      'Spatula',
      'Knife and chopping board',
      'Clean plate',
      'Food thermometer',
    ],
    steps: [
      'Check the prawn pack and thaw frozen prawns as directed. Wash and thinly slice the courgette and cabbage, and finely chop the garlic.',
      'Heat half the sesame oil over medium heat. Add the courgette and cabbage with a splash of water, cover for 3–4 minutes and then stir uncovered for 1–2 minutes until just tender. Transfer the vegetables to a clean plate.',
      'Add the remaining sesame oil and the garlic to the pan. Stir for about 30 seconds, then add the raw prawns. Cook, turning, for roughly 3–5 minutes or as their pack directs, until opaque, firm and piping hot throughout; check thick prawns reach 75°C for 30 seconds or 70°C for 2 minutes.',
      'Return the vegetables to the pan with a splash of soy sauce. Toss for about 1 minute until everything is piping hot. Add a teaspoon of water if the pan becomes dry.',
      'Taste and finish with a little lemon juice if wanted. Serve in your bowl; the measured-out sesame oil already covers cooking and flavouring.',
    ],
  },
  'Tilapia squash bowl': {
    description:
      'Tomato-herb tilapia with roasted squash and broccoli. A small amount of tomato sauce keeps the top of the fish moist while the vegetables finish roasting.',
    portions: {
      Tilapia:
        'One boneless raw fillet or a comfortable portion; thaw frozen fish as its pack directs.',
      Squash: 'A couple of handfuls, peeled, deseeded and cut into even 2 cm cubes.',
      Broccoli: 'A generous handful of small florets.',
      'Olive oil':
        'Up to the programme’s 1 tbsp total, divided between the squash, broccoli and fish.',
      'Tomato sauce':
        'A few spoonfuls of plain tomato sauce, enough to lightly coat the fish; check the product label.',
      Garlic: 'One small clove, peeled and finely chopped.',
      'Herbs and spices': 'A pinch of dried oregano or mixed herbs, and paprika if wanted.',
    },
    flavourings: ['Tomato sauce', 'Garlic', 'Herbs and spices'],
    prepMinutes: 10,
    cookMinutes: 40,
    equipment: [
      'Oven',
      'Baking tray or roasting dish',
      'Small bowl',
      'Spoon',
      'Knife and chopping board',
      'Food thermometer',
    ],
    steps: [
      'Heat the oven to 200°C / 180°C fan. Check the fish pack for any different cooking instructions and thaw frozen fish as directed. Peel and deseed the squash and cut it into even 2 cm cubes.',
      'Toss the squash with about half of the olive oil on the tray and spread it out. Roast for about 20 minutes, turning once.',
      'Cut the broccoli into small florets and coat with most of the remaining olive oil. Mix the tomato sauce, garlic and herbs in a small bowl.',
      'Add the broccoli to the tray and make space for the fish. Rub the last little oil under the fillet to reduce sticking, lay it flat and spoon the tomato-herb sauce over the top. Wash hands and utensils after handling raw fish.',
      'Roast for about 12–18 minutes more, or follow the fish pack if its timing differs. The squash should be fork-tender and the fish piping hot, opaque and flaking easily. Check the thickest part of the fish reaches 75°C for 30 seconds or 70°C for 2 minutes; return anything underdone to the oven.',
      'Lift the fish, vegetables and tomato cooking juices into your bowl. The total olive oil already includes the oil used under the fish and on the vegetables.',
    ],
  },
};

export const fillingBowlRecipeNotes =
  'Optional household amounts are starting points for one bowl, not recorded quantities or nutrition. Choose amounts that suit your appetite. Preparation and cooking times are estimates; ingredient size, equipment and product instructions can change them. These cooking guides were independently developed for FORM from the starter food combinations and have not been kitchen-tested or supplied as tested recipes by the video creator. Food-safety reference: https://www.food.gov.uk/safety-hygiene/cooking-your-food';
