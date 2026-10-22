# Styleguide protocol, version 2

The interface of the styleguide (this package, a plugin of the Neos UI) knows nothing about the frontend. It talks to an **adapter**: whatever
renders the website (for SvelteKit:
[Devclaim.NeosStyleguide.Adapter.Svelte](https://github.com/Devclaim/Devclaim.NeosStyleguide.Adapter.Svelte), for CPX
components inside Neos:
[Devclaim.NeosStyleguide.Adapter.CPX](https://github.com/Devclaim/Devclaim.NeosStyleguide.Adapter.CPX); a Fusion
adapter would work like the CPX one). Three parts:

| Part | Who | What |
| --- | --- | --- |
| Neos API | this package | sites, the design token overrides of a site (in the editor's workspace) |
| Adapter API | the adapter | the entries of the styleguide and the design tokens of the frontend (JSON) |
| Preview | the adapter | an HTML page per entry, shown in an iframe; a plain page, the interface works on it itself |

All requests come from the browser of a logged-in editor, with the Neos session cookie. The adapter answers `401`
without a backend session (it can ask the Neos API, which needs the session). Everything is same-origin: the interface,
the adapter and the preview are served under the host of the Neos backend.

## Where the adapter is

`adapter` of the Neos UI's `frontendConfiguration` `Devclaim.NeosStyleguide` (Configuration/Settings.yaml) is the
base URL of the adapter API, e.g. `/neos/styleguide/api/v1`.
Everything else, the preview URLs included, comes from its manifest.

## Adapter API

JSON, `GET` unless noted. Every response that is an object has `"protocol": 2`.

### `GET {adapter}/manifest`

```json
{
    "protocol": 2,
    "name": "SvelteKit",
    "levels": [{ "id": "atoms", "label": "Atoms", "position": 200 }],
    "viewports": [{ "id": "md", "label": "Tablet (768)", "width": 768, "height": 1024 }],
    "preview": "/neos/styleguide/preview?entry={entry}&site={site}",
    "gallery": "/neos/styleguide/preview?entries={entries}&site={site}",
    "features": { "grid": true, "colorScheme": true }
}
```

- `levels`: the navigation of the elements, in `position` order.
- `viewports`: the widths the interface offers (in px); "full width" is always there.
- `preview`: a URL template. The interface replaces `{entry}` and `{site}` and appends `useCase`, `propSet` and
    `props` (below) as query parameters.
- `gallery` (optional): a URL template for many entries on one page (below); `{entries}` are ids separated by commas.
    Without it the interface lists the entries as cards.
- `features`: what the preview can do beyond the basics (below); missing ones are `false`. `grid`: it draws the page
    grid of the website while `<html>` has the attribute `data-styleguide-grid`. `colorScheme`: it shows the color
    scheme `<html>` names in `data-color-scheme` (`light` or `dark`), whether the site has a dark mode or not, so the
    dark values can be designed before it is switched on.

### `GET {adapter}/entries`

```json
{
    "protocol": 2,
    "entries": [
        {
            "id": "content.Accordion",
            "title": "Accordion",
            "level": "organisms",
            "description": "Expandable items …",
            "useCases": [{ "id": "closed", "title": "All closed" }],
            "propSets": [{ "id": "twoColumns", "title": "twoColumns" }],
            "source": "Frontend/src/lib/content/Accordion.styleguide.yaml",
            "gallery": true,
            "page": false
        }
    ]
}
```

`id` is stable and URL safe (letters, digits, `.`, `-`, `_`); `source` is shown to developers, the interface does not
read it. `gallery` (optional, default `true`): `false` for an entry that is only shown alone (a whole page). `page`
(optional, default `false`): a whole page; the interface shows it at the height of a screen, scrolled inside its frame
like in a browser, so heights in `vh`, sticky and fixed elements work as on the website.

### `GET {adapter}/entries/{id}`

The entry as in the list, plus what the inspector shows:

```json
{
    "protocol": 2,
    "entry": {
        "id": "ui.Button",
        "title": "Button",
        "level": "atoms",
        "props": [
            { "name": "html", "value": "Mehr erfahren", "editor": { "type": "text" } },
            { "name": "variant", "value": "REGULAR", "editor": { "type": "select", "options": [{ "value": "REGULAR", "label": "REGULAR" }] } },
            { "name": "iconOnly", "value": false, "editor": { "type": "checkbox" } }
        ],
        "propSets": [{ "id": "solid", "title": "solid", "props": { "variant": "SOLID" } }],
        "useCases": [{ "id": "iconOnly", "title": "Icon only", "props": { "html": "", "iconOnly": true } }]
    }
}
```

- `props`: only the props with an editor; others (lists, objects) stay as they are.
- `editor.type`: `text`, `textarea`, `number`, `checkbox` or `select` (with `options`, `value` a string; `""` stands
    for "none").
- `propSets` and `useCases` change props; the preview applies them itself (below), the interface only needs their
    `props` to show the changed values.

`404` for an unknown id.

### `GET {adapter}/tokens`

The design tokens of the frontend, with their defaults (not the values of a site: those come from the Neos API):

```json
{
    "protocol": 2,
    "kinds": [{ "id": "colors", "label": "Farben" }],
    "groups": [{ "id": "semantic-colors", "label": "Semantic colors", "description": "the only colors components use", "kind": "colors" }],
    "tokens": [
        {
            "name": "--color-brand",
            "value": "light-dark(var(--color-brand-light), var(--color-brand-dark))",
            "group": "semantic-colors",
            "type": "color",
            "description": "primary actions (buttons)",
            "editable": true,
            "layer": "semantic",
            "variants": [
                { "id": "light", "token": "--color-brand-light" },
                { "id": "dark", "token": "--color-brand-dark" }
            ],
            "pointsAt": ["base-colors", "color-scales"]
        },
        {
            "name": "--color-brand-light",
            "value": "var(--color-sd-70)",
            "group": "semantic-colors-light",
            "type": "color",
            "description": "",
            "editable": true,
            "layer": "semantic",
            "variantOf": "--color-brand",
            "variant": "light",
            "pointsAt": ["base-colors", "color-scales"]
        }
    ]
}
```

- `kinds` (optional): the navigation of the tokens, in this order (colors, typography …); every group names its
    `kind`. Without kinds the interface lists the groups.
- `type`: `color`, `font`, `size` (lengths), `shadow`, `ratio`, `breakpoint` or `other`; the interface picks the
    editor by it.
- `editable`: `false` for tokens a site cannot change (breakpoints: fixed at build time).
- `value` may refer to other tokens (`var(--color-sd-50)`).
- `layer`, `variants`, `variantOf`, `variant`, `pointsAt` (optional, below): what the editor changes, and with what.
- `subgroup` (optional): a part of the group the interface shows as a heading ("Flächen" of the semantic colors); the
    SvelteKit adapter reads it from a comment `Subgroup: <label>` in the group, until the next one.

#### Layers and variants

Two layers, so an editor restyles the site without touching the design:

- **Design tokens** (`layer: "design"`): the raw values of the design, the palette and the scales (`--color-sd-70`,
    `--spacing-16`). Nothing of the website uses them directly.
- **Semantic tokens** (`layer: "semantic"`): what the website uses (`--color-brand`, `--spacing-card`); each points at
    design tokens (`var(--color-sd-70)`), the editor changes where it points.

A semantic token may have a value per **variant**: `light` and `dark` (the color scheme), or `base`, `md`, `lg`, `xl`
(from that width; a width without own value takes the one of the smaller width). Then `variants` lists the tokens that
hold them, in that order, and each of those names the token in `variantOf` and its variant in `variant`. The editor
changes the variants; a value for the token itself would set one value for all variants (and does nothing for a shadow,
whose utility Tailwind writes with the value of the token).

`pointsAt`: the groups (ids) whose design tokens a semantic token may point at, e.g. the color groups for a color, the
spacing scale for a spacing. Without layers (`layer` missing) the interface shows the tokens by group as before.

The SvelteKit adapter reads all of it from the conventions of the stylesheets: a group whose label starts with
"Semantic" holds semantic tokens, a semantic token named like another one plus `-light`, `-dark`, `-base`, `-md`, `-lg`
or `-xl` is its variant, and a semantic token points at the design groups its family refers to: the groups of the
design tokens the tokens of its group (and its variant groups, "Semantic colors (light)" …) use in their defaults, of
its namespace (`--color-`, `--spacing-` …). So the colors of the site offer the palette of the site, the colors of the
event types their own; a family without such a reference offers every design group of its namespace. An adapter in PHP gets the
same from `Devclaim\NeosStyleguide\Tokens\TokenLayers` (with the subgroups of `ThemeTokens`); a theme without
semantic groups has no layers there.

### `POST {adapter}/tokens/validate`

Checks overrides before the interface saves them, with the rules the adapter applies when it renders them.

Request: `{ "overrides": { "--color-brand": "#e5007d", "--color-nope": "red" } }`

```json
{
    "protocol": 2,
    "valid": { "--color-brand": "#e5007d" },
    "invalid": [{ "name": "--color-nope", "value": "red", "reason": "unknown token" }]
}
```

## Preview

The URL of the manifest's `preview` template, plus:

| Parameter | What |
| --- | --- |
| `entry` | the id of the entry |
| `site` | the site (node name, from the Neos API); its saved token overrides apply |
| `useCase`, `propSet` | ids from the entry; the preview applies their props |
| `props` | JSON object of the props changed in the inspector, applied last |

Order of the props: defaults, prop set, use case, `props`. The page renders the entry as the website would, in the
site's theme, without anything of the interface around it.

### Gallery

The URL of the manifest's `gallery` template: the entries with their defaults on one page, in the given order, each in
an element with `data-styleguide-entry="<id>"`, all inside `data-styleguide-root`. Unknown ids are left out. The
interface shows it at the width of a viewport (scaled into its room), reserves room above each entry (a style in the
head: a `margin-top` on `[data-styleguide-entry]`) and puts its own labels there; the page needs nothing for that.

### What the interface does with it

The previews are on the origin of the Neos backend, like the interface, so the interface works on their documents
directly. An adapter writes no script for the styleguide; it only has to render a page that

- marks what it shows with the attribute `data-styleguide-root` (else the interface takes the `<body>`),
- uses the design tokens as CSS custom properties, so a value set on `:root` restyles it,
- draws the page grid for `data-styleguide-grid` on `<html>`, if its manifest says `features.grid`,
- shows the color scheme of `data-color-scheme` on `<html>`, if its manifest says `features.colorScheme`.

The interface then

| Does | How |
| --- | --- |
| shows the draft tokens | a `<style data-styleguide-draft>:root{…}</style>` at the end of the `<head>`, after the page's own styles, updated on every change (only names `--…` and values that cannot leave the declaration) |
| makes the uploaded fonts available | a `<style data-styleguide-fonts>` with their `@font-face` rules (Neos API `fonts`, below), so a draft can name any of them |
| sizes the iframe | the bottom of the root element, observed with a `ResizeObserver` |
| lists the tokens an entry uses | the `var(--…)` of every style rule of the page that matches the root or an element in it |
| shows the page grid | sets or removes `data-styleguide-grid` on `<html>` |
| shows light or dark | sets `data-color-scheme` on `<html>` to `light` or `dark` (the switch next to the widths) |

A new preview URL loads in a hidden iframe and replaces the shown one once it has loaded and has the draft, so a page
of the adapter may take its time; it should not change its height long after it has loaded.

## Neos API

Served by this package, `Devclaim.NeosStyleguide` routes:

- `GET /api/styleguide/v1/sites`: `{ "sites": [{ "key", "title", "languages", "designTokens", "liveDesignTokens" }] }`,
    the token overrides of each site in the editor's workspace as `--name: value;` lines, and as they are live. For the
    adapter: the preview renders an entry in the theme of the site, unpublished changes included. For the interface:
    what differs from live is not published yet.
- `GET /api/styleguide/v1/fonts`: `{ "families": ["Inter"], "css": "@font-face{…}" }`, the fonts editors
    uploaded (Devclaim.NeosStyleguide `FontLibrary`, asset collection "Schriften"). For the interface: the font editor and
    the previews. Fonts are Neos', not the adapter's: the pages of the website print the same rules (the SvelteKit
    frontend from `site.fonts` of the headless API, Fusion with `NeosStyleguide.Fonts.css()`); previews need nothing.

The interface saves the overrides like an inline edit of the Neos UI (a change of the property of the site node into the
editor's workspace); publishing is Neos' own.

## Serving

The interface, the adapter and the previews share the origin of the Neos backend: the interface reads and changes the
documents of the previews, which a browser only allows on the same origin. The adapter's paths may be anywhere on that
host. Behind a web server they go to the adapter before any rule that sends `/neos` or `/api` to Neos (see the README
of the adapter). Its answers are for one editor: `Cache-Control: private, no-store`, never in a shared
cache.

## Writing an adapter

Another frontend (a classic Neos site with Fusion or CPX, another JavaScript framework) keeps the interface and writes
an adapter. In the order worth building, each step shows more in the styleguide:

1. **Manifest and entries** (`manifest`, `entries`, `entries/{id}`). Where the entries come from is the adapter's
    business: the SvelteKit adapter reads a `*.styleguide.yaml` next to each component; a Fusion adapter could read
    the same files next to its prototypes, or annotations of the prototypes themselves. Levels and viewports are free
    to choose.
2. **The preview.** A page per entry that renders the component with its props (defaults, prop set, use case,
    `props`) in the theme of the site, inside `data-styleguide-root`, and nothing else. No script for the styleguide.
    With `gallery` in the manifest the elements screen shows every entry in one page, without it a card per entry.
3. **Tokens** (`tokens`, `tokens/validate`). The CSS custom properties the CSS of the site defines, with their defaults;
    the interface edits only these. With layers and variants ("Layers and variants") the editor works on the semantic
    tokens. `validate` applies exactly the rules the website applies when it renders the
    overrides of a site (4.), or the styleguide saves values the website leaves out.
4. **The overrides in the pages.** Not part of the protocol, but a change of a token is only seen with it: the
    website renders the property `designTokens` of the site node (`--name: value;` per line) into a `<style>` after its
    stylesheet, line by line checked (the SvelteKit adapter: `themeTokens()`, its `tokens.ts`). The preview
    does the same with the tokens of the site in the editor's workspace.
5. **Login.** Every answer `401` without the Neos backend session. An adapter outside of Neos asks the Neos API with
    the editor's cookie (the answer is the check); an adapter inside Neos (a Flow controller) gets the session when its
    controller is matched by a request pattern of the provider `Neos.Neos:Backend` (`Configuration/Settings.yaml` of
    this package does that for `ApiController`), and reads the site node in the editor's workspace itself.
6. **Point the interface to it:** `adapter` of the `frontendConfiguration` `Devclaim.NeosStyleguide` of the Neos UI
    (`Configuration/Settings.yaml`), then check it.

An adapter in PHP (CPX, Fusion) is a Flow package with a controller for the adapter API and the preview, like
Devclaim.NeosStyleguide.Adapter.CPX: it reads the theme and checks overrides with the classes of this package
(`Devclaim\NeosStyleguide\Tokens\Theme`, setting `Devclaim.NeosStyleguide.theme.stylesheets`), takes the sites of the
editor from `Devclaim\NeosStyleguide\Application\Sites`, and renders an entry with the props and the tokens of the site
in the same `<head>` as the website. Its controller needs a request pattern of `Neos.Neos:Backend` and a privilege for
its actions (Neos denies all controller actions that are not granted); it answers `401` itself without a session. The
interface does not change.

## Checking an adapter

`Benchmarks/browser/styleguide-protocol.mjs` checks an adapter against this protocol (the API, and a preview: same
origin, root element, tokens as custom properties, the grid):
`node browser/styleguide-protocol.mjs <origin> [<adapter base URL>]` inside the DDEV web container.

`Benchmarks/browser/styleguide.mjs` checks the whole styleguide in the content module with the adapter configured
there: open it, search, change a token (the draft in the previews and the canvas, an invalid value, saving into the
workspace), and discard the change with the Neos UI.

## Versioning

A change an existing interface or adapter cannot handle (a removed or renamed field, a changed meaning) raises
`protocol`. New optional fields do not: both sides ignore what they do not know.

Version 2 removed the messages between the interface and the preview of version 1 (`styleguide:tokens`, `…:grid`,
`…:ready`, `…:size`, `…:usedTokens`): the interface does all of it on the document itself, so an adapter needs no
script.
