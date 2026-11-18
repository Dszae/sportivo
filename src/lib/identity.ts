/**
 * Single source for the author's identity. Every page links to these profiles,
 * and every page carries exactly one full Person definition built from here.
 *
 * The canonical entity page is the main website (dipeshsapkota7.com.np). The
 * Person below mirrors the one published there (same @id, url, description,
 * education and identifiers) so search engines merge them into one entity.
 * When the main site's Person changes, update this to match.
 *
 * Profile URLs are the final addresses (no redirects).
 */
export const MAIN_SITE = 'https://www.dipeshsapkota7.com.np/';
/** Same @id the main website uses for its Person node. */
export const PERSON_ID = `${MAIN_SITE}#person`;
export const SPORTIVO_URL = 'https://sportivo.dipeshsapkota7.com.np/';
export const SPORTIVO_ORG_ID = `${SPORTIVO_URL}#organization`;
export const SOURCE_REPO = 'https://github.com/Dszae/sportivo';

export const profiles = {
  website: MAIN_SITE,
  wikidata: 'https://www.wikidata.org/wiki/Q141595522',
  orcid: 'https://orcid.org/0009-0001-7595-5114',
  github: 'https://github.com/dszae',
  linkedin: 'https://www.linkedin.com/in/dipeshsapkota7',
  facebook: 'https://www.facebook.com/dsz.ae',
} as const;

export const sameAs: string[] = Object.values(profiles);

/** Reference to the Person; use this everywhere except the one full definition per page. */
export const personRef = { '@id': PERSON_ID } as const;

/** Word-for-word the same as the main website. */
export const PERSON_DESCRIPTION =
  'Computer Engineering student at IOE Thapathali Campus in Kathmandu, Nepal, exploring Artificial Intelligence, Machine Learning, embedded systems, and visual motion design.';

const defined = (name: string, wiki: string) => ({
  '@type': 'DefinedTerm',
  name,
  sameAs: `https://en.wikipedia.org/wiki/${wiki}`,
});

const ioeThapathali = {
  '@type': 'CollegeOrUniversity',
  '@id': 'https://tcioe.edu.np/#organization',
  name: 'Institute of Engineering (IOE), Thapathali Campus',
  url: 'https://tcioe.edu.np',
  sameAs: ['https://en.wikipedia.org/wiki/Thapathali_Campus', 'https://www.wikidata.org/wiki/Q7710687'],
};

/** The one full Person node. Pages without their own @graph get it from BaseLayout. */
export const person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Dipesh Sapkota',
  givenName: 'Dipesh',
  familyName: 'Sapkota',
  alternateName: ['dszae', 'dsz.ae', 'Dipesh Sapkota (dszae)', 'Dipesh'],
  description: PERSON_DESCRIPTION,
  disambiguatingDescription:
    'Computer Engineering student and AI/ML enthusiast at IOE Thapathali Campus in Nepal; creator of IOE Admission Hub, Sportivo, and Git Visualizer; known online as dszae.',
  url: MAIN_SITE,
  mainEntityOfPage: `${MAIN_SITE}about`,
  image: `${MAIN_SITE}dipesh-sapkota-portrait.jpg`,
  jobTitle: ['Computer Engineering Student', 'AI/ML Enthusiast', 'Motion Graphics Designer', 'Video Editor'],
  identifier: profiles.orcid,
  nationality: { '@type': 'Country', name: 'Nepal', sameAs: 'https://www.wikidata.org/wiki/Q837' },
  homeLocation: { '@type': 'Place', name: 'Kathmandu, Nepal', sameAs: 'https://www.wikidata.org/wiki/Q2429' },
  alumniOf: [
    ioeThapathali,
    {
      '@type': 'CollegeOrUniversity',
      '@id': 'https://tu.edu.np/#organization',
      name: 'Tribhuvan University',
      url: 'https://tu.edu.np',
      sameAs: ['https://en.wikipedia.org/wiki/Tribhuvan_University', 'https://www.wikidata.org/wiki/Q1143890'],
    },
  ],
  affiliation: ioeThapathali,
  worksFor: { '@type': 'Organization', '@id': SPORTIVO_ORG_ID, name: 'Sportivo', url: SPORTIVO_URL },
  knowsAbout: [
    defined('Computer Engineering', 'Computer_engineering'),
    defined('Artificial Intelligence', 'Artificial_intelligence'),
    defined('Machine Learning', 'Machine_learning'),
    defined('Embedded Systems', 'Embedded_system'),
    defined('Motion Graphic Design', 'Motion_graphic_design'),
    defined('Video Editing', 'Video_editing'),
    defined('Python Programming', 'Python_(programming_language)'),
    defined('React', 'React_(software)'),
    defined('Web Development', 'Web_development'),
  ],
  sameAs,
};

export const personJsonLd = { '@context': 'https://schema.org', ...person };
