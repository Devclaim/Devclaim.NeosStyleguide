# Devclaim.NeosStyleguide

The styleguide in the Neos content module: the components of the frontend with their use cases and the design tokens
of the site. "Styleguide" in the top bar opens it on any page, below the top bar (over the page tree, the canvas and the
inspector). Changes of tokens save themselves into the editor's workspace, like an inline edit; publishing and
discarding them is Neos' own workflow (the top bar, the workspace module).

- **The tokens** are the property `designTokens` of the site node: a site package gives its site node type the mixin
    of this package (`NodeTypes/Mixin/DesignTokensMixin.php`, OPGM; one value for all languages, not in the
    inspector).
- **The design panel** (right, where the inspector would be) shows the editor of the token selected in the
    styleguide (color picker and palette, font stacks, text), or every token by kind with a search: any token can be
    changed next to the elements. A change is a draft first (the previews show it at once); after a pause the adapter
    checks it and, when every value is valid, it is saved with the Neos UI's own change (`Neos.Neos.Ui:Property`, as
    inline editing does). The publish counter of the top bar counts it. "Diese Seite veröffentlichen" contains it
    only on the home page; "Alle veröffentlichen" and the workspace module always.
- **The search** (the navigation, left) finds elements and tokens at once: by title, id, use case and prop set, by
    token name and group. A token opens its kind and its editor.
- **The view** is a container of the Neos UI (`Modals/Devclaim.NeosStyleguide/View`), the button one of its top bar
    (`PrimaryToolbar/Right`).
- **Who may change tokens:** whoever may edit that property of the home page (Neos' node privileges).
- `ApiController` (`GET /api/styleguide/v1/sites`, backend login): the sites with languages and design tokens
    from the editor's workspace. The adapter calls it for the previews, with the editor's session (privilege
    `Devclaim.NeosStyleguide:Api`, granted to `Neos.Neos:Editor`).

The entries (YAML next to the components) and the previews are in the frontend, see Frontend/README.md "Styleguide".
How the tokens get from the CSS through Neos into the pages, and how the styleguide reads the theme and the
components: [ARCHITECTURE.md](ARCHITECTURE.md).

## Protocol

The interface talks to the frontend (the adapter) through a protocol: [PROTOCOL.md](PROTOCOL.md). The SvelteKit
frontend of this distribution implements it (`Frontend/src/routes/neos/styleguide`); the base URL of the adapter is
`adapter` of the Neos UI's `frontendConfiguration` `Devclaim.NeosStyleguide` (`Configuration/Settings.yaml`).

## Production

The SvelteKit adapter renders on request, so the styleguide needs the node server (the static build has no styleguide,
as it has no `/neos/preview`). The web server in front of Neos and the node server sends the adapter to the node
server, on the host of the Neos backend (PROTOCOL.md "Serving"):

```nginx
upstream sveltekit {
    server 127.0.0.1:3000;
}

# the Neos paths (Frontend/src/lib/neosPaths.ts) to PHP: backend, the API of this package, resources
location ~ ^/(_Resources|media|neos|api)(/|$) {
    try_files $uri $uri/ /index.php?$query_string;
}

# the adapter of the styleguide (API, previews, placeholder images) and the page in the content canvas: SvelteKit.
# ^~ and = win over the regex location above
location ^~ /neos/styleguide {
    proxy_pass http://sveltekit;
}
location = /neos/preview {
    proxy_pass http://sveltekit;
}

# in the server block, for every proxy_pass: the node server reads them (PROTOCOL_HEADER / HOST_HEADER in the start
# script of Frontend/package.json)
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
```

- The cookies pass through unchanged (nginx does that by default): the adapter asks Neos with the editor's session.
- No `proxy_cache` for these locations; their answers are `private, no-store`.
- Check it on the server: `node browser/styleguide-protocol.mjs https://<host>` and `node browser/styleguide.mjs
    https://<host>` in `Benchmarks` (with a test editor, see Benchmarks/README.md).

DDEV does the same in `.ddev/nginx_full/nginx-site.conf`.

## The interface

`Resources/Private/JavaScript`: a plugin of the Neos UI (`neos-ui/index.tsx`), with React and the components of the
Neos UI from the host (`@neos-project/neos-ui-extensibility`), in the look of the Neos backend. It reads everything
through the protocol, nothing of the frontend.

- `search.ts`: the search of the navigation and of the design panel
- `neos-ui/`: the plugin: the top bar button, the view, the design panel, their store, the Neos UI around it (the
    site node, saving: `neos.ts`), the data of the screens (saved overrides = the property in the workspace, draft =
    not saved yet)
- `screens/`: the tokens of a kind, the elements (gallery), one element (use cases, the preview at a viewport width
    with the page grid, props, the tokens it uses)
- `components/`: the navigation, the gallery, the token editor and the list of all tokens
- `draft.ts`: the draft on top of the saved overrides (checked by the adapter, what the previews get)

It is a separate yarn project; the build (`Resources/Public/NeosUi`) is committed. After a change:

```bash
yarn install && yarn check && yarn build
```

`yarn watch` rebuilds on every change.

## License

GPL-3.0-or-later
