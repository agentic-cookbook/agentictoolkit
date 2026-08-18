import { featureTsup } from '../tsup.preset'

// ProfilePersonas moved to the personas site's own src/ (it renders `profileSection`, which
// imports the adh vocabulary tier a portable package may not — see check_boundaries.py), so this
// package builds only its own two entries again.
export default featureTsup(['src/index.ts', 'src/parse-path.ts'])
