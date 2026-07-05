declare module '*.css?inline' {
  const content: string
  export default content
}

// `process.env.NEXT_PUBLIC_*` is build-inlined by the consuming Next app (it
// never executes against a real Node `process` here). Declare the minimal shape
// so this browser-targeted package typechecks without pulling in @types/node.
declare const process: { env: Record<string, string | undefined> }
