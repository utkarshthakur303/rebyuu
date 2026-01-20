export interface Anime {
  id: string;
  title: string;
  rating: number;
  genres: string[];
  year: number;
  season: string;
  status: 'airing' | 'completed' | 'upcoming';
  episodes: number;
  description: string;
  coverImage: string;
  bannerImage: string;
  trailer?: string;
}

export interface Review {
  id: string;
  animeId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  date: string;
  reported: boolean;
}

export const mockAnimeData: Anime[] = [
  {
    id: '1',
    title: 'Demon Slayer: Kimetsu no Yaiba',
    rating: 8.7,
    genres: ['Action', 'Fantasy', 'Demons'],
    year: 2019,
    season: 'Spring',
    status: 'completed',
    episodes: 26,
    description: 'A family is attacked by demons and only two members survive - Tanjiro and his sister Nezuko, who is turning into a demon slowly. Tanjiro sets out to become a demon slayer to avenge his family and cure his sister.',
    coverImage: 'demon-slayer',
    bannerImage: 'demon-slayer-banner',
    trailer: 'https://www.youtube.com/watch?v=VQGCKyvzIM4'
  },
  {
    id: '2',
    title: 'Attack on Titan',
    rating: 9.0,
    genres: ['Action', 'Drama', 'Fantasy'],
    year: 2013,
    season: 'Spring',
    status: 'completed',
    episodes: 75,
    description: 'After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.',
    coverImage: 'attack-on-titan',
    bannerImage: 'attack-on-titan-banner'
  },
  {
    id: '3',
    title: 'Jujutsu Kaisen',
    rating: 8.6,
    genres: ['Action', 'Supernatural', 'School'],
    year: 2020,
    season: 'Fall',
    status: 'airing',
    episodes: 24,
    description: 'A boy swallows a cursed talisman - the finger of a demon - and becomes cursed himself. He enters a shaman\'s school to be able to locate the demon\'s other body parts and thus exorcise himself.',
    coverImage: 'jujutsu-kaisen',
    bannerImage: 'jujutsu-kaisen-banner'
  },
  {
    id: '4',
    title: 'My Hero Academia',
    rating: 8.4,
    genres: ['Action', 'Comedy', 'School', 'Superhero'],
    year: 2016,
    season: 'Spring',
    status: 'airing',
    episodes: 113,
    description: 'A superhero-loving boy without any powers enrolls in a prestigious hero academy and learns what it really means to be a hero.',
    coverImage: 'my-hero-academia',
    bannerImage: 'my-hero-academia-banner'
  },
  {
    id: '5',
    title: 'One Punch Man',
    rating: 8.8,
    genres: ['Action', 'Comedy', 'Parody', 'Superhero'],
    year: 2015,
    season: 'Fall',
    status: 'completed',
    episodes: 24,
    description: 'The story of Saitama, a hero that only became a hero for fun. After three years of "special" training, though, he\'s become so strong that he\'s practically invincible.',
    coverImage: 'one-punch-man',
    bannerImage: 'one-punch-man-banner'
  },
  {
    id: '6',
    title: 'Spy x Family',
    rating: 8.7,
    genres: ['Action', 'Comedy', 'Slice of Life'],
    year: 2022,
    season: 'Spring',
    status: 'airing',
    episodes: 25,
    description: 'A spy on an undercover mission gets married and adopts a child as part of his cover. His wife and daughter have secrets of their own, and all three must hide their true identities.',
    coverImage: 'spy-family',
    bannerImage: 'spy-family-banner'
  },
  {
    id: '7',
    title: 'Chainsaw Man',
    rating: 8.5,
    genres: ['Action', 'Dark Fantasy', 'Supernatural'],
    year: 2022,
    season: 'Fall',
    status: 'completed',
    episodes: 12,
    description: 'Following a betrayal, a young man left for dead is reborn as a powerful devil-human hybrid after merging with his pet devil and is soon enlisted into an organization dedicated to hunting devils.',
    coverImage: 'chainsaw-man',
    bannerImage: 'chainsaw-man-banner'
  },
  {
    id: '8',
    title: 'Mob Psycho 100',
    rating: 8.6,
    genres: ['Action', 'Comedy', 'Supernatural'],
    year: 2016,
    season: 'Summer',
    status: 'completed',
    episodes: 37,
    description: 'A psychic middle school boy tries to live a normal life and keep his growing powers under control, even though he constantly gets into trouble.',
    coverImage: 'mob-psycho',
    bannerImage: 'mob-psycho-banner'
  },
  {
    id: '9',
    title: 'Vinland Saga',
    rating: 8.8,
    genres: ['Action', 'Adventure', 'Historical'],
    year: 2019,
    season: 'Summer',
    status: 'airing',
    episodes: 48,
    description: 'Thorfinn, son of one of the Vikings\' greatest warriors, is among the finest fighters in the merry band of mercenaries run by the cunning Askeladd.',
    coverImage: 'vinland-saga',
    bannerImage: 'vinland-saga-banner'
  },
  {
    id: '10',
    title: 'Tokyo Revengers',
    rating: 8.3,
    genres: ['Action', 'Drama', 'Time Travel'],
    year: 2021,
    season: 'Spring',
    status: 'completed',
    episodes: 24,
    description: 'A young man is suddenly pushed 12 years into the past and gets a chance to change the present by altering his delinquent days.',
    coverImage: 'tokyo-revengers',
    bannerImage: 'tokyo-revengers-banner'
  },
  {
    id: '11',
    title: 'Sword Art Online',
    rating: 7.6,
    genres: ['Action', 'Adventure', 'Fantasy', 'Romance'],
    year: 2012,
    season: 'Summer',
    status: 'completed',
    episodes: 96,
    description: 'In the year 2022, thousands of people get trapped in a new virtual MMORPG and the lone wolf player, Kirito, works to escape.',
    coverImage: 'sword-art-online',
    bannerImage: 'sword-art-online-banner'
  },
  {
    id: '12',
    title: 'Haikyu!!',
    rating: 8.7,
    genres: ['Sports', 'Comedy', 'School'],
    year: 2014,
    season: 'Spring',
    status: 'completed',
    episodes: 85,
    description: 'Inspired after watching a volleyball ace nicknamed "Little Giant" in action, small-statured Shouyou Hinata revives the volleyball club at his middle school.',
    coverImage: 'haikyuu',
    bannerImage: 'haikyuu-banner'
  }
];

