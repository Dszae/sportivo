/**
 * Single source for the author's identity links. Every page links to these,
 * so search engines and profile sites see one consistent set.
 *
 * Use the final URLs (no redirects): linkedin.com drops the trailing slash and
 * facebook.com redirects to www.
 */
export const MAIN_SITE = 'https://www.dipeshsapkota7.com.np/';
export const PERSON_ID = `${MAIN_SITE}#person`;
export const SOURCE_REPO = 'https://github.com/Dszae/sportivo';

export const profiles = {
  website: MAIN_SITE,
  github: 'https://github.com/dszae',
  linkedin: 'https://www.linkedin.com/in/dipeshsapkota7',
  facebook: 'https://www.facebook.com/dsz.ae',
} as const;

export const sameAs: string[] = Object.values(profiles);

/** Person node shared by every page; other JSON-LD on the page references it by @id. */
export const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Dipesh Sapkota',
  alternateName: 'dszae',
  url: MAIN_SITE,
  image: 'https://sportivo.dipeshsapkota7.com.np/dipesh-sapkota-profile.webp',
  jobTitle: 'Software Developer & Engineering Student',
  sameAs,
};
