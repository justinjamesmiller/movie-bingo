// Aggregates every genre's descriptions. Imported dynamically (see
// tropeDescriptions.js) so this large body of text is code-split out of the
// initial bundle rather than blocking first paint.
import action from './action.js';
import comedy from './comedy.js';
import documentary from './documentary.js';
import drama from './drama.js';
import fantasy from './fantasy.js';
import horror from './horror.js';
import romance from './romance.js';
import sciFi from './sci-fi.js';
import thriller from './thriller.js';

export default {
  ...horror,
  ...comedy,
  ...action,
  ...sciFi,
  ...fantasy,
  ...thriller,
  ...romance,
  ...drama,
  ...documentary,
};
