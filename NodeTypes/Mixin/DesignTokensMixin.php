<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\NodeTypes\Mixin;

use Neos\ContentRepository\Core\Feature\NodeModification\Dto\PropertyScope;
use PackageFactory\OPGM\Domain\NodeType\NodeTypeDeclaration;
use PackageFactory\OPGM\Domain\Property\PropertyScopeDeclaration;
use PackageFactory\OPGM\NeosAdapter\PropertyDeclaration\PropertyUiConfiguration;

/**
 * The design tokens of the site that differ from the defaults of the frontend (its theme, read by the adapter): one CSS
 * custom property per line, e.g. "--color-brand: #e5007d;". For the site node type of a site package. One value for
 * all languages, not in the inspector: the styleguide edits it ("Styleguide" in the top bar of the content module). The adapter of the frontend only takes tokens it knows (PROTOCOL.md, tokens/validate).
 * No reloadPageIfChanged: the styleguide saves while the editor types and reloads the page itself when it closes.
 */
#[NodeTypeDeclaration]
interface DesignTokensMixin
{
    #[PropertyUiConfiguration(
        label: 'Design-Tokens',
    )]
    #[PropertyScopeDeclaration(scope: PropertyScope::SCOPE_NODE_AGGREGATE)]
    public ?string $designTokens {get;}
}
