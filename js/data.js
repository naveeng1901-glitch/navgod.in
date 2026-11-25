/* =========================================================
   NAVGOD: content map
   Hall names are placeholders: change `title` freely.
   aspect = cover width / height, n = number of pages in the project gallery
   ========================================================= */
export const WORKS = {
  altura:    { title: 'Altura', hook: 'The mountain comes to your cup',                   cat: 'Packaging',            color: '#8fc1b5', aspect: .793, n: 10, case: 'altura', desc: "Mountain Dip tea. Each tea bag is cut like one of India's peaks and sits on the rim of your cup: the mountain comes to you." },
  kazaar:    { title: 'Kazaar', hook: 'A monsoon gin from Assam',                   cat: 'Packaging · Branding', color: '#c9a04a', aspect: 1.376, n: 4, case: 'kazaar', desc: 'A monsoon gin distilled in Assam, pulling from Kaziranga\'s rain, rhinos and botanicals: earthy, wild and a little mysterious.' },
  cheese:    { title: 'Eleftheria', hook: 'Break the word, share the wheel',              cat: 'Packaging',            color: '#e8c95a', aspect: 1.965, n: 10, case: 'eleftheria', desc: 'Break the word, share the wheel. Six wedge cartons spell C-H-E-E-S-E; pull one out and the sticker stays in the centre.' },
  donuts:    { title: 'Donut Protocol', hook: 'Don\u2019t open. Okay fine\u2026 open.',           cat: 'Packaging',            color: '#e3a23b', aspect: .903, n: 6, case: 'donut', desc: '"Don\'t open. Okay fine… open." A donut box with a sense of humour.' },
  misty:     { title: 'Misty Matches', hook: 'One strike, a pattern per box',            cat: 'Packaging',            color: '#d81b60', aspect: 1.412, n: 2, case: 'misty', desc: 'One strike, a pattern per box. A 70s-disco matchbox series in neon pink on black: collect the set.' },
  playable:  { title: 'Playable', hook: 'Made to be played in',        cat: 'Packaging',            color: '#a41e22', aspect: .922, n: 4, case: 'playable', desc: 'Made to be played in. The tee ships in a kraft box cut as its own hanger: hang it, carry it, play in it.' },
  brain:     { title: 'Brain 2.0', hook: 'Archives for the future',                cat: 'Brand Identity',       color: '#b9a493', aspect: 1.777, n: 10, case: 'brain', wall: { bg: '#5e4a3a', edge: '#efe7da', logo: ['logo.png', 2.606, 4.4, .8], pieces: [['01.jpg', 1.777, 0, 0, 3.95], ['02.jpg', .667, -2.935, 0, 1.48], ['04.jpg', .8, 2.645, .549, .9], ['03.jpg', 1, 2.645, -.6615, .9]] }, desc: 'Archives for the future. A calm brand for a tool that remembers what matters, because brains forget and systems don\'t.' },
  forkyeah:  { title: 'Fork Yeah', hook: 'Dig in!',                cat: 'Identity · Posters',   color: '#f07c1f', aspect: 1.777, n: 9, case: 'forkyeah', wall: { z: -3.0, bg: '#147d92', edge: '#fbf5e6', logo: ['logo.png', .833, 4.6, 1.35], pieces: [['01.jpg', 1.777, 0, 0, 3.95], ['02.jpg', .667, -2.935, 0, 1.48], ['04.jpg', .8, 2.645, .549, .9], ['03.jpg', 1, 2.645, -.6615, .9]] }, desc: 'Identity and poster series for a street-food festival in Portugal. Loud lettering, a parrot with a fork, and a lot of "Dig in!"' },
  meghalaya: { title: 'Ryndia Runway', hook: 'Dressed by nature',            cat: 'Campaign',             color: '#a8392c', aspect: .667, n: 3, case: 'ryndia',
    runway: { key: 'key.jpg', models: [['m1.png', .303, 1.93], ['m2.png', .275, 1.76], ['m3.png', .332, 1.72], ['m4.png', .404, 1.74]],
      backdrop: 'backdrop.jpg',
      creatives: [] },   // (no posters on the walls: the runway, the avenue and the hills say it; the six artworks live in the case study)
    desc: 'Meghalaya Tourism: an open-air fashion show in the hills, woven from Ryndia silk. Dressed by nature.' },
  axe:       { title: 'Axe: Creative Connection', hook: 'Make your scent worth wearing', cat: 'Advertising',          color: '#1d7a7a', aspect: 1.333, n: 5, desc: 'An ashtray and a cloth hanger, joined by one idea: smoke sticks to clothes, so make your scent worth wearing.' },
  concert:   { title: 'The Concert Times', hook: 'A front page for Lollapalooza India',        cat: 'Editorial',            color: '#f0675a', aspect: 1.285, n: 1, desc: 'A newspaper front page for Lollapalooza India 2026.' },
  daily:     { title: 'Everyday Artefacts', hook: 'An unnecessarily emotional lookbook',       cat: 'Editorial · Lookbook', color: '#8d8f7c', aspect: 1, n: 10, book: { n: 19, aspect: 1, h: .44, thick: .012, cover: '#d9d5cc', mk: [['mk1.jpg', 1.5], ['mk2.jpg', .8], ['mk3.jpg', 1.5]] }, desc: 'An unnecessarily emotional lookbook for DailyObjects.' },
  inked:     { title: 'INKED', hook: 'The body is the canvas',                    cat: 'Editorial · Magazine', color: '#3a2a22', aspect: .707, n: 2, book: { mode: 'covers', n: 2, aspect: .707, h: .54, thick: .004, cover: '#1a1411', mk: [['mk1.jpg', 1.5], ['mk2.jpg', .8], ['mk3.jpg', 1.5]] }, desc: 'Film X Fashion: the visual language of Toxic turned into a fashion magazine about body art. The body is the canvas.' },
  characters:{ title: 'The Characters', hook: 'The most played songs of all time',           cat: 'Editorial · Magazine', color: '#b25f78', aspect: .764, n: 4, book: { n: 7, aspect: .764, h: .54, thick: .008, cover: '#111111', mk: [['mk1.jpg', 1.5], ['mk2.jpg', 1.5]] }, desc: 'A magazine from pencil masthead to print: Top 10, the most played songs of all time.' },
  donutbook: { title: 'Donut Protocol, the book', hook: 'Unfolds like the box', cat: 'Editorial · Fold-out', color: '#6b4a1f', aspect: 1, n: 6, book: { mode: 'fold', n: 5, aspect: 1, h: .36, thick: .006, cover: '#4b4310', mk: [['mk1.jpg', 1.5], ['mk2.jpg', 1.5]] }, desc: '"Welcome to Donut Protocol. Don’t open. Okay fine… open." A fold-out that unfolds like the box.' },
  currency:  { title: 'Currency Redesign', hook: 'The \u20b9500 note, three ways',        cat: 'Redesign · Currency',  color: '#3b8e5f', aspect: 2.265, n: 15, case: 'currency', wall: { bg: '#1f3a2b', edge: '#efe7da', logo: ['logo.png', 7.394, 3.7, .3], pieces: [['05.jpg', 2.265, -2.16, .52, 2], ['03.jpg', 2.265, 0, .52, 2], ['01.jpg', 2.265, 2.16, .52, 2], ['06.jpg', 2.265, -2.16, -.52, 2], ['04.jpg', 2.265, 0, -.52, 2], ['02.jpg', 2.265, 2.16, -.52, 2]] }, desc: 'Rethinking the ₹500 note in three directions: futuristic, heritage and nature.' },
  albums:    { title: 'Album Covers, Redesigned', hook: 'Four records, re-sleeved', cat: 'Redesign · Album Art', color: '#c23a8a', aspect: 1, n: 4, case: 'albums', wall: { vinyl: true, bg: '#3a1520', edge: '#efe7da', logo: ['logo.png', 10.433, 3.95, .28], pieces: [['01.jpg', 1, -.74, .74, 1.3], ['03.jpg', 1, .74, .74, 1.3], ['05.jpg', 1, -.74, -.74, 1.3], ['04.jpg', 1, .74, -.74, 1.3]] }, desc: 'Four records, re-sleeved: Radiohead, Peter Cat Recording Co., The Chemical Brothers and Nikhil Banerjee, each cover rethought around one image.' },
  notfound:  { title: '404: Find Your 0', hook: 'Fix the page by finding the 0',         cat: 'UX · Interaction',     color: '#8b4dff', aspect: 1.776, n: 14, desc: 'A Canva-inspired error page where the 0 is missing, and users fix the page by making it.' },
};

