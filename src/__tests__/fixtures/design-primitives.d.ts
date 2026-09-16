// Types for the HOST-SHARED design primitives module
// (`@cinatra-ai/design-primitives`, slice 3 of cinatra-ai/cinatra#3471).
//
// WHY THIS FILE EXISTS. The module id is VIRTUAL: the host-shared-primitives
// contract publishes no package under it, and the typed contract names the
// exports, not their component types — the contract module is React-free by
// design (importing it must never pull a second copy of anything), so a
// migrating package types the values against its OWN React types. That is what
// this file does, for this package's standalone `tsc --noEmit` only.
//
// WHY IT LIVES UNDER `src/__tests__/fixtures/` AND NOWHERE ELSE. An ambient
// `declare module` wins over a tsconfig `paths` mapping for every file of the
// program that reads it. Inside the host this file must therefore never be part
// of the program, or it would shadow the host's REAL module
// (`src/lib/artifacts/host-shared-primitives.ts`, which serves the whole frozen
// export list) and the host build would fail with TS2305 on every name this
// package does not declare. The host's tsconfig excludes
// `**/__tests__/fixtures/**`, and this package's own tsconfig include
// (`src/**/*.ts`) reaches it, so the declaration is inside this package's
// program and outside the host's. It is also outside the published `files` set
// (`!src/__tests__`), so no consumer installing this package from the registry
// receives the declaration at all.
//
// WHAT THIS FILE IS NOT.
//   * Not a copy of the product primitive: it carries no implementation, no
//     variant table and no class strings — the byte copies this migration
//     deleted (`src/components/ui/button.tsx`, `src/components/ui/card.tsx`)
//     never come back under another name.
//   * Not a dependency on the virtual id: a type-only ambient declaration adds
//     no specifier to package.json, which the contract forbids — any specifier,
//     an optional peer included, makes the install resolve and 404.
//   * Not a tsconfig `paths` entry: pointing the id at a local file would turn
//     the contract's BUILD-TIME road into a local copy. Inside the host, the
//     host's own generated path map resolves the id and serves the real module.
//
// ONLY the six frozen-list names this package's renderer imports are declared,
// and each is typed with the primitive's OWN prop surface rather than with the
// subset today's renderer happens to pass.
// The host module also serves `buttonVariants`, `CardAction` and
// `CardDescription`; this package imports none of them, and an export nobody
// uses is not declared here.
//
// This file is a global script (no top-level import/export) on purpose: a
// top-level import would make it a module, and `declare module` would then be
// read as an augmentation of a module that does not resolve. React types are
// reached through inline `import("react")` types instead.

declare module "@cinatra-ai/design-primitives" {
  /**
   * The `button` primitive. The draft-review renderer renders it with
   * `variant`, `onClick`, `disabled`, `type` and children — the props a
   * `button` carries, plus the variant table's own two keys.
   */
  export const Button: (
    props: import("react").ComponentProps<"button"> & {
      // The variant and size keys are the product primitive's OWN tables,
      // copied whole rather than narrowed to today's usage: a narrower union
      // would reject a legitimate future call with a type error that says
      // nothing true about the host module.
      variant?:
        | "default"
        | "outline"
        | "secondary"
        | "ghost"
        | "destructive"
        | "link"
        | null;
      size?:
        | "default"
        | "xs"
        | "sm"
        | "lg"
        | "icon"
        | "icon-xs"
        | "icon-sm"
        | "icon-lg"
        | null;
      asChild?: boolean;
    },
  ) => import("react").ReactElement | null;

  /** The `card` region. Rendered with `className` and children; the primitive
   * also carries its own `size` key. */
  export const Card: (
    props: import("react").ComponentProps<"div"> & {
      size?: "default" | "sm";
    },
  ) => import("react").ReactElement | null;

  /** The `card` header slot. Rendered with children only. */
  export const CardHeader: (
    props: import("react").ComponentProps<"div">,
  ) => import("react").ReactElement | null;

  /** The `card` title slot. Rendered with children only. */
  export const CardTitle: (
    props: import("react").ComponentProps<"div">,
  ) => import("react").ReactElement | null;

  /** The `card` body slot. Rendered with `className` and children. */
  export const CardContent: (
    props: import("react").ComponentProps<"div">,
  ) => import("react").ReactElement | null;

  /** The `card` footer slot. Rendered with `className` and children. */
  export const CardFooter: (
    props: import("react").ComponentProps<"div">,
  ) => import("react").ReactElement | null;
}