export const mockReviews: Review[] = [
  {
    id: 'r1',
    animeId: '1',
    userId: 'u1',
    userName: 'AnimeExpert',
    userAvatar: 'user-1',
    rating: 9,
    comment: 'Absolutely stunning animation and emotional storytelling. A must-watch!',
    date: '2024-01-15'
  },
  {
    id: 'r2',
    animeId: '1',
    userId: 'u2',
    userName: 'MangaReader',
    userAvatar: 'user-2',
    rating: 8.5,
    comment: 'Great adaptation of the manga. The fight scenes are incredible.',
    date: '2024-01-10'
  },
  {
    id: 'r3',
    animeId: '2',
    userId: 'u3',
    userName: 'TitanFan',
    userAvatar: 'user-3',
    rating: 10,
    comment: 'One of the best anime series ever created. The plot twists are mind-blowing.',
    date: '2024-01-12'
  }
];

export const mockComments: Comment[] = [
  {
    id: 'c1',
    userId: 'u1',
    userName: 'SpamUser123',
    userAvatar: 'user-spam',
    content: 'Check out my website for free anime downloads!!!',
    date: '2024-01-16',
    reported: true
  },
  {
    id: 'c2',
    userId: 'u2',
    userName: 'NormalUser',
    userAvatar: 'user-normal',
    content: 'This episode was amazing! Can\'t wait for the next one.',
    date: '2024-01-15',
    reported: false
  },
  {
    id: 'c3',
    userId: 'u3',
    userName: 'ToxicCommenter',
    userAvatar: 'user-toxic',
    content: 'This anime is trash and anyone who likes it is an idiot',
    date: '2024-01-14',
    reported: true
  }
];

export const genres = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller'
];

export const years = Array.from({ length: 25 }, (_, i) => 2024 - i);

export const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];

export const statuses = ['all', 'airing', 'completed', 'upcoming'] as const;