// k = slot around the rotunda (0 is the back room, straight ahead on +z)
export const HALLS = [
  { id: 'packaging', k: 1, num: '01', title: 'Packaging',               stage: 'plinths', works: ['altura', 'kazaar', 'cheese', 'donuts', 'misty', 'playable'] },
  { id: 'identity',  k: 2, num: '02', title: 'Identity & Branding',     stage: 'frames', works: ['brain', 'forkyeah'] },
  { id: 'campaigns', k: 3, num: '03', title: 'Advertising & Campaigns', stage: 'runway', works: ['meghalaya'] },   // Axe waits for a later hall
  { id: 'editorial', k: 4, num: '04', title: 'Editorial & Print',       stage: 'press', works: ['daily', 'inked', 'characters', 'donutbook'], slots: ['nasa'] },   // a fifth station kept for Down to Earth   // The Concert Times left out (2026-11-11)
  { id: 'redesign',  k: 5, num: '05', title: 'Redesign',          stage: 'frames', works: ['currency', 'albums'] },   // (side = i % 2: currency lands on the right wall, albums on the left) (404 left out for now, 2026-11-13)
];
export const BACKROOM = { id: 'backroom', k: 0, num: 'BR', title: 'Blender & 3D' };   // the Blender hall (was the back room)
export const N_ROOMS = HALLS.length + 1; // arches around the rotunda

// the guided tour walks this order
export const ORDER = HALLS.flatMap(h => h.works);
export const hallOf = id => HALLS.find(h => h.works.includes(id));
export const coverOf = id => WORKS[id]?.case ? `assets/case/${WORKS[id].case}/m01.jpg` : `assets/projects/${id}/cover.jpg`;
export const caseOf = id => WORKS[id]?.case ? `project.html?p=${WORKS[id].case}` : null;
export const pageOf = (id, i) => `assets/projects/${id}/p${String(i).padStart(2, '0')}.jpg`;

// what lies on the recap desk
export const DESK_ITEMS = [];   // the Blender hall's desk now shows the real 3D packages and the books (world.fillDesk)
