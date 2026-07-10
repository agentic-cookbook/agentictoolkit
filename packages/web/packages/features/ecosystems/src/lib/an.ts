/** Prefix `word` with its indefinite article — copy like "Open a product" /
 *  "an ecosystem" stays grammatical for any host-supplied noun. A leaf util
 *  (no feature imports), so both the feature and its panes can share it
 *  without an import cycle. */
export const an = (word: string): string => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);
