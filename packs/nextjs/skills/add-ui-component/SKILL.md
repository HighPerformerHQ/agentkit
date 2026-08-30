---
name: add-ui-component
description: Add a UI component from the shadcn/ui or Magic UI registries instead of hand-writing one. Use whenever the task needs a button, dialog, form control, animation, or any other common interface element.
---
# Add a UI component

Components come from registries via the shadcn CLI. **Do not hand-write a
component that either registry already provides**, and do not copy source out of
documentation - the CLI resolves dependencies and import paths correctly.

## Check what already exists first

```bash
ls src/components/ui/
```

## Add from shadcn/ui (the default registry)

```bash
pnpm dlx shadcn@latest add button card dialog
```

## Add from Magic UI

Magic UI is wired up as the `@magicui` namespace in `components.json`, pointing
at `https://magicui.design/r/{name}.json`:

```bash
pnpm dlx shadcn@latest add @magicui/marquee
```

Browse available components at https://magicui.design/docs/components.

Reach for Magic UI for motion and marketing surfaces - animated backgrounds,
marquees, text effects, bento grids. Reach for shadcn/ui for everything
structural and interactive - forms, dialogs, tables, navigation.

## After adding

- Components land in `src/components/ui/`. **Treat them as yours** - they are
  copied in, not imported from a package, so edit them freely.
- Compose using `className` and props rather than rewriting internals, so a
  later re-add does not clobber your changes.
- Merge classes with the `cn()` helper from `src/lib/utils.ts`.
- Some Magic UI components need `motion` (Framer Motion). The CLI installs
  dependencies automatically - re-run `pnpm install` if the import fails.
