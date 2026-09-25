import type { Translation } from '../id';
import articles from './articles.json';
import auth from './auth.json';
import bookChapter from './bookChapter.json';
import books from './books.json';
import common from './common.json';
import contentLanguages from './contentLanguages.json';
import editors from './editors.json';
import errors from './errors.json';
import events from './events.json';
import footer from './footer.json';
import home from './home.json';
import nav from './nav.json';
import packages from './packages.json';
import people from './people.json';
import services from './services.json';

// Bertipe `Translation`: kunci yang kurang dari bahasa Indonesia = galat kompilasi.
const ms: Translation = {
    articles,
    auth,
    bookChapter,
    books,
    common,
    contentLanguages,
    editors,
    errors,
    events,
    footer,
    home,
    nav,
    packages,
    people,
    services,
};

export default ms;
