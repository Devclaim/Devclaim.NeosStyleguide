# Devclaim.NeosStyleguide

A styleguide in the Neos content module, for any frontend. "Styleguide" in the top bar shows the components of the
website with their use cases, in the design of the site, and lets editors change the site's design tokens (colors,
fonts, sizes …) right next to them. Changes save themselves into the editor's workspace like an inline edit;
publishing and discarding stay Neos' own workflow.

The styleguide knows nothing about the frontend: an **adapter** renders the previews and knows the design tokens, the
styleguide talks to it through a small protocol ([PROTOCOL.md](PROTOCOL.md)).

## What it brings

- the styleguide in the content module (a Neos UI plugin): elements with use cases, prop editors, viewports, the page
    grid, a search; the tokens by kind with editors for colors, fonts and sizes, a live draft in every preview
- the design tokens of a site: the property `designTokens` of the site node (a mixin, one value for all languages)
- fonts per site: font files uploaded to the media module (asset collection "Schriften", one file per style, e.g.
    `Inter-SemiBoldItalic.woff2`); the styleguide offers them next to the system fonts
- an API for adapters (`/api/styleguide/v1/sites`, `/fonts`), for logged-in editors only

## Installation

```bash
composer require devclaim/neos-styleguide
```

Requires Neos 9.2 and [PackageFactory.OPGM](https://codeberg.org/PackageFactory/opgm) (node types as PHP classes).
From GitHub: add `{"type": "vcs", "url": "https://github.com/Devclaim/Devclaim.NeosStyleguide"}` to the
`repositories` of the project's `composer.json`.

## Setup

1. **The tokens:** give the site node type the mixin:

    ```php
    final readonly class HomePage extends Document implements Site, DesignTokensMixin
    {
        use DesignTokensProperties;
    }
    ```

2. **The adapter:** install one for the frontend and point the styleguide to it (default `/neos/styleguide/api/v1`):

    ```yaml
    Neos:
        Neos:
            Ui:
                frontendConfiguration:
                    'Devclaim.NeosStyleguide':
                        adapter: '/neos/styleguide/api/v1'
    ```

    The adapter and its previews must be on the host of the Neos backend.

3. **The pages of the website** apply the tokens and fonts of their site: the token overrides as `:root` custom
    properties after the stylesheet, the `@font-face` rules of the uploaded fonts in the `<head>`. A site rendered by
    Neos (CPX, Fusion) names its stylesheets in `Devclaim.NeosStyleguide.theme.stylesheets` and prints
    `Theme::styleElement($siteNode->getProperty('designTokens'))` and `FontLibrary::css()` (Fusion:
    `NeosStyleguide.Tokens.styleElement(...)`, `NeosStyleguide.Fonts.css()`); the same rules check the overrides as in the
    styleguide.

Fonts: upload them in the media module, or import a directory with `./flow fonts:import <path>`; `./flow fonts:list`
shows what the styleguide reads from the file names.

## Adapters

| Adapter | Frontend |
| --- | --- |
| [Devclaim.NeosStyleguide.Adapter.Svelte](https://github.com/Devclaim/Devclaim.NeosStyleguide.Adapter.Svelte) (npm `@devclaim/neos-styleguide-adapter-svelte`) | SvelteKit (headless) |
| [Devclaim.NeosStyleguide.Adapter.CPX](https://github.com/Devclaim/Devclaim.NeosStyleguide.Adapter.CPX) | CPX components, inside Neos |

Another frontend: implement [PROTOCOL.md](PROTOCOL.md), see its "Writing an adapter".

## Development

The plugin is a separate yarn project in `Resources/Private/JavaScript`; its build (`Resources/Public/NeosUi`) is
committed.

```bash
yarn install && yarn check && yarn build
```

## License

GPL-3.0-or-later
