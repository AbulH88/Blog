require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { syncDatabase, Creator } = require('../models');

const creators = [
  {
    slug: 'cristina',
    displayName: 'Cristina Adam',
    email: 'cristina@example.com',
    password: 'admin123',
    shortBio: "NYC native. 19. Just a girl who spends too much on iced coffee and vintage tees she doesn't need.",
    bio: "NYC born and raised. 19.\n\nI'm Cristina Adam. If you've seen me, I was probably staring at a vintage rack in the East Village or complaining about the L train.\n\nThis site is my digital bedroom. Instagram is exhausting — here I post the stuff that actually matters to me.\n\nCurrent Mood:\n- Overpriced matcha.\n- Warehouse parties in Bushwick.\n- Collecting old film cameras I don't know how to use.\n- Staying up way too late playing Valorant.",
    subscriptionPrice: 9.99,
    subscriptionPricePremium: 24.99,
    welcomeMessage: "Hey, welcome to my private space! So glad you're here. Feel free to message me anytime 💌",
    theme: {
      primaryColor: '#ffffff',
      backgroundColor: '#0a0a0a',
      accentColor: '#ffffff',
      fontFamily: "'Didot', serif",
    },
    links: {
      instagram: 'https://instagram.com/your-profile',
      twitter: 'https://twitter.com/your-profile',
      tiktok: 'https://tiktok.com/@your-profile',
    },
    seo: {
      metaTitle: 'Cristina Adam | NYC — Personal Blog',
      metaDescription: 'NYC lifestyle, fashion, and personal diaries by Cristina Adam. NYC born and raised.',
      favicon: '',
      ogImage: '',
    },
    blog: [
      {
        id: 1,
        title: 'A Day in the Digital Life',
        excerpt: 'Ever wonder what goes on behind the scenes of my daily routine?',
        content: 'Full story coming soon. Documenting the creative process and my journey in NYC.',
      },
      {
        id: 2,
        title: 'Summer Vibes & Digital Sun',
        excerpt: 'Exploring the latest summer fashion trends through my lens.',
        content: 'Fashion is evolving. See how I blend style with my personality to create stunning visuals.',
      },
    ],
    faq: [
      { q: 'How old are you?', a: "I'm 19, born and raised in NYC." },
      { q: 'What games do you play?', a: 'Mostly Valorant, Overwatch 2, and some retro RPGs.' },
      { q: 'Do you do meetups?', a: 'Only for close friends in the VIP Club for now!' },
    ],
    mustHaves: [
      { name: 'Gamer Headset', image: 'https://via.placeholder.com/300', link: '#' },
      { name: 'Neon Desk Lights', image: 'https://via.placeholder.com/300', link: '#' },
      { name: 'Vintage Camcorder', image: 'https://via.placeholder.com/300', link: '#' },
    ],
  },
];

(async () => {
  try {
    await syncDatabase();

    for (const data of creators) {
      const exists = await Creator.findOne({ where: { slug: data.slug } });
      if (exists) {
        console.log(`Creator "${data.slug}" already exists — skipping`);
        continue;
      }
      const { password, ...rest } = data;
      const passwordHash = await bcrypt.hash(password, 12);
      await Creator.create({ ...rest, passwordHash });
      console.log(`Created creator: ${data.slug} (login: ${data.email} / ${password})`);
    }

    console.log('Seed complete');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
