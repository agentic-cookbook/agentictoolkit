import { featureTsup } from '../tsup.preset'

// `ProfileProjects` is its own chunk, same reason as `parse-path`: the barrel dist hoists
// `'use client'` from `ProjectsFeature`, and this component's home is the `./profile`
// subpath a site's home-model imports directly — never through the barrel.
export default featureTsup(['src/index.ts', 'src/parse-path.ts', 'src/ProfileProjects.tsx'])
