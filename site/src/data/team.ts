// Team bios for the /brian, /jovan, /bane, /nenad, /alex pages.
//
// Ported from partials/about/about-single/who-am-i.php, which switched on the
// WordPress page title. Only two of the five live pages had a matching case:
//
//   page      title              matched?
//   /brian    Brian Dordevic     yes
//   /nenad    Nenad Nidzovic     yes
//   /jovan    Jovan Zornic       NO -> fell through to the default branch
//   /bane     Branislav Jeftic   NO -> fell through to the default branch
//   /alex     Alex               NO -> the case reads 'Alex Malkovsky'
//
// The default branch holds Brian's role and biography, so production currently
// publishes Brian's bio and the title "President" on three other people's
// pages. That is a live content bug, not a migration artefact.
//
// Rather than carry it across, the three unresolved entries below have no role
// or bio. The page renders their name and a visible "content pending" note.
// Fabricating biographies for real, named colleagues is not something to guess
// at — supply the copy and it drops straight in.

export interface Person {
  slug: string;
  name: string;
  role: string | null;
  bio: string | null;
  image: string | null;
  hobbies: string[];
  socials: { kind: 'instagram' | 'linkedin'; href: string }[];
  /** True when who-am-i.php had no case for this page. */
  needsContent?: boolean;
}

export const team: Person[] = [
  {
    slug: 'brian',
    name: 'Brian Dordevic',
    role: 'President',
    bio: 'From $4/hour virtual assistant to running a leading Chicago web design agency. I will help you occupy the minds of your ideal customers, improve your aesthetics, and increase sales.',
    image: '/assets/images/about/personel/bojan.webp',
    hobbies: [
      'With a decade of digital marketing experience under his belt, and over 10 million dollars of successfully executed budgets in his management, he is capable of taking any project, and finding a working solution.',
      'Besides working on Alpha Efficiency client projects, he is tackling our content efforts, strategic partnerships for our up and coming startup called Alpha Delivered, an email marketing platform that resolves B2B challenges.',
    ],
    socials: [
      { kind: 'instagram', href: 'https://www.instagram.com/briandecoded/' },
      { kind: 'linkedin', href: 'https://www.linkedin.com/in/briandecoded' },
    ],
  },
  {
    slug: 'nenad',
    name: 'Nenad Nidzovic',
    role: 'Content Writer',
    bio: 'Nenad is an advanced literature student with a passion for wordsmithing. He is thrilled every time he comes across a peculiar word or meaning which he writes down in his dictionary as he constantly strives to better his command of the English language.',
    image: '/assets/images/about/personel/nenad.png',
    hobbies: [
      'Although Nenad is primarily schooled to be a Serbian language teacher, the English language has always been his love and passion. His work as both online and private tutor has only fortified that affection so that he always has a dictionary and a grammar book by his side.',
      'Nenad enjoys sports and nature. If it is not the keyboard in his hands, it is usually the basketball or the joypad. He often spends his weekends exploring the nearby mountains on his bike while his evenings are reserved for playing video games with his brothers or relaxing in pubs with his friends.',
    ],
    socials: [],
  },
  { slug: 'jovan', name: 'Jovan Zornic', role: null, bio: null, image: null, hobbies: [], socials: [], needsContent: true },
  { slug: 'bane', name: 'Branislav Jeftic', role: null, bio: null, image: null, hobbies: [], socials: [], needsContent: true },
  { slug: 'alex', name: 'Alex', role: null, bio: null, image: null, hobbies: [], socials: [], needsContent: true },
];
